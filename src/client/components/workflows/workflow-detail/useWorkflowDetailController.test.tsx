import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useWorkflowDetailController } from './useWorkflowDetailController';
import type { Workflow } from '../../../types';

const apiMock = vi.fn();

vi.mock('../../../lib/api', () => ({
  api: (...args: unknown[]) => apiMock(...args)
}));

class WebSocketMock {
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;

  constructor(_url: string) {}

  close() {}
}

const baseWorkflow: Workflow = {
  id: 1,
  name: 'Test Workflow',
  description: 'desc',
  apiJson: {},
  autoTagEnabled: false,
  autoTagInputRefs: [],
  autoTagMaxWords: 2,
  folderId: null,
  sortOrder: 0,
  createdAt: 1,
  updatedAt: 1
};

describe('useWorkflowDetailController', () => {
  beforeEach(() => {
    apiMock.mockReset();
    vi.stubGlobal('WebSocket', WebSocketMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('preserves dirty input values when workflow metadata updates for the same workflow id', async () => {
    let currentDefault = 'default prompt';

    apiMock.mockImplementation(async (path: string) => {
      if (path === '/api/workflows/1') {
        return {
          workflow: { ...baseWorkflow, updatedAt: Date.now() },
          inputs: [
            {
              id: 10,
              workflowId: 1,
              nodeId: '1',
              inputKey: 'prompt',
              inputType: 'text',
              label: 'Prompt',
              defaultValue: currentDefault,
              sortOrder: 0
            }
          ]
        };
      }
      if (path === '/api/workflows/1/jobs') {
        return { jobs: [] };
      }
      if (path === '/api/comfy/stats') {
        return { cpuPercent: 0, ramPercent: 0, vramPercent: null };
      }
      throw new Error(`Unexpected API path: ${path}`);
    });

    const refreshTags = vi.fn();
    const { result, rerender } = renderHook(
      ({ workflow }) =>
        useWorkflowDetailController({
          workflow,
          prefill: null,
          refreshTags
        }),
      {
        initialProps: { workflow: baseWorkflow }
      }
    );

    await waitFor(() => {
      expect(result.current.inputValues[10]).toBe('default prompt');
    });

    act(() => {
      result.current.handleInputChange(10, 'edited prompt');
    });

    expect(result.current.inputValues[10]).toBe('edited prompt');

    currentDefault = 'new server default';
    rerender({ workflow: { ...baseWorkflow, updatedAt: 2 } });

    await waitFor(() => {
      expect(result.current.inputValues[10]).toBe('edited prompt');
    });
  });

  it('applies new defaults on metadata updates when inputs are not dirty', async () => {
    let currentDefault = 'default prompt';

    apiMock.mockImplementation(async (path: string) => {
      if (path === '/api/workflows/1') {
        return {
          workflow: { ...baseWorkflow, updatedAt: Date.now() },
          inputs: [
            {
              id: 10,
              workflowId: 1,
              nodeId: '1',
              inputKey: 'prompt',
              inputType: 'text',
              label: 'Prompt',
              defaultValue: currentDefault,
              sortOrder: 0
            }
          ]
        };
      }
      if (path === '/api/workflows/1/jobs') {
        return { jobs: [] };
      }
      if (path === '/api/comfy/stats') {
        return { cpuPercent: 0, ramPercent: 0, vramPercent: null };
      }
      throw new Error(`Unexpected API path: ${path}`);
    });

    const refreshTags = vi.fn();
    const { result, rerender } = renderHook(
      ({ workflow }) =>
        useWorkflowDetailController({
          workflow,
          prefill: null,
          refreshTags
        }),
      {
        initialProps: { workflow: baseWorkflow }
      }
    );

    await waitFor(() => {
      expect(result.current.inputValues[10]).toBe('default prompt');
    });

    currentDefault = 'next default prompt';
    rerender({ workflow: { ...baseWorkflow, updatedAt: 3 } });

    await waitFor(() => {
      expect(result.current.inputValues[10]).toBe('next default prompt');
    });
  });
});
