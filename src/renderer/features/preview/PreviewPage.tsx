import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useUiStore } from '@renderer/stores/uiStore';
import { useProjects } from '@renderer/hooks/useProjects';
import { useVideoPlayer } from './useVideoPlayer';
import { useCues } from './hooks/useCues';
import { VideoPlayer } from './VideoPlayer';
import { CueList } from './CueList';

const canPreviewProject = (project: { status: string; subtitleStatus: string | null }) =>
  project.status === 'ready' &&
  (project.subtitleStatus === 'ready' || project.subtitleStatus === 'ready_with_warnings');

export const PreviewPage = () => {
  const { selectedProjectId, setRoute } = useUiStore();
  const projectsQuery = useProjects();
  const project = projectsQuery.data?.find((p) => p.id === selectedProjectId) ?? null;
  const canPreview = project !== null && canPreviewProject(project);

  const playbackUrlQuery = useQuery({
    queryKey: ['video', 'playbackUrl', selectedProjectId],
    queryFn: () => window.sceneSift.video.getPlaybackUrl(selectedProjectId!),
    enabled: canPreview && selectedProjectId !== null,
  });

  const src = playbackUrlQuery.data?.url ?? null;
  const player = useVideoPlayer(src);
  const cuesQuery = useCues(canPreview ? selectedProjectId : null);
  const cues = cuesQuery.data?.cues ?? [];
  const currentTimeMs = Math.floor(player.currentTime * 1000);

  const { seek } = player;
  const onCueClick = useCallback(
    (startMs: number) => {
      seek(startMs / 1000);
    },
    [seek],
  );

  if (!canPreview) {
    const missingInspection = !project || project.status !== 'ready';
    const missingSubtitle =
      project?.status === 'ready' &&
      project.subtitleStatus !== 'ready' &&
      project.subtitleStatus !== 'ready_with_warnings';

    return (
      <div data-testid="preview-page" className="flex h-full items-center justify-center">
        <div
          data-testid="preview-not-available"
          className="max-w-sm rounded-[var(--radius-md)] border border-border bg-card p-6"
        >
          <h2 className="mb-2 text-base font-semibold">Preview not available</h2>
          {!selectedProjectId ? (
            <p className="text-sm text-muted-foreground">Select a project to preview.</p>
          ) : (
            <>
              <p className="mb-3 text-sm text-muted-foreground">
                To preview, this project needs:
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
    <div data-testid="preview-page" className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="text-sm text-muted-foreground hover:text-foreground"
          onClick={() => setRoute('projects')}
        >
          ◀ Back to Projects
        </button>
        <h1 className="text-base font-semibold">Preview: {project.name}</h1>
      </div>

      <div className="grid gap-4 [grid-template-columns:minmax(0,3fr)_minmax(0,1fr)]">
        <div>
          {src && (
            <VideoPlayer
              videoRef={player.videoRef}
              src={src}
              playerState={player.playerState}
              currentTime={player.currentTime}
              duration={player.duration}
              playbackRate={player.playbackRate}
              cues={cues}
              play={player.play}
              pause={player.pause}
              seek={player.seek}
              setPlaybackRate={player.setPlaybackRate}
              retryLoad={player.retryLoad}
            />
          )}
        </div>
        <div className="h-[min(70vh,600px)] overflow-hidden">
          <CueList
            cues={cues}
            currentTimeMs={currentTimeMs}
            onCueClick={onCueClick}
          />
        </div>
      </div>
    </div>
  );
};
