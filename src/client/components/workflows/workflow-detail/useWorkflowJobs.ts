import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../../lib/api';
import type { Job } from '../../../types';
import type { SystemStatsResponse } from '../types';

type UseWorkflowJobsArgs = {
  workflowId: number;
  running: boolean;
  onError: (message: string) => void;
};

export type UseWorkflowJobsResult = {
  jobs: Job[];
  setJobs: Dispatch<SetStateAction<Job[]>>;
  jobClock: number;
  systemStats: SystemStatsResponse | null;
  systemStatsError: string | null;
  systemStatsUpdatedAt: number | null;
  loadJobs: (targetWorkflowId?: number) => Promise<void>;
  mergeJobUpdate: (job: Job) => void;
  handleCancelJob: (jobId: number) => Promise<void>;
  handleRecheckJobOutputs: (jobId: number) => Promise<void>;
};

export function useWorkflowJobs({ workflowId, running, onError }: UseWorkflowJobsArgs): UseWorkflowJobsResult {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobClock, setJobClock] = useState(() => Date.now());
  const [wsConnected, setWsConnected] = useState(false);
  const [systemStats, setSystemStats] = useState<SystemStatsResponse | null>(null);
  const [systemStatsError, setSystemStatsError] = useState<string | null>(null);
  const [systemStatsUpdatedAt, setSystemStatsUpdatedAt] = useState<number | null>(null);
  const recheckAttemptsRef = useRef<Set<number>>(new Set());
  const pendingJobRefetchTimeoutsRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const workflowIdRef = useRef(workflowId);

  workflowIdRef.current = workflowId;

  useEffect(() => {
    recheckAttemptsRef.current = new Set();
  }, [workflowId]);

  useEffect(() => {
    return () => {
      pendingJobRefetchTimeoutsRef.current.forEach((timeoutId) => {
        clearTimeout(timeoutId);
      });
      pendingJobRefetchTimeoutsRef.current.clear();
    };
  }, [workflowId]);

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

  const loadJobs = useCallback(async (targetWorkflowId?: number) => {
    const activeWorkflowId = targetWorkflowId ?? workflowIdRef.current;
    try {
      const response = await api<{ jobs: Job[] }>(`/api/workflows/${activeWorkflowId}/jobs`);
      if (workflowIdRef.current !== activeWorkflowId) return;
      setJobs(response.jobs);
    } catch (err) {
      console.error('Failed to load jobs:', err);
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
          await loadJobs(workflowIdRef.current);
        }
      } catch (err) {
        onError(err instanceof Error ? err.message : 'Failed to cancel job');
        await loadJobs(workflowIdRef.current);
      }
    },
    [loadJobs, onError]
  );

  const handleRecheckJobOutputs = useCallback(
    async (jobId: number) => {
      try {
        await api(`/api/jobs/${jobId}/recheck`, { method: 'POST' });
        const response = await api<{ job: Job }>(`/api/jobs/${jobId}`);
        if (response?.job) {
          mergeJobUpdate(response.job);
        } else {
          await loadJobs(workflowIdRef.current);
        }
      } catch (err) {
        console.warn('Failed to recheck job outputs:', err);
      }
    },
    [loadJobs, mergeJobUpdate]
  );

  useEffect(() => {
    if (jobs.length === 0) return;
    jobs.forEach((job) => {
      if (job.status !== 'completed') return;
      if (job.outputs && job.outputs.length > 0) return;
      if (!job.promptId) return;
      if (recheckAttemptsRef.current.has(job.id)) return;
      recheckAttemptsRef.current.add(job.id);
      void handleRecheckJobOutputs(job.id);
    });
  }, [jobs, handleRecheckJobOutputs]);

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
          if (job.workflowId !== workflowId) {
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
  }, [mergeJobUpdate, workflowId]);

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
      void loadJobs();
    }, 8000);
    return () => window.clearInterval(interval);
  }, [hasActiveJobs, loadJobs, wsConnected]);

  useEffect(() => {
    void loadSystemStats();
    const interval = window.setInterval(() => {
      void loadSystemStats();
    }, 8000);
    return () => window.clearInterval(interval);
  }, [loadSystemStats]);

  return {
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
  };
}
