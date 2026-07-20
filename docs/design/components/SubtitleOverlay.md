# SubtitleOverlay

Renders active subtitle cues as text overlays centered at the bottom of the video surface.

## Props

| Prop | Type | Description |
|------|------|-------------|
| `activeCues` | `VideoCueItem[]` | Cues whose time range includes the current playback position. |

Returns `null` when `activeCues` is empty.

## Usage

```tsx
import { SubtitleOverlay } from '@renderer/features/preview/SubtitleOverlay';

// Rendered inside VideoPlayer — not used standalone.
<div className="relative aspect-video">
  <video ref={videoRef} src={src} />
  <SubtitleOverlay activeCues={activeCues} />
</div>
```

## Design notes

- Positioned absolute, `bottom-[20%]`, centered horizontally.
- Cue background: `bg-video-bg/60` (60% opaque black via `--video-bg` token).
- Cue text: `text-video-fg` (`--video-fg` token).
- `aria-live="polite"` — screen readers announce new cues without interrupting.
- Multi-line cues rendered as individual `<span>` elements, split on `\n`.
