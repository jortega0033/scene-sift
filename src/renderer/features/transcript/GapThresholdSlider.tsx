type GapThresholdSliderProps = {
  value: number;
  onChange: (value: number) => void;
};

export const GapThresholdSlider = ({ value, onChange }: GapThresholdSliderProps) => (
  <div className="flex items-center gap-3" data-testid="gap-threshold-slider">
    <label htmlFor="gap-threshold" className="shrink-0 text-sm text-muted-foreground">
      Merge gap
    </label>
    <input
      id="gap-threshold"
      type="range"
      min={0}
      max={2000}
      step={50}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-32 accent-foreground"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={2000}
    />
    <span className="w-16 shrink-0 text-sm tabular-nums text-muted-foreground">
      {value}&thinsp;ms
    </span>
  </div>
);
