# SceneSift Visual Change Policy

## Risk levels

### Low visual risk

- Copy correction
- Label/accessibility-text correction
- Internal refactor with unchanged rendering

Required: `pnpm test`, relevant e2e check.

### Medium visual risk

- Spacing/layout adjustments
- Component variant adjustments
- Status treatment adjustments
- Compact-window behavior changes

Required:

- `pnpm test:e2e`
- `pnpm test:visual`
- accessibility check of affected flows
- before/after screenshot evidence

### High visual risk

- Token changes
- Typography system changes
- Navigation structure changes
- Dialog behavior changes
- Theme system changes
- New icon library

Required:

- `pnpm validate:full`
- `pnpm test:visual:update` with explicit rationale
- independent design review
- explicit human approval

## Snapshot update protocol

1. Record reason and affected screens in PR description.
2. Include before/after evidence for meaningful visual changes.
3. Confirm accessibility impact status (improved/neutral/regressed).
4. Update snapshots only via `pnpm test:visual:update`.

## Prohibited update behavior

- Updating snapshots to hide failing behavior.
- Raising thresholds to mask regressions.
- Skipping visual tests for medium/high visual changes.
