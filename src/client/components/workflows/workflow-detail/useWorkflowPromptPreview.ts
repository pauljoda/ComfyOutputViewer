import { useMemo } from 'react';
import type { Workflow, WorkflowInput } from '../../../types';

type UseWorkflowPromptPreviewArgs = {
  apiJson: Workflow['apiJson'];
  inputs: WorkflowInput[];
  inputValues: Record<number, string>;
};

export function useWorkflowPromptPreview({
  apiJson,
  inputs,
  inputValues
}: UseWorkflowPromptPreviewArgs): string {
  return useMemo(() => {
    try {
      const cloned = JSON.parse(JSON.stringify(apiJson));
      for (const input of inputs) {
        if (Object.prototype.hasOwnProperty.call(inputValues, input.id) && cloned[input.nodeId]) {
          const rawValue = inputValues[input.id];
          const resolvedValue =
            input.inputType === 'image' && rawValue?.startsWith('local:')
              ? rawValue.slice('local:'.length)
              : rawValue;
          cloned[input.nodeId].inputs[input.inputKey] =
            input.inputType === 'number' || input.inputType === 'seed'
              ? Number(resolvedValue)
              : resolvedValue;
        }
      }
      return JSON.stringify(cloned, null, 2);
    } catch (err) {
      return `Failed to build prompt JSON: ${err instanceof Error ? err.message : 'Unknown error'}`;
    }
  }, [apiJson, inputs, inputValues]);
}
