import type { VideoCueItem } from '@shared/schemas/video';
import type { PlayerState } from './useVideoPlayer';
import { PLAYBACK_RATES } from './useVideoPlayer';
import { SubtitleOverlay } from './SubtitleOverlay';
import { formatPlayerTime } from './videoFormatters';

type Props = {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  src: string;
  playerState: PlayerState;
  currentTime: number;
  duration: number;
  playbackRate: number;
  cues: VideoCueItem[];
  play: () => void;
  pause: () => void;
  seek: (seconds: number) => void;
  setPlaybackRate: (rate: number) => void;
  retryLoad: () => void;
};

export const VideoPlayer = ({
  videoRef,
  src,
  playerState,
  currentTime,
  duration,
  playbackRate,
  cues,
  play,
  pause,
  seek,
  setPlaybackRate,
  retryLoad,
}: Props) => {
  const isPlaying = playerState === 'playing';
  const isLoading = playerState === 'loading' || playerState === 'not_ready';
  const isError = playerState === 'error';

  const currentTimeMs = Math.floor(currentTime * 1000);
  const activeCues = cues.filter(
    (cue) => currentTimeMs >= cue.startMs && currentTimeMs < cue.endMs,
  );

  if (isError) {
    return (
      <div
        data-testid="preview-error"
        className="flex flex-col items-center justify-center gap-3 rounded-[var(--radius-md)] bg-card p-8 text-center"
      >
        <span className="text-2xl">⚠</span>
        <p className="font-medium">Video could not be loaded</p>
        <p className="text-sm text-muted-foreground">
          This may be because the file format is not supported (e.g. H.265 / MKV).
        </p>
        <button
          type="button"
          data-testid="preview-retry"
          onClick={retryLoad}
          className="mt-2 rounded-[var(--radius-sm)] border border-border px-3 py-1.5 text-sm hover:bg-muted"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col gap-3"
      role="region"
      aria-label="Video player"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === ' ') {
          e.preventDefault();
          if (isPlaying) { pause(); } else { play(); }
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          seek(Math.max(0, currentTime - 5));
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          seek(Math.min(duration, currentTime + 5));
        }
      }}
    >
      <div className="relative aspect-video w-full overflow-hidden rounded-[var(--radius-md)] bg-video-bg">
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-video-fg">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-video-fg/30 border-t-video-fg" />
            <span className="text-sm">Loading preview…</span>
          </div>
        )}
        <video
          ref={videoRef}
          data-testid="preview-video"
          src={src}
          className="h-full w-full object-contain"
          playsInline
        />
        <SubtitleOverlay activeCues={activeCues} />
      </div>

      <input
        type="range"
        data-testid="preview-seek-bar"
        aria-label="Video progress"
        aria-valuemin={0}
        aria-valuemax={Math.floor(duration)}
        aria-valuenow={Math.floor(currentTime)}
        min={0}
        max={Math.floor(duration) || 0}
        step={1}
        value={Math.floor(currentTime)}
        onChange={(e) => seek(Number(e.target.value))}
        className="w-full cursor-pointer"
      />

      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Rewind 5 seconds"
          onClick={() => seek(Math.max(0, currentTime - 5))}
          className="rounded-[var(--radius-sm)] border border-border px-2 py-1 text-xs hover:bg-muted"
        >
          ⏪ -5s
        </button>
        <button
          type="button"
          data-testid="preview-play-pause"
          aria-label={isPlaying ? 'Pause' : 'Play'}
          onClick={() => (isPlaying ? pause() : play())}
          className="rounded-[var(--radius-sm)] border border-border px-3 py-1 text-xs hover:bg-muted"
        >
          {isPlaying ? '⏸ Pause' : '▶ Play'}
        </button>
        <button
          type="button"
          aria-label="Forward 5 seconds"
          onClick={() => seek(Math.min(duration, currentTime + 5))}
          className="rounded-[var(--radius-sm)] border border-border px-2 py-1 text-xs hover:bg-muted"
        >
          ⏩ +5s
        </button>
        <span data-testid="preview-current-time" className="font-mono text-xs text-muted-foreground">
          {formatPlayerTime(currentTime)} / {formatPlayerTime(duration)}
        </span>
        <select
          data-testid="preview-speed-picker"
          aria-label="Playback speed"
          value={playbackRate}
          onChange={(e) => setPlaybackRate(Number(e.target.value))}
          className="ml-auto rounded-[var(--radius-sm)] border border-border bg-background px-2 py-1 text-xs"
        >
          {PLAYBACK_RATES.map((rate) => (
            <option key={rate} value={rate}>
              {rate}×
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};
