export function createWorkflowExecutionService({
  statements,
  runtimeState,
  path,
  fs,
  createHash,
  existsSync,
  sourceDir,
  dataDir,
  getComfyApiReady,
  isHashBlacklisted,
  hashFile,
  ensureDir,
  ensureThumbnail,
  syncSourceToData,
  clearJobTransient,
  getBroadcastJobUpdate
}) {
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
      await new Promise((resolve) => setTimeout(resolve, delayMs));
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

  async function downloadAndRecordOutputs(
    jobId,
    imageOutputs,
    workflowInputs,
    inputValuesMap,
    workflowId,
    now
  ) {
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
      const sourcePath = path.join(sourceDir, imagePath);
      const dataPath = path.join(dataDir, imagePath);
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
          const hasSystemLabel = input.systemLabel && input.systemLabel !== input.label;
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
        await downloadAndRecordOutputs(
          jobId,
          imageOutputs,
          workflowInputs,
          inputValuesMap,
          workflowId,
          Date.now()
        );
        getBroadcastJobUpdate()?.(jobId);
      })().catch((err) => {
        console.warn('Failed to recover job outputs:', err);
      });
    }, 2000);
  }

  async function finalizeJobFromPrompt(promptId, options = {}) {
    if (!promptId) return;
    if (runtimeState.promptFinalizeInFlight.has(promptId)) return;
    runtimeState.promptFinalizeInFlight.add(promptId);
    try {
      const jobRow = statements.selectJobByPromptId.get(promptId);
      if (!jobRow) return;
      if (
        jobRow.status === 'completed' ||
        jobRow.status === 'error' ||
        jobRow.status === 'cancelled'
      ) {
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
        getBroadcastJobUpdate()?.(jobId);
        return;
      }

      const promptHistory = await fetchPromptHistory(promptId, { allowFallback: true });
      const statusStr = promptHistory?.status?.status_str;
      if (statusStr === 'error') {
        const errorMsg = promptHistory?.status?.messages?.[0]?.[1] || 'Unknown error';
        statements.updateJobStatus.run('error', errorMsg, null, now, jobId);
        clearJobTransient(jobId);
        getBroadcastJobUpdate()?.(jobId);
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
      getBroadcastJobUpdate()?.(jobId);
    } catch (err) {
      console.warn('Failed to finalize job from ComfyUI event:', err);
    } finally {
      runtimeState.promptFinalizeInFlight.delete(promptId);
    }
  }

  async function pollJobCompletion(jobId, promptId, workflowInputs, inputValuesMap, workflowId) {
    const maxAttempts = 3600;
    const pollInterval = 1000;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, pollInterval));

      const jobRow = statements.selectJobById.get(jobId);
      if (!jobRow || jobRow.status === 'cancelled') {
        return;
      }

      try {
        const promptHistory = await fetchPromptHistory(promptId);
        if (!promptHistory) continue;

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
              getBroadcastJobUpdate()?.(jobId);
            }, 2000);
            return;
          }
        }

        if (promptHistory.status?.status_str === 'running') {
          const job = statements.selectJobById.get(jobId);
          if (job && job.status !== 'running') {
            const startedAt = job.started_at ?? Date.now();
            statements.updateJobStatus.run('running', null, startedAt, null, jobId);
            getBroadcastJobUpdate()?.(jobId);
          }
        }
      } catch (err) {
        console.error('Poll error:', err);
      }
    }

    statements.updateJobStatus.run('error', 'Job timed out', null, Date.now(), jobId);
    clearJobTransient(jobId);
    if (runtimeState.currentExecutingPromptId === promptId) {
      runtimeState.currentExecutingPromptId = null;
    }
    getBroadcastJobUpdate()?.(jobId);
  }

  return {
    fetchPromptHistory,
    collectImageOutputs,
    fetchImageOutputsWithRetry,
    downloadAndRecordOutputs,
    scheduleOutputRecovery,
    finalizeJobFromPrompt,
    pollJobCompletion
  };
}
