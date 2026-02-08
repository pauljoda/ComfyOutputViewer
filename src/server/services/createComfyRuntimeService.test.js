import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createComfyRuntimeService } from './createComfyRuntimeService.js';
import { makeGet, makeRun } from '../test/helpers.js';

vi.mock('@saintno/comfyui-sdk', () => {
  class MockComfyApi {
    constructor() {
      this.id = 'fake-api-id';
      this.handlers = new Map();
      this.socket = { client: { readyState: 1 } };
    }

    init() {
      return this;
    }

    waitForReady() {
      return Promise.resolve(this);
    }

    on(event, handler) {
      this.handlers.set(event, handler);
      return () => this.handlers.delete(event);
    }

    reconnectWs() {}
  }

  return { ComfyApi: MockComfyApi };
});

function createRuntimeState() {
  return {
    jobProgressById: new Map(),
    jobPreviewById: new Map(),
    jobOverallById: new Map(),
    promptJobIdByPromptId: new Map(),
    queueState: { running: [], pending: [], remaining: null, updatedAt: 0, signature: '' },
    queueRemainingOverride: null,
    queueRemainingOverrideUpdatedAt: 0,
    lastActivePromptId: null,
    currentExecutingPromptId: null,
    comfyWsConnected: true,
    comfyWsConnectedId: null,
    comfyWsReconnectPending: false,
    comfyEventStats: {
      lastEventAt: null,
      lastEventType: null,
      lastProgressAt: null,
      lastPreviewAt: null,
      lastExecutingAt: null,
      lastProgress: null,
      lastProgressRaw: null,
      counts: { all: 0, progress: 0, preview: 0, executing: 0, status: 0 }
    },
    clearJobTransient: vi.fn()
  };
}

describe('createComfyRuntimeService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes comfy api once and starts queue polling listener binding', async () => {
    const runtimeState = createRuntimeState();
    const startQueuePolling = vi.fn();
    const service = createComfyRuntimeService({
      comfyApiUrl: 'http://127.0.0.1:8188',
      comfyClientId: 'test-client',
      runtimeState,
      statements: {
        selectWorkflowById: makeGet(() => null),
        selectJobById: makeGet(() => null),
        selectJobByPromptId: makeGet(() => null),
        updateJobStatus: makeRun()
      },
      getBroadcastJobUpdate: () => vi.fn(),
      getFinalizeJobFromPrompt: () => vi.fn(),
      getStartQueuePolling: () => startQueuePolling
    });

    const apiOne = service.getComfyApi();
    const apiTwo = service.getComfyApi();
    await service.getComfyApiReady();

    expect(apiOne).toBe(apiTwo);
    expect(startQueuePolling).toHaveBeenCalledTimes(1);
  });

  it('builds and caches overall progress entry from workflow api json', () => {
    const runtimeState = createRuntimeState();
    const service = createComfyRuntimeService({
      comfyApiUrl: 'http://127.0.0.1:8188',
      comfyClientId: 'test-client',
      runtimeState,
      statements: {
        selectWorkflowById: makeGet(() => ({
          api_json: JSON.stringify({ '1': {}, '2': {}, '3': {} })
        })),
        selectJobById: makeGet(() => null),
        selectJobByPromptId: makeGet(() => null),
        updateJobStatus: makeRun()
      },
      getBroadcastJobUpdate: () => vi.fn(),
      getFinalizeJobFromPrompt: () => vi.fn(),
      getStartQueuePolling: () => vi.fn()
    });

    const first = service.ensureOverallEntry(7, 2);
    const second = service.ensureOverallEntry(7, 2);

    expect(first?.totalNodes).toBe(3);
    expect(second).toBe(first);
    expect(runtimeState.jobOverallById.get(7)).toBe(first);
  });

  it('resolves job id for prompt from cache and db fallback', () => {
    const runtimeState = createRuntimeState();
    runtimeState.promptJobIdByPromptId.set('prompt-a', 5);
    const statements = {
      selectWorkflowById: makeGet(() => null),
      selectJobById: makeGet((id) =>
        id === 5 ? { id: 5, prompt_id: 'prompt-a' } : null
      ),
      selectJobByPromptId: makeGet((promptId) =>
        promptId === 'prompt-b' ? { id: 9, prompt_id: 'prompt-b' } : null
      ),
      updateJobStatus: makeRun()
    };
    const service = createComfyRuntimeService({
      comfyApiUrl: 'http://127.0.0.1:8188',
      comfyClientId: 'test-client',
      runtimeState,
      statements,
      getBroadcastJobUpdate: () => vi.fn(),
      getFinalizeJobFromPrompt: () => vi.fn(),
      getStartQueuePolling: () => vi.fn()
    });

    expect(service.getJobIdForPrompt('prompt-a')).toBe(5);
    expect(service.getJobIdForPrompt('prompt-b')).toBe(9);
    expect(runtimeState.promptJobIdByPromptId.get('prompt-b')).toBe(9);
    expect(service.getJobIdForPrompt('missing')).toBeNull();
  });

  it('clears transient job data through runtime state', () => {
    const runtimeState = createRuntimeState();
    const service = createComfyRuntimeService({
      comfyApiUrl: 'http://127.0.0.1:8188',
      comfyClientId: 'test-client',
      runtimeState,
      statements: {
        selectWorkflowById: makeGet(() => null),
        selectJobById: makeGet(() => null),
        selectJobByPromptId: makeGet(() => null),
        updateJobStatus: makeRun()
      },
      getBroadcastJobUpdate: () => vi.fn(),
      getFinalizeJobFromPrompt: () => vi.fn(),
      getStartQueuePolling: () => vi.fn()
    });

    service.clearJobTransient(15);
    expect(runtimeState.clearJobTransient).toHaveBeenCalledWith(15);
  });
});
