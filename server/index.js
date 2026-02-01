import express from 'express';
import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import { createHash } from 'crypto';
import { createReadStream, existsSync } from 'fs';
import http from 'node:http';
import dotenv from 'dotenv';
import { WebSocketServer, WebSocket } from 'ws';
import { DatabaseSync } from 'node:sqlite';

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
const THUMB_DIR = path.join(DATA_DIR, '.thumbs');
const LEGACY_DB_PATH = path.join(DATA_DIR, '.comfy_viewer.json');
const DB_PATH = path.join(DATA_DIR, '.comfy_viewer.sqlite');
const THUMB_MAX = Number(process.env.THUMB_MAX || 512);
const THUMB_QUALITY = Number(process.env.THUMB_QUALITY || 72);
const SYNC_INTERVAL_MS = Number(process.env.SYNC_INTERVAL_MS || 0);
const RATING_MIN = 0;
const RATING_MAX = 5;

const isProd = process.env.NODE_ENV === 'production';
const port = Number(process.env.SERVER_PORT || process.env.PORT || (isProd ? 8008 : 8009));

let sharpModule;

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
const wsClients = new Set();

wss.on('connection', (socket) => {
  wsClients.add(socket);
  socket.on('close', () => {
    wsClients.delete(socket);
  });
});
app.use(express.json({ limit: '1mb' }));

await ensureDir(DATA_DIR);
await ensureDir(THUMB_DIR);
const db = initDb();
const statements = prepareStatements(db);
await migrateLegacyDb();

app.use('/images', express.static(DATA_DIR));

app.get('/api/images', async (_req, res) => {
  try {
    const metadata = loadMetadata();
    const { images } = await listImages(DATA_DIR, metadata);
    res.json({
      images,
      sourceDir: SOURCE_DIR,
      dataDir: DATA_DIR
    });
  } catch (err) {
    res.status(500).send(err instanceof Error ? err.message : 'Failed to list images');
  }
});

app.post('/api/favorite', async (req, res) => {
  try {
    const { path: relPath, value } = req.body || {};
    if (!relPath) return res.status(400).send('Missing path');
    setFavorite(relPath, Boolean(value));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).send(err instanceof Error ? err.message : 'Failed to update favorite');
  }
});

app.post('/api/favorite/bulk', async (req, res) => {
  try {
    const { paths, value } = req.body || {};
    if (!Array.isArray(paths) || paths.length === 0) {
      return res.status(400).send('Missing paths');
    }
    setBulkFavorite(paths, Boolean(value));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).send(err instanceof Error ? err.message : 'Failed to update favorites');
  }
});

app.post('/api/hidden', async (req, res) => {
  try {
    const { path: relPath, value } = req.body || {};
    if (!relPath) return res.status(400).send('Missing path');
    setHidden(relPath, Boolean(value));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).send(err instanceof Error ? err.message : 'Failed to update hidden state');
  }
});

app.post('/api/hidden/bulk', async (req, res) => {
  try {
    const { paths, value } = req.body || {};
    if (!Array.isArray(paths) || paths.length === 0) {
      return res.status(400).send('Missing paths');
    }
    setBulkHidden(paths, Boolean(value));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).send(err instanceof Error ? err.message : 'Failed to update hidden state');
  }
});

app.post('/api/rating', async (req, res) => {
  try {
    const { path: relPath, value } = req.body || {};
    if (!relPath) return res.status(400).send('Missing path');
    setRating(relPath, normalizeRating(value));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).send(err instanceof Error ? err.message : 'Failed to update rating');
  }
});

app.post('/api/rating/bulk', async (req, res) => {
  try {
    const { paths, value } = req.body || {};
    if (!Array.isArray(paths) || paths.length === 0) {
      return res.status(400).send('Missing paths');
    }
    setBulkRating(paths, normalizeRating(value));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).send(err instanceof Error ? err.message : 'Failed to update ratings');
  }
});

app.post('/api/tags', async (req, res) => {
  try {
    const { path: relPath, tags } = req.body || {};
    if (!relPath) return res.status(400).send('Missing path');
    const normalized = normalizeTags(tags);
    setTagsForPath(relPath, normalized);
    res.json({ ok: true, tags: normalized });
  } catch (err) {
    res.status(500).send(err instanceof Error ? err.message : 'Failed to update tags');
  }
});

app.post('/api/tags/bulk', async (req, res) => {
  try {
    const { updates } = req.body || {};
    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).send('Missing updates');
    }
    setBulkTags(updates);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).send(err instanceof Error ? err.message : 'Failed to update tags');
  }
});

app.post('/api/delete', async (req, res) => {
  try {
    const { path: relPath } = req.body || {};
    if (!relPath) return res.status(400).send('Missing path');
    const result = await deleteImageByPath(relPath);
    res.json(result);
  } catch (err) {
    res.status(500).send(err instanceof Error ? err.message : 'Failed to delete image');
  }
});

app.post('/api/delete/bulk', async (req, res) => {
  try {
    const { paths } = req.body || {};
    if (!Array.isArray(paths) || paths.length === 0) {
      return res.status(400).send('Missing paths');
    }
    const result = await deleteImagesByPath(paths);
    res.json(result);
  } catch (err) {
    res.status(500).send(err instanceof Error ? err.message : 'Failed to delete images');
  }
});

app.post('/api/sync', async (_req, res) => {
  try {
    const result = await syncSourceToData();
    res.json(result);
  } catch (err) {
    res.status(500).send(err instanceof Error ? err.message : 'Failed to sync');
  }
});

// ==================== WORKFLOW API ENDPOINTS ====================

// List all workflow folders
app.get('/api/workflow-folders', async (_req, res) => {
  try {
    const folders = [];
    for (const row of statements.selectWorkflowFolders.iterate()) {
      folders.push({
        id: row.id,
        name: row.name,
        sortOrder: row.sort_order,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      });
    }
    res.json({ folders });
  } catch (err) {
    res.status(500).send(err instanceof Error ? err.message : 'Failed to list folders');
  }
});

// Create workflow folder
app.post('/api/workflow-folders', async (req, res) => {
  try {
    const { name } = req.body || {};
    if (!name) {
      return res.status(400).send('Missing folder name');
    }
    const now = Date.now();
    // Get max sort order
    let maxSortOrder = 0;
    for (const row of statements.selectWorkflowFolders.iterate()) {
      if (row.sort_order > maxSortOrder) {
        maxSortOrder = row.sort_order;
      }
    }
    const result = statements.insertWorkflowFolder.run(name, maxSortOrder + 1, now, now);
    const folderId = Number(result.lastInsertRowid);
    res.json({ ok: true, id: folderId });
  } catch (err) {
    res.status(500).send(err instanceof Error ? err.message : 'Failed to create folder');
  }
});

// Update workflow folder
app.put('/api/workflow-folders/:id', async (req, res) => {
  try {
    const folderId = Number(req.params.id);
    const { name, sortOrder } = req.body || {};
    const existing = statements.selectWorkflowFolderById.get(folderId);
    if (!existing) {
      return res.status(404).send('Folder not found');
    }
    const now = Date.now();
    statements.updateWorkflowFolder.run(
      name ?? existing.name,
      sortOrder ?? existing.sort_order,
      now,
      folderId
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).send(err instanceof Error ? err.message : 'Failed to update folder');
  }
});

// Delete workflow folder
app.delete('/api/workflow-folders/:id', async (req, res) => {
  try {
    const folderId = Number(req.params.id);
    statements.deleteWorkflowFolder.run(folderId);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).send(err instanceof Error ? err.message : 'Failed to delete folder');
  }
});

// Reorder workflow folders
app.post('/api/workflow-folders/reorder', async (req, res) => {
  try {
    const { folderIds } = req.body || {};
    if (!Array.isArray(folderIds)) {
      return res.status(400).send('Missing folderIds array');
    }
    const now = Date.now();
    runTransaction(() => {
      for (let i = 0; i < folderIds.length; i++) {
        const folderId = folderIds[i];
        if (typeof folderId !== 'number') continue;
        statements.updateWorkflowFolder.run(null, i, now, folderId);
      }
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).send(err instanceof Error ? err.message : 'Failed to reorder folders');
  }
});

// List all workflows
app.get('/api/workflows', async (_req, res) => {
  try {
    const workflows = [];
    for (const row of statements.selectWorkflows.iterate()) {
      workflows.push({
        id: row.id,
        name: row.name,
        description: row.description,
        apiJson: JSON.parse(row.api_json),
        folderId: row.folder_id,
        sortOrder: row.sort_order,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      });
    }
    res.json({ workflows });
  } catch (err) {
    res.status(500).send(err instanceof Error ? err.message : 'Failed to list workflows');
  }
});

// Get single workflow with inputs
app.get('/api/workflows/:id', async (req, res) => {
  try {
    const workflowId = Number(req.params.id);
    const row = statements.selectWorkflowById.get(workflowId);
    if (!row) {
      return res.status(404).send('Workflow not found');
    }
    const workflow = {
      id: row.id,
      name: row.name,
      description: row.description,
      apiJson: JSON.parse(row.api_json),
      folderId: row.folder_id,
      sortOrder: row.sort_order,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
    const inputs = [];
    for (const inputRow of statements.selectWorkflowInputs.iterate(workflowId)) {
      inputs.push({
        id: inputRow.id,
        workflowId: inputRow.workflow_id,
        nodeId: inputRow.node_id,
        nodeTitle: inputRow.node_title,
        inputKey: inputRow.input_key,
        inputType: inputRow.input_type,
        label: inputRow.label,
        defaultValue: inputRow.default_value,
        sortOrder: inputRow.sort_order
      });
    }
    res.json({ workflow, inputs });
  } catch (err) {
    res.status(500).send(err instanceof Error ? err.message : 'Failed to get workflow');
  }
});

// Create new workflow
app.post('/api/workflows', async (req, res) => {
  try {
    const { name, description, apiJson, inputs, folderId } = req.body || {};
    if (!name || !apiJson) {
      return res.status(400).send('Missing name or apiJson');
    }
    const now = Date.now();
    // Get max sort order for the target folder (or null folder)
    let maxSortOrder = 0;
    const targetFolderId = folderId || null;
    const workflowsIter = targetFolderId
      ? statements.selectWorkflowsByFolder.iterate(targetFolderId)
      : statements.selectWorkflowsWithoutFolder.iterate();
    for (const row of workflowsIter) {
      if (row.sort_order > maxSortOrder) {
        maxSortOrder = row.sort_order;
      }
    }
    const result = statements.insertWorkflow.run(
      name,
      description || null,
      JSON.stringify(apiJson),
      targetFolderId,
      maxSortOrder + 1,
      now,
      now
    );
    const workflowId = Number(result.lastInsertRowid);

    // Insert inputs if provided
    if (Array.isArray(inputs) && inputs.length > 0) {
      runTransaction(() => {
        for (let i = 0; i < inputs.length; i++) {
          const input = inputs[i];
          const label = typeof input.label === 'string' ? input.label.trim() : '';
          const storedLabel = label || input.inputKey;
          statements.insertWorkflowInput.run(
            workflowId,
            input.nodeId,
            input.nodeTitle || null,
            input.inputKey,
            input.inputType,
            storedLabel,
            input.defaultValue || null,
            i
          );
        }
      });
    }

    res.json({ ok: true, id: workflowId });
  } catch (err) {
    res.status(500).send(err instanceof Error ? err.message : 'Failed to create workflow');
  }
});

// Update workflow
app.put('/api/workflows/:id', async (req, res) => {
  try {
    const workflowId = Number(req.params.id);
    const { name, description, apiJson, inputs } = req.body || {};
    if (!name || !apiJson) {
      return res.status(400).send('Missing name or apiJson');
    }
    const now = Date.now();
    statements.updateWorkflow.run(
      name,
      description || null,
      JSON.stringify(apiJson),
      now,
      workflowId
    );

    // Replace inputs
    if (Array.isArray(inputs)) {
      runTransaction(() => {
        statements.deleteJobInputsByWorkflowId.run(workflowId);
        statements.deleteWorkflowInputs.run(workflowId);
        for (let i = 0; i < inputs.length; i++) {
          const input = inputs[i];
          const label = typeof input.label === 'string' ? input.label.trim() : '';
          const storedLabel = label || input.inputKey;
          statements.insertWorkflowInput.run(
            workflowId,
            input.nodeId,
            input.nodeTitle || null,
            input.inputKey,
            input.inputType,
            storedLabel,
            input.defaultValue || null,
            i
          );
        }
      });
    }

    res.json({ ok: true });
  } catch (err) {
    res.status(500).send(err instanceof Error ? err.message : 'Failed to update workflow');
  }
});

// Delete workflow
app.delete('/api/workflows/:id', async (req, res) => {
  try {
    const workflowId = Number(req.params.id);
    statements.deleteWorkflow.run(workflowId);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).send(err instanceof Error ? err.message : 'Failed to delete workflow');
  }
});

// Move workflow to folder
app.post('/api/workflows/:id/move', async (req, res) => {
  try {
    const workflowId = Number(req.params.id);
    const { folderId } = req.body || {};
    const existing = statements.selectWorkflowById.get(workflowId);
    if (!existing) {
      return res.status(404).send('Workflow not found');
    }
    const now = Date.now();
    const targetFolderId = folderId === null || folderId === undefined ? null : Number(folderId);
    // Get max sort order in target folder
    let maxSortOrder = 0;
    const workflowsIter = targetFolderId
      ? statements.selectWorkflowsByFolder.iterate(targetFolderId)
      : statements.selectWorkflowsWithoutFolder.iterate();
    for (const row of workflowsIter) {
      if (row.sort_order > maxSortOrder) {
        maxSortOrder = row.sort_order;
      }
    }
    statements.updateWorkflowFolderAndOrder.run(targetFolderId, maxSortOrder + 1, now, workflowId);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).send(err instanceof Error ? err.message : 'Failed to move workflow');
  }
});

// Reorder workflows within a folder (or root level if folderId is null)
app.post('/api/workflows/reorder', async (req, res) => {
  try {
    const { workflowIds, folderId } = req.body || {};
    if (!Array.isArray(workflowIds)) {
      return res.status(400).send('Missing workflowIds array');
    }
    const now = Date.now();
    const targetFolderId = folderId === null || folderId === undefined ? null : Number(folderId);
    runTransaction(() => {
      for (let i = 0; i < workflowIds.length; i++) {
        const wfId = workflowIds[i];
        if (typeof wfId !== 'number') continue;
        statements.updateWorkflowFolderAndOrder.run(targetFolderId, i, now, wfId);
      }
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).send(err instanceof Error ? err.message : 'Failed to reorder workflows');
  }
});

// Get jobs for a workflow
app.get('/api/workflows/:id/jobs', async (req, res) => {
  try {
    const workflowId = Number(req.params.id);
    const jobs = [];
    for (const row of statements.selectJobsByWorkflow.iterate(workflowId)) {
      const outputs = [];
      for (const outputRow of statements.selectJobOutputs.iterate(row.id)) {
        outputs.push({
          id: outputRow.id,
          jobId: outputRow.job_id,
          imagePath: outputRow.image_path,
          comfyFilename: outputRow.comfy_filename,
          createdAt: outputRow.created_at,
          thumbUrl: getThumbUrl(outputRow.image_path)
        });
      }
      jobs.push({
        id: row.id,
        workflowId: row.workflow_id,
        promptId: row.prompt_id,
        status: row.status,
        errorMessage: row.error_message,
        createdAt: row.created_at,
        startedAt: row.started_at,
        completedAt: row.completed_at,
        outputs
      });
    }
    res.json({ jobs });
  } catch (err) {
    res.status(500).send(err instanceof Error ? err.message : 'Failed to get jobs');
  }
});

// Run workflow
app.post('/api/workflows/:id/run', async (req, res) => {
  try {
    const workflowId = Number(req.params.id);
    const { inputs: inputValues } = req.body || {};

    // Get workflow
    const workflowRow = statements.selectWorkflowById.get(workflowId);
    if (!workflowRow) {
      return res.status(404).send('Workflow not found');
    }

    // Get workflow inputs
    const workflowInputs = [];
    for (const row of statements.selectWorkflowInputs.iterate(workflowId)) {
      workflowInputs.push(row);
    }

    // Create the prompt JSON by modifying the workflow's API JSON
    const promptJson = JSON.parse(workflowRow.api_json);

    // Apply input values only for defined workflow inputs.
    const workflowInputIds = new Set(workflowInputs.map((input) => input.id));
    const inputValuesMap = new Map();
    if (Array.isArray(inputValues)) {
      for (const iv of inputValues) {
        if (workflowInputIds.has(iv.inputId)) {
          inputValuesMap.set(iv.inputId, iv.value);
        }
      }
    }

    for (const input of workflowInputs) {
      if (!inputValuesMap.has(input.id)) continue;
      const value = inputValuesMap.get(input.id);
      if (promptJson[input.node_id]) {
        promptJson[input.node_id].inputs[input.input_key] =
          input.input_type === 'number' || input.input_type === 'seed'
            ? Number(value)
            : value;
      }
    }

    // Create job record
    const now = Date.now();
    const jobResult = statements.insertJob.run(workflowId, null, 'pending', now);
    const jobId = Number(jobResult.lastInsertRowid);

    // Save job inputs
    runTransaction(() => {
      for (const input of workflowInputs) {
        const value = inputValuesMap.get(input.id);
        if (value !== undefined) {
          statements.insertJobInput.run(jobId, input.id, value);
        }
      }
    });
    broadcastJobUpdate(jobId);

    // Generate a client ID for tracking
    const clientId = `comfy-viewer-${jobId}-${now}`;

    // Send to ComfyUI
    try {
      const response = await fetch(`${COMFY_API_URL}/prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptJson,
          client_id: clientId
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        statements.updateJobStatus.run('error', errorText, now, now, jobId);
        broadcastJobUpdate(jobId);
        return res.status(500).json({ ok: false, error: errorText, jobId });
      }

      const result = await response.json();
      const promptId = result.prompt_id;

      // Update job with prompt ID
      statements.updateJobPromptId.run(promptId, jobId);
      statements.updateJobStatus.run('queued', null, now, null, jobId);
      broadcastJobUpdate(jobId);

      // Start polling for completion in the background
      pollJobCompletion(jobId, promptId, workflowInputs, inputValuesMap, workflowId);

      res.json({ ok: true, jobId, promptId });
    } catch (fetchErr) {
      const errorMessage = fetchErr instanceof Error ? fetchErr.message : 'Failed to connect to ComfyUI';
      statements.updateJobStatus.run('error', errorMessage, now, now, jobId);
      broadcastJobUpdate(jobId);
      res.status(500).json({ ok: false, error: errorMessage, jobId });
    }
  } catch (err) {
    res.status(500).send(err instanceof Error ? err.message : 'Failed to run workflow');
  }
});

function buildJobPayload(jobId) {
  const row = statements.selectJobById.get(jobId);
  if (!row) return null;

  const outputs = [];
  for (const outputRow of statements.selectJobOutputs.iterate(jobId)) {
    const outputHash = outputRow.output_hash;
    outputs.push({
      id: outputRow.id,
      jobId: outputRow.job_id,
      imagePath: outputRow.image_path,
      comfyFilename: outputRow.comfy_filename,
      createdAt: outputRow.created_at,
      outputHash,
      thumbUrl: getThumbUrl(outputRow.image_path),
      exists: outputExists(outputRow.image_path, outputHash)
    });
  }

  const inputs = [];
  for (const inputRow of statements.selectJobInputs.iterate(jobId)) {
    inputs.push({
      id: inputRow.id,
      jobId: inputRow.job_id,
      inputId: inputRow.input_id,
      value: inputRow.value,
      label: inputRow.label,
      inputType: inputRow.input_type,
      inputKey: inputRow.input_key
    });
  }

  return {
    id: row.id,
    workflowId: row.workflow_id,
    promptId: row.prompt_id,
    status: row.status,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    outputs,
    inputs
  };
}

function broadcastJobUpdate(jobId) {
  const job = buildJobPayload(jobId);
  if (!job) return;
  const payload = JSON.stringify({ type: 'job_update', job });
  for (const client of wsClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

function outputExists(imagePath, outputHash) {
  if (outputHash && isHashBlacklisted(outputHash)) {
    return false;
  }
  const dataPath = resolveDataPath(imagePath);
  return existsSync(dataPath);
}

// Get job status
app.get('/api/jobs/:id', async (req, res) => {
  try {
    const jobId = Number(req.params.id);
    const job = buildJobPayload(jobId);
    if (!job) {
      return res.status(404).send('Job not found');
    }
    res.json({ job });
  } catch (err) {
    res.status(500).send(err instanceof Error ? err.message : 'Failed to get job');
  }
});

// Get prompt data for an image
app.get('/api/images/:path(*)/prompt', async (req, res) => {
  try {
    const imagePath = req.params.path;
    const row = statements.selectImagePrompt.get(imagePath);
    if (!row) {
      return res.status(404).send('No prompt data found for this image');
    }
    const promptData = JSON.parse(row.prompt_data);
    const jobRow = row.job_id ? statements.selectJobById.get(row.job_id) : null;
    if (jobRow && !promptData.workflowId) {
      promptData.workflowId = jobRow.workflow_id;
    }
    const jobInputs = [];
    if (row.job_id) {
      for (const inputRow of statements.selectJobInputs.iterate(row.job_id)) {
        jobInputs.push({
          inputId: inputRow.input_id,
          value: inputRow.value,
          label: inputRow.label,
          inputType: inputRow.input_type,
          inputKey: inputRow.input_key
        });
      }
    }
    res.json({
      imagePath: row.image_path,
      jobId: row.job_id,
      workflowId: promptData.workflowId ?? jobRow?.workflow_id ?? null,
      promptData,
      jobInputs,
      createdAt: row.created_at
    });
  } catch (err) {
    res.status(500).send(err instanceof Error ? err.message : 'Failed to get prompt data');
  }
});

// Get metadata for a single image
app.get('/api/images/:path(*)', async (req, res) => {
  try {
    const imagePath = req.params.path;
    const metadata = loadMetadata();
    const image = await buildImageItem(imagePath, metadata);
    if (!image) {
      return res.status(404).send('Image not found');
    }
    res.json(image);
  } catch (err) {
    res.status(500).send(err instanceof Error ? err.message : 'Failed to get image');
  }
});

// ComfyUI proxy endpoints
app.post('/api/comfy/upload', async (req, res) => {
  try {
    // For file uploads, we need to forward the request to ComfyUI
    const response = await fetch(`${COMFY_API_URL}/upload/image`, {
      method: 'POST',
      body: req.body,
      headers: {
        'Content-Type': req.headers['content-type']
      }
    });
    const result = await response.json();
    res.json(result);
  } catch (err) {
    res.status(500).send(err instanceof Error ? err.message : 'Failed to upload to ComfyUI');
  }
});

// Poll for job completion and download images
async function pollJobCompletion(jobId, promptId, workflowInputs, inputValuesMap, workflowId) {
  const maxAttempts = 3600; // 1 hour max (for large models)
  const pollInterval = 1000; // 1 second

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise(resolve => setTimeout(resolve, pollInterval));

    try {
      // Check history for this prompt
      const historyResponse = await fetch(`${COMFY_API_URL}/history/${promptId}`);
      if (!historyResponse.ok) continue;

      const history = await historyResponse.json();
      const promptHistory = history[promptId];

      if (!promptHistory) continue;

      // Check if execution is complete
      if (promptHistory.status && promptHistory.status.completed) {
        const now = Date.now();

        // Check for errors
        if (promptHistory.status.status_str === 'error') {
          const errorMsg = promptHistory.status.messages?.[0]?.[1] || 'Unknown error';
          statements.updateJobStatus.run('error', errorMsg, null, now, jobId);
          broadcastJobUpdate(jobId);
          return;
        }

        // Process outputs
        const outputs = promptHistory.outputs || {};
        const imageOutputs = [];

        for (const [nodeId, nodeOutput] of Object.entries(outputs)) {
          if (nodeOutput.images && Array.isArray(nodeOutput.images)) {
            for (const img of nodeOutput.images) {
              imageOutputs.push({
                filename: img.filename,
                subfolder: img.subfolder || '',
                type: img.type || 'output'
              });
            }
          }
        }

        // Download images and save to output folder
        for (const imgInfo of imageOutputs) {
          try {
            const params = new URLSearchParams({
              filename: imgInfo.filename,
              subfolder: imgInfo.subfolder,
              type: imgInfo.type
            });
            const imageResponse = await fetch(`${COMFY_API_URL}/view?${params}`);
            if (!imageResponse.ok) continue;

            const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
            const outputHash = createHash('sha256').update(imageBuffer).digest('hex');
            const imagePath = imgInfo.subfolder
              ? path.join(imgInfo.subfolder, imgInfo.filename)
              : imgInfo.filename;
            const sourcePath = path.join(SOURCE_DIR, imagePath);
            const dataPath = path.join(DATA_DIR, imagePath);
            let wroteToSource = false;
            let wroteToData = false;

            try {
              await ensureDir(path.dirname(sourcePath));
              await fs.writeFile(sourcePath, imageBuffer);
              wroteToSource = true;
            } catch (err) {
              if (err && (err.code === 'EACCES' || err.code === 'EPERM')) {
                try {
                  await ensureDir(path.dirname(dataPath));
                  await fs.writeFile(dataPath, imageBuffer);
                  wroteToData = true;
                  const stats = await fs.stat(dataPath);
                  await ensureThumbnail(dataPath, imagePath, stats, {
                    scanned: 0,
                    copied: 0,
                    thumbnails: 0
                  });
                } catch (innerErr) {
                  console.error('Failed to save output image to data dir:', innerErr);
                }
              } else {
                throw err;
              }
            }

            const outputExists = wroteToSource || wroteToData || existsSync(sourcePath) || existsSync(dataPath);
            if (!outputExists) {
              continue;
            }

            // Record the output
            statements.insertJobOutput.run(jobId, imagePath, imgInfo.filename, now, outputHash);

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

          } catch (imgErr) {
            console.error('Failed to download image:', imgErr);
          }
        }

        // Trigger a sync to copy to data dir before marking complete
        // This ensures outputs are accessible when the job update is broadcast
        await syncSourceToData();

        // Mark job as complete
        statements.updateJobStatus.run('completed', null, null, now, jobId);
        broadcastJobUpdate(jobId);

        // Schedule a follow-up broadcast after a short delay to catch any sync timing issues
        setTimeout(() => {
          broadcastJobUpdate(jobId);
        }, 2000);

        return;
      }

      // Update status to running if we see execution progress
      if (promptHistory.status?.status_str === 'running') {
        const job = statements.selectJobById.get(jobId);
        if (job && job.status !== 'running') {
          statements.updateJobStatus.run('running', null, Date.now(), null, jobId);
          broadcastJobUpdate(jobId);
        }
      }

    } catch (err) {
      console.error('Poll error:', err);
    }
  }

  // Timeout
  statements.updateJobStatus.run('error', 'Job timed out', null, Date.now(), jobId);
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

function initDb() {
  const database = new DatabaseSync(DB_PATH);
  database.exec('PRAGMA journal_mode = WAL;');
  database.exec('PRAGMA foreign_keys = ON;');
  database.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      path TEXT PRIMARY KEY,
      favorite INTEGER NOT NULL DEFAULT 0,
      hidden INTEGER NOT NULL DEFAULT 0,
      rating INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS tags (
      path TEXT NOT NULL,
      tag TEXT NOT NULL,
      PRIMARY KEY (path, tag)
    );
    CREATE TABLE IF NOT EXISTS blacklist (
      hash TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS workflow_folders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS workflows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      api_json TEXT NOT NULL,
      folder_id INTEGER REFERENCES workflow_folders(id) ON DELETE SET NULL,
      sort_order INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS workflow_inputs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workflow_id INTEGER NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
      node_id TEXT NOT NULL,
      node_title TEXT,
      input_key TEXT NOT NULL,
      input_type TEXT NOT NULL,
      label TEXT NOT NULL,
      default_value TEXT,
      sort_order INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workflow_id INTEGER NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
      prompt_id TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      error_message TEXT,
      created_at INTEGER NOT NULL,
      started_at INTEGER,
      completed_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS job_inputs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      input_id INTEGER NOT NULL REFERENCES workflow_inputs(id),
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS job_outputs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      image_path TEXT NOT NULL,
      comfy_filename TEXT,
      created_at INTEGER NOT NULL,
      output_hash TEXT
    );
    CREATE TABLE IF NOT EXISTS image_prompts (
      image_path TEXT PRIMARY KEY,
      job_id INTEGER REFERENCES jobs(id) ON DELETE SET NULL,
      prompt_data TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);
  ensureMetaColumn(database, 'rating', 'INTEGER NOT NULL DEFAULT 0');
  ensureJobOutputColumn(database, 'output_hash', 'TEXT');
  ensureWorkflowColumn(database, 'folder_id', 'INTEGER REFERENCES workflow_folders(id) ON DELETE SET NULL');
  ensureWorkflowColumn(database, 'sort_order', 'INTEGER DEFAULT 0');
  return database;
}

function ensureMetaColumn(database, columnName, definition) {
  const columns = database.prepare('PRAGMA table_info(meta)').all();
  if (columns.some((column) => column.name === columnName)) return;
  database.exec(`ALTER TABLE meta ADD COLUMN ${columnName} ${definition};`);
}

function ensureJobOutputColumn(database, columnName, definition) {
  const columns = database.prepare('PRAGMA table_info(job_outputs)').all();
  if (columns.some((column) => column.name === columnName)) return;
  database.exec(`ALTER TABLE job_outputs ADD COLUMN ${columnName} ${definition};`);
}

function ensureWorkflowColumn(database, columnName, definition) {
  const columns = database.prepare('PRAGMA table_info(workflows)').all();
  if (columns.some((column) => column.name === columnName)) return;
  database.exec(`ALTER TABLE workflows ADD COLUMN ${columnName} ${definition};`);
}

function prepareStatements(database) {
  return {
    selectMeta: database.prepare('SELECT path, favorite, hidden, rating FROM meta'),
    selectTags: database.prepare('SELECT path, tag FROM tags ORDER BY path, tag'),
    upsertFavorite: database.prepare(
      'INSERT INTO meta (path, favorite) VALUES (?, ?) ON CONFLICT(path) DO UPDATE SET favorite = excluded.favorite'
    ),
    upsertHidden: database.prepare(
      'INSERT INTO meta (path, hidden) VALUES (?, ?) ON CONFLICT(path) DO UPDATE SET hidden = excluded.hidden'
    ),
    upsertRating: database.prepare(
      'INSERT INTO meta (path, rating) VALUES (?, ?) ON CONFLICT(path) DO UPDATE SET rating = excluded.rating'
    ),
    deleteMeta: database.prepare('DELETE FROM meta WHERE path = ?'),
    deleteTagsByPath: database.prepare('DELETE FROM tags WHERE path = ?'),
    insertTag: database.prepare('INSERT OR IGNORE INTO tags (path, tag) VALUES (?, ?)'),
    selectBlacklist: database.prepare('SELECT 1 FROM blacklist WHERE hash = ? LIMIT 1'),
    insertBlacklist: database.prepare(
      'INSERT OR IGNORE INTO blacklist (hash, created_at) VALUES (?, ?)'
    ),
    hasMeta: database.prepare('SELECT 1 FROM meta LIMIT 1'),
    hasTags: database.prepare('SELECT 1 FROM tags LIMIT 1'),
    // Workflow folder statements
    selectWorkflowFolders: database.prepare('SELECT id, name, sort_order, created_at, updated_at FROM workflow_folders ORDER BY sort_order ASC, name ASC'),
    selectWorkflowFolderById: database.prepare('SELECT id, name, sort_order, created_at, updated_at FROM workflow_folders WHERE id = ?'),
    insertWorkflowFolder: database.prepare('INSERT INTO workflow_folders (name, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?)'),
    updateWorkflowFolder: database.prepare('UPDATE workflow_folders SET name = ?, sort_order = ?, updated_at = ? WHERE id = ?'),
    deleteWorkflowFolder: database.prepare('DELETE FROM workflow_folders WHERE id = ?'),
    // Workflow statements
    selectWorkflows: database.prepare('SELECT id, name, description, api_json, folder_id, sort_order, created_at, updated_at FROM workflows ORDER BY folder_id NULLS FIRST, sort_order ASC, name ASC'),
    selectWorkflowById: database.prepare('SELECT id, name, description, api_json, folder_id, sort_order, created_at, updated_at FROM workflows WHERE id = ?'),
    selectWorkflowsByFolder: database.prepare('SELECT id, name, description, api_json, folder_id, sort_order, created_at, updated_at FROM workflows WHERE folder_id = ? ORDER BY sort_order ASC, name ASC'),
    selectWorkflowsWithoutFolder: database.prepare('SELECT id, name, description, api_json, folder_id, sort_order, created_at, updated_at FROM workflows WHERE folder_id IS NULL ORDER BY sort_order ASC, name ASC'),
    insertWorkflow: database.prepare('INSERT INTO workflows (name, description, api_json, folder_id, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'),
    updateWorkflow: database.prepare('UPDATE workflows SET name = ?, description = ?, api_json = ?, updated_at = ? WHERE id = ?'),
    updateWorkflowFolder: database.prepare('UPDATE workflows SET folder_id = ?, updated_at = ? WHERE id = ?'),
    updateWorkflowSortOrder: database.prepare('UPDATE workflows SET sort_order = ?, updated_at = ? WHERE id = ?'),
    updateWorkflowFolderAndOrder: database.prepare('UPDATE workflows SET folder_id = ?, sort_order = ?, updated_at = ? WHERE id = ?'),
    deleteWorkflow: database.prepare('DELETE FROM workflows WHERE id = ?'),
    // Workflow input statements
    selectWorkflowInputs: database.prepare('SELECT id, workflow_id, node_id, node_title, input_key, input_type, label, default_value, sort_order FROM workflow_inputs WHERE workflow_id = ? ORDER BY sort_order'),
    insertWorkflowInput: database.prepare('INSERT INTO workflow_inputs (workflow_id, node_id, node_title, input_key, input_type, label, default_value, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'),
    deleteWorkflowInputs: database.prepare('DELETE FROM workflow_inputs WHERE workflow_id = ?'),
    deleteJobInputsByWorkflowId: database.prepare(
      'DELETE FROM job_inputs WHERE input_id IN (SELECT id FROM workflow_inputs WHERE workflow_id = ?)'
    ),
    // Job statements
    selectJobsByWorkflow: database.prepare('SELECT id, workflow_id, prompt_id, status, error_message, created_at, started_at, completed_at FROM jobs WHERE workflow_id = ? ORDER BY created_at DESC LIMIT 50'),
    selectJobById: database.prepare('SELECT id, workflow_id, prompt_id, status, error_message, created_at, started_at, completed_at FROM jobs WHERE id = ?'),
    selectJobByPromptId: database.prepare('SELECT id, workflow_id, prompt_id, status, error_message, created_at, started_at, completed_at FROM jobs WHERE prompt_id = ?'),
    insertJob: database.prepare('INSERT INTO jobs (workflow_id, prompt_id, status, created_at) VALUES (?, ?, ?, ?)'),
    updateJobStatus: database.prepare('UPDATE jobs SET status = ?, error_message = ?, started_at = ?, completed_at = ? WHERE id = ?'),
    updateJobPromptId: database.prepare('UPDATE jobs SET prompt_id = ? WHERE id = ?'),
    // Job input statements
    selectJobInputs: database.prepare('SELECT ji.id, ji.job_id, ji.input_id, ji.value, wi.label, wi.input_type, wi.input_key FROM job_inputs ji JOIN workflow_inputs wi ON ji.input_id = wi.id WHERE ji.job_id = ?'),
    insertJobInput: database.prepare('INSERT INTO job_inputs (job_id, input_id, value) VALUES (?, ?, ?)'),
    // Job output statements
    selectJobOutputs: database.prepare('SELECT id, job_id, image_path, comfy_filename, created_at, output_hash FROM job_outputs WHERE job_id = ?'),
    insertJobOutput: database.prepare('INSERT INTO job_outputs (job_id, image_path, comfy_filename, created_at, output_hash) VALUES (?, ?, ?, ?, ?)'),
    // Image prompt statements
    selectImagePrompt: database.prepare('SELECT image_path, job_id, prompt_data, created_at FROM image_prompts WHERE image_path = ?'),
    insertImagePrompt: database.prepare('INSERT OR REPLACE INTO image_prompts (image_path, job_id, prompt_data, created_at) VALUES (?, ?, ?, ?)')
  };
}

function runTransaction(task) {
  db.exec('BEGIN');
  try {
    const result = task();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

function loadMetadata() {
  const favorites = new Map();
  const hidden = new Map();
  const ratings = new Map();
  const tagsByPath = new Map();
  for (const row of statements.selectMeta.iterate()) {
    if (row.favorite) {
      favorites.set(row.path, true);
    }
    if (row.hidden) {
      hidden.set(row.path, true);
    }
    if (Number.isFinite(row.rating)) {
      ratings.set(row.path, row.rating);
    }
  }
  for (const row of statements.selectTags.iterate()) {
    const existing = tagsByPath.get(row.path);
    if (existing) {
      existing.push(row.tag);
    } else {
      tagsByPath.set(row.path, [row.tag]);
    }
  }
  return { favorites, hidden, ratings, tagsByPath };
}

function setFavorite(relPath, value) {
  statements.upsertFavorite.run(relPath, value ? 1 : 0);
}

function setHidden(relPath, value) {
  statements.upsertHidden.run(relPath, value ? 1 : 0);
}

function setRating(relPath, value) {
  statements.upsertRating.run(relPath, value);
}

function setBulkFavorite(paths, value) {
  runTransaction(() => {
    for (const relPath of paths) {
      if (typeof relPath !== 'string' || !relPath) continue;
      statements.upsertFavorite.run(relPath, value ? 1 : 0);
    }
  });
}

function setBulkHidden(paths, value) {
  runTransaction(() => {
    for (const relPath of paths) {
      if (typeof relPath !== 'string' || !relPath) continue;
      statements.upsertHidden.run(relPath, value ? 1 : 0);
    }
  });
}

function setBulkRating(paths, value) {
  runTransaction(() => {
    for (const relPath of paths) {
      if (typeof relPath !== 'string' || !relPath) continue;
      statements.upsertRating.run(relPath, value);
    }
  });
}

function setTagsForPath(relPath, tags) {
  runTransaction(() => {
    statements.deleteTagsByPath.run(relPath);
    for (const tag of tags) {
      statements.insertTag.run(relPath, tag);
    }
  });
}

function setBulkTags(updates) {
  runTransaction(() => {
    for (const update of updates) {
      if (!update || typeof update.path !== 'string' || !update.path) continue;
      const normalized = normalizeTags(update.tags);
      statements.deleteTagsByPath.run(update.path);
      for (const tag of normalized) {
        statements.insertTag.run(update.path, tag);
      }
    }
  });
}

function addHashToBlacklist(hash) {
  statements.insertBlacklist.run(hash, Date.now());
}

function isHashBlacklisted(hash) {
  return Boolean(statements.selectBlacklist.get(hash));
}

async function migrateLegacyDb() {
  if (!existsSync(LEGACY_DB_PATH)) return;
  const hasMeta = statements.hasMeta.get();
  const hasTags = statements.hasTags.get();
  if (hasMeta || hasTags) return;
  try {
    const raw = await fs.readFile(LEGACY_DB_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    runTransaction(() => {
      for (const [relPath, value] of Object.entries(parsed.favorites || {})) {
        if (!value) continue;
        statements.upsertFavorite.run(relPath, 1);
      }
      for (const [relPath, value] of Object.entries(parsed.hidden || {})) {
        if (!value) continue;
        statements.upsertHidden.run(relPath, 1);
      }
      for (const [relPath, value] of Object.entries(parsed.ratings || {})) {
        if (value === undefined || value === null) continue;
        const rating = normalizeRating(value);
        if (!rating) continue;
        statements.upsertRating.run(relPath, rating);
      }
      for (const [relPath, tags] of Object.entries(parsed.tags || {})) {
        const normalized = normalizeTags(tags);
        if (!normalized.length) continue;
        statements.deleteTagsByPath.run(relPath);
        for (const tag of normalized) {
          statements.insertTag.run(relPath, tag);
        }
      }
    });
    console.log('Migrated legacy JSON metadata into SQLite.');
  } catch (err) {
    console.warn('Failed to migrate legacy JSON metadata.', err);
  }
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

function normalizeTags(tags) {
  if (!Array.isArray(tags)) return [];
  const tagMap = new Map();
  for (const entry of tags) {
    if (typeof entry !== 'string') continue;
    const trimmed = entry.trim().replace(/\s+/g, ' ');
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (!tagMap.has(key)) {
      tagMap.set(key, key);
    }
  }
  return Array.from(tagMap.values()).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
  );
}

function normalizeRating(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return RATING_MIN;
  const rounded = Math.round(parsed);
  return Math.max(RATING_MIN, Math.min(RATING_MAX, rounded));
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
