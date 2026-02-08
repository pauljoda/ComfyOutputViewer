import express from 'express';
import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import { createHash } from 'crypto';
import { createReadStream, createWriteStream, existsSync } from 'fs';
import http from 'node:http';
import dotenv from 'dotenv';
import { WebSocketServer, WebSocket } from 'ws';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { ComfyApi } from '@saintno/comfyui-sdk';
import { createDatabase } from './db/createDatabase.js';
import { createMetadataRepository } from './db/createMetadataRepository.js';
import { ComfyRuntimeState } from './lib/ComfyRuntimeState.js';
import { ComfyWebSocketAdapter } from './sdk/ComfyWebSocketAdapter.js';
import { registerComfyRoutes } from './routes/registerComfyRoutes.js';
import { registerImageRoutes } from './routes/registerImageRoutes.js';
import { registerWorkflowRoutes } from './routes/registerWorkflowRoutes.js';

dotenv.config();

const DEFAULT_OUTPUT_DIR = '/var/lib/comfyui/output';
const DEFAULT_DATA_DIR = path.join(os.homedir(), 'comfy_viewer', 'data');
const DEFAULT_COMFY_API_URL = 'http://127.0.0.1:8188';
const IMAGE_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.gif',
  '.bmp',
  '.tiff',
  '.svg'
]);

const SOURCE_DIR = resolveDir(
  process.env.COMFY_OUTPUT_DIR || process.env.OUTPUT_DIR || DEFAULT_OUTPUT_DIR
);
const DATA_DIR = resolveDir(process.env.DATA_DIR || DEFAULT_DATA_DIR);
const COMFY_API_URL = process.env.COMFY_API_URL || DEFAULT_COMFY_API_URL;
const COMFY_CLIENT_ID =
  process.env.COMFY_CLIENT_ID || `comfy-viewer-${os.hostname()}-${process.pid}`;
const THUMB_DIR = path.join(DATA_DIR, '.thumbs');
const INPUTS_DIR = path.join(DATA_DIR, 'inputs');
const LEGACY_DB_PATH = path.join(DATA_DIR, '.comfy_viewer.json');
const DB_PATH = path.join(DATA_DIR, '.comfy_viewer.sqlite');
const THUMB_MAX = Number(process.env.THUMB_MAX || 512);
const THUMB_QUALITY = Number(process.env.THUMB_QUALITY || 72);
const SYNC_INTERVAL_MS = Number(process.env.SYNC_INTERVAL_MS || 0);
const RATING_MIN = 0;
const RATING_MAX = 5;
const MAX_INPUT_UPLOAD_BYTES = Number(process.env.MAX_INPUT_UPLOAD_BYTES || 50 * 1024 * 1024);
const QUEUE_REMAINING_OVERRIDE_TTL_MS = Number(
  process.env.QUEUE_REMAINING_OVERRIDE_TTL_MS || 10000
);

const isProd = process.env.NODE_ENV === 'production';
const port = Number(process.env.SERVER_PORT || process.env.PORT || (isProd ? 8008 : 8009));

let sharpModule;

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
const wsClients = new Set();
let comfyApi;
let comfyApiInit;
let comfyApiListenersBound = false;
const runtimeState = new ComfyRuntimeState();
let broadcastJobUpdate = () => {};

wss.on('connection', (socket) => {
  wsClients.add(socket);
  socket.on('close', () => {
    wsClients.delete(socket);
  });
});
app.use(express.json({ limit: '1mb' }));

await ensureDir(DATA_DIR);
await ensureDir(THUMB_DIR);
await ensureDir(INPUTS_DIR);
const { statements, runTransaction } = createDatabase(DB_PATH);
const metadataRepository = createMetadataRepository({
  statements,
  runTransaction,
  fs,
  existsSync,
  legacyDbPath: LEGACY_DB_PATH,
  ratingMin: RATING_MIN,
  ratingMax: RATING_MAX
});
const {
  loadMetadata,
  setFavorite,
  setHidden,
  setRating,
  setBulkFavorite,
  setBulkHidden,
  setBulkRating,
  setTagsForPath,
  setBulkTags,
  addHashToBlacklist,
  isHashBlacklisted,
  migrateLegacyDb,
  normalizeTags,
  normalizeRating
} = metadataRepository;
await migrateLegacyDb();

function getComfyApi() {
  if (!comfyApi) {
    comfyApi = new ComfyApi(COMFY_API_URL, COMFY_CLIENT_ID, {
      forceWs: false,
      customWebSocketImpl: ComfyWebSocketAdapter
    });
    bindComfyApiListeners(comfyApi);
    comfyApiInit = Promise.resolve(comfyApi.init?.() ?? comfyApi)
      .then((api) => (api.waitForReady ? api.waitForReady() : api))
      .catch((err) => {
        comfyApiInit = null;
        throw err;
      });
  }
  return comfyApi;
}

async function getComfyApiReady() {
  const api = getComfyApi();
  if (comfyApiInit) {
    await comfyApiInit;
  }
  await ensureComfyWsReady(api);
  return api;
}

function ensureOverallEntry(jobId, workflowId) {
  if (!jobId || !workflowId) return null;
  if (runtimeState.jobOverallById.has(jobId)) return runtimeState.jobOverallById.get(jobId);
  const workflowRow = statements.selectWorkflowById.get(workflowId);
  if (!workflowRow) return null;
  try {
    const promptJson = JSON.parse(workflowRow.api_json);
    const totalNodes = promptJson && typeof promptJson === 'object' ? Object.keys(promptJson).length : 0;
    const entry = {
      totalNodes,
      executedNodes: new Set(),
      updatedAt: Date.now()
    };
    runtimeState.jobOverallById.set(jobId, entry);
    return entry;
  } catch (err) {
    console.warn('Failed to parse workflow JSON for overall progress:', err);
    return null;
  }
}

function bindComfyApiListeners(api) {
  if (comfyApiListenersBound) return;
  comfyApiListenersBound = true;
  api.on('progress', (event) => {
    if (event?.detail?.prompt_id) {
      runtimeState.lastActivePromptId = event.detail.prompt_id;
    }
    runtimeState.comfyEventStats.lastEventAt = Date.now();
    runtimeState.comfyEventStats.lastEventType = 'progress';
    runtimeState.comfyEventStats.lastProgressAt = runtimeState.comfyEventStats.lastEventAt;
    runtimeState.comfyEventStats.counts.progress += 1;
    handleComfyProgress(event.detail);
  });
  api.on('all', (event) => {
    runtimeState.comfyEventStats.lastEventAt = Date.now();
    runtimeState.comfyEventStats.lastEventType = event?.detail?.type || 'all';
    runtimeState.comfyEventStats.counts.all += 1;
  });
  api.on('executing', (event) => {
    if (event?.detail?.prompt_id) {
      runtimeState.lastActivePromptId = event.detail.prompt_id;
      runtimeState.currentExecutingPromptId = event.detail.prompt_id;
      runtimeState.comfyEventStats.lastEventAt = Date.now();
      runtimeState.comfyEventStats.lastEventType = 'executing';
      runtimeState.comfyEventStats.lastExecutingAt = runtimeState.comfyEventStats.lastEventAt;
      runtimeState.comfyEventStats.counts.executing += 1;
      const jobId = getJobIdForPrompt(event.detail.prompt_id);
      if (jobId) {
        const now = Date.now();
        const existing = runtimeState.jobProgressById.get(jobId);
        runtimeState.jobProgressById.set(jobId, {
          value: existing?.value ?? 0,
          max: existing?.max ?? 0,
          node: event.detail.node ?? existing?.node ?? null,
          updatedAt: now
        });
        const overall = runtimeState.jobOverallById.get(jobId);
        if (overall) {
          overall.updatedAt = now;
        }
        const jobRow = statements.selectJobById.get(jobId);
        if (jobRow && (jobRow.status === 'pending' || jobRow.status === 'queued')) {
          const startedAt = jobRow.started_at ?? now;
          statements.updateJobStatus.run('running', null, startedAt, jobRow.completed_at ?? null, jobId);
        }
        broadcastJobUpdate(jobId);
      }
    }
  });
  api.on('executed', (event) => {
    if (!event?.detail?.prompt_id || !event?.detail?.node) return;
    const jobId = getJobIdForPrompt(event.detail.prompt_id);
    if (!jobId) return;
    const overall = runtimeState.jobOverallById.get(jobId);
    if (!overall) return;
    overall.executedNodes.add(String(event.detail.node));
    overall.updatedAt = Date.now();
    broadcastJobUpdate(jobId);
  });
  api.on('execution_cached', (event) => {
    if (!event?.detail?.prompt_id || !Array.isArray(event?.detail?.nodes)) return;
    const jobId = getJobIdForPrompt(event.detail.prompt_id);
    if (!jobId) return;
    const overall = runtimeState.jobOverallById.get(jobId);
    if (!overall) return;
    event.detail.nodes.forEach((node) => {
      if (node !== undefined && node !== null) {
        overall.executedNodes.add(String(node));
      }
    });
    overall.updatedAt = Date.now();
    broadcastJobUpdate(jobId);
  });
  api.on('execution_success', (event) => {
    if (event?.detail?.prompt_id && runtimeState.currentExecutingPromptId === event.detail.prompt_id) {
      runtimeState.currentExecutingPromptId = null;
    }
    if (event?.detail?.prompt_id) {
      finalizeJobFromPrompt(event.detail.prompt_id);
    }
  });
  api.on('execution_error', (event) => {
    if (event?.detail?.prompt_id && runtimeState.currentExecutingPromptId === event.detail.prompt_id) {
      runtimeState.currentExecutingPromptId = null;
    }
    if (event?.detail?.prompt_id) {
      const errorMessage =
        event?.detail?.exception_message ||
        event?.detail?.exception_type ||
        'Execution failed';
      finalizeJobFromPrompt(event.detail.prompt_id, { errorMessage });
    }
  });
  api.on('execution_interrupted', (event) => {
    if (event?.detail?.prompt_id && runtimeState.currentExecutingPromptId === event.detail.prompt_id) {
      runtimeState.currentExecutingPromptId = null;
    }
    if (event?.detail?.prompt_id) {
      finalizeJobFromPrompt(event.detail.prompt_id, { errorMessage: 'Execution interrupted' });
    }
  });
  api.on('status', (event) => {
    const remaining = event?.detail?.status?.exec_info?.queue_remaining;
    if (Number.isFinite(remaining)) {
      runtimeState.queueRemainingOverride = remaining;
      runtimeState.queueRemainingOverrideUpdatedAt = Date.now();
      runtimeState.queueState.remaining = remaining;
    }
    runtimeState.comfyEventStats.lastEventAt = Date.now();
    runtimeState.comfyEventStats.lastEventType = 'status';
    runtimeState.comfyEventStats.counts.status += 1;
    if (event?.detail?.sid) {
      const sid = event.detail.sid;
      if (runtimeState.comfyWsConnected && runtimeState.comfyWsConnectedId && runtimeState.comfyWsConnectedId !== sid && !runtimeState.comfyWsReconnectPending) {
        runtimeState.comfyWsReconnectPending = true;
        setTimeout(() => {
          try {
            api.reconnectWs(true);
          } catch (err) {
            console.warn('Failed to reconnect ComfyUI websocket for sid update:', err);
            runtimeState.comfyWsReconnectPending = false;
          }
        }, 0);
      }
    }
  });
  api.on('b_preview', (event) => {
    runtimeState.comfyEventStats.lastEventAt = Date.now();
    runtimeState.comfyEventStats.lastEventType = 'preview';
    runtimeState.comfyEventStats.lastPreviewAt = runtimeState.comfyEventStats.lastEventAt;
    runtimeState.comfyEventStats.counts.preview += 1;
    handleComfyPreview(event.detail).catch((err) => {
      console.warn('Failed to handle ComfyUI preview frame:', err);
    });
  });
  api.on('connected', () => {
    runtimeState.comfyWsConnected = true;
    runtimeState.comfyWsConnectedId = api.id;
    runtimeState.comfyWsReconnectPending = false;
  });
  api.on('reconnected', () => {
    runtimeState.comfyWsConnected = true;
    runtimeState.comfyWsConnectedId = api.id;
    runtimeState.comfyWsReconnectPending = false;
  });
  api.on('disconnected', () => {
    runtimeState.comfyWsConnected = false;
  });
  startQueuePolling();
}

async function ensureComfyWsReady(api) {
  const socketClient = api?.socket?.client;
  const isOpen = socketClient && socketClient.readyState === ComfyWebSocketAdapter.OPEN;
  if (runtimeState.comfyWsConnected && isOpen) return;

  if (!isOpen) {
    try {
      api.reconnectWs(true);
    } catch (err) {
      console.warn('Failed to trigger ComfyUI websocket reconnect:', err);
    }
  }

  await new Promise((resolve) => {
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve(null);
    }, 4000);

    const stop = api.on('connected', () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      stop?.();
      resolve(null);
    });

    const stopReconnected = api.on('reconnected', () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      stop?.();
      stopReconnected?.();
      resolve(null);
    });

    if (isOpen) {
      settled = true;
      clearTimeout(timeout);
      stop?.();
      stopReconnected?.();
      resolve(null);
    }
  });
}

function isGeneratingStatus(status) {
  return status === 'pending' || status === 'queued' || status === 'running';
}

function getJobIdForPrompt(promptId) {
  if (!promptId) return null;
  if (runtimeState.promptJobIdByPromptId.has(promptId)) {
    const cachedJobId = runtimeState.promptJobIdByPromptId.get(promptId);
    const cachedRow = statements.selectJobById.get(cachedJobId);
    if (cachedRow && cachedRow.prompt_id === promptId) {
      return cachedJobId;
    }
    runtimeState.promptJobIdByPromptId.delete(promptId);
  }
  const row = statements.selectJobByPromptId.get(promptId);
  if (row) {
    runtimeState.promptJobIdByPromptId.set(promptId, row.id);
    return row.id;
  }
  return null;
}

function handleComfyProgress(progress) {
  if (!progress || !progress.prompt_id) return;
  runtimeState.comfyEventStats.lastProgressRaw = progress;
  const jobId = getJobIdForPrompt(progress.prompt_id);
  if (!jobId) return;
  const now = Date.now();
  const rawValue = Number(progress.value);
  const rawMax = Number(progress.max);
  const value = Number.isFinite(rawValue) ? rawValue : 0;
  const max = Number.isFinite(rawMax) ? rawMax : 0;
  const node = progress.node ?? null;
  const existing = runtimeState.jobProgressById.get(jobId);
  if (
    existing &&
    existing.value === value &&
    existing.max === max &&
    existing.node === node &&
    now - existing.updatedAt < 400
  ) {
    return;
  }
  runtimeState.jobProgressById.set(jobId, { value, max, node, updatedAt: now });
  runtimeState.comfyEventStats.lastProgress = { value, max, node, updatedAt: now };

  const jobRow = statements.selectJobById.get(jobId);
  if (jobRow && (jobRow.status === 'pending' || jobRow.status === 'queued')) {
    const startedAt = jobRow.started_at ?? now;
    statements.updateJobStatus.run('running', null, startedAt, jobRow.completed_at ?? null, jobId);
  }
  broadcastJobUpdate(jobId);
}

function clearJobTransient(jobId) {
  runtimeState.clearJobTransient(jobId);
}

async function handleComfyPreview(blob) {
  if (!blob || typeof blob.arrayBuffer !== 'function') return;
  const promptId = runtimeState.currentExecutingPromptId || runtimeState.lastActivePromptId;
  if (!promptId) return;
  const jobId = getJobIdForPrompt(promptId);
  if (!jobId) return;
  const now = Date.now();
  const existing = runtimeState.jobPreviewById.get(jobId);
  if (existing && now - existing.updatedAt < 500) {
    return;
  }
  const buffer = Buffer.from(await blob.arrayBuffer());
  const type = blob.type || 'image/jpeg';
  const dataUrl = `data:${type};base64,${buffer.toString('base64')}`;
  runtimeState.jobPreviewById.set(jobId, { url: dataUrl, updatedAt: now });
  runtimeState.comfyEventStats.lastPreviewAt = now;
  broadcastJobUpdate(jobId);
}

async function finalizeJobFromPrompt(promptId, options = {}) {
  if (!promptId) return;
  if (runtimeState.promptFinalizeInFlight.has(promptId)) return;
  runtimeState.promptFinalizeInFlight.add(promptId);
  try {
    const jobRow = statements.selectJobByPromptId.get(promptId);
    if (!jobRow) return;
    if (jobRow.status === 'completed' || jobRow.status === 'error' || jobRow.status === 'cancelled') {
      return;
    }

    const jobId = jobRow.id;
    const now = Date.now();
    const workflowInputs = [];
    for (const row of statements.selectWorkflowInputs.iterate(jobRow.workflow_id)) {
      workflowInputs.push(row);
    }
    const inputValuesMap = new Map();
    for (const inputRow of statements.selectJobInputs.iterate(jobId)) {
      inputValuesMap.set(inputRow.input_id, inputRow.value);
    }

    if (options.errorMessage) {
      statements.updateJobStatus.run('error', options.errorMessage, null, now, jobId);
      clearJobTransient(jobId);
      broadcastJobUpdate(jobId);
      return;
    }

    const promptHistory = await fetchPromptHistory(promptId, { allowFallback: true });
    const statusStr = promptHistory?.status?.status_str;
    if (statusStr === 'error') {
      const errorMsg = promptHistory?.status?.messages?.[0]?.[1] || 'Unknown error';
      statements.updateJobStatus.run('error', errorMsg, null, now, jobId);
      clearJobTransient(jobId);
      broadcastJobUpdate(jobId);
      return;
    }

    let imageOutputs = collectImageOutputs(promptHistory?.outputs || {});
    if (imageOutputs.length === 0) {
      imageOutputs = await fetchImageOutputsWithRetry(promptId, 3, 1000);
    }

    if (imageOutputs.length === 0) {
      scheduleOutputRecovery(jobId, promptId, workflowInputs, inputValuesMap, jobRow.workflow_id);
    } else {
      await downloadAndRecordOutputs(
        jobId,
        imageOutputs,
        workflowInputs,
        inputValuesMap,
        jobRow.workflow_id,
        now
      );
    }

    statements.updateJobStatus.run('completed', null, null, now, jobId);
    clearJobTransient(jobId);
    broadcastJobUpdate(jobId);
  } catch (err) {
    console.warn('Failed to finalize job from ComfyUI event:', err);
  } finally {
    runtimeState.promptFinalizeInFlight.delete(promptId);
  }
}

function getPromptIdFromQueueItem(item) {
  if (!item) return null;
  if (typeof item === 'string') return item;
  if (Array.isArray(item)) {
    const candidate = item[1];
    if (typeof candidate === 'string') return candidate;
    for (const entry of item) {
      const nested = getPromptIdFromQueueItem(entry);
      if (nested) return nested;
    }
    return null;
  }
  if (typeof item === 'object') {
    if (typeof item.prompt_id === 'string') return item.prompt_id;
    if (typeof item.promptId === 'string') return item.promptId;
    for (const value of Object.values(item)) {
      const nested = getPromptIdFromQueueItem(value);
      if (nested) return nested;
    }
  }
  return null;
}

function getQueueInfoForPrompt(promptId) {
  if (!promptId) return null;
  const runningIndex = runtimeState.queueState.running.findIndex(
    (item) => getPromptIdFromQueueItem(item) === promptId
  );
  const pendingIndex = runtimeState.queueState.pending.findIndex(
    (item) => getPromptIdFromQueueItem(item) === promptId
  );
  const runningCount = runtimeState.queueState.running.length;
  const pendingCount = runtimeState.queueState.pending.length;
  const total = runningCount + pendingCount;
  const remaining =
    Number.isFinite(runtimeState.queueState.remaining) && runtimeState.queueState.remaining !== null
      ? runtimeState.queueState.remaining
      : pendingCount;

  if (runningIndex >= 0) {
    return {
      state: 'running',
      position: runningIndex + 1,
      total,
      ahead: runningIndex,
      remaining,
      updatedAt: runtimeState.queueState.updatedAt
    };
  }

  if (pendingIndex >= 0) {
    const position = runningCount + pendingIndex + 1;
    return {
      state: 'queued',
      position,
      total,
      ahead: position - 1,
      remaining,
      updatedAt: runtimeState.queueState.updatedAt
    };
  }

  if (total > 0) {
    return {
      state: 'unknown',
      position: null,
      total,
      ahead: null,
      remaining,
      updatedAt: runtimeState.queueState.updatedAt
    };
  }

  return null;
}

async function refreshQueueState() {
  const api = await getComfyApiReady();
  const queue = await api.getQueue();
  const running = Array.isArray(queue?.queue_running) ? queue.queue_running : [];
  const pending = Array.isArray(queue?.queue_pending) ? queue.queue_pending : [];
  const now = Date.now();
  if (
    Number.isFinite(runtimeState.queueRemainingOverride) &&
    runtimeState.queueRemainingOverrideUpdatedAt > 0 &&
    now - runtimeState.queueRemainingOverrideUpdatedAt > QUEUE_REMAINING_OVERRIDE_TTL_MS
  ) {
    runtimeState.queueRemainingOverride = null;
    runtimeState.queueRemainingOverrideUpdatedAt = 0;
  }
  const signature = JSON.stringify({
    running: running.map(getPromptIdFromQueueItem),
    pending: pending.map(getPromptIdFromQueueItem),
    remaining: runtimeState.queueRemainingOverride
  });
  const changed = signature !== runtimeState.queueState.signature;
  runtimeState.queueState.running = running;
  runtimeState.queueState.pending = pending;
  runtimeState.queueState.updatedAt = now;
  runtimeState.queueState.signature = signature;
  if (Number.isFinite(runtimeState.queueRemainingOverride)) {
    runtimeState.queueState.remaining = runtimeState.queueRemainingOverride;
  } else {
    runtimeState.queueState.remaining = pending.length;
  }
  return changed;
}

function broadcastGeneratingJobs() {
  for (const row of statements.selectGeneratingJobs.iterate()) {
    broadcastJobUpdate(row.id);
  }
}

function startQueuePolling() {
  if (runtimeState.queuePollTimer) return;
  refreshQueueState()
    .then((changed) => {
      if (changed) {
        broadcastGeneratingJobs();
      }
    })
    .catch((err) => {
      console.warn('Failed to refresh ComfyUI queue:', err);
    });
  runtimeState.queuePollTimer = setInterval(() => {
    refreshQueueState()
      .then((changed) => {
        if (changed) {
          broadcastGeneratingJobs();
        }
      })
      .catch((err) => {
        console.warn('Failed to refresh ComfyUI queue:', err);
      });
  }, 2000);
}

async function resumeGeneratingJobs() {
  if (runtimeState.resumeJobsPromise) return runtimeState.resumeJobsPromise;
  runtimeState.resumeJobsPromise = (async () => {
    const generatingJobs = [];
    for (const row of statements.selectGeneratingJobDetails.iterate()) {
      generatingJobs.push(row);
    }
    if (generatingJobs.length === 0) return;

    try {
      await getComfyApiReady();
      await refreshQueueState();
    } catch (err) {
      console.warn('Failed to resume ComfyUI queue state:', err);
    }

    const runningIds = new Set(runtimeState.queueState.running.map(getPromptIdFromQueueItem).filter(Boolean));
    const pendingIds = new Set(runtimeState.queueState.pending.map(getPromptIdFromQueueItem).filter(Boolean));
    if (runningIds.size > 0) {
      runtimeState.currentExecutingPromptId = Array.from(runningIds)[0];
      runtimeState.lastActivePromptId = runtimeState.currentExecutingPromptId;
    }

    for (const jobRow of generatingJobs) {
      const promptId = jobRow.prompt_id;
      if (!promptId) {
        const errorMessage = 'Server restarted before prompt was queued.';
        statements.updateJobStatus.run('error', errorMessage, null, Date.now(), jobRow.id);
        broadcastJobUpdate(jobRow.id);
        continue;
      }

      runtimeState.promptJobIdByPromptId.set(promptId, jobRow.id);
      ensureOverallEntry(jobRow.id, jobRow.workflow_id);

      if (runningIds.has(promptId)) {
        const startedAt = jobRow.started_at ?? Date.now();
        statements.updateJobStatus.run('running', null, startedAt, null, jobRow.id);
      } else if (pendingIds.has(promptId)) {
        const startedAt = jobRow.started_at ?? null;
        statements.updateJobStatus.run('queued', null, startedAt, null, jobRow.id);
      }

      const workflowInputs = [];
      for (const row of statements.selectWorkflowInputs.iterate(jobRow.workflow_id)) {
        workflowInputs.push(row);
      }
      const inputValuesMap = new Map();
      for (const inputRow of statements.selectJobInputs.iterate(jobRow.id)) {
        inputValuesMap.set(inputRow.input_id, inputRow.value);
      }

      pollJobCompletion(jobRow.id, promptId, workflowInputs, inputValuesMap, jobRow.workflow_id);
      broadcastJobUpdate(jobRow.id);
    }
  })();
  return runtimeState.resumeJobsPromise;
}

async function fetchPromptHistory(promptId, { allowFallback = false } = {}) {
  const api = await getComfyApiReady();
  try {
    const entry = await api.getHistory(promptId);
    if (entry) return entry;
  } catch (err) {
    console.warn('Failed to fetch ComfyUI history entry:', err);
  }
  if (!allowFallback) return null;
  try {
    const histories = await api.getHistories();
    return histories?.[promptId] ?? null;
  } catch (err) {
    console.warn('Failed to fetch ComfyUI histories:', err);
  }
  return null;
}

async function fetchComfyImageBuffer(imageInfo) {
  const api = await getComfyApiReady();
  const blob = await api.getImage(imageInfo);
  const arrayBuffer = await blob.arrayBuffer();
  return Buffer.from(arrayBuffer);
}


registerImageRoutes(app, {
  express,
  DATA_DIR,
  SOURCE_DIR,
  statements,
  path,
  fs,
  createHash,
  Transform,
  pipeline,
  createWriteStream,
  existsSync,
  MAX_INPUT_UPLOAD_BYTES,
  INPUTS_DIR,
  loadMetadata,
  listImages,
  setFavorite,
  setBulkFavorite,
  setHidden,
  setBulkHidden,
  setRating,
  normalizeRating,
  setBulkRating,
  setTagsForPath,
  normalizeTags,
  setBulkTags,
  deleteImageByPath,
  deleteImagesByPath,
  syncSourceToData,
  buildImageItem,
  removeFileIfExists,
  findExistingInputByHash,
  resolveImageExtension
});

registerWorkflowRoutes(app, {
  statements,
  runTransaction,
  getComfyApiReady,
  getPromptIdFromQueueItem,
  clearJobTransient,
  isGeneratingStatus,
  pollJobCompletion,
  runtimeState,
  fetchImageOutputsWithRetry,
  fetchPromptHistory,
  collectImageOutputs,
  downloadAndRecordOutputs,
  ensureOverallEntry,
  getQueueInfoForPrompt,
  getThumbUrl,
  resolveDataPath,
  isHashBlacklisted,
  existsSync,
  wsClients,
  setBroadcastJobUpdate: (fn) => {
    if (typeof fn === 'function') {
      broadcastJobUpdate = fn;
    }
  }
});

registerComfyRoutes(app, {
  path,
  runtimeState,
  getComfyApi,
  getComfyApiReady,
  getPromptIdFromQueueItem,
  getJobIdForPrompt
});


function collectImageOutputs(outputs) {
  const imageOutputs = [];
  if (!outputs || typeof outputs !== 'object') return imageOutputs;
  for (const nodeOutput of Object.values(outputs)) {
    if (!nodeOutput || !Array.isArray(nodeOutput.images)) continue;
    for (const img of nodeOutput.images) {
      if (!img || typeof img !== 'object') continue;
      imageOutputs.push({
        filename: img.filename,
        subfolder: img.subfolder || '',
        type: img.type || 'output'
      });
    }
  }
  return imageOutputs;
}

async function fetchImageOutputsWithRetry(promptId, attempts = 3, delayMs = 1000) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    await new Promise(resolve => setTimeout(resolve, delayMs));
    try {
      const promptHistory = await fetchPromptHistory(promptId);
      if (!promptHistory) continue;
      const imageOutputs = collectImageOutputs(promptHistory.outputs || {});
      if (imageOutputs.length > 0) return imageOutputs;
    } catch (err) {
      console.warn('Failed to refetch prompt history outputs:', err);
    }
  }
  return [];
}

async function downloadAndRecordOutputs(jobId, imageOutputs, workflowInputs, inputValuesMap, workflowId, now) {
  if (!Array.isArray(imageOutputs) || imageOutputs.length === 0) return 0;
  const existingOutputs = new Set();
  for (const outputRow of statements.selectJobOutputs.iterate(jobId)) {
    existingOutputs.add(outputRow.image_path);
  }
  let recorded = 0;
  const thumbnailResult = { scanned: 0, copied: 0, thumbnails: 0 };

  for (const imgInfo of imageOutputs) {
    if (!imgInfo || !imgInfo.filename) continue;
    const imagePath = imgInfo.subfolder
      ? path.join(imgInfo.subfolder, imgInfo.filename)
      : imgInfo.filename;
    if (!imagePath || existingOutputs.has(imagePath)) continue;
    const sourcePath = path.join(SOURCE_DIR, imagePath);
    const dataPath = path.join(DATA_DIR, imagePath);
    const existingPath = existsSync(dataPath) ? dataPath : existsSync(sourcePath) ? sourcePath : null;

    try {
      if (existingPath) {
        let outputHash = null;
        try {
          outputHash = await hashFile(existingPath);
        } catch (hashErr) {
          console.warn('Failed to hash existing output:', hashErr);
        }
        if (outputHash && isHashBlacklisted(outputHash)) {
          continue;
        }
        try {
          const stats = await fs.stat(existingPath);
          await ensureThumbnail(existingPath, imagePath, stats, thumbnailResult);
        } catch (thumbErr) {
          console.warn('Failed to ensure thumbnail for existing output:', thumbErr);
        }
        statements.insertJobOutput.run(jobId, imagePath, imgInfo.filename, now, outputHash);
      } else {
        const imageBuffer = await fetchComfyImageBuffer({
          filename: imgInfo.filename,
          subfolder: imgInfo.subfolder || '',
          type: imgInfo.type || 'output'
        });
        const outputHash = createHash('sha256').update(imageBuffer).digest('hex');
        let wroteToSource = false;
        let wroteToData = false;

        try {
          await ensureDir(path.dirname(sourcePath));
          await fs.writeFile(sourcePath, imageBuffer);
          wroteToSource = true;
        } catch (err) {
          try {
            await ensureDir(path.dirname(dataPath));
            await fs.writeFile(dataPath, imageBuffer);
            wroteToData = true;
            const stats = await fs.stat(dataPath);
            await ensureThumbnail(dataPath, imagePath, stats, thumbnailResult);
          } catch (innerErr) {
            console.error('Failed to save output image to data dir:', innerErr);
          }
        }

        const outputExists = wroteToSource || wroteToData || existsSync(sourcePath) || existsSync(dataPath);
        if (!outputExists) {
          continue;
        }

        statements.insertJobOutput.run(jobId, imagePath, imgInfo.filename, now, outputHash);
      }

      // Save prompt data for this image
      const inputs = workflowInputs
        .map((wi) => {
          const rawValue = inputValuesMap.get(wi.id);
          if (rawValue === undefined) return null;
          const userLabel = typeof wi.label === 'string' ? wi.label.trim() : '';
          const systemLabel = wi.input_key;
          const label = userLabel || systemLabel;
          const numericValue = Number(rawValue);
          const value =
            wi.input_type === 'number' || wi.input_type === 'seed'
              ? Number.isFinite(numericValue)
                ? numericValue
                : rawValue
              : rawValue;
          return {
            inputId: wi.id,
            label,
            systemLabel,
            inputType: wi.input_type,
            value
          };
        })
        .filter(Boolean);
      const inputJson = {};
      for (const input of inputs) {
        const hasSystemLabel =
          input.systemLabel && input.systemLabel !== input.label;
        inputJson[input.label] = hasSystemLabel
          ? { value: input.value, systemLabel: input.systemLabel }
          : input.value;
      }
      const promptData = { workflowId, inputs, inputJson };
      statements.insertImagePrompt.run(imagePath, jobId, JSON.stringify(promptData), now);

      recorded += 1;
      existingOutputs.add(imagePath);
    } catch (imgErr) {
      console.error('Failed to download image:', imgErr);
    }
  }

  await syncSourceToData();
  return recorded;
}

function scheduleOutputRecovery(jobId, promptId, workflowInputs, inputValuesMap, workflowId) {
  setTimeout(() => {
    (async () => {
      const jobRow = statements.selectJobById.get(jobId);
      if (!jobRow || jobRow.status === 'cancelled') return;
      const imageOutputs = await fetchImageOutputsWithRetry(promptId, 5, 1000);
      if (imageOutputs.length === 0) return;
      await downloadAndRecordOutputs(jobId, imageOutputs, workflowInputs, inputValuesMap, workflowId, Date.now());
      broadcastJobUpdate(jobId);
    })().catch((err) => {
      console.warn('Failed to recover job outputs:', err);
    });
  }, 2000);
}

// Poll for job completion and download images
async function pollJobCompletion(jobId, promptId, workflowInputs, inputValuesMap, workflowId) {
  const maxAttempts = 3600; // 1 hour max (for large models)
  const pollInterval = 1000; // 1 second

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise(resolve => setTimeout(resolve, pollInterval));

    const jobRow = statements.selectJobById.get(jobId);
    if (!jobRow || jobRow.status === 'cancelled') {
      return;
    }

    try {
      // Check history for this prompt
      const promptHistory = await fetchPromptHistory(promptId);
      if (!promptHistory) continue;

      // Check if execution is complete
      if (promptHistory.status && promptHistory.status.completed) {
        await finalizeJobFromPrompt(promptId);
        if (runtimeState.currentExecutingPromptId === promptId) {
          runtimeState.currentExecutingPromptId = null;
        }
        const latestJob = statements.selectJobById.get(jobId);
        const isTerminal =
          latestJob &&
          (latestJob.status === 'completed' ||
            latestJob.status === 'error' ||
            latestJob.status === 'cancelled');
        if (isTerminal) {
          setTimeout(() => {
            broadcastJobUpdate(jobId);
          }, 2000);
          return;
        }
      }

      // Update status to running if we see execution progress
      if (promptHistory.status?.status_str === 'running') {
        const job = statements.selectJobById.get(jobId);
        if (job && job.status !== 'running') {
          const startedAt = job.started_at ?? Date.now();
          statements.updateJobStatus.run('running', null, startedAt, null, jobId);
          broadcastJobUpdate(jobId);
        }
      }

    } catch (err) {
      console.error('Poll error:', err);
    }
  }

  // Timeout
  statements.updateJobStatus.run('error', 'Job timed out', null, Date.now(), jobId);
  clearJobTransient(jobId);
  if (runtimeState.currentExecutingPromptId === promptId) {
    runtimeState.currentExecutingPromptId = null;
  }
  broadcastJobUpdate(jobId);
}

if (isProd) {
  const distPath = path.join(process.cwd(), 'dist');
  if (existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }
}

await syncSourceToData();
resumeGeneratingJobs().catch((err) => {
  console.warn('Failed to resume in-progress jobs:', err);
});

if (Number.isFinite(SYNC_INTERVAL_MS) && SYNC_INTERVAL_MS > 0) {
  setInterval(() => {
    syncSourceToData().catch((err) => {
      console.error('Auto-sync failed:', err);
    });
  }, SYNC_INTERVAL_MS);
}

server.listen(port, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${port}`);
  console.log(`Source dir: ${SOURCE_DIR}`);
  console.log(`Data dir: ${DATA_DIR}`);
});

function resolveDir(input) {
  if (!input) return input;
  if (input.startsWith('~')) {
    return path.join(os.homedir(), input.slice(1));
  }
  return input;
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

function isImageFile(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  return IMAGE_EXTENSIONS.has(ext);
}

function resolveImageExtension(originalName, contentType) {
  const ext = path.extname(originalName || '').toLowerCase();
  if (IMAGE_EXTENSIONS.has(ext)) return ext;
  const type = (contentType || '').split(';')[0].trim().toLowerCase();
  switch (type) {
    case 'image/jpeg':
    case 'image/jpg':
      return '.jpg';
    case 'image/png':
      return '.png';
    case 'image/webp':
      return '.webp';
    case 'image/gif':
      return '.gif';
    case 'image/bmp':
      return '.bmp';
    case 'image/tiff':
      return '.tiff';
    case 'image/svg+xml':
      return '.svg';
    default:
      return '';
  }
}

async function findExistingInputByHash(hash) {
  try {
    const entries = await fs.readdir(INPUTS_DIR, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (!entry.name.startsWith(`${hash}.`)) continue;
      if (!isImageFile(entry.name)) continue;
      return entry.name;
    }
  } catch (err) {
    if (err && err.code === 'ENOENT') return null;
    throw err;
  }
  return null;
}

async function listImages(root, metadata) {
  const images = [];

  if (!existsSync(root)) {
    return { images };
  }

  await walkDir(root, '', images, metadata);

  return { images };
}

async function walkDir(currentDir, relDir, images, metadata) {
  const entries = await fs.readdir(currentDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === '.comfy_viewer.json' || entry.name === '.comfy_viewer.sqlite') continue;
    if (entry.isDirectory() && entry.name === '.thumbs') continue;
    const entryPath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      const nextRel = relDir ? `${relDir}/${entry.name}` : entry.name;
      await walkDir(entryPath, nextRel, images, metadata);
    } else if (entry.isFile() && isImageFile(entry.name)) {
      const relPath = relDir ? `${relDir}/${entry.name}` : entry.name;
      const thumbUrl = getThumbUrl(relPath);
      const stats = await fs.stat(entryPath);
      const createdMs = Number.isFinite(stats.birthtimeMs) && stats.birthtimeMs > 0
        ? stats.birthtimeMs
        : Number.isFinite(stats.ctimeMs) && stats.ctimeMs > 0
          ? stats.ctimeMs
          : stats.mtimeMs;
      images.push({
        id: relPath,
        name: entry.name,
        url: `/images/${encodeURI(relPath)}`,
        thumbUrl,
        favorite: metadata.favorites.has(relPath),
        hidden: metadata.hidden.has(relPath),
        rating: metadata.ratings.get(relPath) ?? 0,
        tags: metadata.tagsByPath.get(relPath) || [],
        createdMs,
        mtimeMs: stats.mtimeMs,
        size: stats.size
      });
    }
  }
}

function getThumbUrl(relPath) {
  const thumbRel = `${relPath}.jpg`;
  const thumbPath = path.join(THUMB_DIR, thumbRel);
  return existsSync(thumbPath) ? `/images/.thumbs/${encodeURI(thumbRel)}` : undefined;
}

async function buildImageItem(relPath, metadata) {
  const fullPath = resolveDataPath(relPath);
  if (!existsSync(fullPath)) return null;
  const stats = await fs.stat(fullPath);
  const createdMs = Number.isFinite(stats.birthtimeMs) && stats.birthtimeMs > 0
    ? stats.birthtimeMs
    : Number.isFinite(stats.ctimeMs) && stats.ctimeMs > 0
      ? stats.ctimeMs
      : stats.mtimeMs;
  return {
    id: relPath,
    name: path.basename(relPath),
    url: `/images/${encodeURI(relPath)}`,
    thumbUrl: getThumbUrl(relPath),
    favorite: metadata.favorites.has(relPath),
    hidden: metadata.hidden.has(relPath),
    rating: metadata.ratings.get(relPath) ?? 0,
    tags: metadata.tagsByPath.get(relPath) || [],
    createdMs,
    mtimeMs: stats.mtimeMs,
    size: stats.size
  };
}

function resolvePathWithinRoot(rootDir, relPath) {
  const resolved = path.resolve(rootDir, relPath);
  const relative = path.relative(rootDir, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Invalid path');
  }
  return resolved;
}

function resolveDataPath(relPath) {
  return resolvePathWithinRoot(DATA_DIR, relPath);
}

function resolveSourcePath(relPath) {
  return resolvePathWithinRoot(SOURCE_DIR, relPath);
}

async function removeFileIfExists(filePath) {
  try {
    await fs.unlink(filePath);
  } catch (err) {
    if (err && err.code === 'ENOENT') return;
    throw err;
  }
}

async function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

async function deleteImageByPath(relPath) {
  const outcome = await deleteSingleImage(relPath);
  return {
    ok: true,
    deleted: outcome.deleted ? 1 : 0,
    blacklisted: outcome.blacklisted ? 1 : 0
  };
}

async function deleteImagesByPath(paths) {
  const results = [];
  for (const relPath of paths) {
    if (typeof relPath !== 'string' || !relPath) continue;
    const outcome = await deleteSingleImage(relPath);
    results.push(outcome);
  }
  const deleted = results.filter((entry) => entry.deleted).length;
  const blacklisted = results.filter((entry) => entry.blacklisted).length;
  return { ok: true, deleted, blacklisted };
}

async function deleteSingleImage(relPath) {
  const dataPath = resolveDataPath(relPath);
  const thumbPath = path.join(THUMB_DIR, `${relPath}.jpg`);
  let hash;
  if (existsSync(dataPath)) {
    hash = await hashFile(dataPath);
  } else {
    const sourcePath = resolveSourcePath(relPath);
    if (existsSync(sourcePath)) {
      hash = await hashFile(sourcePath);
    }
  }
  await removeFileIfExists(dataPath);
  await removeFileIfExists(thumbPath);
  if (hash) {
    addHashToBlacklist(hash);
  }
  statements.deleteTagsByPath.run(relPath);
  statements.deleteMeta.run(relPath);
  return { ok: true, deleted: true, blacklisted: Boolean(hash) };
}

async function syncSourceToData() {
  const result = { scanned: 0, copied: 0, thumbnails: 0 };
  if (!existsSync(SOURCE_DIR)) {
    return result;
  }
  await copyImages(SOURCE_DIR, DATA_DIR, result);
  return result;
}

async function copyImages(sourceDir, targetDir, result, rel = '') {
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const nextRel = rel ? path.join(rel, entry.name) : entry.name;
    if (entry.isDirectory()) {
      if (entry.name === '.thumbs') continue;
      await copyImages(sourcePath, targetDir, result, nextRel);
    } else if (entry.isFile() && isImageFile(entry.name)) {
      result.scanned += 1;
      const targetPath = path.join(targetDir, nextRel);
      await ensureDir(path.dirname(targetPath));
      const sourceStat = await fs.stat(sourcePath);
      let targetStat;
      let targetExists = false;
      let shouldCopy = true;
      try {
        targetStat = await fs.stat(targetPath);
        targetExists = true;
        if (targetStat.mtimeMs >= sourceStat.mtimeMs && targetStat.size === sourceStat.size) {
          shouldCopy = false;
        }
      } catch {
        shouldCopy = true;
      }
      if (shouldCopy) {
        const hash = await hashFile(sourcePath);
        if (isHashBlacklisted(hash)) {
          await removeFileIfExists(targetPath);
          await removeFileIfExists(path.join(THUMB_DIR, `${nextRel}.jpg`));
          continue;
        }
        await fs.copyFile(sourcePath, targetPath);
        result.copied += 1;
        targetStat = await fs.stat(targetPath);
        targetExists = true;
      }
      if (targetExists) {
        await ensureThumbnail(targetPath, nextRel, targetStat, result);
      }
    }
  }
}

async function getSharp() {
  if (sharpModule !== undefined) return sharpModule;
  try {
    const mod = await import('sharp');
    sharpModule = mod.default ?? mod;
  } catch (err) {
    console.warn('Sharp not available, thumbnails disabled.', err);
    sharpModule = null;
  }
  return sharpModule;
}

async function ensureThumbnail(targetPath, relPath, sourceStat, result) {
  const thumbPath = path.join(THUMB_DIR, `${relPath}.jpg`);
  await ensureDir(path.dirname(thumbPath));
  let shouldGenerate = true;
  try {
    const thumbStat = await fs.stat(thumbPath);
    if (thumbStat.mtimeMs >= sourceStat.mtimeMs) {
      shouldGenerate = false;
    }
  } catch {
    shouldGenerate = true;
  }
  if (!shouldGenerate) return;
  const sharp = await getSharp();
  if (!sharp) return;
  await sharp(targetPath)
    .rotate()
    .resize({
      width: THUMB_MAX,
      height: THUMB_MAX,
      fit: 'inside',
      withoutEnlargement: true
    })
    .jpeg({ quality: THUMB_QUALITY })
    .toFile(thumbPath);
  result.thumbnails += 1;
}
