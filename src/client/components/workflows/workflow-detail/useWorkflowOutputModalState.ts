import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ImageItem, Job, JobOutput, ModalTool } from '../../../types';

type UseWorkflowOutputModalStateArgs = {
  workflowId: number;
  jobs: Job[];
  outputCache: Record<string, ImageItem>;
  buildFallbackImage: (imagePath: string) => ImageItem;
  loadOutputImage: (imagePath: string) => Promise<void>;
  loadOutputImages: (paths: string[]) => Promise<void>;
};

export type UseWorkflowOutputModalStateResult = {
  outputPaths: string[];
  selectedOutputIndex: number;
  selectedOutputImage: ImageItem | null;
  selectedInputImage: ImageItem | null;
  outputTool: ModalTool;
  inputTool: ModalTool;
  handleOpenOutput: (job: Job, output: JobOutput) => Promise<void>;
  handleOpenInputPreview: (imagePath: string) => Promise<void>;
  closeOutputModal: () => void;
  closeInputModal: () => void;
  removeOutputPath: (imagePath: string) => void;
  goToPrevOutput: () => void;
  goToNextOutput: () => void;
  toggleOutputTagsTool: () => void;
  toggleOutputRatingTool: () => void;
  toggleOutputPromptTool: () => void;
  toggleInputTagsTool: () => void;
  toggleInputRatingTool: () => void;
  toggleInputPromptTool: () => void;
};

export function useWorkflowOutputModalState({
  workflowId,
  jobs,
  outputCache,
  buildFallbackImage,
  loadOutputImage,
  loadOutputImages
}: UseWorkflowOutputModalStateArgs): UseWorkflowOutputModalStateResult {
  const [outputPaths, setOutputPaths] = useState<string[]>([]);
  const [selectedOutputPath, setSelectedOutputPath] = useState<string | null>(null);
  const [outputTool, setOutputTool] = useState<ModalTool>(null);
  const [selectedInputPath, setSelectedInputPath] = useState<string | null>(null);
  const [inputTool, setInputTool] = useState<ModalTool>(null);

  useEffect(() => {
    setOutputPaths([]);
    setSelectedOutputPath(null);
    setOutputTool(null);
    setSelectedInputPath(null);
    setInputTool(null);
  }, [workflowId]);

  useEffect(() => {
    if (selectedOutputPath) {
      setOutputTool(null);
    }
  }, [selectedOutputPath]);

  useEffect(() => {
    if (selectedInputPath) {
      setInputTool(null);
    }
  }, [selectedInputPath]);

  const handleOpenOutput = useCallback(
    async (job: Job, output: JobOutput) => {
      const visibleOutputs = job.outputs?.filter((item) => item.exists !== false) ?? [];
      const paths: string[] = [];
      const seen = new Set<string>();
      visibleOutputs.forEach((item) => {
        if (!seen.has(item.imagePath)) {
          seen.add(item.imagePath);
          paths.push(item.imagePath);
        }
      });
      if (paths.length === 0) {
        return;
      }
      const allPaths = jobs
        .flatMap((entry) => entry.outputs?.filter((item) => item.exists !== false) ?? [])
        .reduce<string[]>((acc, entry) => {
          if (!acc.includes(entry.imagePath)) {
            acc.push(entry.imagePath);
          }
          return acc;
        }, []);

      const nextPaths = allPaths.length > 0 ? allPaths : paths;
      setOutputPaths(nextPaths);
      setSelectedOutputPath(output.imagePath);
      setSelectedInputPath(null);
      setOutputTool(null);
      await loadOutputImages(nextPaths);
    },
    [jobs, loadOutputImages]
  );

  const handleOpenInputPreview = useCallback(
    async (imagePath: string) => {
      if (!imagePath) return;
      setSelectedOutputPath(null);
      setSelectedInputPath(imagePath);
      setInputTool(null);
      await loadOutputImage(imagePath);
    },
    [loadOutputImage]
  );

  const selectedOutputIndex = selectedOutputPath
    ? outputPaths.findIndex((path) => {
        if (path === selectedOutputPath) return true;
        const decode = (value: string) => {
          try {
            return decodeURIComponent(value);
          } catch {
            return value;
          }
        };
        return decode(path) === decode(selectedOutputPath);
      })
    : -1;

  const selectedOutputImage = useMemo(
    () =>
      selectedOutputPath
        ? outputCache[selectedOutputPath] ?? buildFallbackImage(selectedOutputPath)
        : null,
    [buildFallbackImage, outputCache, selectedOutputPath]
  );

  const selectedInputImage = useMemo(
    () =>
      selectedInputPath
        ? outputCache[selectedInputPath] ?? buildFallbackImage(selectedInputPath)
        : null,
    [buildFallbackImage, outputCache, selectedInputPath]
  );

  useEffect(() => {
    if (selectedOutputPath) {
      void loadOutputImage(selectedOutputPath);
    }
  }, [selectedOutputPath, loadOutputImage]);

  useEffect(() => {
    if (selectedInputPath) {
      void loadOutputImage(selectedInputPath);
    }
  }, [selectedInputPath, loadOutputImage]);

  const closeOutputModal = useCallback(() => {
    setSelectedOutputPath(null);
    setOutputTool(null);
  }, []);

  const closeInputModal = useCallback(() => {
    setSelectedInputPath(null);
    setInputTool(null);
  }, []);

  const removeOutputPath = useCallback((imagePath: string) => {
    setOutputPaths((prev) => prev.filter((path) => path !== imagePath));
  }, []);

  const goToPrevOutput = useCallback(() => {
    if (outputPaths.length === 0) return;
    if (selectedOutputIndex <= 0) {
      setSelectedOutputPath(outputPaths[outputPaths.length - 1]);
      return;
    }
    setSelectedOutputPath(outputPaths[selectedOutputIndex - 1]);
  }, [outputPaths, selectedOutputIndex]);

  const goToNextOutput = useCallback(() => {
    if (outputPaths.length === 0) return;
    if (selectedOutputIndex === -1 || selectedOutputIndex >= outputPaths.length - 1) {
      setSelectedOutputPath(outputPaths[0]);
      return;
    }
    setSelectedOutputPath(outputPaths[selectedOutputIndex + 1]);
  }, [outputPaths, selectedOutputIndex]);

  const toggleOutputTagsTool = useCallback(() => {
    setOutputTool((current) => (current === 'tags' ? null : 'tags'));
  }, []);

  const toggleOutputRatingTool = useCallback(() => {
    setOutputTool((current) => (current === 'rating' ? null : 'rating'));
  }, []);

  const toggleOutputPromptTool = useCallback(() => {
    setOutputTool((current) => (current === 'prompt' ? null : 'prompt'));
  }, []);

  const toggleInputTagsTool = useCallback(() => {
    setInputTool((current) => (current === 'tags' ? null : 'tags'));
  }, []);

  const toggleInputRatingTool = useCallback(() => {
    setInputTool((current) => (current === 'rating' ? null : 'rating'));
  }, []);

  const toggleInputPromptTool = useCallback(() => {
    setInputTool((current) => (current === 'prompt' ? null : 'prompt'));
  }, []);

  return {
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
  };
}
