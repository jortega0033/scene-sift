# M4 — Video Preview Workspace: UX Specification

Date: 2026-07-20
Status: PLANNING

---

## Navigation

Add "Preview" to the left nav bar (4th item, below Projects/Queue/Settings). Icon: play circle. Disabled appearance when no project selected or prerequisites not met. Clicking navigates to PreviewPage.

---

## PreviewPage layout

```
┌─────────────────────────────────────────────────────────────┐
│ [◀ Back to Projects]              Preview: {project name}    │
├───────────────────────────────────┬─────────────────────────┤
│                                   │                         │
│        VIDEO PLAYER               │     CUE LIST            │
│   (16:9, fills left column)       │   (scrollable)          │
│                                   │                         │
│   ┌───────────────────────┐       │  ── 00:01:23 ──         │
│   │                       │       │  > [active cue text]    │
│   │    video frame        │       │  ── 00:01:26 ──         │
│   │    + subtitle overlay │       │    [next cue text]      │
│   │                       │       │    ...                  │
│   └───────────────────────┘       │                         │
│                                   │                         │
│   [Playback controls bar]         │                         │
└───────────────────────────────────┴─────────────────────────┘
```

---

## Video player component

- 16:9 aspect ratio preserved (CSS `aspect-ratio: 16/9`, `object-fit: contain`)
- Background: black (#000)
- Subtitle overlay: centered bottom 20% of player, white text with black drop-shadow
- Multi-line cues: each line on its own row

### Playback controls (below video)

```
[⏪ -5s] [▶ Play / ⏸ Pause] [⏩ +5s]   [1.0×▾]
         timestamp: 00:12:34 / 01:23:45
```

Note: Restart (⏮), End (⏭), and volume slider are deferred to M5.

| Control | Behavior |
|---|---|
| -5s | Seek currentTime - 5 |
| Play/Pause | Toggle |
| +5s | Seek currentTime + 5 |
| Speed picker | 0.5 / 0.75 / 1.0 / 1.25 / 1.5 / 2.0 via `playbackRate` |
| Progress bar | Click/drag to seek |

---

## Seek bar

- Width: full player width
- Background: muted-foreground (lighter shade)
- Fill: foreground (progress)
- Thumb: 12px circle
- Click anywhere on bar → seek to that position
- `input[type=range]` styled with CSS

---

## Cue list (right panel)

- Vertically scrollable list of all cues
- Each item: `{HH:MM:SS.mmm} — {text}` (truncated to 2 lines max)
- Active cue: highlighted with blue left border + background
- Auto-scrolls to keep active cue visible (smooth scroll)
- Click on any cue → seek video to cue.startMs
- No selection state; clicking is immediate seek

---

## Not available state

When `canPreview` is false:

```
┌─────────────────────────────────┐
│ Preview not available           │
│                                 │
│ To preview, this project needs: │
│  • Video inspection complete    │  (if missing)
│  • Subtitle parsed              │  (if missing)
│                                 │
│ Go to Projects →                │
└─────────────────────────────────┘
```

---

## Error state

When HTMLVideoElement fires `error`:

```
┌─────────────────────────────────┐
│  ⚠  Video could not be loaded   │
│                                 │
│  This may be because the file   │
│  format is not supported        │
│  (e.g. H.265 / MKV).            │
│                                 │
│  [Retry]                        │
└─────────────────────────────────┘
```

---

## Loading state

Spinner centered in player area. "Loading preview…" text.

---

## Accessibility

- Play/Pause button: `aria-label="Play"` / `aria-label="Pause"` (updates with state)
- Seek bar: `aria-label="Video progress"`, `aria-valuemin`, `aria-valuemax`, `aria-valuenow`
- Speed picker: `aria-label="Playback speed"`
- Cue list items: `role="button"` with `aria-label="Jump to {time}"`
- Subtitle overlay: `aria-live="polite"` for cue text
- Keyboard: space = play/pause, left/right arrows = ±5s seek

---

## Tokens

All colors use design tokens from `src/renderer/tokens/`. No hardcoded hex values.

---

## data-testid attributes

| Element | testid |
|---|---|
| Preview page container | `preview-page` |
| Not available message | `preview-not-available` |
| Video element | `preview-video` |
| Play/pause button | `preview-play-pause` |
| Seek bar | `preview-seek-bar` |
| Current time display | `preview-current-time` |
| Speed picker | `preview-speed-picker` |
| Subtitle overlay | `preview-subtitle-overlay` |
| Cue list | `preview-cue-list` |
| Cue list item | `preview-cue-item` |
| Active cue item | `preview-cue-item-active` |
| Error state | `preview-error` |
| Retry button | `preview-retry` |
