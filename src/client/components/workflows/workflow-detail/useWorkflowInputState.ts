import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import { api } from '../../../lib/api';
import type { Workflow, WorkflowInput } from '../../../types';
import type { WorkflowPrefill, WorkflowPrefillEntry } from '../types';

type LoadWorkflowDetailsOptions = {
  preserveInputValues?: boolean;
};

type AutoTagWorkflowSettings = Pick<
  Workflow,
  'autoTagEnabled' | 'autoTagInputRefs' | 'autoTagMaxWords'
>;

export type UseWorkflowInputStateArgs = {
  workflowId: number;
  prefill?: WorkflowPrefill | null;
  onPrefillApplied?: () => void;
  inputs: WorkflowInput[];
  setInputs: Dispatch<SetStateAction<WorkflowInput[]>>;
  setInputValues: Dispatch<SetStateAction<Record<number, string>>>;
  applyAutoTagSettings: (settings: AutoTagWorkflowSettings) => void;
  onError: (message: string | null) => void;
};

export type UseWorkflowInputStateResult = {
  loadWorkflowDetails: (
    targetWorkflowId?: number,
    options?: LoadWorkflowDetailsOptions
  ) => Promise<void>;
  handleInputChange: (inputId: number, value: string) => void;
  resetInputTracking: () => void;
};

export function useWorkflowInputState({
  workflowId,
  prefill,
  onPrefillApplied,
  inputs,
  setInputs,
  setInputValues,
  applyAutoTagSettings,
  onError
}: UseWorkflowInputStateArgs): UseWorkflowInputStateResult {
  const workflowIdRef = useRef(workflowId);
  const prefillAppliedRef = useRef<string | null>(null);
  const isInputDirtyRef = useRef(false);

  workflowIdRef.current = workflowId;

  const loadWorkflowDetails = useCallback(
    async (targetWorkflowId?: number, options: LoadWorkflowDetailsOptions = {}) => {
      const currentWorkflowId = targetWorkflowId ?? workflowIdRef.current;
      try {
        const response = await api<{ workflow: Workflow; inputs: WorkflowInput[] }>(
          `/api/workflows/${currentWorkflowId}`
        );
        if (workflowIdRef.current !== currentWorkflowId) return;
        setInputs(response.inputs);
        applyAutoTagSettings(response.workflow);
        const defaults: Record<number, string> = {};
        for (const input of response.inputs) {
          defaults[input.id] = input.defaultValue || '';
        }
        setInputValues((prev) => {
          if (!options.preserveInputValues || !isInputDirtyRef.current) {
            isInputDirtyRef.current = false;
            return defaults;
          }
          const merged: Record<number, string> = {};
          for (const input of response.inputs) {
            if (Object.prototype.hasOwnProperty.call(prev, input.id)) {
              merged[input.id] = prev[input.id] ?? '';
            } else {
              merged[input.id] = defaults[input.id] ?? '';
            }
          }
          return merged;
        });
        onError(null);
      } catch (err) {
        if (workflowIdRef.current !== currentWorkflowId) return;
        onError(err instanceof Error ? err.message : 'Failed to load workflow details');
      }
    },
    [applyAutoTagSettings, onError, setInputValues, setInputs]
  );

  useEffect(() => {
    if (!prefill || prefill.workflowId !== workflowId) {
      prefillAppliedRef.current = null;
      return;
    }
    if (inputs.length === 0) return;
    const prefillKey = `${prefill.workflowId}:${prefill.sourceImagePath || ''}:${prefill.createdAt || ''}`;
    if (prefillAppliedRef.current === prefillKey) return;
    setInputValues((prev) => {
      const next = { ...prev };
      let changed = false;
      const entries = prefill.entries || [];
      const byId = new Map<number, WorkflowPrefillEntry>();
      const byLabel = new Map<string, WorkflowPrefillEntry>();
      const bySystemLabel = new Map<string, WorkflowPrefillEntry>();
      entries.forEach((entry) => {
        if (typeof entry.inputId === 'number') {
          byId.set(entry.inputId, entry);
        }
        if (entry.label) {
          byLabel.set(entry.label.trim(), entry);
        }
        if (entry.systemLabel) {
          bySystemLabel.set(entry.systemLabel.trim(), entry);
        }
      });
      for (const input of inputs) {
        const entry =
          byId.get(input.id) ||
          (input.label ? byLabel.get(input.label.trim()) : undefined) ||
          (input.inputKey ? bySystemLabel.get(input.inputKey.trim()) : undefined);
        if (!entry) continue;
        next[input.id] = entry.value ?? '';
        changed = true;
      }
      if (!changed) {
        return prev;
      }
      isInputDirtyRef.current = true;
      return next;
    });
    prefillAppliedRef.current = prefillKey;
    onPrefillApplied?.();
  }, [prefill, inputs, workflowId, onPrefillApplied, setInputValues]);

  const handleInputChange = useCallback(
    (inputId: number, value: string) => {
      isInputDirtyRef.current = true;
      setInputValues((prev) => ({ ...prev, [inputId]: value }));
    },
    [setInputValues]
  );

  const resetInputTracking = useCallback(() => {
    isInputDirtyRef.current = false;
    prefillAppliedRef.current = null;
  }, []);

  return {
    loadWorkflowDetails,
    handleInputChange,
    resetInputTracking
  };
}
