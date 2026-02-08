import { describe, expect, it } from 'vitest';
import { ComfyRuntimeState } from './ComfyRuntimeState.js';

describe('ComfyRuntimeState', () => {
  it('initializes with expected defaults', () => {
    const state = new ComfyRuntimeState();
    expect(state.jobProgressById.size).toBe(0);
    expect(state.queueState.running).toEqual([]);
    expect(state.queueState.pending).toEqual([]);
    expect(state.queueState.remaining).toBeNull();
    expect(state.comfyWsConnected).toBe(false);
    expect(state.comfyEventStats.counts.progress).toBe(0);
  });

  it('clears per-job transient maps', () => {
    const state = new ComfyRuntimeState();
    state.jobProgressById.set(1, { value: 3, max: 10 });
    state.jobPreviewById.set(1, { url: 'data:image/png;base64,abc', updatedAt: Date.now() });
    state.jobOverallById.set(1, { totalNodes: 20, executedNodes: new Set(['1']), updatedAt: Date.now() });

    state.clearJobTransient(1);

    expect(state.jobProgressById.has(1)).toBe(false);
    expect(state.jobPreviewById.has(1)).toBe(false);
    expect(state.jobOverallById.has(1)).toBe(false);
  });
});
