# VideoPlayer

Purely presentational video player component. Receives all state and callbacks from the parent.
Player state machine is managed by `useVideoPlayer` and lifted to `PreviewPage`.

## Props

| Prop | Type | Description |
|------|------|-------------|
| `videoRef` | `React.RefObject<HTMLVideoElement \| null>` | Ref forwarded from `useVideoPlayer`. |
| `src` | `string` | Playback URL (e.g. `local:///video/{uuid}`). |
| `playerState` | `PlayerState` | `'not_ready' \| 'loading' \| 'playing' \| 'paused' \| 'error'`. |
| `currentTime` | `number` | Current playback time in seconds. |
| `duration` | `number` | Total duration in seconds. |
| `playbackRate` | `number` | Current playback rate multiplier. |
| `cues` | `VideoCueItem[]` | All cues (used to compute active cues for overlay). |
| `play` | `() => void` | Start playback. |
| `pause` | `() => void` | Pause playback. |
| `seek` | `(seconds: number) => void` | Seek to position in seconds. |
| `setPlaybackRate` | `(rate: number) => void` | Change playback speed. |
| `retryLoad` | `() => void` | Retry after error state. |

## Usage

```tsx
import { VideoPlayer } from '@renderer/features/preview/VideoPlayer';
import { useVideoPlayer } from '@renderer/features/preview/useVideoPlayer';

// State must be lifted to the parent (e.g. PreviewPage):
const player = useVideoPlayer(playbackUrl ?? null);

<VideoPlayer
  videoRef={player.videoRef}
  src={playbackUrl}
  playerState={player.state}
  currentTime={player.currentTime}
  duration={player.duration}
  playbackRate={player.playbackRate}
  cues={cues}
  play={player.play}
  pause={player.pause}
  seek={player.seek}
  setPlaybackRate={player.setPlaybackRate}
  retryLoad={player.retryLoad}
/>
```

## Design notes

- Video container: `bg-video-bg` (via `--video-bg` token, renders as pure black).
- Loading spinner and text: `text-video-fg` (`--video-fg` token, white on dark).
- Spinner border: `border-video-fg/30 border-t-video-fg` (30% and 100% opacity via token).
- Keyboard: Space = play/pause, ArrowLeft = −5 s, ArrowRight = +5 s.
- Error state renders `data-testid="preview-error"` and hides the `preview-video` element.
- Playback rates available: `[0.5, 0.75, 1, 1.25, 1.5, 2]` (exported as `PLAYBACK_RATES`).
