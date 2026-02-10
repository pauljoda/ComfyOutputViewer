import express from 'express';
import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import { createHash, randomUUID } from 'crypto';
import { createReadStream, createWriteStream, existsSync } from 'fs';
import http from 'node:http';
import dotenv from 'dotenv';
import { WebSocketServer, WebSocket } from 'ws';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createDatabase } from './db/createDatabase.js';
import { createMetadataRepository } from './db/createMetadataRepository.js';
import { createImageService } from './services/createImageService.js';
import { createComfyRuntimeService } from './services/createComfyRuntimeService.js';
import { createQueueService } from './services/createQueueService.js';
import { createWorkflowExecutionService } from './services/createWorkflowExecutionService.js';
import { ComfyRuntimeState } from './lib/ComfyRuntimeState.js';
import { registerComfyRoutes } from './routes/registerComfyRoutes.js';
import { registerImageRoutes } from './routes/registerImageRoutes.js';
import { registerWorkflowRoutes } from './routes/registerWorkflowRoutes.js';
import { createMcpServer } from './mcp/createMcpServer.js';

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

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
const wsClients = new Set();
const runtimeState = new ComfyRuntimeState();
let broadcastJobUpdate = () => {};
let startQueuePolling = () => {};
let finalizeJobFromPrompt = async () => {};
let pollJobCompletion = async () => {};

wss.on('connection', (socket) => {
  wsClients.add(socket);
  socket.on('close', () => {
    wsClients.delete(socket);
  });
});
app.use(express.json({ limit: '1mb' }));

await fs.mkdir(DATA_DIR, { recursive: true });
await fs.mkdir(THUMB_DIR, { recursive: true });
await fs.mkdir(INPUTS_DIR, { recursive: true });
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
const imageService = createImageService({
  path,
  fs,
  createHash,
  createReadStream,
  existsSync,
  imageExtensions: IMAGE_EXTENSIONS,
  dataDir: DATA_DIR,
  sourceDir: SOURCE_DIR,
  thumbDir: THUMB_DIR,
  inputsDir: INPUTS_DIR,
  thumbMax: THUMB_MAX,
  thumbQuality: THUMB_QUALITY,
  statements,
  addHashToBlacklist,
  isHashBlacklisted
});
const {
  ensureDir,
  resolveImageExtension,
  findExistingInputByHash,
  listImages,
  getThumbUrl,
  buildImageItem,
  resolveDataPath,
  removeFileIfExists,
  hashFile,
  deleteImageByPath,
  deleteImagesByPath,
  syncSourceToData,
  ensureThumbnail
} = imageService;
const comfyRuntimeService = createComfyRuntimeService({
  comfyApiUrl: COMFY_API_URL,
  comfyClientId: COMFY_CLIENT_ID,
  runtimeState,
  statements,
  getBroadcastJobUpdate: () => broadcastJobUpdate,
  getFinalizeJobFromPrompt: () => finalizeJobFromPrompt,
  getStartQueuePolling: () => startQueuePolling
});
const {
  getComfyApi,
  getComfyApiReady,
  ensureOverallEntry,
  isGeneratingStatus,
  getJobIdForPrompt,
  clearJobTransient
} = comfyRuntimeService;

const workflowExecutionService = createWorkflowExecutionService({
  statements,
  runtimeState,
  path,
  fs,
  createHash,
  existsSync,
  sourceDir: SOURCE_DIR,
  dataDir: DATA_DIR,
  getComfyApiReady,
  isHashBlacklisted,
  hashFile,
  ensureDir,
  ensureThumbnail,
  syncSourceToData,
  clearJobTransient,
  getBroadcastJobUpdate: () => broadcastJobUpdate
});
const {
  fetchPromptHistory,
  collectImageOutputs,
  fetchImageOutputsWithRetry,
  downloadAndRecordOutputs,
  finalizeJobFromPrompt: finalizeJobFromPromptHandler,
  pollJobCompletion: pollJobCompletionHandler
} = workflowExecutionService;
finalizeJobFromPrompt = finalizeJobFromPromptHandler;
pollJobCompletion = pollJobCompletionHandler;

const queueService = createQueueService({
  runtimeState,
  statements,
  getComfyApiReady,
  queueRemainingOverrideTtlMs: QUEUE_REMAINING_OVERRIDE_TTL_MS,
  ensureOverallEntry,
  getPollJobCompletion: () => pollJobCompletion,
  getBroadcastJobUpdate: () => broadcastJobUpdate
});
const {
  getPromptIdFromQueueItem,
  getQueueInfoForPrompt,
  startQueuePolling: startQueuePollingHandler,
  resumeGeneratingJobs
} = queueService;
startQueuePolling = startQueuePollingHandler;

await migrateLegacyDb();

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

const { buildJobPayload, resolveTriggeredInputValues, executeWorkflowFromInputMap } =
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

// MCP server for AI tool integration
function createMcpToolServer() {
  return createMcpServer({
    statements,
    resolveTriggeredInputValues,
    executeWorkflowFromInputMap,
    buildJobPayload
  });
}

const mcpSseTransports = new Map();
const mcpStreamableTransports = new Map();

function getSingleHeaderValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

app.post('/mcp', async (req, res) => {
  const sessionId = getSingleHeaderValue(req.headers['mcp-session-id']);
  const sessionState = sessionId ? mcpStreamableTransports.get(sessionId) : null;
  let transport = sessionState?.transport || null;

  try {
    if (!transport) {
      if (sessionId || !isInitializeRequest(req.body)) {
        return res.status(400).json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Bad Request: No valid MCP session ID provided'
          },
          id: null
        });
      }

      const mcpToolServer = createMcpToolServer();
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (nextSessionId) => {
          mcpStreamableTransports.set(nextSessionId, { transport, mcpToolServer });
        }
      });

      transport.onclose = () => {
        const activeSessionId = transport?.sessionId;
        if (activeSessionId) {
          const activeSession = mcpStreamableTransports.get(activeSessionId);
          if (activeSession) {
            void activeSession.mcpToolServer.close().catch((closeErr) => {
              console.warn('Failed to close MCP session server:', closeErr);
            });
          }
          mcpStreamableTransports.delete(activeSessionId);
        }
      };

      await mcpToolServer.connect(transport);
    }

    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error('MCP Streamable HTTP POST error:', err);
    if (!res.headersSent) {
      res.status(500).send('MCP server error');
    }
  }
});

app.get('/mcp', async (req, res) => {
  const sessionId = getSingleHeaderValue(req.headers['mcp-session-id']);
  const transport = sessionId ? mcpStreamableTransports.get(sessionId)?.transport : null;
  if (!transport) {
    return res.status(400).send('Invalid or missing MCP session ID');
  }
  try {
    await transport.handleRequest(req, res);
  } catch (err) {
    console.error('MCP Streamable HTTP GET error:', err);
    if (!res.headersSent) {
      res.status(500).send('MCP stream error');
    }
  }
});

app.delete('/mcp', async (req, res) => {
  const sessionId = getSingleHeaderValue(req.headers['mcp-session-id']);
  const transport = sessionId ? mcpStreamableTransports.get(sessionId)?.transport : null;
  if (!transport) {
    return res.status(400).send('Invalid or missing MCP session ID');
  }
  try {
    await transport.handleRequest(req, res);
  } catch (err) {
    console.error('MCP Streamable HTTP DELETE error:', err);
    if (!res.headersSent) {
      res.status(500).send('MCP session close error');
    }
  }
});

app.get('/mcp/sse', async (req, res) => {
  try {
    const mcpToolServer = createMcpToolServer();
    const { SSEServerTransport } = await import('@modelcontextprotocol/sdk/server/sse.js');
    const transport = new SSEServerTransport('/mcp/messages', res);
    mcpSseTransports.set(transport.sessionId, { transport, mcpToolServer });
    res.on('close', () => {
      const activeSession = mcpSseTransports.get(transport.sessionId);
      if (activeSession) {
        void activeSession.mcpToolServer.close().catch((closeErr) => {
          console.warn('Failed to close MCP SSE session server:', closeErr);
        });
      }
      mcpSseTransports.delete(transport.sessionId);
    });
    await mcpToolServer.connect(transport);
  } catch (err) {
    console.error('MCP SSE connection error:', err);
    if (!res.headersSent) {
      res.status(500).send('MCP server error');
    }
  }
});

app.post('/mcp/messages', async (req, res) => {
  const sessionId = req.query.sessionId;
  const transport = mcpSseTransports.get(sessionId)?.transport;
  if (!transport) {
    return res.status(400).send('Invalid or expired MCP session');
  }
  try {
    await transport.handlePostMessage(req, res);
  } catch (err) {
    console.error('MCP message error:', err);
    if (!res.headersSent) {
      res.status(500).send('MCP message handling error');
    }
  }
});

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
