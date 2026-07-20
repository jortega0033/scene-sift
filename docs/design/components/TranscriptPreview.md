# TranscriptPreview

Renders a scrollable ordered list of `TranscriptEntry` items. Each entry shows a formatted timestamp and text content.

## Props

| Prop | Type | Description |
|------|------|-------------|
| `entries` | `TranscriptEntry[]` | Array of transcript entries to display |
| `loading` | `boolean` | When true, shows a loading state instead of entries |

## Usage

```tsx
<TranscriptPreview entries={entries} loading={transcriptQuery.isLoading} />
```

## Design notes

- Loading state: `data-testid="transcript-loading"` with centered muted text.
- Empty state: `data-testid="transcript-empty"` when entries array is empty.
- Entry list: `data-testid="transcript-entry-list"` (`<ol aria-label="Transcript entries">`).
- Each entry: `data-testid="transcript-entry"` — card with timestamp + text.
- Timestamp formatted via `formatTimestamp` from `transcriptFormatters.ts` (M:SS or H:MM:SS).
- Key: `${startMs}-${index}` — stable across re-renders with same data.
