import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../../lib/api';
import type { ImageItem, Job, JobOutput, ModalTool, Workflow, WorkflowInput } from '../../../types';
import { useWorkflowAutoTagSettings } from './useWorkflowAutoTagSettings';
import { useWorkflowJobs } from './useWorkflowJobs';
import { useWorkflowMetadataMutations } from './useWorkflowMetadataMutations';
import { useWorkflowOutputCache } from './useWorkflowOutputCache';
import { useWorkflowOutputModalState } from './useWorkflowOutputModalState';
import { useWorkflowRunPipeline } from './useWorkflowRunPipeline';
import type {
  SystemStatsResponse,
  WorkflowPrefill,
  WorkflowPrefillEntry
} from '../types';

export type UseWorkflowDetailControllerArgs = {
  workflow: Workflow;
  prefill?: WorkflowPrefill | null;
  onPrefillApplied?: () => void;
  refreshTags: () => void;
};

export type UseWorkflowDetailControllerResult = {
  inputs: WorkflowInput[];
  inputValues: Record<number, string>;
  autoTagEnabled: boolean;
  autoTagInputRefs: Set<string>;
  autoTagMaxWords: number;
  autoTagSaving: boolean;
  autoTagEligibleInputs: WorkflowInput[];
  normalizeAutoTagMaxWords: (value: unknown) => number;
  running: boolean;
  error: string | null;
  jobs: Job[];
  jobClock: number;
  systemStats: SystemStatsResponse | null;
  systemStatsError: string | null;
  systemStatsUpdatedAt: number | null;
  outputPaths: string[];
  selectedOutputIndex: number;
  selectedOutputImage: ImageItem | null;
  selectedInputImage: ImageItem | null;
  outputTool: ModalTool;
  inputTool: ModalTool;
  exportApiOpen: boolean;
  promptPreview: string;
  setError: (value: string | null) => void;
  setAutoTagMaxWords: (value: number) => void;
  setExportApiOpen: (open: boolean) => void;
  handleToggleAutoTagEnabled: () => void;
  handleToggleAutoTagInput: (input: WorkflowInput) => void;
  handleAutoTagMaxWordsBlur: () => void;
  handleInputChange: (inputId: number, value: string) => void;
  handleRun: () => Promise<void>;
  handleOpenInputPreview: (imagePath: string) => Promise<void>;
  handleOpenOutput: (job: Job, output: JobOutput) => Promise<void>;
  handleCancelJob: (jobId: number) => Promise<void>;
  handleRecheckJobOutputs: (jobId: number) => Promise<void>;
  handleOutputTags: (tags: string[]) => Promise<void>;
  handleOutputFavorite: () => Promise<void>;
  handleOutputHidden: () => Promise<void>;
  handleOutputRating: (rating: number) => Promise<void>;
  handleOutputDelete: () => Promise<void>;
  handleInputTags: (tags: string[]) => Promise<void>;
  handleInputFavorite: () => Promise<void>;
  handleInputHidden: () => Promise<void>;
  handleInputRating: (rating: number) => Promise<void>;
  handleInputDelete: () => Promise<void>;
  closeOutputModal: () => void;
  closeInputModal: () => void;
  goToPrevOutput: () => void;
  goToNextOutput: () => void;
  toggleOutputTagsTool: () => void;
  toggleOutputRatingTool: () => void;
  toggleOutputPromptTool: () => void;
  toggleInputTagsTool: () => void;
  toggleInputRatingTool: () => void;
  toggleInputPromptTool: () => void;
};

export function useWorkflowDetailController({
  workflow,
  prefill,
  onPrefillApplied,
  refreshTags
}: UseWorkflowDetailControllerArgs): UseWorkflowDetailControllerResult {
  const [inputs, setInputs] = useState<WorkflowInput[]>([]);
  const [inputValues, setInputValues] = useState<Record<number, string>>({});
  const [running, setRunning] = useState(false);
  const [exportApiOpen, setExportApiOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const prefillAppliedRef = useRef<string | null>(null);
  const isInputDirtyRef = useRef(false);
  const previousWorkflowIdRef = useRef<number | null>(null);
  const workflowIdRef = useRef(workflow.id);

  workflowIdRef.current = workflow.id;

  const autoTag = useWorkflowAutoTagSettings({
    workflowId: workflow.id,
    inputs,
    onError: setError
  });

  const workflowJobs = useWorkflowJobs({
    workflowId: workflow.id,
    running,
    onError: (message) => setError(message)
  });
  const {
    jobs,
    setJobs,
    jobClock,
    systemStats,
    systemStatsError,
    systemStatsUpdatedAt,
    loadJobs,
    mergeJobUpdate,
    handleCancelJob,
    handleRecheckJobOutputs
  } = workflowJobs;
  const runPipeline = useWorkflowRunPipeline({
    workflowId: workflow.id,
    inputs,
    inputValues,
    setRunning,
    onError: setError,
    mergeJobUpdate,
    loadJobs
  });
  const outputCacheState = useWorkflowOutputCache();
  const { outputCache, setOutputCache, buildFallbackImage, loadOutputImage, loadOutputImages } =
    outputCacheState;

  useEffect(() => {
    autoTag.applyAutoTagSettings({
      autoTagEnabled: workflow.autoTagEnabled,
      autoTagInputRefs: workflow.autoTagInputRefs,
      autoTagMaxWords: workflow.autoTagMaxWords
    });
  }, [workflow.id, autoTag.applyAutoTagSettings]);

  const loadWorkflowDetails = useCallback(
    async (targetWorkflowId?: number, options: { preserveInputValues?: boolean } = {}) => {
      const workflowId = targetWorkflowId ?? workflowIdRef.current;
      try {
        const response = await api<{ workflow: Workflow; inputs: WorkflowInput[] }>(
          `/api/workflows/${workflowId}`
        );
        if (workflowIdRef.current !== workflowId) return;
        setInputs(response.inputs);
        autoTag.applyAutoTagSettings(response.workflow);
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
        setError(null);
      } catch (err) {
        if (workflowIdRef.current !== workflowId) return;
        setError(err instanceof Error ? err.message : 'Failed to load workflow details');
      }
    },
    [autoTag.applyAutoTagSettings]
  );

  useEffect(() => {
    const workflowChanged = previousWorkflowIdRef.current !== workflow.id;
    previousWorkflowIdRef.current = workflow.id;

    if (workflowChanged) {
      setInputs([]);
      setInputValues({});
      setJobs([]);
      setRunning(false);
      setError(null);
      setOutputCache({});
      isInputDirtyRef.current = false;
      prefillAppliedRef.current = null;
      void loadWorkflowDetails(workflow.id);
      void loadJobs(workflow.id);
      return;
    }

    // Keep in-progress edits when workflow metadata updates for the same workflow id.
    void loadWorkflowDetails(workflow.id, { preserveInputValues: true });
    void loadJobs(workflow.id);
  }, [workflow.id, workflow.updatedAt, loadJobs, loadWorkflowDetails]);

  useEffect(() => {
    if (!prefill || prefill.workflowId !== workflow.id) {
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
  }, [prefill, inputs, workflow.id, onPrefillApplied]);

  const outputModalState = useWorkflowOutputModalState({
    workflowId: workflow.id,
    jobs,
    outputCache,
    buildFallbackImage,
    loadOutputImage,
    loadOutputImages
  });
  const {
    outputPaths,
    selectedOutputIndex,
    selectedOutputImage,
    selectedInputImage,
    outputTool,
    inputTool,
    handleOpenOutput,
    handleOpenInputPreview,
    closeOutputModal,
    closeInputModal,
    removeOutputPath,
    goToPrevOutput,
    goToNextOutput,
    toggleOutputTagsTool,
    toggleOutputRatingTool,
    toggleOutputPromptTool,
    toggleInputTagsTool,
    toggleInputRatingTool,
    toggleInputPromptTool
  } = outputModalState;
  const metadataMutations = useWorkflowMetadataMutations({
    selectedOutputImage,
    selectedInputImage,
    buildFallbackImage,
    loadOutputImage,
    setOutputCache,
    setJobs,
    closeOutputModal,
    closeInputModal,
    removeOutputPath,
    refreshTags,
    setError
  });
  const {
    handleOutputTags,
    handleOutputFavorite,
    handleOutputHidden,
    handleOutputRating,
    handleOutputDelete,
    handleInputTags,
    handleInputFavorite,
    handleInputHidden,
    handleInputRating,
    handleInputDelete
  } = metadataMutations;

  const handleInputChange = useCallback((inputId: number, value: string) => {
    isInputDirtyRef.current = true;
    setInputValues((prev) => ({ ...prev, [inputId]: value }));
  }, []);

  const handleRun = runPipeline.handleRun;

  const promptPreview = useMemo(() => {
    try {
      const cloned = JSON.parse(JSON.stringify(workflow.apiJson));
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
  }, [inputs, inputValues, workflow.apiJson]);

  return {
    inputs,
    inputValues,
    autoTagEnabled: autoTag.autoTagEnabled,
    autoTagInputRefs: autoTag.autoTagInputRefs,
    autoTagMaxWords: autoTag.autoTagMaxWords,
    autoTagSaving: autoTag.autoTagSaving,
    autoTagEligibleInputs: autoTag.autoTagEligibleInputs,
    normalizeAutoTagMaxWords: autoTag.normalizeAutoTagMaxWords,
    running,
    error,
    jobs,
    jobClock,
    systemStats,
    systemStatsError,
    systemStatsUpdatedAt,
    outputPaths,
    selectedOutputIndex,
    selectedOutputImage,
    selectedInputImage,
    outputTool,
    inputTool,
    exportApiOpen,
    promptPreview,
    setError,
    setAutoTagMaxWords: autoTag.setAutoTagMaxWords,
    setExportApiOpen,
    handleToggleAutoTagEnabled: autoTag.handleToggleAutoTagEnabled,
    handleToggleAutoTagInput: autoTag.handleToggleAutoTagInput,
    handleAutoTagMaxWordsBlur: autoTag.handleAutoTagMaxWordsBlur,
    handleInputChange,
    handleRun,
    handleOpenInputPreview,
    handleOpenOutput,
    handleCancelJob,
    handleRecheckJobOutputs,
    handleOutputTags,
    handleOutputFavorite,
    handleOutputHidden,
    handleOutputRating,
    handleOutputDelete,
    handleInputTags,
    handleInputFavorite,
    handleInputHidden,
    handleInputRating,
    handleInputDelete,
    closeOutputModal,
    closeInputModal,
    goToPrevOutput,
    goToNextOutput,
    toggleOutputTagsTool,
    toggleOutputRatingTool,
    toggleOutputPromptTool,
    toggleInputTagsTool,
    toggleInputRatingTool,
    toggleInputPromptTool
  };
}
