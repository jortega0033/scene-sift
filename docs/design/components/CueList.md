# CueList

Scrollable list of subtitle cues with active-cue highlighting and click-to-seek.

## Props

| Prop | Type | Description |
|------|------|-------------|
| `cues` | `VideoCueItem[]` | All cues for the current project. |
| `currentTimeMs` | `number` | Current playback position in milliseconds. |
| `onCueClick` | `(startMs: number) => void` | Called when user clicks a cue to seek. |

## Usage

```tsx
import { CueList } from '@renderer/features/preview/CueList';

<CueList
  cues={cues}
  currentTimeMs={currentTimeMs}
  onCueClick={(startMs) => seek(startMs / 1000)}
/>
```

## Design notes

- Active cue: `border-l-2 border-foreground bg-muted text-foreground`.
- Inactive cue: `text-muted-foreground hover:bg-muted hover:text-foreground`.
- Timestamp label: `text-label uppercase tracking-label` (design tokens).
- Auto-scrolls active cue into view (`scrollIntoView` on `activeCueIndex` change).
- `aria-label` on each button includes the formatted timestamp.
- `data-testid="preview-cue-item"` (inactive) / `data-testid="preview-cue-item-active"` (active).
