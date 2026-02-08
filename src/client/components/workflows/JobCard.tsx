import { Button } from '../ui/button';
import type { Job, JobOutput } from '../../types';
import { formatDuration } from './formatters';

type JobCardProps = {
  job: Job;
  now: number;
  onOpenOutput: (job: Job, output: JobOutput) => void;
  onCancel: (jobId: number) => void;
  onRecheck: (jobId: number) => void;
};

export default function JobCard({ job, now, onOpenOutput, onCancel, onRecheck }: JobCardProps) {
  const isGenerating = job.status === 'pending' || job.status === 'queued' || job.status === 'running';
  const statusColor =
    job.status === 'completed'
      ? 'text-green-500'
      : job.status === 'error'
        ? 'text-destructive'
        : job.status === 'cancelled'
          ? 'text-muted-foreground'
          : 'text-primary';
  const borderColor =
    job.status === 'completed'
      ? 'border-green-500/40'
      : job.status === 'error'
        ? 'border-destructive/40'
        : job.status === 'cancelled'
          ? ''
          : 'border-primary/30';
  const statusLabel =
    isGenerating ? 'Generating Image…' : job.status === 'cancelled' ? 'Cancelled' : job.status;
  const startedAt = job.startedAt ?? job.createdAt;
  const endedAt = job.completedAt ?? now;
  const durationMs = Math.max(0, endedAt - startedAt);
  const hasOutputs = Boolean(job.outputs && job.outputs.length > 0);
  const progress = isGenerating ? job.progress : null;
  const overall = isGenerating ? job.overall : null;
  const progressValue = progress && Number.isFinite(progress.value) ? progress.value : 0;
  const progressMax = progress && Number.isFinite(progress.max) ? progress.max : 0;
  const normalizedProgressPercent =
    progress && Number.isFinite(progress.percent) ? Number(progress.percent) : null;
  const progressPercent =
    normalizedProgressPercent !== null
      ? normalizedProgressPercent
      : progressMax > 0
        ? (progressValue / progressMax) * 100
        : null;
  const progressPercentValue =
    progressPercent === null ? 0 : Math.max(0, Math.min(100, Math.round(progressPercent)));
  const progressLabel =
    progress && progressMax > 0 ? `${Math.min(progressValue, progressMax)} / ${progressMax}` : null;
  const nodeLabel = progress?.node ? `Node ${progress.node}` : null;
  const normalizedOverallPercent =
    overall && Number.isFinite(overall.percent) ? Number(overall.percent) : null;
  const overallPercent =
    normalizedOverallPercent !== null
      ? normalizedOverallPercent
      : overall && overall.total > 0
        ? (overall.current / overall.total) * 100
        : null;
  const overallPercentValue =
    overallPercent === null ? 0 : Math.max(0, Math.min(100, Math.round(overallPercent)));
  const overallLabel =
    overall && overall.total > 0 ? `${Math.min(overall.current, overall.total)} / ${overall.total}` : null;
  const previewUrl = isGenerating ? job.preview?.url : null;
  const queueInfo = job.queue;
  const liveStatus = job.live;
  const pillPercentValue =
    overall && overall.total > 0 ? overallPercentValue : progressPercentValue;
  const queueStateLabel =
    queueInfo?.state === 'running'
      ? 'Running'
      : queueInfo?.state === 'queued'
        ? 'Queued'
        : 'Queue';
  const queuePositionLabel =
    queueInfo && typeof queueInfo.position === 'number' && typeof queueInfo.total === 'number'
      ? `${queueInfo.position}/${queueInfo.total}`
      : null;
  const queueAheadLabel =
    queueInfo && typeof queueInfo.ahead === 'number'
      ? `${queueInfo.ahead} ahead`
      : null;
  const queueRemainingLabel =
    queueInfo && typeof queueInfo.remaining === 'number'
      ? `${queueInfo.remaining} remaining`
      : null;
  const showQueueMeta = Boolean(
    isGenerating && queueInfo && (queuePositionLabel || queueRemainingLabel)
  );
  const hasProgress = Boolean(progress && progressMax > 0);
  const showLiveWarning =
    isGenerating &&
    liveStatus &&
    liveStatus.connected === false &&
    !progress &&
    !previewUrl;

  return (
    <div className={`rounded-lg border bg-card p-3 space-y-2 ${borderColor}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium capitalize ${statusColor}`}>
            {statusLabel}
            {isGenerating && <span className="ml-1 inline-block h-2 w-2 animate-pulse rounded-full bg-primary" aria-hidden="true" />}
          </span>
          {isGenerating && (overallPercent !== null || progressPercent !== null) && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{pillPercentValue}%</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {isGenerating && (
            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => onCancel(job.id)}>
              Cancel
            </Button>
          )}
          {!isGenerating && job.status === 'completed' && !hasOutputs && (
            <Button variant="ghost" size="sm" onClick={() => onRecheck(job.id)}>
              Recheck outputs
            </Button>
          )}
        </div>
      </div>
      <div className="flex gap-3">
        {isGenerating && previewUrl && (
          <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-md border">
            <img src={previewUrl} alt="Live preview" loading="lazy" className="h-full w-full object-cover" width={96} height={96} />
            <span className="absolute bottom-1 left-1 rounded bg-primary px-1 py-0.5 text-[10px] font-medium text-primary-foreground">Live</span>
          </div>
        )}
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{new Date(job.createdAt).toLocaleString()}</span>
            <span>{formatDuration(durationMs)}</span>
            {showQueueMeta && (
              <span className="flex items-center gap-1">
                <span className="font-medium">{queueStateLabel}</span>
                {queuePositionLabel && <span>{queuePositionLabel}</span>}
                {queueAheadLabel && queueInfo?.state === 'queued' && (
                  <span className="opacity-70">{queueAheadLabel}</span>
                )}
                {!queueAheadLabel && queueRemainingLabel && (
                  <span className="opacity-70">{queueRemainingLabel}</span>
                )}
              </span>
            )}
          </div>
          {isGenerating && (
            <div className="space-y-1">
              {overall && overall.total > 0 && (
                <div className="space-y-0.5">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary/60 transition-[width]" style={{ width: `${overallPercentValue}%` }} />
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>{overallLabel ? `Overall ${overallLabel}` : 'Overall progress'}</span>
                    <span>{overallPercentValue}%</span>
                  </div>
                </div>
              )}
              <div className={`h-1.5 w-full overflow-hidden rounded-full bg-muted ${!hasProgress ? 'animate-pulse' : ''}`}>
                <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${progressPercentValue}%` }} />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>{progressLabel ? `Step ${progressLabel}` : 'Working…'}</span>
                {nodeLabel && <span>{nodeLabel}</span>}
              </div>
              {showLiveWarning && (
                <div className="text-[10px] text-destructive">
                  Live updates unavailable (ComfyUI websocket not connected).
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {job.errorMessage && <p className="text-xs text-destructive">{job.errorMessage}</p>}
      {job.outputs && job.outputs.filter((output) => output.exists !== false).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {job.outputs
            .filter((output) => output.exists !== false)
            .map((output, index) => (
            <button
              key={index}
              type="button"
              className="h-16 w-16 overflow-hidden rounded-md border hover:ring-2 hover:ring-primary"
              onClick={() => onOpenOutput(job, output)}
              title="Open in viewer"
              aria-label={`Open output ${index + 1}`}
            >
              <img
                src={output.thumbUrl || `/images/${encodeURI(output.imagePath)}`}
                alt={`Output ${index + 1}`}
                className="h-full w-full object-cover"
                loading="lazy"
                width={64}
                height={64}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
