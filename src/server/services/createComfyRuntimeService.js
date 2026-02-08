import { ComfyApi } from '@saintno/comfyui-sdk';
import { ComfyWebSocketAdapter } from '../sdk/ComfyWebSocketAdapter.js';

export function createComfyRuntimeService({
  comfyApiUrl,
  comfyClientId,
  runtimeState,
  statements,
  getBroadcastJobUpdate,
  getFinalizeJobFromPrompt,
  getStartQueuePolling
}) {
  let comfyApi;
  let comfyApiInit;
  let comfyApiListenersBound = false;

  function getComfyApi() {
    if (!comfyApi) {
      comfyApi = new ComfyApi(comfyApiUrl, comfyClientId, {
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
            statements.updateJobStatus.run(
              'running',
              null,
              startedAt,
              jobRow.completed_at ?? null,
              jobId
            );
          }
          getBroadcastJobUpdate()?.(jobId);
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
      getBroadcastJobUpdate()?.(jobId);
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
      getBroadcastJobUpdate()?.(jobId);
    });
    api.on('execution_success', (event) => {
      if (event?.detail?.prompt_id && runtimeState.currentExecutingPromptId === event.detail.prompt_id) {
        runtimeState.currentExecutingPromptId = null;
      }
      if (event?.detail?.prompt_id) {
        getFinalizeJobFromPrompt()?.(event.detail.prompt_id);
      }
    });
    api.on('execution_error', (event) => {
      if (event?.detail?.prompt_id && runtimeState.currentExecutingPromptId === event.detail.prompt_id) {
        runtimeState.currentExecutingPromptId = null;
      }
      if (event?.detail?.prompt_id) {
        const errorMessage =
          event?.detail?.exception_message || event?.detail?.exception_type || 'Execution failed';
        getFinalizeJobFromPrompt()?.(event.detail.prompt_id, { errorMessage });
      }
    });
    api.on('execution_interrupted', (event) => {
      if (event?.detail?.prompt_id && runtimeState.currentExecutingPromptId === event.detail.prompt_id) {
        runtimeState.currentExecutingPromptId = null;
      }
      if (event?.detail?.prompt_id) {
        getFinalizeJobFromPrompt()?.(event.detail.prompt_id, { errorMessage: 'Execution interrupted' });
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
        if (
          runtimeState.comfyWsConnected &&
          runtimeState.comfyWsConnectedId &&
          runtimeState.comfyWsConnectedId !== sid &&
          !runtimeState.comfyWsReconnectPending
        ) {
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
    getStartQueuePolling()?.();
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
    getBroadcastJobUpdate()?.(jobId);
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
    getBroadcastJobUpdate()?.(jobId);
  }

  return {
    getComfyApi,
    getComfyApiReady,
    ensureOverallEntry,
    isGeneratingStatus,
    getJobIdForPrompt,
    clearJobTransient
  };
}
