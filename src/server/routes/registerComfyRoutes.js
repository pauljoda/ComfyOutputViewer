export function registerComfyRoutes(app, deps) {
  const {
    path,
    runtimeState,
    getComfyApi,
    getComfyApiReady,
    getPromptIdFromQueueItem,
    getJobIdForPrompt
  } = deps;
app.get('/api/comfy/stats', async (_req, res) => {
  try {
    const api = await getComfyApiReady();
    const stats = await api.getSystemStats();
    res.json(stats);
  } catch (err) {
    res.status(500).send(err instanceof Error ? err.message : 'Failed to load ComfyUI system stats');
  }
});

app.get('/api/comfy/ws-status', async (_req, res) => {
  try {
    const api = getComfyApi();
    const runningIds = runtimeState.queueState.running.map(getPromptIdFromQueueItem).filter(Boolean);
    const pendingIds = runtimeState.queueState.pending.map(getPromptIdFromQueueItem).filter(Boolean);
    const currentJobId = runtimeState.currentExecutingPromptId ? getJobIdForPrompt(runtimeState.currentExecutingPromptId) : null;
    const jobProgress = currentJobId ? runtimeState.jobProgressById.get(currentJobId) : null;
    const jobPreview = currentJobId ? runtimeState.jobPreviewById.get(currentJobId) : null;
    res.json({
      connected: runtimeState.comfyWsConnected,
      connectedId: runtimeState.comfyWsConnectedId,
      apiId: api?.id ?? null,
      lastActivePromptId: runtimeState.lastActivePromptId,
      currentExecutingPromptId: runtimeState.currentExecutingPromptId,
      queue: {
        running: runtimeState.queueState.running.length,
        pending: runtimeState.queueState.pending.length,
        remaining: runtimeState.queueState.remaining,
        updatedAt: runtimeState.queueState.updatedAt,
        runningIds,
        pendingIds
      },
      events: {
        ...runtimeState.comfyEventStats,
        counts: { ...runtimeState.comfyEventStats.counts }
      },
      currentJob: currentJobId
        ? {
            id: currentJobId,
            progress: jobProgress ?? null,
            preview: jobPreview ?? null
          }
        : null
    });
  } catch (err) {
    res.status(500).send(err instanceof Error ? err.message : 'Failed to load ComfyUI websocket status');
  }
});

app.post('/api/comfy/upload', async (req, res) => {
  try {
    const request = new Request('http://localhost', {
      method: 'POST',
      headers: req.headers,
      body: req,
      duplex: 'half'
    });
    const formData = await request.formData();
    const file = formData.get('image');
    if (!file || typeof file.arrayBuffer !== 'function') {
      return res.status(400).send('Missing image upload');
    }

    const rawName = typeof file.name === 'string' ? file.name : 'image.png';
    const fileName = path.basename(rawName) || 'image.png';
    const buffer = Buffer.from(await file.arrayBuffer());

    const overrideRaw = formData.get('overwrite');
    const override =
      overrideRaw === null || overrideRaw === undefined
        ? undefined
        : overrideRaw === 'true' || overrideRaw === '1' || overrideRaw === true;
    const subfolderRaw = formData.get('subfolder');
    const subfolder = typeof subfolderRaw === 'string' ? subfolderRaw : undefined;

    const api = await getComfyApiReady();
    const uploadResult = await api.uploadImage(buffer, fileName, {
      ...(override !== undefined ? { override } : null),
      ...(subfolder ? { subfolder } : null)
    });

    if (!uploadResult || !uploadResult.info) {
      return res.status(500).send('Failed to upload to ComfyUI');
    }

    res.json({
      name: uploadResult.info.filename,
      subfolder: uploadResult.info.subfolder,
      type: uploadResult.info.type,
      url: uploadResult.url
    });
  } catch (err) {
    res.status(500).send(err instanceof Error ? err.message : 'Failed to upload to ComfyUI');
  }
});
}
