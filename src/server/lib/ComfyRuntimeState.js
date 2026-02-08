function createComfyEventStats() {
  return {
    lastEventAt: null,
    lastEventType: null,
    lastProgressAt: null,
    lastPreviewAt: null,
    lastExecutingAt: null,
    lastProgress: null,
    lastProgressRaw: null,
    counts: {
      all: 0,
      progress: 0,
      preview: 0,
      executing: 0,
      status: 0
    }
  };
}

export class ComfyRuntimeState {
  constructor() {
    this.jobProgressById = new Map();
    this.jobPreviewById = new Map();
    this.jobOverallById = new Map();
    this.promptJobIdByPromptId = new Map();
    this.queueState = {
      running: [],
      pending: [],
      remaining: null,
      updatedAt: 0,
      signature: ''
    };
    this.queuePollTimer = null;
    this.queueRemainingOverride = null;
    this.queueRemainingOverrideUpdatedAt = 0;
    this.lastActivePromptId = null;
    this.currentExecutingPromptId = null;
    this.resumeJobsPromise = null;
    this.comfyWsConnected = false;
    this.comfyWsConnectedId = null;
    this.comfyWsReconnectPending = false;
    this.promptFinalizeInFlight = new Set();
    this.comfyEventStats = createComfyEventStats();
  }

  clearJobTransient(jobId) {
    if (!jobId) return;
    this.jobProgressById.delete(jobId);
    this.jobPreviewById.delete(jobId);
    this.jobOverallById.delete(jobId);
  }
}
