import type { VideoCueItem } from '@shared/schemas/video';

type Props = {
  activeCues: VideoCueItem[];
};

export const SubtitleOverlay = ({ activeCues }: Props) => {
  if (activeCues.length === 0) return null;

  return (
    <div
      data-testid="preview-subtitle-overlay"
      aria-live="polite"
      className="absolute bottom-[20%] left-0 right-0 flex flex-col items-center gap-1 px-4"
    >
      {activeCues.map((cue) =>
        cue.text.split('\n').map((line, i) => (
          <span
            key={`${cue.index}-${i}`}
            className="rounded bg-video-bg/60 px-2 py-0.5 text-center text-sm font-medium text-video-fg [text-shadow:0_1px_3px_hsl(var(--video-bg))]"
          >
            {line}
          </span>
        )),
      )}
    </div>
  );
};
