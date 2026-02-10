import { describe, expect, it, vi } from 'vitest';
import { createMcpServer } from './createMcpServer.js';

function makeIterable(rows = []) {
  return {
    iterate: vi.fn(() => rows)
  };
}

function makeGet(fn = () => undefined) {
  return {
    get: vi.fn(fn)
  };
}

function createTestDeps(overrides = {}) {
  const workflows = [
    { id: 1, name: 'Text2Img', description: 'Generate images from text' },
    { id: 2, name: 'Upscale', description: null }
  ];
  const workflowInputs = {
    1: [
      { id: 10, label: 'Positive Prompt', input_key: 'prompt', input_type: 'text', default_value: 'a cat' },
      { id: 11, label: 'Steps', input_key: 'steps', input_type: 'number', default_value: '30' },
      { id: 12, label: 'Image', input_key: 'image', input_type: 'image', default_value: null }
    ],
    2: [
      { id: 20, label: 'Scale', input_key: 'scale', input_type: 'number', default_value: '2' }
    ]
  };

  return {
    statements: {
      selectWorkflows: makeIterable(workflows),
      selectWorkflowInputs: {
        iterate: vi.fn((workflowId) => workflowInputs[workflowId] || [])
      },
      selectWorkflowById: makeGet((id) => workflows.find((w) => w.id === id))
    },
    resolveTriggeredInputValues: vi.fn((inputs, body) => {
      const map = new Map();
      for (const [key, value] of Object.entries(body || {})) {
        const input = inputs.find((i) => i.label.toLowerCase() === key.toLowerCase());
        if (input) map.set(input.id, String(value));
      }
      return map;
    }),
    executeWorkflowFromInputMap: vi.fn(async ({ workflowId }) => ({
      ok: true,
      jobId: 42,
      promptId: 'test-prompt-42'
    })),
    buildJobPayload: vi.fn((jobId) => {
      if (jobId === 42) {
        return {
          id: 42,
          status: 'completed',
          errorMessage: null,
          createdAt: 1000,
          completedAt: 2000,
          outputs: [
            { imagePath: 'output/image1.png', exists: true }
          ],
          progress: null,
          overall: null
        };
      }
      return null;
    }),
    ...overrides
  };
}

// Helper to call an MCP tool directly by extracting the handler.
// The SDK stores tools as plain object properties with a `handler` function.
async function callTool(server, toolName, args = {}) {
  const tools = server._registeredTools;
  const toolEntry = tools?.[toolName];
  if (!toolEntry) {
    throw new Error(`Tool ${toolName} not found. Available: ${Object.keys(tools || {}).join(', ')}`);
  }
  return toolEntry.handler(args);
}

describe('createMcpServer', () => {
  it('creates server with expected tools', () => {
    const deps = createTestDeps();
    const server = createMcpServer(deps);
    expect(server).toBeTruthy();
    // Verify the tools are registered
    const tools = server._registeredTools;
    expect(tools).toBeTruthy();
    expect('list_workflows' in tools).toBe(true);
    expect('run_workflow' in tools).toBe(true);
    expect('get_job_status' in tools).toBe(true);
  });

  it('list_workflows returns workflows with text-based inputs only', async () => {
    const deps = createTestDeps();
    const server = createMcpServer(deps);
    const result = await callTool(server, 'list_workflows');

    expect(result.content).toHaveLength(1);
    const workflows = JSON.parse(result.content[0].text);
    expect(workflows).toHaveLength(2);

    // First workflow should have 2 text inputs (prompt + steps), not 3 (image excluded)
    expect(workflows[0].name).toBe('Text2Img');
    expect(workflows[0].inputs).toHaveLength(2);
    expect(workflows[0].inputs[0].label).toBe('Positive Prompt');
    expect(workflows[0].inputs[1].label).toBe('Steps');

    // Second workflow should have 1 input
    expect(workflows[1].name).toBe('Upscale');
    expect(workflows[1].inputs).toHaveLength(1);
  });

  it('run_workflow calls executeWorkflowFromInputMap and returns job info', async () => {
    const deps = createTestDeps();
    const server = createMcpServer(deps);
    const result = await callTool(server, 'run_workflow', {
      workflowId: 1,
      inputs: { 'Positive Prompt': 'a sunset', Steps: 45 }
    });

    expect(result.isError).toBeFalsy();
    const response = JSON.parse(result.content[0].text);
    expect(response.ok).toBe(true);
    expect(response.jobId).toBe(42);
    expect(response.appliedInputs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'Positive Prompt',
          value: 'a sunset'
        }),
        expect.objectContaining({
          label: 'Steps',
          value: '45'
        })
      ])
    );
    expect(deps.executeWorkflowFromInputMap).toHaveBeenCalled();
  });

  it('run_workflow returns error for missing workflow', async () => {
    const deps = createTestDeps();
    const server = createMcpServer(deps);
    const result = await callTool(server, 'run_workflow', {
      workflowId: 999,
      inputs: {}
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('not found');
  });

  it('get_job_status returns job data', async () => {
    const deps = createTestDeps();
    const server = createMcpServer(deps);
    const result = await callTool(server, 'get_job_status', { jobId: 42 });

    expect(result.isError).toBeFalsy();
    const job = JSON.parse(result.content[0].text);
    expect(job.id).toBe(42);
    expect(job.status).toBe('completed');
    expect(job.outputs).toHaveLength(1);
    expect(job.outputs[0].imageUrl).toBe('/images/output/image1.png');
  });

  it('get_job_status returns error for missing job', async () => {
    const deps = createTestDeps();
    const server = createMcpServer(deps);
    const result = await callTool(server, 'get_job_status', { jobId: 999 });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('not found');
  });
});
