import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useUiStore } from '@renderer/stores/uiStore';
import { useProjects } from '@renderer/hooks/useProjects';
import { GapThresholdSlider } from './GapThresholdSlider';
import { TranscriptPreview } from './TranscriptPreview';

const canGenerateTranscript = (project: { status: string; subtitleStatus: string | null }) =>
  project.status === 'ready' &&
  (project.subtitleStatus === 'ready' || project.subtitleStatus === 'ready_with_warnings');

const DEFAULT_GAP_MS = 500;

export const TranscriptPage = () => {
  const { selectedProjectId, setRoute } = useUiStore();
  const projectsQuery = useProjects();
  const project = projectsQuery.data?.find((p) => p.id === selectedProjectId) ?? null;
  const canGenerate = project !== null && canGenerateTranscript(project);

  const [gapThresholdMs, setGapThresholdMs] = useState(DEFAULT_GAP_MS);
  const [exportError, setExportError] = useState<string | null>(null);
  const [lastExportPath, setLastExportPath] = useState<string | null>(null);

  const transcriptQuery = useQuery({
    queryKey: ['transcript', selectedProjectId, gapThresholdMs],
    queryFn: () =>
      window.sceneSift.transcript.generateForProject({
        projectId: selectedProjectId!,
        gapThresholdMs,
      }),
    enabled: canGenerate && selectedProjectId !== null,
  });

  const entries = transcriptQuery.data?.entries ?? [];
  const subtitleStatus = transcriptQuery.data?.subtitleStatus ?? null;
  const showWarningBanner = subtitleStatus === 'ready_with_warnings';

  const handleExport = async (format: 'txt' | 'json') => {
    if (!selectedProjectId) return;
    setExportError(null);
    setLastExportPath(null);
    try {
      const result = await window.sceneSift.transcript.exportForProject({
        projectId: selectedProjectId,
        gapThresholdMs,
        format,
      });
      if (result.exported && result.path) {
        setLastExportPath(result.path);
      }
    } catch {
      setExportError('Export failed. Please try again.');
    }
  };

  if (!canGenerate) {
    const missingInspection = !project || project.status !== 'ready';
    const missingSubtitle =
      project?.status === 'ready' &&
      project.subtitleStatus !== 'ready' &&
      project.subtitleStatus !== 'ready_with_warnings';

    return (
      <div data-testid="transcript-page" className="flex h-full items-center justify-center">
        <div
          data-testid="transcript-not-available"
          className="max-w-sm rounded-[var(--radius-md)] border border-border bg-card p-6"
        >
          <h2 className="mb-2 text-base font-semibold">Transcript not available</h2>
          {!selectedProjectId ? (
            <p className="text-sm text-muted-foreground">Select a project to generate a transcript.</p>
          ) : (
            <>
              <p className="mb-3 text-sm text-muted-foreground">
                To generate a transcript, this project needs:
              </p>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {missingInspection && <li>• Video inspection complete</li>}
                {missingSubtitle && <li>• Subtitle parsed</li>}
              </ul>
            </>
          )}
          <button
            type="button"
            className="mt-4 text-sm text-foreground underline hover:no-underline"
            onClick={() => setRoute('projects')}
          >
            Go to Projects →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="transcript-page" className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="text-sm text-muted-foreground hover:text-foreground"
          onClick={() => setRoute('projects')}
        >
          ◀ Back to Projects
        </button>
        <h1 className="text-base font-semibold">Transcript: {project.name}</h1>
      </div>

      {showWarningBanner && (
        <div
          data-testid="subtitle-warning-banner"
          className="rounded-[var(--radius-sm)] border border-border bg-card px-4 py-3 text-sm text-muted-foreground"
          role="status"
        >
          Subtitle file parsed with warnings. Transcript may be incomplete.
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <GapThresholdSlider value={gapThresholdMs} onChange={setGapThresholdMs} />
        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid="export-txt-button"
            disabled={entries.length === 0}
            className="rounded-[var(--radius-sm)] border border-border bg-card px-3 py-1.5 text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => handleExport('txt')}
          >
            Export .txt
          </button>
          <button
            type="button"
            data-testid="export-json-button"
            disabled={entries.length === 0}
            className="rounded-[var(--radius-sm)] border border-border bg-card px-3 py-1.5 text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => handleExport('json')}
          >
            Export .json
          </button>
        </div>
      </div>

      {exportError && (
        <p data-testid="export-error" className="text-sm text-destructive" role="alert">
          {exportError}
        </p>
      )}
      {lastExportPath && (
        <p data-testid="export-success" className="text-sm text-muted-foreground" role="status">
          Exported to {lastExportPath}
        </p>
      )}

      <TranscriptPreview entries={entries} loading={transcriptQuery.isLoading} />
    </div>
  );
};
