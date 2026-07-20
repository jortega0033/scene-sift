# GapThresholdSlider

Controlled range input for configuring the cue-merge gap threshold in milliseconds.

## Props

| Prop | Type | Description |
|------|------|-------------|
| `value` | `number` | Current gap threshold in milliseconds |
| `onChange` | `(value: number) => void` | Callback when slider changes |

## Usage

```tsx
<GapThresholdSlider value={gapThresholdMs} onChange={setGapThresholdMs} />
```

## Design notes

- Container: `data-testid="gap-threshold-slider"` wrapper div.
- Label: `htmlFor="gap-threshold"`, text "Merge gap".
- Range input: `id="gap-threshold"`, min=0, max=2000, step=50.
- ARIA: `aria-valuenow`, `aria-valuemin={0}`, `aria-valuemax={2000}` on the input.
- Display span shows current value with `{value}&thinsp;ms` (thin-space before unit).
