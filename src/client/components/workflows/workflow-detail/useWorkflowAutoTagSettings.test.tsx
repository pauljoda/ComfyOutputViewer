import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkflowInput } from '../../../types';
import { useWorkflowAutoTagSettings } from './useWorkflowAutoTagSettings';

const apiMock = vi.fn();

vi.mock('../../../lib/api', () => ({
  api: (...args: unknown[]) => apiMock(...args)
}));

const inputs: WorkflowInput[] = [
  {
    id: 1,
    workflowId: 5,
    nodeId: '10',
    inputKey: 'prompt',
    inputType: 'text',
    label: 'Prompt',
    sortOrder: 0
  },
  {
    id: 2,
    workflowId: 5,
    nodeId: '11',
    inputKey: 'negative_prompt',
    inputType: 'negative',
    label: 'Negative Prompt',
    sortOrder: 1
  }
];

describe('useWorkflowAutoTagSettings', () => {
  beforeEach(() => {
    apiMock.mockReset();
  });

  it('applies workflow auto-tag settings and normalizes max words bounds', () => {
    const onError = vi.fn();
    const { result } = renderHook(() =>
      useWorkflowAutoTagSettings({
        workflowId: 5,
        inputs,
        onError
      })
    );

    act(() => {
      result.current.applyAutoTagSettings({
        autoTagEnabled: true,
        autoTagInputRefs: ['10:prompt', '11:negative_prompt'],
        autoTagMaxWords: 999
      });
    });

    expect(result.current.autoTagEnabled).toBe(true);
    expect(Array.from(result.current.autoTagInputRefs)).toEqual(['10:prompt', '11:negative_prompt']);
    expect(result.current.autoTagMaxWords).toBe(20);
    expect(result.current.normalizeAutoTagMaxWords(-1)).toBe(1);
  });

  it('uses positive text refs as fallback when enabling auto-tag and no refs are selected', async () => {
    const onError = vi.fn();
    apiMock.mockResolvedValue({
      autoTagEnabled: true,
      autoTagInputRefs: ['10:prompt'],
      autoTagMaxWords: 2
    });

    const { result } = renderHook(() =>
      useWorkflowAutoTagSettings({
        workflowId: 5,
        inputs,
        onError
      })
    );

    act(() => {
      result.current.handleToggleAutoTagEnabled();
    });

    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledTimes(1);
    });

    const [, options] = apiMock.mock.calls[0] as [string, { body?: string }];
    const parsed = JSON.parse(options.body ?? '{}');
    expect(parsed.enabled).toBe(true);
    expect(parsed.inputRefs).toEqual(['10:prompt']);
    expect(onError).toHaveBeenCalledWith(null);
  });
});
