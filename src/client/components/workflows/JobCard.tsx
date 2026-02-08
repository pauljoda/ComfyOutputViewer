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
  const statusClass =
    job.status === 'completed'
      ? 'success'
      : job.status === 'error'
        ? 'error'
        : job.status === 'cancelled'
          ? 'cancelled'
          : job.status === 'queued'
            ? 'queued'
            : job.status === 'running'
              ? 'running'
              : 'pending';
  const statusLabel =
    isGenerating ? 'Generating Image...' : job.status === 'cancelled' ? 'Cancelled' : job.status;
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
    <div className={`job-card ${statusClass} ${isGenerating ? 'generating' : ''}`}>
      <div className="job-header">
        <div className="job-title">
          <span className="job-status">
            {statusLabel}
            {isGenerating && <span className="job-spinner" aria-hidden="true" />}
          </span>
          {isGenerating && (overallPercent !== null || progressPercent !== null) && (
            <span className="job-progress-pill">{pillPercentValue}%</span>
          )}
        </div>
        <div className="job-actions">
          {isGenerating && (
            <button
              type="button"
              className="ghost small danger"
              onClick={() => onCancel(job.id)}
            >
              Cancel
            </button>
          )}
          {!isGenerating && job.status === 'completed' && !hasOutputs && (
            <button
              type="button"
              className="ghost small"
              onClick={() => onRecheck(job.id)}
            >
              Recheck outputs
            </button>
          )}
        </div>
      </div>
      <div className="job-body">
        {isGenerating && previewUrl && (
          <div className="job-preview">
            <img src={previewUrl} alt="Live preview" loading="lazy" />
            <span className="job-preview-badge">Live</span>
          </div>
        )}
        <div className="job-detail">
          <div className="job-meta">
            <span className="job-time">{new Date(job.createdAt).toLocaleString()}</span>
            <span className="job-duration">{formatDuration(durationMs)}</span>
            {showQueueMeta && (
              <span className="job-queue">
                <span className="job-queue-label">{queueStateLabel}</span>
                {queuePositionLabel && <span className="job-queue-value">{queuePositionLabel}</span>}
                {queueAheadLabel && queueInfo?.state === 'queued' && (
                  <span className="job-queue-sub">{queueAheadLabel}</span>
                )}
                {!queueAheadLabel && queueRemainingLabel && (
                  <span className="job-queue-sub">{queueRemainingLabel}</span>
                )}
              </span>
            )}
          </div>
          {isGenerating && (
            <div className="job-progress">
              {overall && overall.total > 0 && (
                <div className="job-progress-overall">
                  <div className="job-progress-bar overall">
                    <span style={{ width: `${overallPercentValue}%` }} />
                  </div>
                  <div className="job-progress-info">
                    <span>{overallLabel ? `Overall ${overallLabel}` : 'Overall progress'}</span>
                    <span className="job-progress-node">{overallPercentValue}%</span>
                  </div>
                </div>
              )}
              <div className={`job-progress-bar ${hasProgress ? '' : 'indeterminate'}`}>
                <span style={{ width: `${progressPercentValue}%` }} />
              </div>
              <div className="job-progress-info">
                <span>{progressLabel ? `Step ${progressLabel}` : 'Working...'}</span>
                {nodeLabel && <span className="job-progress-node">{nodeLabel}</span>}
              </div>
              {showLiveWarning && (
                <div className="job-live-warning">
                  Live updates unavailable (ComfyUI websocket not connected).
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {job.errorMessage && <p className="job-error">{job.errorMessage}</p>}
      {job.outputs && job.outputs.filter((output) => output.exists !== false).length > 0 && (
        <div className="job-outputs">
          {job.outputs
            .filter((output) => output.exists !== false)
            .map((output, index) => (
            <button
              key={index}
              type="button"
              className="job-output-thumb"
              onClick={() => onOpenOutput(job, output)}
              title="Open in viewer"
            >
              <img
                src={output.thumbUrl || `/images/${encodeURI(output.imagePath)}`}
                alt={`Output ${index + 1}`}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
