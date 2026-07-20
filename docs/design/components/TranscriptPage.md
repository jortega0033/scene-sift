# TranscriptPage

Top-level page for the transcript workspace (route: `'transcript'`).
Generates a merged transcript from subtitle cues via `transcript:generateForProject` IPC, displays it in TranscriptPreview, and exposes export buttons for `.txt` and `.json`.

## No props

Reads project context from `useProjects` and navigation from `uiStore`.

## Usage

Rendered by the router when `uiStore.activeRoute === 'transcript'`. Not used standalone.

```tsx
// In App.tsx routing:
case 'transcript':
  return <TranscriptPage />;
```

## Prerequisites for transcript (`canGenerate`)

Both conditions must be true:
1. `selectedProject.status === 'ready'` (media inspected successfully)
2. `selectedProject.subtitleStatus === 'ready' || 'ready_with_warnings'` (subtitle parsed)

## Design notes

- Not-available state: `data-testid="transcript-not-available"` shown when no project or prerequisites unmet.
- Ready state: gap slider row + export buttons row + TranscriptPreview list.
- Warning banner: `data-testid="subtitle-warning-banner"` visible when `subtitleStatus === 'ready_with_warnings'`.
- React Query key: `['transcript', selectedProjectId, gapThresholdMs]` — refetches when slider changes.
- Export buttons: disabled when entries array empty; each invokes `transcript:exportForProject`.
- Export success path shown via `data-testid="export-success"`.
