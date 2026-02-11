import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWorkflowExecutionService } from './createWorkflowExecutionService.js';
import { makeGet, makeIterable, makeRun } from '../test/helpers.js';

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7YxYQAAAAASUVORK5CYII=',
  'base64'
);

async function createTempDir(prefix) {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

async function hashFile(filePath) {
  const buffer = await fs.readFile(filePath);
  return createHash('sha256').update(buffer).digest('hex');
}

function createStatements(overrides = {}) {
  return {
    selectJobOutputs: makeIterable([]),
    insertJobOutput: makeRun(),
    insertImagePrompt: makeRun(),
    insertTag: makeRun(),
    selectWorkflowById: makeGet(() => null),
    selectJobByPromptId: makeGet(() => null),
    selectWorkflowInputs: makeIterable([]),
    selectJobInputs: makeIterable([]),
    updateJobStatus: makeRun(),
    selectJobById: makeGet(() => null),
    ...overrides
  };
}

describe('createWorkflowExecutionService', () => {
  const tempRoots = [];

  afterEach(async () => {
    await Promise.all(tempRoots.map((dir) => fs.rm(dir, { recursive: true, force: true })));
    tempRoots.length = 0;
  });

  async function makeService({ statements = createStatements(), api } = {}) {
    const root = await createTempDir('cov-workflow-exec-');
    tempRoots.push(root);
    const sourceDir = path.join(root, 'source');
    const dataDir = path.join(root, 'data');
    await fs.mkdir(sourceDir, { recursive: true });
    await fs.mkdir(dataDir, { recursive: true });

    const runtimeState = {
      promptFinalizeInFlight: new Set(),
      currentExecutingPromptId: null
    };
    const ensureThumbnail = vi.fn();
    const syncSourceToData = vi.fn(async () => ({ copied: 0, scanned: 0 }));
    const clearJobTransient = vi.fn();
    const broadcast = vi.fn();

    const service = createWorkflowExecutionService({
      statements,
      runtimeState,
      path,
      fs,
      createHash,
      existsSync,
      sourceDir,
      dataDir,
      getComfyApiReady: vi.fn(async () => api),
      isHashBlacklisted: vi.fn(() => false),
      hashFile,
      ensureDir: (dirPath) => fs.mkdir(dirPath, { recursive: true }),
      ensureThumbnail,
      syncSourceToData,
      clearJobTransient,
      getBroadcastJobUpdate: () => broadcast
    });

    return {
      root,
      sourceDir,
      dataDir,
      runtimeState,
      service,
      ensureThumbnail,
      syncSourceToData,
      clearJobTransient,
      broadcast
    };
  }

  it('collects image outputs from comfy history payloads', async () => {
    const { service } = await makeService({
      api: {
        getHistory: vi.fn(),
        getHistories: vi.fn(),
        getImage: vi.fn()
      }
    });

    const outputs = service.collectImageOutputs({
      a: { images: [{ filename: 'x.png', subfolder: 'nested', type: 'output' }] },
      b: { images: [{ filename: 'y.png' }] }
    });

    expect(outputs).toEqual([
      { filename: 'x.png', subfolder: 'nested', type: 'output' },
      { filename: 'y.png', subfolder: '', type: 'output' }
    ]);
  });

  it('falls back to getHistories when direct history lookup fails', async () => {
    const api = {
      getHistory: vi.fn(async () => {
        throw new Error('transient');
      }),
      getHistories: vi.fn(async () => ({ abc: { outputs: {} } })),
      getImage: vi.fn()
    };
    const { service } = await makeService({ api });

    const result = await service.fetchPromptHistory('abc', { allowFallback: true });

    expect(result).toEqual({ outputs: {} });
    expect(api.getHistories).toHaveBeenCalledTimes(1);
  });

  it('finalizes with an explicit error and clears transient state', async () => {
    const statements = createStatements({
      selectJobByPromptId: makeGet(() => ({
        id: 9,
        workflow_id: 4,
        status: 'running'
      }))
    });
    const { service, clearJobTransient, broadcast } = await makeService({
      statements,
      api: {
        getHistory: vi.fn(),
        getHistories: vi.fn(),
        getImage: vi.fn()
      }
    });

    await service.finalizeJobFromPrompt('prompt-9', { errorMessage: 'boom' });

    expect(statements.updateJobStatus.run).toHaveBeenCalledWith(
      'error',
      'boom',
      null,
      expect.any(Number),
      9
    );
    expect(clearJobTransient).toHaveBeenCalledWith(9);
    expect(broadcast).toHaveBeenCalledWith(9);
  });

  it('records outputs and marks job completed when history has images', async () => {
    const statements = createStatements({
      selectJobByPromptId: makeGet(() => ({
        id: 11,
        workflow_id: 2,
        status: 'running'
      })),
      selectWorkflowInputs: makeIterable([
        { id: 71, input_key: 'prompt', input_type: 'text', label: 'Prompt' }
      ]),
      selectJobInputs: makeIterable([{ input_id: 71, value: 'forest' }])
    });
    const api = {
      getHistory: vi.fn(async () => ({
        outputs: {
          nodeA: {
            images: [{ filename: 'render.png', subfolder: '', type: 'output' }]
          }
        },
        status: { completed: true, status_str: 'success' }
      })),
      getHistories: vi.fn(),
      getImage: vi.fn()
    };
    const { service, sourceDir, ensureThumbnail, syncSourceToData, clearJobTransient, broadcast } =
      await makeService({ statements, api });

    await fs.writeFile(path.join(sourceDir, 'render.png'), PNG_1X1);
    await service.finalizeJobFromPrompt('prompt-11');

    expect(statements.insertJobOutput.run).toHaveBeenCalledWith(
      11,
      'render.png',
      'render.png',
      expect.any(Number),
      expect.any(String)
    );
    expect(statements.insertImagePrompt.run).toHaveBeenCalledTimes(1);
    expect(ensureThumbnail).toHaveBeenCalledTimes(1);
    expect(syncSourceToData).toHaveBeenCalledTimes(1);
    expect(statements.updateJobStatus.run).toHaveBeenCalledWith(
      'completed',
      null,
      null,
      expect.any(Number),
      11
    );
    expect(clearJobTransient).toHaveBeenCalledWith(11);
    expect(broadcast).toHaveBeenCalledWith(11);
  });

  it('applies workflow auto-tags to generated outputs when enabled', async () => {
    const statements = createStatements({
      selectWorkflowById: makeGet(() => ({
        id: 2,
        auto_tag_enabled: 1,
        auto_tag_input_refs: JSON.stringify(['10:prompt']),
        auto_tag_max_words: 2
      })),
      selectJobByPromptId: makeGet(() => ({
        id: 11,
        workflow_id: 2,
        status: 'running'
      })),
      selectWorkflowInputs: makeIterable([
        { id: 71, node_id: '10', input_key: 'prompt', input_type: 'text', label: 'Prompt' },
        { id: 72, node_id: '10', input_key: 'negative', input_type: 'negative', label: 'Negative' }
      ]),
      selectJobInputs: makeIterable([
        {
          input_id: 71,
          value: '!!portrait!!, moody lighting setup, ?!dr. person!!!, [cinematic], ###person_talking###'
        },
        { input_id: 72, value: 'bad anatomy, blurry' }
      ])
    });
    const api = {
      getHistory: vi.fn(async () => ({
        outputs: {
          nodeA: {
            images: [{ filename: 'render.png', subfolder: '', type: 'output' }]
          }
        },
        status: { completed: true, status_str: 'success' }
      })),
      getHistories: vi.fn(),
      getImage: vi.fn()
    };
    const { service, sourceDir } = await makeService({ statements, api });

    await fs.writeFile(path.join(sourceDir, 'render.png'), PNG_1X1);
    await service.finalizeJobFromPrompt('prompt-11');

    expect(statements.insertTag.run).toHaveBeenCalledWith('render.png', 'portrait');
    expect(statements.insertTag.run).toHaveBeenCalledWith('render.png', 'dr. person');
    expect(statements.insertTag.run).toHaveBeenCalledWith('render.png', 'cinematic');
    expect(statements.insertTag.run).toHaveBeenCalledWith('render.png', 'person_talking');
    expect(statements.insertTag.run).not.toHaveBeenCalledWith('render.png', 'moody lighting setup');
    expect(statements.insertTag.run).not.toHaveBeenCalledWith('render.png', 'bad anatomy');
  });
});
