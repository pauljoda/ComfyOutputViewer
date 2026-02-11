import { useCallback, useMemo, useState } from 'react';
import { api } from '../../../lib/api';
import type { Workflow, WorkflowInput } from '../../../types';

type UseWorkflowAutoTagSettingsArgs = {
  workflowId: number;
  inputs: WorkflowInput[];
  onError: (message: string | null) => void;
};

type ApplyAutoTagSettingsInput = Pick<Workflow, 'autoTagEnabled' | 'autoTagInputRefs' | 'autoTagMaxWords'>;

export type UseWorkflowAutoTagSettingsResult = {
  autoTagEnabled: boolean;
  autoTagInputRefs: Set<string>;
  autoTagMaxWords: number;
  autoTagSaving: boolean;
  autoTagEligibleInputs: WorkflowInput[];
  normalizeAutoTagMaxWords: (value: unknown) => number;
  setAutoTagMaxWords: (value: number) => void;
  applyAutoTagSettings: (settings: ApplyAutoTagSettingsInput) => void;
  handleToggleAutoTagEnabled: () => void;
  handleToggleAutoTagInput: (input: WorkflowInput) => void;
  handleAutoTagMaxWordsBlur: () => void;
};

export function useWorkflowAutoTagSettings({
  workflowId,
  inputs,
  onError
}: UseWorkflowAutoTagSettingsArgs): UseWorkflowAutoTagSettingsResult {
  const [autoTagEnabled, setAutoTagEnabled] = useState(false);
  const [autoTagInputRefs, setAutoTagInputRefs] = useState<Set<string>>(new Set());
  const [autoTagMaxWords, setAutoTagMaxWords] = useState(2);
  const [autoTagSaving, setAutoTagSaving] = useState(false);

  const autoTagEligibleInputs = useMemo(
    () => inputs.filter((input) => input.inputType === 'text' || input.inputType === 'negative'),
    [inputs]
  );

  const defaultAutoTagRefs = useMemo(
    () =>
      autoTagEligibleInputs
        .filter((input) => input.inputType !== 'negative')
        .map((input) => `${input.nodeId}:${input.inputKey}`),
    [autoTagEligibleInputs]
  );

  const normalizeAutoTagMaxWords = useCallback((value: unknown) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 2;
    const rounded = Math.floor(parsed);
    if (rounded < 1) return 1;
    if (rounded > 20) return 20;
    return rounded;
  }, []);

  const applyAutoTagSettings = useCallback(
    ({ autoTagEnabled, autoTagInputRefs, autoTagMaxWords }: ApplyAutoTagSettingsInput) => {
      setAutoTagEnabled(Boolean(autoTagEnabled));
      setAutoTagInputRefs(new Set(autoTagInputRefs || []));
      setAutoTagMaxWords(normalizeAutoTagMaxWords(autoTagMaxWords));
      setAutoTagSaving(false);
    },
    [normalizeAutoTagMaxWords]
  );

  const buildOrderedAutoTagRefs = useCallback(
    (refs: Set<string>) => {
      const rank = new Map(
        autoTagEligibleInputs.map((input, index) => [`${input.nodeId}:${input.inputKey}`, index])
      );
      return [...refs].sort((a, b) => {
        const rankA = rank.get(a);
        const rankB = rank.get(b);
        if (rankA !== undefined && rankB !== undefined) return rankA - rankB;
        if (rankA !== undefined) return -1;
        if (rankB !== undefined) return 1;
        return a.localeCompare(b);
      });
    },
    [autoTagEligibleInputs]
  );

  const persistAutoTagSettings = useCallback(
    async (enabled: boolean, refs: Set<string>, maxWords: number) => {
      setAutoTagSaving(true);
      try {
        const orderedRefs = buildOrderedAutoTagRefs(refs);
        const normalizedMaxWords = normalizeAutoTagMaxWords(maxWords);
        const response = await api<{
          autoTagEnabled: boolean;
          autoTagInputRefs: string[];
          autoTagMaxWords: number;
        }>(`/api/workflows/${workflowId}/auto-tag`, {
          method: 'PUT',
          body: JSON.stringify({
            enabled,
            inputRefs: orderedRefs,
            maxWords: normalizedMaxWords
          })
        });
        applyAutoTagSettings(response);
        onError(null);
      } catch (err) {
        onError(err instanceof Error ? err.message : 'Failed to save auto-tag settings');
        setAutoTagSaving(false);
      }
    },
    [applyAutoTagSettings, buildOrderedAutoTagRefs, normalizeAutoTagMaxWords, onError, workflowId]
  );

  const handleToggleAutoTagEnabled = useCallback(() => {
    const nextEnabled = !autoTagEnabled;
    let nextRefs = new Set(autoTagInputRefs);
    if (nextEnabled && nextRefs.size === 0) {
      const fallbackRefs =
        defaultAutoTagRefs.length > 0
          ? defaultAutoTagRefs
          : autoTagEligibleInputs.map((input) => `${input.nodeId}:${input.inputKey}`);
      nextRefs = new Set(fallbackRefs);
    }
    setAutoTagEnabled(nextEnabled);
    setAutoTagInputRefs(nextRefs);
    void persistAutoTagSettings(nextEnabled, nextRefs, autoTagMaxWords);
  }, [
    autoTagEnabled,
    autoTagInputRefs,
    autoTagEligibleInputs,
    autoTagMaxWords,
    defaultAutoTagRefs,
    persistAutoTagSettings
  ]);

  const handleToggleAutoTagInput = useCallback(
    (input: WorkflowInput) => {
      const ref = `${input.nodeId}:${input.inputKey}`;
      const nextRefs = new Set(autoTagInputRefs);
      if (nextRefs.has(ref)) {
        nextRefs.delete(ref);
      } else {
        nextRefs.add(ref);
      }
      setAutoTagInputRefs(nextRefs);
      void persistAutoTagSettings(autoTagEnabled, nextRefs, autoTagMaxWords);
    },
    [autoTagEnabled, autoTagInputRefs, autoTagMaxWords, persistAutoTagSettings]
  );

  const handleAutoTagMaxWordsBlur = useCallback(() => {
    void persistAutoTagSettings(autoTagEnabled, autoTagInputRefs, autoTagMaxWords);
  }, [autoTagEnabled, autoTagInputRefs, autoTagMaxWords, persistAutoTagSettings]);

  return {
    autoTagEnabled,
    autoTagInputRefs,
    autoTagMaxWords,
    autoTagSaving,
    autoTagEligibleInputs,
    normalizeAutoTagMaxWords,
    setAutoTagMaxWords,
    applyAutoTagSettings,
    handleToggleAutoTagEnabled,
    handleToggleAutoTagInput,
    handleAutoTagMaxWordsBlur
  };
}
