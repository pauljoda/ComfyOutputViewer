import { useEffect, useMemo, useRef, useState } from 'react';
import type { ImageItem, Job, JobOutput, ModalTool, Workflow, WorkflowInput } from '../../../types';
import { useWorkflowAutoTagSettings } from './useWorkflowAutoTagSettings';
import { useWorkflowInputState } from './useWorkflowInputState';
import { useWorkflowJobs } from './useWorkflowJobs';
import { useWorkflowMetadataMutations } from './useWorkflowMetadataMutations';
import { useWorkflowOutputCache } from './useWorkflowOutputCache';
import { useWorkflowOutputModalState } from './useWorkflowOutputModalState';
import { useWorkflowRunPipeline } from './useWorkflowRunPipeline';
import type { SystemStatsResponse, WorkflowPrefill } from '../types';

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
  const previousWorkflowIdRef = useRef<number | null>(null);

  const autoTag = useWorkflowAutoTagSettings({
    workflowId: workflow.id,
    inputs,
    onError: setError
  });
  const workflowInputState = useWorkflowInputState({
    workflowId: workflow.id,
    prefill,
    onPrefillApplied,
    inputs,
    setInputs,
    setInputValues,
    applyAutoTagSettings: autoTag.applyAutoTagSettings,
    onError: setError
  });
  const { loadWorkflowDetails, handleInputChange, resetInputTracking } = workflowInputState;

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
      resetInputTracking();
      void loadWorkflowDetails(workflow.id);
      void loadJobs(workflow.id);
      return;
    }

    // Keep in-progress edits when workflow metadata updates for the same workflow id.
    void loadWorkflowDetails(workflow.id, { preserveInputValues: true });
    void loadJobs(workflow.id);
  }, [workflow.id, workflow.updatedAt, loadJobs, loadWorkflowDetails]);

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
