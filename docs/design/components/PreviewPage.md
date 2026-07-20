# PreviewPage

Top-level page for the video preview workspace (route: `'preview'`).
Lifts `useVideoPlayer` state and renders a two-column layout: VideoPlayer on the left, CueList on the right.
Shows a prerequisite checklist when the selected project is not ready to preview.

## No props

PreviewPage reads project context from `useProjects` and navigation from `uiStore`.

## Usage

Rendered by the router when `uiStore.activeRoute === 'preview'`. Not used standalone.

```tsx
// In Layout.tsx routing:
{activeRoute === 'preview' && <PreviewPage />}
```

## Prerequisites for preview (`canPreview`)

Both conditions must be true:
1. `selectedProject.status === 'ready'` (media inspected successfully)
2. `selectedProject.subtitleStatus === 'ready' || 'ready_with_warnings'` (subtitle parsed)

## Design notes

- Not-available state: `data-testid="preview-not-available"` shown when no project or prerequisites unmet.
- Prerequisite list renders check icons (✓/○) for each requirement.
- Ready state: two-column grid `[grid-template-columns:minmax(0,3fr)_minmax(0,1fr)]`.
- Cue seek: `onCueClick` calls `seek(startMs / 1000)` (converts ms → seconds for `HTMLVideoElement`).
- `data-testid="preview-page"` on the outer container when prerequisites are met.
