import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ClipCandidate } from '@shared/schemas/candidates';
import { useUpdateCandidateTiming } from '@renderer/hooks/useCandidates';
import { useVideoPlayer } from '@renderer/features/preview/useVideoPlayer';
import { msToTimingString } from './timingFormatters';

type TimingEditorModalProps = {
  candidate: ClipCandidate;
  projectId: string;
  onClose: () => void;
};

export const TimingEditorModal = ({ candidate, projectId, onClose }: TimingEditorModalProps) => {
  const [startMs, setStartMs] = useState(candidate.startMs);
  const [endMs, setEndMs] = useState(candidate.endMs);

  const updateTiming = useUpdateCandidateTiming();

  const playbackUrlQuery = useQuery({
    queryKey: ['video-playback-url', projectId],
    queryFn: () => window.sceneSift.video.getPlaybackUrl(projectId),
    staleTime: Infinity,
  });

  const src = playbackUrlQuery.data?.url ?? null;
  const { videoRef, currentTime, duration, play, pause, seek, playerState } = useVideoPlayer(src);

  const currentTimeMs = Math.floor(currentTime * 1000);
  const videoDurationMs = Math.floor(duration * 1000);

  const previewIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearPreviewInterval = () => {
    if (previewIntervalRef.current !== null) {
      clearInterval(previewIntervalRef.current);
      previewIntervalRef.current = null;
    }
  };

  useEffect(() => clearPreviewInterval, []);

  const handlePreview = () => {
    clearPreviewInterval();
    seek(startMs / 1000);
    void Promise.resolve().then(() => {
      void play();
      previewIntervalRef.current = setInterval(() => {
        if (videoRef.current && videoRef.current.currentTime * 1000 >= endMs) {
          pause();
          clearPreviewInterval();
        }
      }, 50);
    });
  };

  const handleSetIn = () => setStartMs(currentTimeMs);
  const handleSetOut = () => setEndMs(currentTimeMs);

  const canSave = startMs < endMs && (videoDurationMs === 0 || endMs <= videoDurationMs);

  const handleSave = async () => {
    await updateTiming.mutateAsync({ candidateId: candidate.id, projectId, startMs, endMs });
    onClose();
  };

  return (
    <div
      data-testid="timing-editor-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Edit clip timing"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-2xl rounded-lg border border-border bg-background p-5 shadow-xl space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Edit Timing</h2>
          <button
            type="button"
            data-testid="timing-editor-close-button"
            className="text-muted-foreground hover:text-foreground"
            onClick={onClose}
            aria-label="Close timing editor"
          >
            ✕
          </button>
        </div>

        <p className="text-xs text-muted-foreground truncate">{candidate.title}</p>

        {/* Video player */}
        <div className="rounded overflow-hidden bg-black aspect-video">
          <video
            data-testid="timing-editor-video"
            ref={videoRef}
            src={src ?? undefined}
            className="w-full h-full"
            playsInline
          />
          {playerState === 'error' && (
            <p className="text-xs text-muted-foreground p-2">Video unavailable.</p>
          )}
        </div>

        {/* Current position display */}
        <p
          data-testid="timing-editor-current-time"
          className="font-mono text-xs text-muted-foreground text-center"
        >
          Position: {msToTimingString(currentTimeMs)}
          {videoDurationMs > 0 && ` / ${msToTimingString(videoDurationMs)}`}
        </p>

        {/* Start / End controls */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">In point</label>
            <p
              data-testid="timing-editor-start-display"
              className="font-mono text-sm font-medium"
            >
              {msToTimingString(startMs)}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                data-testid="seek-to-in-button"
                className="h-[var(--control-height)] rounded-[var(--radius-sm)] border border-border px-2 text-xs hover:bg-muted"
                onClick={() => seek(startMs / 1000)}
                disabled={playerState === 'not_ready' || playerState === 'loading'}
              >
                Seek to in
              </button>
              <button
                type="button"
                data-testid="set-in-button"
                className="h-[var(--control-height)] rounded-[var(--radius-sm)] border border-border px-2 text-xs hover:bg-muted"
                onClick={handleSetIn}
                disabled={playerState === 'not_ready' || playerState === 'loading'}
              >
                Set in
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Out point</label>
            <p
              data-testid="timing-editor-end-display"
              className="font-mono text-sm font-medium"
            >
              {msToTimingString(endMs)}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                data-testid="seek-to-out-button"
                className="h-[var(--control-height)] rounded-[var(--radius-sm)] border border-border px-2 text-xs hover:bg-muted"
                onClick={() => seek(endMs / 1000)}
                disabled={playerState === 'not_ready' || playerState === 'loading'}
              >
                Seek to out
              </button>
              <button
                type="button"
                data-testid="set-out-button"
                className="h-[var(--control-height)] rounded-[var(--radius-sm)] border border-border px-2 text-xs hover:bg-muted"
                onClick={handleSetOut}
                disabled={playerState === 'not_ready' || playerState === 'loading'}
              >
                Set out
              </button>
            </div>
          </div>
        </div>

        {startMs >= endMs && (
          <p data-testid="timing-validation-error" className="text-xs text-red-600 dark:text-red-400">
            In point must be before out point.
          </p>
        )}

        {/* Preview button */}
        <div className="flex gap-2">
          <button
            type="button"
            data-testid="preview-range-button"
            className="h-[var(--control-height)] rounded-[var(--radius-sm)] border border-border px-3 text-xs hover:bg-muted disabled:opacity-50"
            onClick={handlePreview}
            disabled={!canSave || playerState === 'not_ready' || playerState === 'loading'}
          >
            Preview range
          </button>
        </div>

        {/* Save / Cancel */}
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            data-testid="timing-editor-cancel-button"
            className="h-[var(--control-height)] rounded-[var(--radius-sm)] border border-border px-3 text-xs hover:bg-muted"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            data-testid="timing-editor-save-button"
            className="h-[var(--control-height)] rounded-[var(--radius-sm)] border border-foreground bg-foreground px-3 text-xs font-medium text-background disabled:opacity-50"
            disabled={!canSave || updateTiming.isPending}
            onClick={() => void handleSave()}
          >
            {updateTiming.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};
