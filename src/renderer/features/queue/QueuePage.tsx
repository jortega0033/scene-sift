import { useMemo } from 'react';
import { useCreateDemoJob, useQueue } from '@renderer/hooks/useQueue';
import { useProjects } from '@renderer/hooks/useProjects';
import { StatusPill } from '@renderer/components/StatusPill';

export const QueuePage = () => {
  const queue = useQueue();
  const projects = useProjects();
  const createDemoJob = useCreateDemoJob();

  const firstProjectId = useMemo(() => projects.data?.[0]?.id ?? null, [projects.data]);

  return (
    <section data-testid="queue-page" className="space-y-4">
      <header className="space-y-1">
        <h2 className="text-2xl font-semibold">Queue</h2>
        <p className="text-sm text-muted-foreground">
          Job lifecycle visibility for upcoming FFmpeg rendering. No automatic publishing in this
          phase.
        </p>
      </header>

      <div data-mono-surface="panel" className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-label">Jobs</h3>
          {import.meta.env.DEV && (
            <button
              type="button"
              className="h-[var(--control-height)] rounded-[var(--radius-sm)] border border-border px-3 text-sm disabled:opacity-50"
              disabled={!firstProjectId || createDemoJob.isPending}
              onClick={() => {
                if (firstProjectId) void createDemoJob.mutateAsync(firstProjectId);
              }}
            >
              Create demo job
            </button>
          )}
        </div>

        {queue.isLoading && <p className="text-sm text-muted-foreground">Loading queue…</p>}
        {!queue.isLoading && (queue.data?.length ?? 0) === 0 && (
          <p className="text-sm text-muted-foreground">No jobs in queue.</p>
        )}

        <ul className="space-y-2">
          {queue.data?.map((job) => (
            <li key={job.id} data-mono-surface="panel" className="p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-mono text-label text-muted-foreground">{job.id}</p>
                <StatusPill
                  label={job.status}
                  status={
                    job.status === 'completed'
                      ? 'ok'
                      : job.status === 'running' || job.status === 'queued'
                        ? 'warning'
                        : 'neutral'
                  }
                />
              </div>
              <div className="mt-2">
                <p className="text-xs text-muted-foreground">
                  Progress <span className="font-medium text-foreground">{job.progress}%</span>
                </p>
                <div
                  role="progressbar"
                  aria-label={`Progress for job ${job.id}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.max(0, Math.min(job.progress, 100))}
                  className="mt-1 h-2 w-full overflow-hidden rounded-full border border-border bg-muted"
                >
                  <div
                    className="h-full bg-foreground transition-none"
                    style={{ width: `${Math.max(0, Math.min(job.progress, 100))}%` }}
                  />
                </div>
              </div>
              {job.outputPath && (
                <p className="mt-2 break-all font-mono text-label text-muted-foreground">
                  Output: {job.outputPath}
                </p>
              )}
              {job.errorMessage && (
                <p className="mt-2 rounded-[var(--radius-sm)] border border-border bg-muted p-2 text-xs">
                  Error: {job.errorMessage}
                </p>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};
