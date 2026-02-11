import JobCard from '../JobCard';
import SystemStatsPanel from '../SystemStatsPanel';
import type { Job, JobOutput } from '../../../types';
import type { SystemStatsResponse } from '../types';

type WorkflowJobsSectionProps = {
  jobs: Job[];
  jobClock: number;
  systemStats: SystemStatsResponse | null;
  systemStatsError: string | null;
  systemStatsUpdatedAt: number | null;
  onOpenOutput: (job: Job, output: JobOutput) => void;
  onCancelJob: (jobId: number) => void;
  onRecheckJobOutputs: (jobId: number) => void;
};

export default function WorkflowJobsSection({
  jobs,
  jobClock,
  systemStats,
  systemStatsError,
  systemStatsUpdatedAt,
  onOpenOutput,
  onCancelJob,
  onRecheckJobOutputs
}: WorkflowJobsSectionProps) {
  return (
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
              onOpenOutput={onOpenOutput}
              onCancel={onCancelJob}
              onRecheck={onRecheckJobOutputs}
            />
          ))}
        </div>
      )}
    </section>
  );
}
