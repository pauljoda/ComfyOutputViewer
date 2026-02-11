import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../lib/api';
import type { ModalTool } from '../../types';

type PromptInput = {
  inputId?: number;
  label: string;
  systemLabel?: string;
  inputType?: string;
  value: unknown;
};

type PromptPayload = {
  workflowId?: number;
  workflowInputs?: PromptInput[];
  inputs?: PromptInput[];
  inputJson?: Record<string, unknown>;
};

type PromptJobInput = {
  inputId: number;
  value: string;
  label?: string;
  inputType?: string;
  inputKey?: string;
};

export type PromptData = {
  imagePath: string;
  jobId: number | null;
  workflowId?: number | null;
  promptData: PromptPayload;
  jobInputs?: PromptJobInput[];
  createdAt: number;
};

export type PromptPrefillEntry = {
  inputId?: number;
  label?: string;
  systemLabel?: string;
  value: string;
};

type UseImagePromptDataArgs = {
  imageId: string;
  modalTool: ModalTool;
};

export type UseImagePromptDataResult = {
  promptData: PromptData | null;
  promptLoading: boolean;
  promptError: string | null;
  promptAvailable: boolean;
  promptJson: Record<string, unknown> | null;
  promptWorkflowId: number | null;
  promptPrefillEntries: PromptPrefillEntry[];
};

export function useImagePromptData({
  imageId,
  modalTool
}: UseImagePromptDataArgs): UseImagePromptDataResult {
  const [promptData, setPromptData] = useState<PromptData | null>(null);
  const [promptLoading, setPromptLoading] = useState(false);
  const [promptError, setPromptError] = useState<string | null>(null);
  const [promptAvailable, setPromptAvailable] = useState(false);
  const promptRequestAbortRef = useRef<AbortController | null>(null);
  const promptRequestIdRef = useRef(0);
  const modalToolRef = useRef(modalTool);

  modalToolRef.current = modalTool;

  const cancelPromptRequest = useCallback(() => {
    promptRequestAbortRef.current?.abort();
    promptRequestAbortRef.current = null;
  }, []);

  const loadPromptData = useCallback(async () => {
    cancelPromptRequest();
    const controller = new AbortController();
    promptRequestAbortRef.current = controller;
    const requestId = ++promptRequestIdRef.current;
    try {
      setPromptLoading(true);
      setPromptError(null);
      const data = await api<PromptData>(`/api/images/${encodeURIComponent(imageId)}/prompt`, {
        signal: controller.signal
      });
      if (controller.signal.aborted || requestId !== promptRequestIdRef.current) return;
      setPromptData(data);
      setPromptAvailable(true);
    } catch (err) {
      if (controller.signal.aborted || requestId !== promptRequestIdRef.current) return;
      setPromptAvailable(false);
      setPromptData(null);
      if (modalToolRef.current === 'prompt') {
        setPromptError(err instanceof Error ? err.message : 'No prompt data found');
      }
    } finally {
      if (!controller.signal.aborted && requestId === promptRequestIdRef.current) {
        setPromptLoading(false);
      }
      if (promptRequestAbortRef.current === controller) {
        promptRequestAbortRef.current = null;
      }
    }
  }, [cancelPromptRequest, imageId]);

  useEffect(() => {
    cancelPromptRequest();
    setPromptAvailable(false);
    setPromptData(null);
    setPromptError(null);
    void loadPromptData();
    return () => cancelPromptRequest();
  }, [cancelPromptRequest, imageId, loadPromptData]);

  useEffect(() => {
    if (modalTool === 'prompt' && !promptData && !promptLoading && !promptError) {
      void loadPromptData();
    }
  }, [loadPromptData, modalTool, promptData, promptLoading, promptError]);

  const promptInputs = useMemo<PromptInput[]>(() => {
    if (!promptData) return [];
    if (Array.isArray(promptData.promptData?.inputs)) {
      return promptData.promptData.inputs;
    }
    if (Array.isArray(promptData.promptData?.workflowInputs)) {
      return promptData.promptData.workflowInputs;
    }
    if (Array.isArray(promptData.jobInputs) && promptData.jobInputs.length > 0) {
      return promptData.jobInputs.map((input) => ({
        inputId: input.inputId,
        label: input.label || `Input ${input.inputId}`,
        systemLabel: input.inputKey,
        inputType: input.inputType,
        value: input.value
      }));
    }
    return [];
  }, [promptData]);

  const promptJson = useMemo(() => {
    if (!promptData?.promptData) return null;
    if (promptData.promptData.inputJson) {
      return promptData.promptData.inputJson;
    }
    if (promptInputs.length === 0) return null;
    const next = {} as Record<string, unknown>;
    promptInputs.forEach((input) => {
      const key = input.label || input.systemLabel || 'input';
      next[key] = input.value;
    });
    return next;
  }, [promptData, promptInputs]);

  const promptWorkflowId = promptData?.promptData?.workflowId ?? promptData?.workflowId ?? null;

  const promptPrefillEntries = useMemo<PromptPrefillEntry[]>(() => {
    if (!promptData) return [];
    const entries: PromptPrefillEntry[] = [];
    const jobInputs = promptData.jobInputs ?? [];
    const jobInputByLabel = new Map(
      jobInputs.filter((input) => input.label).map((input) => [String(input.label), input])
    );
    const jobInputByKey = new Map(
      jobInputs.filter((input) => input.inputKey).map((input) => [String(input.inputKey), input])
    );
    const promptSource =
      promptData.promptData?.inputs && promptData.promptData.inputs.length > 0
        ? promptData.promptData.inputs
        : promptData.promptData?.workflowInputs || [];
    if (promptSource.length > 0) {
      promptSource.forEach((input) => {
        const byLabel = input.label ? jobInputByLabel.get(String(input.label)) : undefined;
        const byKey = input.systemLabel ? jobInputByKey.get(String(input.systemLabel)) : undefined;
        const inputId = input.inputId ?? byLabel?.inputId ?? byKey?.inputId;
        const value = input.value === null || input.value === undefined ? '' : String(input.value);
        entries.push({ inputId, label: input.label, systemLabel: input.systemLabel, value });
      });
    } else if (jobInputs.length > 0) {
      jobInputs.forEach((input) => {
        entries.push({
          inputId: input.inputId,
          label: input.label,
          systemLabel: input.inputKey,
          value: input.value === null || input.value === undefined ? '' : String(input.value)
        });
      });
    }
    return entries;
  }, [promptData]);

  return {
    promptData,
    promptLoading,
    promptError,
    promptAvailable,
    promptJson,
    promptWorkflowId,
    promptPrefillEntries
  };
}
