import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { registerWorkflowRoutes } from './registerWorkflowRoutes.js';
import { makeGet, makeIterable, makeRun } from '../test/helpers.js';

function createRuntimeState() {
  return {
    jobProgressById: new Map(),
    jobPreviewById: new Map(),
    jobOverallById: new Map(),
    queueState: { running: [], pending: [], remaining: null, updatedAt: 0 },
    comfyWsConnected: false,
    comfyEventStats: {
      lastEventAt: null,
      lastEventType: null,
      counts: { preview: 0 }
    },
    currentExecutingPromptId: null,
    promptJobIdByPromptId: new Map()
  };
}

function createBaseDeps(overrides = {}) {
  const jobStore = new Map();
  const workflows = [
    {
      id: 1,
      name: 'WF 1',
      description: null,
      api_json: JSON.stringify({
        '10': { inputs: { prompt: 'old', seed: 1 } },
        '20': { inputs: { image: 'x.png' } }
      }),
      folder_id: null,
      sort_order: 0,
      created_at: 1,
      updated_at: 1
    }
  ];
  const workflowInputs = [
    {
      id: 900,
      workflow_id: 1,
      node_id: '10',
      input_key: 'prompt',
      input_type: 'text',
      label: 'Prompt'
    },
    {
      id: 901,
      workflow_id: 1,
      node_id: '20',
      input_key: 'image',
      input_type: 'image',
      label: 'Image'
    }
  ];

  const statements = {
    selectWorkflowFolders: makeIterable([]),
    insertWorkflowFolder: makeRun(() => ({ lastInsertRowid: 33 })),
    selectWorkflowFolderById: makeGet(() => null),
    updateWorkflowFolder: makeRun(),
    deleteWorkflowFolder: makeRun(),
    updateWorkflowFolderSortOrder: makeRun(),
    selectWorkflows: makeIterable(workflows),
    selectWorkflowById: makeGet((id) => workflows.find((wf) => wf.id === id)),
    selectWorkflowsByFolder: makeIterable([]),
    selectWorkflowsWithoutFolder: makeIterable([]),
    insertWorkflow: makeRun(() => ({ lastInsertRowid: 1 })),
    insertWorkflowInput: makeRun(),
    updateWorkflow: makeRun(),
    deleteWorkflowInputs: makeRun(),
    deleteJobInputsByWorkflowId: makeRun(),
    deleteWorkflow: makeRun(),
    updateWorkflowFolderAndOrder: makeRun(),
    selectWorkflowInputs: makeIterable(workflowInputs),
    selectJobsByWorkflow: makeIterable([]),
    selectJobById: makeGet((id) => jobStore.get(id)),
    selectJobByPromptId: makeGet((promptId) =>
      Array.from(jobStore.values()).find((job) => job.prompt_id === promptId)
    ),
    insertJob: makeRun((workflowId, promptId, status, createdAt) => {
      const id = 100;
      jobStore.set(id, {
        id,
        workflow_id: workflowId,
        prompt_id: promptId,
        status,
        error_message: null,
        created_at: createdAt,
        started_at: null,
        completed_at: null
      });
      return { lastInsertRowid: id };
    }),
    updateJobStatus: makeRun((status, errorMessage, startedAt, completedAt, jobId) => {
      const job = jobStore.get(jobId);
      if (!job) return;
      job.status = status;
      job.error_message = errorMessage;
      if (startedAt !== null && startedAt !== undefined) {
        job.started_at = startedAt;
      }
      job.completed_at = completedAt;
    }),
    updateJobPromptId: makeRun((promptId, jobId) => {
      const job = jobStore.get(jobId);
      if (job) job.prompt_id = promptId;
    }),
    selectJobOutputs: makeIterable([]),
    selectJobInputs: makeIterable([]),
    insertJobInput: makeRun(),
    insertJobOutput: makeRun(),
    selectImagePrompt: makeGet(() => null),
    insertImagePrompt: makeRun()
  };

  const deps = {
    statements,
    runTransaction: (fn) => fn(),
    getComfyApiReady: vi.fn(async () => ({
      queuePrompt: vi.fn(async (_priority, prompt) => {
        // Verify prompt input substitution from /run
        expect(prompt['10'].inputs.prompt).toBe('hello world');
        expect(prompt['20'].inputs.image).toBe('picked.png');
        return { prompt_id: 'prompt-100' };
      }),
      interrupt: vi.fn(async () => {})
    })),
    getPromptIdFromQueueItem: (item) => item?.prompt_id ?? null,
    clearJobTransient: vi.fn(),
    isGeneratingStatus: (status) => status === 'pending' || status === 'queued' || status === 'running',
    pollJobCompletion: vi.fn(),
    runtimeState: createRuntimeState(),
    fetchImageOutputsWithRetry: vi.fn(async () => []),
    fetchPromptHistory: vi.fn(async () => null),
    collectImageOutputs: vi.fn(() => []),
    downloadAndRecordOutputs: vi.fn(async () => 0),
    ensureOverallEntry: vi.fn(() => ({ totalNodes: 2, executedNodes: new Set(), updatedAt: Date.now() })),
    getQueueInfoForPrompt: vi.fn(() => null),
    getThumbUrl: vi.fn((imagePath) => `/images/.thumbs/${imagePath}.jpg`),
    resolveDataPath: vi.fn((imagePath) => `/tmp/data/${imagePath}`),
    isHashBlacklisted: vi.fn(() => false),
    existsSync: vi.fn(() => true),
    wsClients: new Set(),
    setBroadcastJobUpdate: vi.fn(),
    ...overrides
  };

  return { deps, jobStore };
}

describe('registerWorkflowRoutes', () => {
  it('lists workflows and parses api json', async () => {
    const app = express();
    app.use(express.json());
    const { deps } = createBaseDeps();
    registerWorkflowRoutes(app, deps);

    const response = await request(app).get('/api/workflows');

    expect(response.status).toBe(200);
    expect(response.body.workflows).toHaveLength(1);
    expect(response.body.workflows[0].apiJson['10']).toBeTruthy();
  });

  it('validates workflow folder reorder payload', async () => {
    const app = express();
    app.use(express.json());
    const { deps } = createBaseDeps();
    registerWorkflowRoutes(app, deps);

    const response = await request(app).post('/api/workflow-folders/reorder').send({});
    expect(response.status).toBe(400);
  });

  it('validates missing workflow creation payload', async () => {
    const app = express();
    app.use(express.json());
    const { deps } = createBaseDeps();
    registerWorkflowRoutes(app, deps);

    const response = await request(app).post('/api/workflows').send({ name: '' });
    expect(response.status).toBe(400);
  });

  it('runs workflow, persists job, and queues prompt', async () => {
    const app = express();
    app.use(express.json());
    const { deps, jobStore } = createBaseDeps();
    registerWorkflowRoutes(app, deps);

    const response = await request(app).post('/api/workflows/1/run').send({
      inputs: [
        { inputId: 900, value: 'hello world' },
        {
          inputId: 901,
          value: { filename: 'picked.png', subfolder: 'inputs', type: 'input' }
        }
      ]
    });

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.promptId).toBe('prompt-100');
    expect(jobStore.get(100)?.prompt_id).toBe('prompt-100');
    expect(deps.pollJobCompletion).toHaveBeenCalledWith(
      100,
      'prompt-100',
      expect.any(Array),
      expect.any(Map),
      1
    );
  });

  it('returns non-interrupt result for terminal jobs on cancel', async () => {
    const app = express();
    app.use(express.json());
    const { deps } = createBaseDeps({
      statements: {
        ...createBaseDeps().deps.statements,
        selectJobById: makeGet(() => ({
          id: 50,
          status: 'completed',
          prompt_id: 'prompt-complete',
          started_at: 1
        }))
      }
    });
    registerWorkflowRoutes(app, deps);

    const response = await request(app).post('/api/jobs/50/cancel');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: false, status: 'completed' });
  });

  it('trigger-schema returns text-based fields and example', async () => {
    const app = express();
    app.use(express.json());
    const { deps } = createBaseDeps();
    registerWorkflowRoutes(app, deps);

    const response = await request(app).get('/api/workflows/1/trigger-schema');

    expect(response.status).toBe(200);
    expect(response.body.workflowId).toBe(1);
    expect(response.body.workflowName).toBe('WF 1');
    expect(response.body.endpoint).toBe('/api/workflows/1/trigger');
    expect(response.body.method).toBe('POST');
    // Should only include text input (id 900), not image input (id 901)
    expect(response.body.fields).toHaveLength(1);
    expect(response.body.fields[0].label).toBe('Prompt');
    expect(response.body.fields[0].type).toBe('text');
    expect(response.body.example).toHaveProperty('Prompt');
  });

  it('trigger-schema returns 404 for missing workflow', async () => {
    const app = express();
    app.use(express.json());
    const { deps } = createBaseDeps();
    registerWorkflowRoutes(app, deps);

    const response = await request(app).get('/api/workflows/999/trigger-schema');
    expect(response.status).toBe(404);
  });

  it('trigger maps label-based inputs and queues workflow', async () => {
    const app = express();
    app.use(express.json());
    const queueMock = vi.fn(async () => ({ prompt_id: 'trigger-prompt-1' }));
    const { deps, jobStore } = createBaseDeps({
      getComfyApiReady: vi.fn(async () => ({
        queuePrompt: queueMock,
        interrupt: vi.fn(async () => {})
      }))
    });
    registerWorkflowRoutes(app, deps);

    const response = await request(app).post('/api/workflows/1/trigger').send({
      'Prompt': 'a beautiful sunset'
    });

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.jobId).toBe(100);
    expect(response.body.promptId).toBe('trigger-prompt-1');
    // Verify the prompt JSON was modified correctly
    const queuedPrompt = queueMock.mock.calls[0][1];
    expect(queuedPrompt['10'].inputs.prompt).toBe('a beautiful sunset');
    // Image node should be untouched (not a text type)
    expect(queuedPrompt['20'].inputs.image).toBe('x.png');
    expect(jobStore.get(100)?.prompt_id).toBe('trigger-prompt-1');
  });

  it('trigger falls back to input_key matching', async () => {
    const app = express();
    app.use(express.json());
    const queueMock = vi.fn(async () => ({ prompt_id: 'trigger-prompt-2' }));
    const { deps } = createBaseDeps({
      getComfyApiReady: vi.fn(async () => ({
        queuePrompt: queueMock,
        interrupt: vi.fn(async () => {})
      }))
    });
    registerWorkflowRoutes(app, deps);

    // Use input_key 'prompt' instead of label 'Prompt'
    const response = await request(app).post('/api/workflows/1/trigger').send({
      'prompt': 'test via input key'
    });

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    const queuedPrompt = queueMock.mock.calls[0][1];
    expect(queuedPrompt['10'].inputs.prompt).toBe('test via input key');
  });

  it('trigger uses default values for missing inputs', async () => {
    const app = express();
    app.use(express.json());
    const queueMock = vi.fn(async () => ({ prompt_id: 'trigger-prompt-3' }));
    // Create workflow inputs with default values
    const inputsWithDefaults = [
      {
        id: 900,
        workflow_id: 1,
        node_id: '10',
        input_key: 'prompt',
        input_type: 'text',
        label: 'Prompt',
        default_value: 'default prompt text'
      },
      {
        id: 901,
        workflow_id: 1,
        node_id: '20',
        input_key: 'image',
        input_type: 'image',
        label: 'Image'
      }
    ];
    const { deps } = createBaseDeps({
      getComfyApiReady: vi.fn(async () => ({
        queuePrompt: queueMock,
        interrupt: vi.fn(async () => {})
      })),
      statements: {
        ...createBaseDeps().deps.statements,
        selectWorkflowInputs: makeIterable(inputsWithDefaults)
      }
    });
    registerWorkflowRoutes(app, deps);

    // Send empty body - should use defaults
    const response = await request(app).post('/api/workflows/1/trigger').send({});

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    const queuedPrompt = queueMock.mock.calls[0][1];
    expect(queuedPrompt['10'].inputs.prompt).toBe('default prompt text');
  });

  it('trigger returns 404 for missing workflow', async () => {
    const app = express();
    app.use(express.json());
    const { deps } = createBaseDeps();
    registerWorkflowRoutes(app, deps);

    const response = await request(app).post('/api/workflows/999/trigger').send({
      'Prompt': 'test'
    });
    expect(response.status).toBe(404);
  });

  it('trigger handles number and seed types correctly', async () => {
    const app = express();
    app.use(express.json());
    const queueMock = vi.fn(async () => ({ prompt_id: 'trigger-prompt-4' }));
    const numericInputs = [
      {
        id: 900,
        workflow_id: 1,
        node_id: '10',
        input_key: 'prompt',
        input_type: 'text',
        label: 'Prompt'
      },
      {
        id: 902,
        workflow_id: 1,
        node_id: '10',
        input_key: 'seed',
        input_type: 'seed',
        label: 'Seed'
      }
    ];
    const { deps } = createBaseDeps({
      getComfyApiReady: vi.fn(async () => ({
        queuePrompt: queueMock,
        interrupt: vi.fn(async () => {})
      })),
      statements: {
        ...createBaseDeps().deps.statements,
        selectWorkflowInputs: makeIterable(numericInputs)
      }
    });
    registerWorkflowRoutes(app, deps);

    const response = await request(app).post('/api/workflows/1/trigger').send({
      'Prompt': 'test',
      'Seed': '42'
    });

    expect(response.status).toBe(200);
    const queuedPrompt = queueMock.mock.calls[0][1];
    expect(queuedPrompt['10'].inputs.prompt).toBe('test');
    expect(queuedPrompt['10'].inputs.seed).toBe(42);
  });

  it('returns mock live payload details for seeded generating jobs in mock mode', async () => {
    const previousMockMode = process.env.MOCK_DEV_MODE;
    process.env.MOCK_DEV_MODE = '1';

    try {
      const app = express();
      app.use(express.json());
      const runningJob = {
        id: 501,
        workflow_id: 1,
        prompt_id: 'mock-seed:running:text2img',
        status: 'running',
        error_message: null,
        created_at: Date.now() - 15_000,
        started_at: Date.now() - 12_000,
        completed_at: null
      };
      const { deps } = createBaseDeps({
        statements: {
          ...createBaseDeps().deps.statements,
          selectJobsByWorkflow: makeIterable([runningJob]),
          selectJobById: makeGet(() => runningJob)
        }
      });
      registerWorkflowRoutes(app, deps);

      const response = await request(app).get('/api/workflows/1/jobs');

      expect(response.status).toBe(200);
      expect(response.body.jobs).toHaveLength(1);
      expect(response.body.jobs[0].status).toBe('running');
      expect(response.body.jobs[0].progress).toEqual(
        expect.objectContaining({
          value: 17,
          max: 30,
          node: 'KSampler'
        })
      );
      expect(response.body.jobs[0].queue).toEqual(
        expect.objectContaining({
          state: 'running',
          position: 1
        })
      );
      expect(response.body.jobs[0].preview).toEqual(
        expect.objectContaining({
          url: '/images/portraits/studio-subject.jpg'
        })
      );
    } finally {
      if (previousMockMode === undefined) {
        delete process.env.MOCK_DEV_MODE;
      } else {
        process.env.MOCK_DEV_MODE = previousMockMode;
      }
    }
  });
});
