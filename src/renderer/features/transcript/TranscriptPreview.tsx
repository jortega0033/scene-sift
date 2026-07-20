import type { TranscriptEntry } from '@shared/schemas/transcript';
import { formatTimestamp } from './transcriptFormatters';

type TranscriptPreviewProps = {
  entries: TranscriptEntry[];
  loading: boolean;
};

export const TranscriptPreview = ({ entries, loading }: TranscriptPreviewProps) => {
  if (loading) {
    return (
      <div
        data-testid="transcript-loading"
        className="flex items-center justify-center py-10 text-sm text-muted-foreground"
      >
        Loading transcript…
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div
        data-testid="transcript-empty"
        className="flex items-center justify-center py-10 text-sm text-muted-foreground"
      >
        No transcript entries.
      </div>
    );
  }

  return (
    <ol
      data-testid="transcript-entry-list"
      className="space-y-3 text-sm"
      aria-label="Transcript entries"
    >
      {entries.map((entry, i) => (
        <li
          key={`${entry.startMs}-${i}`}
          data-testid="transcript-entry"
          className="flex gap-3 rounded-[var(--radius-sm)] border border-border bg-card p-3"
        >
          <span
            className="shrink-0 tabular-nums text-muted-foreground"
            aria-label={`${formatTimestamp(entry.startMs)} to ${formatTimestamp(entry.endMs)}`}
          >
            {formatTimestamp(entry.startMs)}
          </span>
          <p className="min-w-0 break-words">{entry.text}</p>
        </li>
      ))}
    </ol>
  );
};
