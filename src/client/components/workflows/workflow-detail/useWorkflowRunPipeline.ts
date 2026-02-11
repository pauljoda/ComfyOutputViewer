import { useCallback, useRef } from 'react';
import { api } from '../../../lib/api';
import { buildImageUrl } from '../../../utils/images';
import type { Job, WorkflowInput } from '../../../types';
import type { ImageUploadValue } from '../types';

type UseWorkflowRunPipelineArgs = {
  workflowId: number;
  inputs: WorkflowInput[];
  inputValues: Record<number, string>;
  setRunning: (value: boolean) => void;
  onError: (message: string | null) => void;
  mergeJobUpdate: (job: Job) => void;
  loadJobs: (targetWorkflowId?: number) => Promise<void>;
};

export type UseWorkflowRunPipelineResult = {
  handleRun: () => Promise<void>;
};

export function useWorkflowRunPipeline({
  workflowId,
  inputs,
  inputValues,
  setRunning,
  onError,
  mergeJobUpdate,
  loadJobs
}: UseWorkflowRunPipelineArgs): UseWorkflowRunPipelineResult {
  const imageUploadCacheRef = useRef<Map<string, ImageUploadValue>>(new Map());

  const resolveImageInputValue = useCallback(async (rawValue: string) => {
    if (!rawValue) return '';
    if (!rawValue.startsWith('local:')) return rawValue;
    const imagePath = rawValue.slice('local:'.length);
    if (!imagePath) return '';
    const cached = imageUploadCacheRef.current.get(imagePath);
    if (cached) return cached;

    const sourceUrl = buildImageUrl(imagePath);
    const imageResponse = await fetch(sourceUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to load selected image: ${imagePath}`);
    }
    const blob = await imageResponse.blob();
    const filename = imagePath.split('/').pop() || 'input.png';

    const formData = new FormData();
    formData.append('image', new File([blob], filename, { type: blob.type || 'image/png' }));

    const uploadResponse = await fetch('/api/comfy/upload', {
      method: 'POST',
      body: formData
    });
    if (!uploadResponse.ok) {
      const text = await uploadResponse.text();
      throw new Error(text || 'Failed to upload image to ComfyUI');
    }

    const uploadResult = await uploadResponse.json();
    const uploadName = typeof uploadResult.name === 'string' ? uploadResult.name : '';
    const uploadSubfolder =
      typeof uploadResult.subfolder === 'string' ? uploadResult.subfolder : '';
    const uploadType = typeof uploadResult.type === 'string' ? uploadResult.type : '';
    if (!uploadName) {
      throw new Error('ComfyUI upload did not return a filename.');
    }

    const uploadValue: ImageUploadValue = {
      filename: uploadName,
      subfolder: uploadSubfolder || undefined,
      type: uploadType || undefined
    };
    imageUploadCacheRef.current.set(imagePath, uploadValue);
    return uploadValue;
  }, []);

  const handleRun = useCallback(async () => {
    try {
      setRunning(true);
      onError(null);
      const inputData = await Promise.all(
        inputs.map(async (input) => {
          const rawValue = inputValues[input.id] || '';
          const value =
            input.inputType === 'image' ? await resolveImageInputValue(rawValue) : rawValue;
          return { inputId: input.id, value };
        })
      );
      const result = await api<{ ok: boolean; jobId: number }>(`/api/workflows/${workflowId}/run`, {
        method: 'POST',
        body: JSON.stringify({ inputs: inputData })
      });
      if (result?.jobId) {
        try {
          const response = await api<{ job: Job }>(`/api/jobs/${result.jobId}`);
          if (response?.job) {
            mergeJobUpdate(response.job);
          }
        } catch (err) {
          console.warn('Failed to load new job:', err);
        }
      }
      await loadJobs(workflowId);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to run workflow');
    } finally {
      setRunning(false);
    }
  }, [inputs, inputValues, loadJobs, mergeJobUpdate, onError, resolveImageInputValue, setRunning, workflowId]);

  return {
    handleRun
  };
}
