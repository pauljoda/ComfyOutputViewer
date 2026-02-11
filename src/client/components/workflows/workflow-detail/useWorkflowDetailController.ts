import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../../lib/api';
import { deleteImage, setFavorite, setHidden, setRating, setTags } from '../../../lib/imagesApi';
import { buildImageUrl } from '../../../utils/images';
import type { ImageItem, Job, JobOutput, ModalTool, Workflow, WorkflowInput } from '../../../types';
import type {
  ImageUploadValue,
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
  const isInputDirtyRef = useRef(false);
  const previousWorkflowIdRef = useRef<number | null>(null);
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

  const loadWorkflowDetails = useCallback(
    async (targetWorkflowId?: number, options: { preserveInputValues?: boolean } = {}) => {
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
    [normalizeAutoTagMaxWords]
  );

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
    const workflowChanged = previousWorkflowIdRef.current !== workflow.id;
    previousWorkflowIdRef.current = workflow.id;

    if (workflowChanged) {
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
      isInputDirtyRef.current = false;
      recheckAttemptsRef.current = new Set();
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
      if (!changed) {
        return prev;
      }
      isInputDirtyRef.current = true;
      return next;
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

  const loadOutputImage = useCallback(
    async (imagePath: string, options: { force?: boolean } = {}) => {
      if (!options.force && outputCache[imagePath]) return;
      try {
        const image = await api<ImageItem>(`/api/images/${encodeURIComponent(imagePath)}`);
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
    },
    [buildFallbackImage, outputCache]
  );

  const loadOutputImages = useCallback(
    async (paths: string[]) => {
      await Promise.all(paths.map((path) => loadOutputImage(path)));
    },
    [loadOutputImage]
  );

  const refreshOutputImage = useCallback(
    async (imagePath: string) => {
      await loadOutputImage(imagePath, { force: true });
    },
    [loadOutputImage]
  );

  const handleOutputUpdateFailure = useCallback(
    async (imagePath: string, err: unknown, fallback: string) => {
      const message = err instanceof Error ? err.message : fallback;
      await refreshOutputImage(imagePath);
      setError(message);
    },
    [refreshOutputImage]
  );

  const updateOutputCache = useCallback(
    (imagePath: string, updater: (image: ImageItem) => ImageItem) => {
      setOutputCache((prev) => {
        const current = prev[imagePath] ?? buildFallbackImage(imagePath);
        return { ...prev, [imagePath]: updater(current) };
      });
    },
    [buildFallbackImage]
  );

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
        }>(`/api/workflows/${workflow.id}/auto-tag`, {
          method: 'PUT',
          body: JSON.stringify({
            enabled,
            inputRefs: orderedRefs,
            maxWords: normalizedMaxWords
          })
        });
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

  const handleInputChange = useCallback((inputId: number, value: string) => {
    isInputDirtyRef.current = true;
    setInputValues((prev) => ({ ...prev, [inputId]: value }));
  }, []);

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
  }, [inputs, inputValues, loadJobs, mergeJobUpdate, resolveImageInputValue, workflow.id]);

  const handleCancelJob = useCallback(
    async (jobId: number) => {
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
    },
    [loadJobs, workflow.id]
  );

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
      setOutputPaths(allPaths.length > 0 ? allPaths : paths);
      setSelectedOutputPath(output.imagePath);
      setSelectedInputPath(null);
      setOutputTool(null);
      await loadOutputImages(allPaths.length > 0 ? allPaths : paths);
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

  const handleOutputFavorite = useCallback(async () => {
    if (!selectedOutputImage) return;
    const nextValue = !selectedOutputImage.favorite;
    updateOutputCache(selectedOutputImage.id, (current) => ({ ...current, favorite: nextValue }));
    try {
      await setFavorite(selectedOutputImage.id, nextValue);
    } catch (err) {
      await handleOutputUpdateFailure(selectedOutputImage.id, err, 'Failed to update favorite');
    }
  }, [handleOutputUpdateFailure, selectedOutputImage, updateOutputCache]);

  const handleOutputHidden = useCallback(async () => {
    if (!selectedOutputImage) return;
    const nextValue = !selectedOutputImage.hidden;
    updateOutputCache(selectedOutputImage.id, (current) => ({ ...current, hidden: nextValue }));
    try {
      await setHidden(selectedOutputImage.id, nextValue);
    } catch (err) {
      await handleOutputUpdateFailure(selectedOutputImage.id, err, 'Failed to update hidden state');
    }
  }, [handleOutputUpdateFailure, selectedOutputImage, updateOutputCache]);

  const handleOutputRating = useCallback(
    async (rating: number) => {
      if (!selectedOutputImage) return;
      updateOutputCache(selectedOutputImage.id, (current) => ({ ...current, rating }));
      try {
        await setRating(selectedOutputImage.id, rating);
      } catch (err) {
        await handleOutputUpdateFailure(selectedOutputImage.id, err, 'Failed to update rating');
      }
    },
    [handleOutputUpdateFailure, selectedOutputImage, updateOutputCache]
  );

  const handleOutputTags = useCallback(
    async (tags: string[]) => {
      if (!selectedOutputImage) return;
      updateOutputCache(selectedOutputImage.id, (current) => ({ ...current, tags }));
      try {
        await setTags(selectedOutputImage.id, tags);
        refreshTags();
      } catch (err) {
        await handleOutputUpdateFailure(selectedOutputImage.id, err, 'Failed to update tags');
      }
    },
    [handleOutputUpdateFailure, refreshTags, selectedOutputImage, updateOutputCache]
  );

  const handleInputFavorite = useCallback(async () => {
    if (!selectedInputImage) return;
    const nextValue = !selectedInputImage.favorite;
    updateOutputCache(selectedInputImage.id, (current) => ({ ...current, favorite: nextValue }));
    try {
      await setFavorite(selectedInputImage.id, nextValue);
    } catch (err) {
      await handleOutputUpdateFailure(selectedInputImage.id, err, 'Failed to update favorite');
    }
  }, [handleOutputUpdateFailure, selectedInputImage, updateOutputCache]);

  const handleInputHidden = useCallback(async () => {
    if (!selectedInputImage) return;
    const nextValue = !selectedInputImage.hidden;
    updateOutputCache(selectedInputImage.id, (current) => ({ ...current, hidden: nextValue }));
    try {
      await setHidden(selectedInputImage.id, nextValue);
    } catch (err) {
      await handleOutputUpdateFailure(selectedInputImage.id, err, 'Failed to update hidden state');
    }
  }, [handleOutputUpdateFailure, selectedInputImage, updateOutputCache]);

  const handleInputRating = useCallback(
    async (rating: number) => {
      if (!selectedInputImage) return;
      updateOutputCache(selectedInputImage.id, (current) => ({ ...current, rating }));
      try {
        await setRating(selectedInputImage.id, rating);
      } catch (err) {
        await handleOutputUpdateFailure(selectedInputImage.id, err, 'Failed to update rating');
      }
    },
    [handleOutputUpdateFailure, selectedInputImage, updateOutputCache]
  );

  const handleInputTags = useCallback(
    async (tags: string[]) => {
      if (!selectedInputImage) return;
      updateOutputCache(selectedInputImage.id, (current) => ({ ...current, tags }));
      try {
        await setTags(selectedInputImage.id, tags);
        refreshTags();
      } catch (err) {
        await handleOutputUpdateFailure(selectedInputImage.id, err, 'Failed to update tags');
      }
    },
    [handleOutputUpdateFailure, refreshTags, selectedInputImage, updateOutputCache]
  );

  const handleInputDelete = useCallback(async () => {
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
  }, [selectedInputImage]);

  const handleOutputDelete = useCallback(async () => {
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
  }, [selectedOutputImage]);

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

  const closeOutputModal = useCallback(() => {
    setSelectedOutputPath(null);
    setOutputTool(null);
  }, []);

  const closeInputModal = useCallback(() => {
    setSelectedInputPath(null);
    setInputTool(null);
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
    inputs,
    inputValues,
    autoTagEnabled,
    autoTagInputRefs,
    autoTagMaxWords,
    autoTagSaving,
    autoTagEligibleInputs,
    normalizeAutoTagMaxWords,
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
    setAutoTagMaxWords,
    setExportApiOpen,
    handleToggleAutoTagEnabled,
    handleToggleAutoTagInput,
    handleAutoTagMaxWordsBlur,
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
