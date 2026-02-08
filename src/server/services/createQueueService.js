export function createQueueService({
  runtimeState,
  statements,
  getComfyApiReady,
  queueRemainingOverrideTtlMs,
  ensureOverallEntry,
  getPollJobCompletion,
  getBroadcastJobUpdate
}) {
  const mockDevMode = process.env.MOCK_DEV_MODE === '1';
  const mockPromptPrefix = 'mock-seed:';

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
      now - runtimeState.queueRemainingOverrideUpdatedAt > queueRemainingOverrideTtlMs
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
      getBroadcastJobUpdate()?.(row.id);
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
          getBroadcastJobUpdate()?.(jobRow.id);
          continue;
        }

        if (mockDevMode && promptId.startsWith(mockPromptPrefix)) {
          runtimeState.promptJobIdByPromptId.set(promptId, jobRow.id);
          getBroadcastJobUpdate()?.(jobRow.id);
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

        getPollJobCompletion()?.(
          jobRow.id,
          promptId,
          workflowInputs,
          inputValuesMap,
          jobRow.workflow_id
        );
        getBroadcastJobUpdate()?.(jobRow.id);
      }
    })();
    return runtimeState.resumeJobsPromise;
  }

  return {
    getPromptIdFromQueueItem,
    getQueueInfoForPrompt,
    startQueuePolling,
    resumeGeneratingJobs
  };
}
