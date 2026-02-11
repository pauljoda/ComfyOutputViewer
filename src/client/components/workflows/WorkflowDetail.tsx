import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Trash2, Code2 } from 'lucide-react';
import { Button } from '../ui/button';
import ImageModal from '../ImageModal';
import ImageInputField from './ImageInputField';
import JobCard from './JobCard';
import SystemStatsPanel from './SystemStatsPanel';
import ExportApiModal from './ExportApiModal';
import WorkflowEditorPanel from './WorkflowEditorPanel';
import { useTags } from '../../contexts/TagsContext';
import { api } from '../../lib/api';
import { deleteImage, setFavorite, setHidden, setRating, setTags } from '../../lib/imagesApi';
import { buildImageUrl } from '../../utils/images';
import type { Workflow, WorkflowInput, Job, JobOutput, ImageItem, ModalTool } from '../../types';
import type { SystemStatsResponse, WorkflowEditorSaveResult, WorkflowPrefill, WorkflowPrefillEntry, ImageUploadValue } from './types';

export type WorkflowDetailProps = {
  workflow: Workflow;
  onBack: () => void;
  editMode: boolean;
  onEditModeChange: (value: boolean) => void;
  onSaved: (result: WorkflowEditorSaveResult) => void;
  onDelete: (workflow: Workflow) => void;
  showDebug: boolean;
  prefill?: WorkflowPrefill | null;
  onPrefillApplied?: () => void;
};

export default function WorkflowDetail({
  workflow,
  onBack,
  editMode,
  onEditModeChange,
  onSaved,
  onDelete,
  showDebug,
  prefill,
  onPrefillApplied
}: WorkflowDetailProps) {
  const { availableTags, refreshTags } = useTags();
  const [inputs, setInputs] = useState<WorkflowInput[]>([]);
  const [inputValues, setInputValues] = useState<Record<number, string>>({});
  const [autoTagEnabled, setAutoTagEnabled] = useState(false);
  const [autoTagInputRefs, setAutoTagInputRefs] = useState<Set<string>>(new Set());
  const [autoTagMaxWords, setAutoTagMaxWords] = useState(2);
  const [autoTagSaving, setAutoTagSaving] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [running, setRunning] = useState(false);
  const [exportApiOpen, setExportApiOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobClock, setJobClock] = useState(() => Date.now());
  const [wsConnected, setWsConnected] = useState(false);
  const [outputCache, setOutputCache] = useState<Record<string, ImageItem>>({});
  const [outputPaths, setOutputPaths] = useState<string[]>([]);
  const [selectedOutputPath, setSelectedOutputPath] = useState<string | null>(null);
  const [outputTool, setOutputTool] = useState<ModalTool>(null);
  const [selectedInputPath, setSelectedInputPath] = useState<string | null>(null);
  const [inputTool, setInputTool] = useState<ModalTool>(null);
  const [systemStats, setSystemStats] = useState<SystemStatsResponse | null>(null);
  const [systemStatsError, setSystemStatsError] = useState<string | null>(null);
  const [systemStatsUpdatedAt, setSystemStatsUpdatedAt] = useState<number | null>(null);
  const prefillAppliedRef = useRef<string | null>(null);
  const imageUploadCacheRef = useRef<Map<string, ImageUploadValue>>(new Map());
  const recheckAttemptsRef = useRef<Set<number>>(new Set());
  const pendingJobRefetchTimeoutsRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const workflowIdRef = useRef(workflow.id);

  workflowIdRef.current = workflow.id;

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

  useEffect(() => {
    return () => {
      pendingJobRefetchTimeoutsRef.current.forEach((timeoutId) => {
        clearTimeout(timeoutId);
      });
      pendingJobRefetchTimeoutsRef.current.clear();
    };
  }, [workflow.id]);

  useEffect(() => {
    setAutoTagEnabled(Boolean(workflow.autoTagEnabled));
    setAutoTagInputRefs(new Set(workflow.autoTagInputRefs || []));
    setAutoTagMaxWords(normalizeAutoTagMaxWords(workflow.autoTagMaxWords));
    setAutoTagSaving(false);
  }, [workflow.id, normalizeAutoTagMaxWords]);

  const mergeJobUpdate = useCallback((job: Job) => {
    if (job.workflowId !== workflowIdRef.current) {
      return;
    }
    setJobs((prev) => {
      const next = prev.filter((item) => item.id !== job.id);
      next.push(job);
      next.sort((a, b) => b.createdAt - a.createdAt);
      return next;
    });
    // If job completed but has no outputs, schedule a refetch to catch sync timing issues
    if (job.status === 'completed' && (!job.outputs || job.outputs.length === 0)) {
      const activeWorkflowId = workflowIdRef.current;
      const timeoutId = setTimeout(async () => {
        pendingJobRefetchTimeoutsRef.current.delete(timeoutId);
        if (workflowIdRef.current !== activeWorkflowId) {
          return;
        }
        try {
          const response = await api<{ job: Job }>(`/api/jobs/${job.id}`);
          if (
            response?.job &&
            response.job.workflowId === workflowIdRef.current &&
            response.job.outputs &&
            response.job.outputs.length > 0
          ) {
            setJobs((prev) => {
              const next = prev.filter((item) => item.id !== response.job.id);
              next.push(response.job);
              next.sort((a, b) => b.createdAt - a.createdAt);
              return next;
            });
          }
        } catch (err) {
          console.warn('Failed to refetch job outputs:', err);
        }
      }, 3000);
      pendingJobRefetchTimeoutsRef.current.add(timeoutId);
    }
  }, []);

  const loadSystemStats = useCallback(async () => {
    try {
      const response = await api<SystemStatsResponse>('/api/comfy/stats');
      setSystemStats(response);
      setSystemStatsUpdatedAt(Date.now());
      setSystemStatsError(null);
    } catch (err) {
      setSystemStatsError(err instanceof Error ? err.message : 'Failed to load system stats');
    }
  }, []);

  const loadWorkflowDetails = useCallback(async (targetWorkflowId?: number) => {
    const workflowId = targetWorkflowId ?? workflowIdRef.current;
    try {
      const response = await api<{ workflow: Workflow; inputs: WorkflowInput[] }>(
        `/api/workflows/${workflowId}`
      );
      if (workflowIdRef.current !== workflowId) return;
      setInputs(response.inputs);
      setAutoTagEnabled(Boolean(response.workflow.autoTagEnabled));
      setAutoTagInputRefs(new Set(response.workflow.autoTagInputRefs || []));
      setAutoTagMaxWords(normalizeAutoTagMaxWords(response.workflow.autoTagMaxWords));
      // Initialize input values with defaults
      const defaults: Record<number, string> = {};
      for (const input of response.inputs) {
        defaults[input.id] = input.defaultValue || '';
      }
      setInputValues(defaults);
      setError(null);
    } catch (err) {
      if (workflowIdRef.current !== workflowId) return;
      setError(err instanceof Error ? err.message : 'Failed to load workflow details');
    }
  }, [normalizeAutoTagMaxWords]);

  const loadJobs = useCallback(async (targetWorkflowId?: number) => {
    const workflowId = targetWorkflowId ?? workflowIdRef.current;
    try {
      const response = await api<{ jobs: Job[] }>(`/api/workflows/${workflowId}/jobs`);
      if (workflowIdRef.current !== workflowId) return;
      setJobs(response.jobs);
    } catch (err) {
      console.error('Failed to load jobs:', err);
    }
  }, []);

  useEffect(() => {
    setInputs([]);
    setInputValues({});
    setJobs([]);
    setRunning(false);
    setError(null);
    setOutputCache({});
    setOutputPaths([]);
    setSelectedOutputPath(null);
    setOutputTool(null);
    setSelectedInputPath(null);
    setInputTool(null);
    recheckAttemptsRef.current = new Set();
    prefillAppliedRef.current = null;
    loadWorkflowDetails(workflow.id);
    loadJobs(workflow.id);
  }, [workflow.id, workflow.updatedAt, loadJobs, loadWorkflowDetails]);

  useEffect(() => {
    loadSystemStats();
    const interval = window.setInterval(loadSystemStats, 8000);
    return () => window.clearInterval(interval);
  }, [loadSystemStats]);

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
      return changed ? next : prev;
    });
    prefillAppliedRef.current = prefillKey;
    onPrefillApplied?.();
  }, [prefill, inputs, workflow.id, onPrefillApplied]);

  const buildFallbackImage = useCallback((imagePath: string): ImageItem => {
    const name = imagePath.split('/').pop() || imagePath;
    return {
      id: imagePath,
      name,
      url: buildImageUrl(imagePath),
      favorite: false,
      hidden: false,
      rating: 0,
      tags: [],
      createdMs: 0,
      mtimeMs: 0,
      size: 0
    };
  }, []);

  const loadOutputImage = useCallback(async (imagePath: string, options: { force?: boolean } = {}) => {
    if (!options.force && outputCache[imagePath]) return;
    try {
      const image = await api<ImageItem>(`/api/images/${encodeURIComponent(imagePath)}`);
      // Ensure tags is always an array for consistency
      const normalizedImage = {
        ...image,
        tags: Array.isArray(image.tags) ? image.tags : []
      };
      setOutputCache((prev) => ({ ...prev, [imagePath]: normalizedImage }));
    } catch (err) {
      setOutputCache((prev) => {
        if (prev[imagePath]) return prev;
        return { ...prev, [imagePath]: buildFallbackImage(imagePath) };
      });
    }
  }, [buildFallbackImage, outputCache]);

  const loadOutputImages = useCallback(async (paths: string[]) => {
    await Promise.all(paths.map((path) => loadOutputImage(path)));
  }, [loadOutputImage]);

  const refreshOutputImage = useCallback(async (imagePath: string) => {
    await loadOutputImage(imagePath, { force: true });
  }, [loadOutputImage]);

  const handleOutputUpdateFailure = useCallback(
    async (imagePath: string, err: unknown, fallback: string) => {
      const message = err instanceof Error ? err.message : fallback;
      await refreshOutputImage(imagePath);
      setError(message);
    },
    [refreshOutputImage]
  );

  const updateOutputCache = useCallback((imagePath: string, updater: (image: ImageItem) => ImageItem) => {
    setOutputCache((prev) => {
      const current = prev[imagePath] ?? buildFallbackImage(imagePath);
      return { ...prev, [imagePath]: updater(current) };
    });
  }, [buildFallbackImage]);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const socket = new WebSocket(`${protocol}://${window.location.host}/ws`);

    socket.onopen = () => {
      setWsConnected(true);
    };

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message?.type === 'job_update' && message.job) {
          const job = message.job as Job;
          if (job.workflowId !== workflow.id) {
            return;
          }
          mergeJobUpdate(job);
        }
      } catch (err) {
        console.warn('Failed to parse job update:', err);
      }
    };

    socket.onerror = () => {
      setWsConnected(false);
    };

    socket.onclose = () => {
      setWsConnected(false);
    };

    return () => {
      setWsConnected(false);
      socket.close();
    };
  }, [mergeJobUpdate, workflow.id]);

  const hasActiveJobs = useMemo(
    () =>
      running ||
      jobs.some((job) => job.status === 'pending' || job.status === 'queued' || job.status === 'running'),
    [jobs, running]
  );

  useEffect(() => {
    if (!hasActiveJobs) return;
    const interval = window.setInterval(() => {
      setJobClock(Date.now());
    }, 1000);
    return () => window.clearInterval(interval);
  }, [hasActiveJobs]);

  useEffect(() => {
    if (!hasActiveJobs && wsConnected) return;
    const interval = window.setInterval(() => {
      loadJobs();
    }, 8000);
    return () => window.clearInterval(interval);
  }, [hasActiveJobs, loadJobs, wsConnected]);

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
        }>(
          `/api/workflows/${workflow.id}/auto-tag`,
          {
            method: 'PUT',
            body: JSON.stringify({
              enabled,
              inputRefs: orderedRefs,
              maxWords: normalizedMaxWords
            })
          }
        );
        setAutoTagEnabled(Boolean(response.autoTagEnabled));
        setAutoTagInputRefs(new Set(response.autoTagInputRefs || []));
        setAutoTagMaxWords(normalizeAutoTagMaxWords(response.autoTagMaxWords));
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save auto-tag settings');
      } finally {
        setAutoTagSaving(false);
      }
    },
    [buildOrderedAutoTagRefs, normalizeAutoTagMaxWords, workflow.id]
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

  const handleInputChange = (inputId: number, value: string) => {
    setInputValues((prev) => ({ ...prev, [inputId]: value }));
  };

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

  const handleRun = async () => {
    try {
      setRunning(true);
      setError(null);
      const inputData = await Promise.all(
        inputs.map(async (input) => {
          const rawValue = inputValues[input.id] || '';
          const value =
            input.inputType === 'image' ? await resolveImageInputValue(rawValue) : rawValue;
          return { inputId: input.id, value };
        })
      );
      const result = await api<{ ok: boolean; jobId: number }>(`/api/workflows/${workflow.id}/run`, {
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
      await loadJobs(workflow.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run workflow');
    } finally {
      setRunning(false);
    }
  };

  const handleCancelJob = async (jobId: number) => {
    setJobs((prev) =>
      prev.map((job) =>
        job.id === jobId
          ? { ...job, status: 'cancelled', errorMessage: 'Cancelled', completedAt: Date.now() }
          : job
      )
    );
    try {
      const response = await api<{ ok: boolean; status?: string }>(`/api/jobs/${jobId}/cancel`, {
        method: 'POST'
      });
      if (!response?.ok) {
        await loadJobs(workflow.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel job');
      await loadJobs(workflow.id);
    }
  };

  const handleRecheckJobOutputs = useCallback(
    async (jobId: number) => {
      try {
        await api(`/api/jobs/${jobId}/recheck`, { method: 'POST' });
        const response = await api<{ job: Job }>(`/api/jobs/${jobId}`);
        if (response?.job) {
          mergeJobUpdate(response.job);
        } else {
          await loadJobs(workflow.id);
        }
      } catch (err) {
        console.warn('Failed to recheck job outputs:', err);
      }
    },
    [loadJobs, mergeJobUpdate, workflow.id]
  );

  useEffect(() => {
    if (jobs.length === 0) return;
    jobs.forEach((job) => {
      if (job.status !== 'completed') return;
      if (job.outputs && job.outputs.length > 0) return;
      if (!job.promptId) return;
      if (recheckAttemptsRef.current.has(job.id)) return;
      recheckAttemptsRef.current.add(job.id);
      handleRecheckJobOutputs(job.id);
    });
  }, [jobs, handleRecheckJobOutputs]);

  const handleOpenOutput = async (job: Job, output: JobOutput) => {
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
    setOutputPaths(allPaths.length > 0 ? allPaths : paths);
    setSelectedOutputPath(output.imagePath);
    setSelectedInputPath(null);
    setOutputTool(null);
    await loadOutputImages(allPaths.length > 0 ? allPaths : paths);
  };

  const handleOpenInputPreview = async (imagePath: string) => {
    if (!imagePath) return;
    setSelectedOutputPath(null);
    setSelectedInputPath(imagePath);
    setInputTool(null);
    await loadOutputImage(imagePath);
  };

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
  const selectedOutputImage = selectedOutputPath
    ? outputCache[selectedOutputPath] ?? buildFallbackImage(selectedOutputPath)
    : null;
  const selectedInputImage = selectedInputPath
    ? outputCache[selectedInputPath] ?? buildFallbackImage(selectedInputPath)
    : null;

  useEffect(() => {
    if (selectedOutputPath) {
      loadOutputImage(selectedOutputPath);
    }
  }, [selectedOutputPath, loadOutputImage]);

  useEffect(() => {
    if (selectedInputPath) {
      loadOutputImage(selectedInputPath);
    }
  }, [selectedInputPath, loadOutputImage]);

  // Use global availableTags from TagsContext for consistent tag suggestions across the app

  const handleOutputFavorite = async () => {
    if (!selectedOutputImage) return;
    const nextValue = !selectedOutputImage.favorite;
    updateOutputCache(selectedOutputImage.id, (current) => ({ ...current, favorite: nextValue }));
    try {
      await setFavorite(selectedOutputImage.id, nextValue);
    } catch (err) {
      await handleOutputUpdateFailure(selectedOutputImage.id, err, 'Failed to update favorite');
    }
  };

  const handleOutputHidden = async () => {
    if (!selectedOutputImage) return;
    const nextValue = !selectedOutputImage.hidden;
    updateOutputCache(selectedOutputImage.id, (current) => ({ ...current, hidden: nextValue }));
    try {
      await setHidden(selectedOutputImage.id, nextValue);
    } catch (err) {
      await handleOutputUpdateFailure(
        selectedOutputImage.id,
        err,
        'Failed to update hidden state'
      );
    }
  };

  const handleOutputRating = async (rating: number) => {
    if (!selectedOutputImage) return;
    updateOutputCache(selectedOutputImage.id, (current) => ({ ...current, rating }));
    try {
      await setRating(selectedOutputImage.id, rating);
    } catch (err) {
      await handleOutputUpdateFailure(selectedOutputImage.id, err, 'Failed to update rating');
    }
  };

  const handleOutputTags = async (tags: string[]) => {
    if (!selectedOutputImage) return;
    updateOutputCache(selectedOutputImage.id, (current) => ({ ...current, tags }));
    try {
      await setTags(selectedOutputImage.id, tags);
      // Refresh global tags so new tags appear in suggestions across the app
      refreshTags();
    } catch (err) {
      await handleOutputUpdateFailure(selectedOutputImage.id, err, 'Failed to update tags');
    }
  };

  const handleInputFavorite = async () => {
    if (!selectedInputImage) return;
    const nextValue = !selectedInputImage.favorite;
    updateOutputCache(selectedInputImage.id, (current) => ({ ...current, favorite: nextValue }));
    try {
      await setFavorite(selectedInputImage.id, nextValue);
    } catch (err) {
      await handleOutputUpdateFailure(selectedInputImage.id, err, 'Failed to update favorite');
    }
  };

  const handleInputHidden = async () => {
    if (!selectedInputImage) return;
    const nextValue = !selectedInputImage.hidden;
    updateOutputCache(selectedInputImage.id, (current) => ({ ...current, hidden: nextValue }));
    try {
      await setHidden(selectedInputImage.id, nextValue);
    } catch (err) {
      await handleOutputUpdateFailure(
        selectedInputImage.id,
        err,
        'Failed to update hidden state'
      );
    }
  };

  const handleInputRating = async (rating: number) => {
    if (!selectedInputImage) return;
    updateOutputCache(selectedInputImage.id, (current) => ({ ...current, rating }));
    try {
      await setRating(selectedInputImage.id, rating);
    } catch (err) {
      await handleOutputUpdateFailure(selectedInputImage.id, err, 'Failed to update rating');
    }
  };

  const handleInputTags = async (tags: string[]) => {
    if (!selectedInputImage) return;
    updateOutputCache(selectedInputImage.id, (current) => ({ ...current, tags }));
    try {
      await setTags(selectedInputImage.id, tags);
      refreshTags();
    } catch (err) {
      await handleOutputUpdateFailure(selectedInputImage.id, err, 'Failed to update tags');
    }
  };

  const handleInputDelete = async () => {
    if (!selectedInputImage) return;
    const confirmed = window.confirm('Remove this image from the library?');
    if (!confirmed) return;
    try {
      await deleteImage(selectedInputImage.id);
      setOutputCache((prev) => {
        const next = { ...prev };
        delete next[selectedInputImage.id];
        return next;
      });
      setSelectedInputPath(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete image');
    }
  };

  const handleOutputDelete = async () => {
    if (!selectedOutputImage) return;
    const confirmed = window.confirm('Remove this image from the library?');
    if (!confirmed) return;
    try {
      await deleteImage(selectedOutputImage.id);
      setJobs((prev) =>
        prev.map((job) => ({
          ...job,
          outputs: job.outputs?.filter((output) => output.imagePath !== selectedOutputImage.id)
        }))
      );
      setOutputCache((prev) => {
        const next = { ...prev };
        delete next[selectedOutputImage.id];
        return next;
      });
      setOutputPaths((prev) => prev.filter((path) => path !== selectedOutputImage.id));
      setSelectedOutputPath(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete image');
    }
  };

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{workflow.name}</h2>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={editMode}
              onChange={(event) => onEditModeChange(event.target.checked)}
              className="accent-primary"
            />
            Edit Mode
          </label>
          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => onDelete(workflow)}>
            <Trash2 className="mr-1 h-3.5 w-3.5" />
            Delete
          </Button>
        </div>
      </div>

      {workflow.description && (
        <p className="text-sm text-muted-foreground">{workflow.description}</p>
      )}

      {editMode ? (
        <section>
          <WorkflowEditorPanel
            mode="edit"
            workflow={workflow}
            onClose={() => onEditModeChange(false)}
            onSaved={onSaved}
          />
        </section>
      ) : (
        <section className="space-y-4">
          <div className="space-y-3 rounded-md border border-border/70 bg-muted/20 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">Auto-Tag On Generate</div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Automatically applies tags to each generated image after it is saved, using the
                  selected text inputs below.
                </p>
                <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                  Best results require comma-separated prompts (for example: "portrait, cinematic
                  lighting, dramatic").
                </p>
              </div>
              <label className="flex shrink-0 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={autoTagEnabled}
                  onChange={handleToggleAutoTagEnabled}
                  disabled={autoTagSaving || autoTagEligibleInputs.length === 0}
                  className="accent-primary"
                />
                Enabled
              </label>
            </div>
            <label className="flex items-center justify-between gap-3 text-xs">
              <span className="text-muted-foreground">Max words per auto-tag</span>
              <input
                type="number"
                min={1}
                max={20}
                step={1}
                value={autoTagMaxWords}
                onChange={(event) =>
                  setAutoTagMaxWords(normalizeAutoTagMaxWords(event.target.value))
                }
                onBlur={handleAutoTagMaxWordsBlur}
                disabled={autoTagSaving}
                className="h-8 w-20 rounded-md border border-input bg-background px-2 text-right text-sm"
              />
            </label>

            {autoTagEligibleInputs.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No text inputs are configured for this workflow yet.
              </p>
            ) : (
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">
                  Use these inputs for auto-tag extraction
                </div>
                <div className="max-h-36 overflow-y-auto rounded-md border border-border/70 bg-background/50 p-2">
                  <div className="space-y-2">
                    {autoTagEligibleInputs.map((input) => {
                      const ref = `${input.nodeId}:${input.inputKey}`;
                      const displayLabel = input.label?.trim() || input.inputKey;
                      const showSystemLabel = displayLabel !== input.inputKey;
                      return (
                        <label key={input.id} className="flex items-center gap-2 text-xs">
                          <input
                            type="checkbox"
                            checked={autoTagInputRefs.has(ref)}
                            onChange={() => handleToggleAutoTagInput(input)}
                            disabled={autoTagSaving}
                            className="accent-primary"
                          />
                          <span className="font-medium">{displayLabel}</span>
                          {showSystemLabel && (
                            <span className="text-muted-foreground">{input.inputKey}</span>
                          )}
                          <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] text-secondary-foreground">
                            {input.inputType}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
            {autoTagSaving && (
              <p className="text-xs text-muted-foreground">Saving auto-tag settings...</p>
            )}
          </div>

          <h3 className="text-sm font-semibold">Inputs</h3>
          {inputs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No inputs configured for this workflow.</p>
          ) : (
            <div className="space-y-3">
              {inputs.map((input) => {
                const displayLabel = input.label?.trim() || input.inputKey;
                const showSystemLabel = displayLabel !== input.inputKey;
                return (
                  <div key={input.id} className="space-y-1">
                    <label htmlFor={`input-${input.id}`} className="block text-sm font-medium">
                      {displayLabel}
                      {showSystemLabel && (
                        <span className="ml-2 text-xs text-muted-foreground">{input.inputKey}</span>
                      )}
                    </label>
                    {input.inputType === 'text' ? (
                      <textarea
                        id={`input-${input.id}`}
                        value={inputValues[input.id] || ''}
                        onChange={(e) => handleInputChange(input.id, e.target.value)}
                        placeholder={`Enter ${displayLabel.toLowerCase()}`}
                        rows={3}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      />
                    ) : input.inputType === 'number' ? (
                      <input
                        id={`input-${input.id}`}
                        type="number"
                        value={inputValues[input.id] || ''}
                        onChange={(e) => handleInputChange(input.id, e.target.value)}
                        placeholder={`Enter ${displayLabel.toLowerCase()}`}
                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                      />
                    ) : input.inputType === 'seed' ? (
                      <div className="flex gap-2">
                        <input
                          id={`input-${input.id}`}
                          type="number"
                          value={inputValues[input.id] || ''}
                          onChange={(e) => handleInputChange(input.id, e.target.value)}
                          placeholder="Seed value"
                          className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            handleInputChange(
                              input.id,
                              String(Math.floor(Math.random() * 2147483647))
                            )
                          }
                        >
                          Random
                        </Button>
                      </div>
                    ) : input.inputType === 'image' ? (
                      <ImageInputField
                        value={inputValues[input.id] || ''}
                        onChange={(value) => handleInputChange(input.id, value)}
                        onPreview={handleOpenInputPreview}
                        onError={setError}
                      />
                    ) : (
                      <input
                        id={`input-${input.id}`}
                        type="text"
                        value={inputValues[input.id] || ''}
                        onChange={(e) => handleInputChange(input.id, e.target.value)}
                        placeholder={`Enter ${displayLabel.toLowerCase()}`}
                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {showDebug && (
            <div className="rounded-md border p-3">
              <div className="text-xs font-medium text-muted-foreground">Generated prompt JSON (debug=1)</div>
              <pre className="mt-2 whitespace-pre-wrap break-all text-xs">{promptPreview}</pre>
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={handleRun} disabled={running}>
              {running ? 'Running...' : 'Run Workflow'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setExportApiOpen(true)}>
              <Code2 className="mr-1 h-3.5 w-3.5" />
              API
            </Button>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </section>
      )}

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Recent Jobs</h3>
        <SystemStatsPanel
          stats={systemStats}
          error={systemStatsError}
          updatedAt={systemStatsUpdatedAt}
        />
        {jobs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No jobs yet. Run the workflow to generate images.</p>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                now={jobClock}
                onOpenOutput={handleOpenOutput}
                onCancel={handleCancelJob}
                onRecheck={handleRecheckJobOutputs}
              />
            ))}
          </div>
        )}
      </section>

      {selectedOutputImage && (
        <ImageModal
          image={selectedOutputImage}
          index={Math.max(0, selectedOutputIndex)}
          total={outputPaths.length || 1}
          modalTool={outputTool}
          availableTags={availableTags}
          onUpdateTags={handleOutputTags}
          onToggleTags={() =>
            setOutputTool((current) => (current === 'tags' ? null : 'tags'))
          }
          onToggleRating={() =>
            setOutputTool((current) => (current === 'rating' ? null : 'rating'))
          }
          onTogglePrompt={() =>
            setOutputTool((current) => (current === 'prompt' ? null : 'prompt'))
          }
          onToggleFavorite={handleOutputFavorite}
          onToggleHidden={handleOutputHidden}
          onRate={handleOutputRating}
          onDelete={handleOutputDelete}
          onClose={() => {
            setSelectedOutputPath(null);
            setOutputTool(null);
          }}
          onPrev={() => {
            if (outputPaths.length === 0) return;
            if (selectedOutputIndex <= 0) {
              setSelectedOutputPath(outputPaths[outputPaths.length - 1]);
              return;
            }
            setSelectedOutputPath(outputPaths[selectedOutputIndex - 1]);
          }}
          onNext={() => {
            if (outputPaths.length === 0) return;
            if (selectedOutputIndex === -1 || selectedOutputIndex >= outputPaths.length - 1) {
              setSelectedOutputPath(outputPaths[0]);
              return;
            }
            setSelectedOutputPath(outputPaths[selectedOutputIndex + 1]);
          }}
        />
      )}

      {selectedInputImage && (
        <ImageModal
          image={selectedInputImage}
          index={0}
          total={1}
          modalTool={inputTool}
          availableTags={availableTags}
          onUpdateTags={handleInputTags}
          onToggleTags={() =>
            setInputTool((current) => (current === 'tags' ? null : 'tags'))
          }
          onToggleRating={() =>
            setInputTool((current) => (current === 'rating' ? null : 'rating'))
          }
          onTogglePrompt={() =>
            setInputTool((current) => (current === 'prompt' ? null : 'prompt'))
          }
          onToggleFavorite={handleInputFavorite}
          onToggleHidden={handleInputHidden}
          onRate={handleInputRating}
          onDelete={handleInputDelete}
          onClose={() => {
            setSelectedInputPath(null);
            setInputTool(null);
          }}
          onPrev={() => {}}
          onNext={() => {}}
        />
      )}
      <ExportApiModal
        workflowId={workflow.id}
        open={exportApiOpen}
        onOpenChange={setExportApiOpen}
      />
    </div>
  );
}
