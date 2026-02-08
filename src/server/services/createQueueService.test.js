import { describe, expect, it, vi } from 'vitest';
import { createQueueService } from './createQueueService.js';
import { makeGet, makeIterable, makeRun } from '../test/helpers.js';

function createRuntimeState() {
  return {
    queueState: {
      running: [],
      pending: [],
      remaining: null,
      updatedAt: 0,
      signature: ''
    },
    queuePollTimer: null,
    queueRemainingOverride: null,
    queueRemainingOverrideUpdatedAt: 0,
    lastActivePromptId: null,
    currentExecutingPromptId: null,
    resumeJobsPromise: null,
    promptJobIdByPromptId: new Map()
  };
}

function createStatements(overrides = {}) {
  return {
    selectGeneratingJobs: makeIterable([]),
    selectGeneratingJobDetails: makeIterable([]),
    selectWorkflowInputs: makeIterable([]),
    selectJobInputs: makeIterable([]),
    updateJobStatus: makeRun(),
    ...overrides
  };
}

describe('createQueueService', () => {
  it('extracts prompt id from nested queue structures', () => {
    const service = createQueueService({
      runtimeState: createRuntimeState(),
      statements: createStatements(),
      getComfyApiReady: vi.fn(),
      queueRemainingOverrideTtlMs: 1000,
      ensureOverallEntry: vi.fn(),
      getPollJobCompletion: vi.fn(),
      getBroadcastJobUpdate: vi.fn()
    });

    expect(service.getPromptIdFromQueueItem('abc')).toBe('abc');
    expect(service.getPromptIdFromQueueItem(['x', 'prompt-1'])).toBe('prompt-1');
    expect(service.getPromptIdFromQueueItem({ nested: { prompt_id: 'prompt-2' } })).toBe('prompt-2');
    expect(service.getPromptIdFromQueueItem(null)).toBeNull();
  });

  it('returns queue info for running and pending prompts', () => {
    const runtimeState = createRuntimeState();
    runtimeState.queueState.running = [{ prompt_id: 'run-1' }];
    runtimeState.queueState.pending = [{ prompt_id: 'queued-1' }, { prompt_id: 'queued-2' }];
    runtimeState.queueState.remaining = 2;
    runtimeState.queueState.updatedAt = 42;

    const service = createQueueService({
      runtimeState,
      statements: createStatements(),
      getComfyApiReady: vi.fn(),
      queueRemainingOverrideTtlMs: 1000,
      ensureOverallEntry: vi.fn(),
      getPollJobCompletion: vi.fn(),
      getBroadcastJobUpdate: vi.fn()
    });

    expect(service.getQueueInfoForPrompt('run-1')).toMatchObject({
      state: 'running',
      position: 1,
      ahead: 0,
      total: 3
    });
    expect(service.getQueueInfoForPrompt('queued-2')).toMatchObject({
      state: 'queued',
      position: 3,
      ahead: 2,
      total: 3
    });
    expect(service.getQueueInfoForPrompt('missing')).toMatchObject({
      state: 'unknown',
      total: 3
    });
  });

  it('resumes generating jobs and reattaches polling/broadcast state', async () => {
    const runtimeState = createRuntimeState();
    const api = {
      getQueue: vi.fn(async () => ({
        queue_running: [{ prompt_id: 'prompt-a' }],
        queue_pending: [{ prompt_id: 'prompt-b' }]
      }))
    };
    const ensureOverallEntry = vi.fn();
    const pollJobCompletion = vi.fn();
    const broadcast = vi.fn();
    const statements = createStatements({
      selectGeneratingJobDetails: makeIterable([
        { id: 10, workflow_id: 101, prompt_id: 'prompt-a', started_at: 99 },
        { id: 11, workflow_id: 102, prompt_id: null, started_at: null }
      ]),
      selectWorkflowInputs: makeIterable([{ id: 501 }]),
      selectJobInputs: makeIterable([{ input_id: 501, value: 'hello' }])
    });

    const service = createQueueService({
      runtimeState,
      statements,
      getComfyApiReady: vi.fn(async () => api),
      queueRemainingOverrideTtlMs: 1000,
      ensureOverallEntry,
      getPollJobCompletion: () => pollJobCompletion,
      getBroadcastJobUpdate: () => broadcast
    });

    await service.resumeGeneratingJobs();

    expect(runtimeState.currentExecutingPromptId).toBe('prompt-a');
    expect(ensureOverallEntry).toHaveBeenCalledWith(10, 101);
    expect(statements.updateJobStatus.run).toHaveBeenCalledWith('running', null, 99, null, 10);
    expect(statements.updateJobStatus.run).toHaveBeenCalledWith(
      'error',
      'Server restarted before prompt was queued.',
      null,
      expect.any(Number),
      11
    );
    expect(pollJobCompletion).toHaveBeenCalledWith(
      10,
      'prompt-a',
      [{ id: 501 }],
      expect.any(Map),
      101
    );
    expect(broadcast).toHaveBeenCalledWith(10);
    expect(broadcast).toHaveBeenCalledWith(11);
  });
});
