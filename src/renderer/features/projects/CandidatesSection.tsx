import { useQuery } from '@tanstack/react-query';
import type { ProjectRecord } from '@shared/schemas/project';
import type { ClipCandidate } from '@shared/schemas/candidates';
import {
  useCandidates,
  useGenerateCandidates,
  useCancelGeneration,
  useUpdateCandidateStatus,
} from '@renderer/hooks/useCandidates';

type CandidatesSectionProps = {
  project: ProjectRecord;
};

const msToTimestamp = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
};

const statusLabel: Record<string, string> = {
  generating: 'Generating…',
  done: 'Ready',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

const statusClass: Record<string, string> = {
  generating: 'text-blue-600 dark:text-blue-400',
  done: 'text-green-600 dark:text-green-400',
  failed: 'text-red-600 dark:text-red-400',
  cancelled: 'text-muted-foreground',
};

const candidateStatusBadge: Record<string, string> = {
  suggested: 'border border-border text-muted-foreground',
  approved: 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200',
  rejected: 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200',
};

const candidateStatusLabel: Record<string, string> = {
  suggested: 'Suggested',
  approved: 'Approved',
  rejected: 'Rejected',
};

function CandidateRow({
  candidate,
  projectId,
}: {
  candidate: ClipCandidate;
  projectId: string;
}) {
  const updateStatus = useUpdateCandidateStatus();

  const handleApprove = () =>
    void updateStatus.mutateAsync({ candidateId: candidate.id, projectId, status: 'approved' });
  const handleReject = () =>
    void updateStatus.mutateAsync({ candidateId: candidate.id, projectId, status: 'rejected' });

  return (
    <li
      data-testid="candidate-item"
      className="rounded border border-border p-3 space-y-1.5"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-snug">{candidate.title}</p>
        <span
          className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${candidateStatusBadge[candidate.candidateStatus] ?? ''}`}
        >
          {candidateStatusLabel[candidate.candidateStatus] ?? candidate.candidateStatus}
        </span>
      </div>

      <p className="font-mono text-mono-path text-xs text-muted-foreground">
        {msToTimestamp(candidate.startMs)} – {msToTimestamp(candidate.endMs)}
        <span className="ml-2 opacity-60">score {(candidate.scoreRaw * 100).toFixed(0)}%</span>
      </p>

      <p className="text-xs text-muted-foreground">{candidate.reason}</p>

      {candidate.candidateStatus !== 'rejected' && (
        <div className="flex gap-2 pt-1">
          {candidate.candidateStatus !== 'approved' && (
            <button
              type="button"
              data-testid="approve-candidate-button"
              className="h-[var(--control-height)] rounded-[var(--radius-sm)] border border-foreground px-2 text-xs hover:bg-muted disabled:opacity-50"
              disabled={updateStatus.isPending}
              onClick={handleApprove}
            >
              Approve
            </button>
          )}
          <button
            type="button"
            data-testid="reject-candidate-button"
            className="h-[var(--control-height)] rounded-[var(--radius-sm)] border border-border px-2 text-xs hover:bg-muted disabled:opacity-50"
            disabled={updateStatus.isPending}
            onClick={handleReject}
          >
            Reject
          </button>
        </div>
      )}
    </li>
  );
}

export const CandidatesSection = ({ project }: CandidatesSectionProps) => {
  const subtitleReady =
    project.subtitleStatus === 'ready' || project.subtitleStatus === 'ready_with_warnings';
  const projectReady = project.status === 'ready';

  const aiConfigQuery = useQuery({
    queryKey: ['ai-config-status'],
    queryFn: () => window.sceneSift.ai.getConfigurationStatus(),
    enabled: subtitleReady && projectReady,
  });
  const aiAvailable = aiConfigQuery.data?.configurationStatus === 'available';

  const candidatesQuery = useCandidates(subtitleReady && projectReady ? project.id : null);
  const generate = useGenerateCandidates();
  const cancel = useCancelGeneration();

  const data = candidatesQuery.data;
  const isGenerating = data?.generationStatus === 'generating' || generate.isPending;
  const canGenerate = subtitleReady && projectReady && aiAvailable;

  if (!subtitleReady) {
    return (
      <div data-testid="candidates-section" className="border-t border-border pt-4 space-y-2">
        <p className="text-label uppercase tracking-label text-muted-foreground">Candidates</p>
        <p className="text-xs text-muted-foreground">
          Parse the subtitle file first to enable candidate generation.
        </p>
      </div>
    );
  }

  if (!projectReady) {
    return (
      <div data-testid="candidates-section" className="border-t border-border pt-4 space-y-2">
        <p className="text-label uppercase tracking-label text-muted-foreground">Candidates</p>
        <p className="text-xs text-muted-foreground">
          Project inspection must succeed before generating candidates.
        </p>
      </div>
    );
  }

  return (
    <div data-testid="candidates-section" className="border-t border-border pt-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-label uppercase tracking-label text-muted-foreground">Candidates</p>
        {data?.generationStatus && (
          <span
            data-testid="generation-status"
            className={`text-xs ${statusClass[data.generationStatus] ?? 'text-muted-foreground'}`}
          >
            {statusLabel[data.generationStatus] ?? data.generationStatus}
          </span>
        )}
      </div>

      {data?.generationError && (
        <p
          data-testid="generation-error"
          className="rounded border border-border px-3 py-2 text-xs text-muted-foreground"
        >
          Generation failed: {data.generationError}
        </p>
      )}

      {candidatesQuery.isLoading && (
        <p className="text-xs text-muted-foreground">Loading…</p>
      )}

      {data && data.candidates.length > 0 && (
        <ul data-testid="candidates-list" className="space-y-2">
          {data.candidates.map((candidate) => (
            <CandidateRow key={candidate.id} candidate={candidate} projectId={project.id} />
          ))}
        </ul>
      )}

      {data && data.candidates.length === 0 && data.generationStatus === 'done' && (
        <p className="text-xs text-muted-foreground">No candidates returned by the model.</p>
      )}

      {!aiAvailable && !aiConfigQuery.isLoading && (
        <p className="text-xs text-muted-foreground" data-testid="ai-not-configured-message">
          Configure and test an AI provider to enable candidate generation.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          data-testid="generate-candidates-button"
          className="h-[var(--control-height)] rounded-[var(--radius-sm)] border border-foreground bg-foreground px-3 text-sm font-medium text-background disabled:opacity-50"
          disabled={!canGenerate || isGenerating}
          onClick={() => void generate.mutateAsync(project.id)}
        >
          {isGenerating ? 'Generating…' : 'Generate candidates'}
        </button>

        {isGenerating && (
          <button
            type="button"
            data-testid="cancel-generation-button"
            className="h-[var(--control-height)] rounded-[var(--radius-sm)] border border-border px-3 text-sm hover:bg-muted"
            onClick={() => void cancel.mutateAsync(project.id)}
          >
            Cancel
          </button>
        )}
      </div>

      {generate.error && (
        <p role="alert" className="text-xs text-muted-foreground">
          {generate.error instanceof Error ? generate.error.message : 'Generation failed.'}
        </p>
      )}
    </div>
  );
};
