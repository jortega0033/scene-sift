import { useRef, useEffect } from 'react';
import type { VideoCueItem } from '@shared/schemas/video';
import { cn } from '@renderer/lib/cn';
import { formatCueTime } from './videoFormatters';

type Props = {
  cues: VideoCueItem[];
  currentTimeMs: number;
  onCueClick: (startMs: number) => void;
};

export const CueList = ({ cues, currentTimeMs, onCueClick }: Props) => {
  const activeRef = useRef<HTMLButtonElement | null>(null);

  const activeCueIndex = cues.findIndex(
    (cue) => currentTimeMs >= cue.startMs && currentTimeMs < cue.endMs,
  );

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [activeCueIndex]);

  return (
    <div
      data-testid="preview-cue-list"
      className="flex h-full flex-col gap-0.5 overflow-y-auto"
    >
      {cues.map((cue, i) => {
        const isActive = i === activeCueIndex;
        return (
          <button
            key={cue.index}
            type="button"
            ref={isActive ? activeRef : null}
            data-testid={isActive ? 'preview-cue-item-active' : 'preview-cue-item'}
            aria-label={`Jump to ${formatCueTime(cue.startMs)}`}
            onClick={() => onCueClick(cue.startMs)}
            className={cn(
              'rounded px-3 py-1.5 text-left text-xs',
              isActive
                ? 'border-l-2 border-foreground bg-muted text-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <span className="block text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
              {formatCueTime(cue.startMs)}
            </span>
            <span className="line-clamp-2">{cue.text}</span>
          </button>
        );
      })}
    </div>
  );
};
