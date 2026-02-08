import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { registerComfyRoutes } from './registerComfyRoutes.js';

function makeRuntimeState() {
  return {
    queueState: {
      running: [{ prompt_id: 'run-1' }],
      pending: [{ prompt_id: 'queued-1' }],
      remaining: 1,
      updatedAt: 123
    },
    comfyWsConnected: true,
    comfyWsConnectedId: 'sid-1',
    lastActivePromptId: 'run-1',
    currentExecutingPromptId: 'run-1',
    comfyEventStats: {
      lastEventAt: 88,
      lastEventType: 'progress',
      counts: { all: 1, progress: 2, preview: 0, executing: 1, status: 1 }
    },
    jobProgressById: new Map([[77, { value: 2, max: 10 }]]),
    jobPreviewById: new Map([[77, { url: 'data:image/png;base64,abc', updatedAt: 90 }]])
  };
}

describe('registerComfyRoutes', () => {
  it('returns websocket status details', async () => {
    const app = express();
    const runtimeState = makeRuntimeState();
    registerComfyRoutes(app, {
      path: {
        basename: (value) => value.split('/').pop()
      },
      runtimeState,
      getComfyApi: () => ({ id: 'api-1' }),
      getComfyApiReady: vi.fn(async () => ({ getSystemStats: vi.fn() })),
      getPromptIdFromQueueItem: (item) => item.prompt_id,
      getJobIdForPrompt: () => 77
    });

    const response = await request(app).get('/api/comfy/ws-status');

    expect(response.status).toBe(200);
    expect(response.body.connected).toBe(true);
    expect(response.body.queue.runningIds).toEqual(['run-1']);
    expect(response.body.currentJob.id).toBe(77);
    expect(response.body.currentJob.progress).toEqual({ value: 2, max: 10 });
  });

  it('returns system stats and handles errors', async () => {
    const appOk = express();
    registerComfyRoutes(appOk, {
      path: { basename: (v) => v },
      runtimeState: makeRuntimeState(),
      getComfyApi: () => null,
      getComfyApiReady: vi.fn(async () => ({
        getSystemStats: vi.fn(async () => ({ devices: [{ name: 'GPU' }] }))
      })),
      getPromptIdFromQueueItem: vi.fn(),
      getJobIdForPrompt: vi.fn()
    });
    const okResponse = await request(appOk).get('/api/comfy/stats');
    expect(okResponse.status).toBe(200);
    expect(okResponse.body.devices[0].name).toBe('GPU');

    const appFail = express();
    registerComfyRoutes(appFail, {
      path: { basename: (v) => v },
      runtimeState: makeRuntimeState(),
      getComfyApi: () => null,
      getComfyApiReady: vi.fn(async () => {
        throw new Error('offline');
      }),
      getPromptIdFromQueueItem: vi.fn(),
      getJobIdForPrompt: vi.fn()
    });
    const failResponse = await request(appFail).get('/api/comfy/stats');
    expect(failResponse.status).toBe(500);
    expect(failResponse.text).toContain('offline');
  });
});
