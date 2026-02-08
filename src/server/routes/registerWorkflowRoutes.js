export function registerWorkflowRoutes(app, deps) {
  const {
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
    setBroadcastJobUpdate
  } = deps;
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
        statements.updateWorkflowFolderSortOrder.run(i, now, folderId);
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
          const defaultValue =
            typeof input.defaultValue === 'string'
              ? input.defaultValue
              : input.defaultValue == null
                ? null
                : String(input.defaultValue);
          statements.insertWorkflowInput.run(
            workflowId,
            input.nodeId,
            input.nodeTitle || null,
            input.inputKey,
            input.inputType,
            storedLabel,
            defaultValue,
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
          const defaultValue =
            typeof input.defaultValue === 'string'
              ? input.defaultValue
              : input.defaultValue == null
                ? null
                : String(input.defaultValue);
          statements.insertWorkflowInput.run(
            workflowId,
            input.nodeId,
            input.nodeTitle || null,
            input.inputKey,
            input.inputType,
            storedLabel,
            defaultValue,
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
      const payload = buildJobPayload(row.id);
      if (payload) {
        jobs.push(payload);
      }
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

    const parseImageValue = (value) => {
      if (!value || typeof value !== 'object') return null;
      const filename =
        typeof value.filename === 'string'
          ? value.filename
          : typeof value.name === 'string'
            ? value.name
            : '';
      const subfolder = typeof value.subfolder === 'string' ? value.subfolder : '';
      const type = typeof value.type === 'string' ? value.type : '';
      if (!filename && !subfolder && !type) return null;
      return { filename, subfolder, type };
    };

    const formatJobInputValue = (value) => {
      if (!value || typeof value !== 'object') return value;
      const imageValue = parseImageValue(value);
      if (imageValue?.filename) return imageValue.filename;
      try {
        return JSON.stringify(value);
      } catch (err) {
        return String(value);
      }
    };

    for (const input of workflowInputs) {
      if (!inputValuesMap.has(input.id)) continue;
      const value = inputValuesMap.get(input.id);
      const node = promptJson[input.node_id];
      if (node && node.inputs) {
        if (input.input_type === 'image') {
          const imageValue = parseImageValue(value);
          if (imageValue) {
            const filename = imageValue.filename || '';
            if (input.input_key === 'subfolder') {
              if (imageValue.subfolder) {
                node.inputs.subfolder = imageValue.subfolder;
              }
            } else if (input.input_key === 'type') {
              if (imageValue.type) {
                node.inputs.type = imageValue.type;
              }
            } else {
              node.inputs[input.input_key] = filename;
            }
            if (imageValue.subfolder) {
              node.inputs.subfolder = imageValue.subfolder;
            }
            if (imageValue.type) {
              node.inputs.type = imageValue.type;
            }
            continue;
          }
        }
        if (input.input_type === 'number' || input.input_type === 'seed') {
          const numericValue = Number(value);
          node.inputs[input.input_key] = Number.isFinite(numericValue) ? numericValue : value;
        } else {
          node.inputs[input.input_key] = value;
        }
      }
    }

    // Create job record
    const now = Date.now();
    const jobResult = statements.insertJob.run(workflowId, null, 'pending', now);
    const jobId = Number(jobResult.lastInsertRowid);
    const totalNodes =
      promptJson && typeof promptJson === 'object' ? Object.keys(promptJson).length : 0;
    runtimeState.jobOverallById.set(jobId, {
      totalNodes,
      executedNodes: new Set(),
      updatedAt: now
    });

    // Save job inputs
    runTransaction(() => {
      for (const input of workflowInputs) {
        const value = inputValuesMap.get(input.id);
        if (value !== undefined) {
          const storedValue = formatJobInputValue(value);
          statements.insertJobInput.run(jobId, input.id, storedValue);
        }
      }
    });
    broadcastJobUpdate(jobId);

    // Send to ComfyUI
    try {
      const api = await getComfyApiReady();
      const result = await api.queuePrompt(0, promptJson);

      if (!result || !result.prompt_id) {
        const errorText = 'Failed to queue prompt in ComfyUI';
        statements.updateJobStatus.run('error', errorText, now, now, jobId);
        clearJobTransient(jobId);
        broadcastJobUpdate(jobId);
        return res.status(500).json({ ok: false, error: errorText, jobId });
      }

      const promptId = result.prompt_id;

      // Update job with prompt ID
      statements.updateJobPromptId.run(promptId, jobId);
      runtimeState.promptJobIdByPromptId.set(promptId, jobId);
      statements.updateJobStatus.run('queued', null, now, null, jobId);
      broadcastJobUpdate(jobId);

      // Start polling for completion in the background
      pollJobCompletion(jobId, promptId, workflowInputs, inputValuesMap, workflowId);

      res.json({ ok: true, jobId, promptId });
    } catch (fetchErr) {
      const errorMessage = fetchErr instanceof Error ? fetchErr.message : 'Failed to connect to ComfyUI';
      statements.updateJobStatus.run('error', errorMessage, now, now, jobId);
      clearJobTransient(jobId);
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

  const generating = isGeneratingStatus(row.status);
  const progress = generating ? runtimeState.jobProgressById.get(jobId) : null;
  const preview = generating ? runtimeState.jobPreviewById.get(jobId) : null;
  const overall = generating ? ensureOverallEntry(jobId, row.workflow_id) : null;
  const queueInfo =
    generating && row.prompt_id ? getQueueInfoForPrompt(row.prompt_id) : null;
  const fallbackQueue =
    generating && runtimeState.queueState.updatedAt
      ? {
          state: 'unknown',
          position: null,
          total: runtimeState.queueState.running.length + runtimeState.queueState.pending.length,
          ahead: null,
          remaining: runtimeState.queueState.remaining,
          updatedAt: runtimeState.queueState.updatedAt
        }
      : null;
  const queue = generating ? queueInfo ?? fallbackQueue : null;
  const progressPercent =
    progress && Number.isFinite(progress.max) && progress.max > 0
      ? Math.max(0, Math.min(100, (progress.value / progress.max) * 100))
      : null;
  const executedCount = overall ? overall.executedNodes.size : 0;
  const overallPercent =
    overall && overall.totalNodes > 0
      ? Math.max(
          0,
          Math.min(
            100,
            ((executedCount +
              (progress && progress.max > 0 ? progress.value / progress.max : 0)) /
              overall.totalNodes) *
              100
          )
        )
      : null;

  const outputs = [];
  const outputPaths = new Set();
  for (const outputRow of statements.selectJobOutputs.iterate(jobId)) {
    if (outputPaths.has(outputRow.image_path)) continue;
    outputPaths.add(outputRow.image_path);
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
    inputs,
    progress: progress
      ? {
          value: progress.value,
          max: progress.max,
          node: progress.node ?? null,
          percent: progressPercent
        }
      : null,
    overall: overall
      ? {
          current: executedCount,
          total: overall.totalNodes,
          percent: overallPercent,
          updatedAt: overall.updatedAt
        }
      : null,
    preview: preview
      ? {
          url: preview.url,
          updatedAt: preview.updatedAt
        }
      : null,
    queue,
    live: {
      connected: runtimeState.comfyWsConnected,
      lastEventAt: runtimeState.comfyEventStats.lastEventAt,
      lastEventType: runtimeState.comfyEventStats.lastEventType,
      previewSeen: runtimeState.comfyEventStats.counts.preview > 0,
      lastPreviewAt: runtimeState.comfyEventStats.lastPreviewAt
    }
  };
}

function broadcastJobUpdate(jobId) {
  const job = buildJobPayload(jobId);
  if (!job) return;
  const payload = JSON.stringify({ type: 'job_update', job });
  for (const client of wsClients) {
    if (client.readyState === 1) {
      client.send(payload);
    }
  }
}

if (typeof setBroadcastJobUpdate === 'function') {
  setBroadcastJobUpdate(broadcastJobUpdate);
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

app.post('/api/jobs/:id/recheck', async (req, res) => {
  try {
    const jobId = Number(req.params.id);
    const jobRow = statements.selectJobById.get(jobId);
    if (!jobRow) {
      return res.status(404).send('Job not found');
    }
    if (!jobRow.prompt_id) {
      return res.status(400).send('Job has no prompt ID');
    }

    const workflowInputs = [];
    for (const row of statements.selectWorkflowInputs.iterate(jobRow.workflow_id)) {
      workflowInputs.push(row);
    }
    const inputValuesMap = new Map();
    for (const inputRow of statements.selectJobInputs.iterate(jobId)) {
      inputValuesMap.set(inputRow.input_id, inputRow.value);
    }

    let imageOutputs = await fetchImageOutputsWithRetry(jobRow.prompt_id, 3, 1000);
    if (imageOutputs.length === 0) {
      const promptHistory = await fetchPromptHistory(jobRow.prompt_id, { allowFallback: true });
      imageOutputs = collectImageOutputs(promptHistory?.outputs || {});
    }

    if (imageOutputs.length === 0) {
      return res.json({ ok: false, recorded: 0, outputs: 0 });
    }

    const recorded = await downloadAndRecordOutputs(
      jobId,
      imageOutputs,
      workflowInputs,
      inputValuesMap,
      jobRow.workflow_id,
      Date.now()
    );
    broadcastJobUpdate(jobId);
    res.json({ ok: true, recorded, outputs: imageOutputs.length });
  } catch (err) {
    res.status(500).send(err instanceof Error ? err.message : 'Failed to recheck job outputs');
  }
});

app.post('/api/jobs/:id/cancel', async (req, res) => {
  try {
    const jobId = Number(req.params.id);
    const job = statements.selectJobById.get(jobId);
    if (!job) {
      return res.status(404).send('Job not found');
    }
    if (job.status === 'completed' || job.status === 'error' || job.status === 'cancelled') {
      return res.json({ ok: false, status: job.status });
    }
    const now = Date.now();
    const startedAt = job.started_at ?? null;
    let interrupted = false;
    if (job.prompt_id) {
      try {
        const isRunningPrompt =
          runtimeState.currentExecutingPromptId === job.prompt_id ||
          runtimeState.queueState.running.some(
            (item) => getPromptIdFromQueueItem(item) === job.prompt_id
          );
        if (isRunningPrompt) {
          const api = await getComfyApiReady();
          await api.interrupt();
          interrupted = true;
        }
      } catch (err) {
        console.warn('Failed to interrupt ComfyUI job:', err);
      }
    }

    statements.updateJobStatus.run(
      'cancelled',
      interrupted ? 'Cancelled' : 'Cancelled',
      startedAt,
      now,
      jobId
    );
    clearJobTransient(jobId);
    if (job.prompt_id && runtimeState.currentExecutingPromptId === job.prompt_id) {
      runtimeState.currentExecutingPromptId = null;
    }
    broadcastJobUpdate(jobId);
    res.json({ ok: true, interrupted });
  } catch (err) {
    res.status(500).send(err instanceof Error ? err.message : 'Failed to cancel job');
  }
});
}
