# Baseline Update Skill

Invoke: `/baseline-update <what changed>`

Updates governance baselines (visual regression snapshots, architecture baseline, test baselines) after an intentional, approved change.

## Steps

1. Confirm change was intentional and reviewed (not a regression fix masquerading as a baseline update).
2. For visual baselines: `pnpm baseline:generate` — capture output.
3. For architecture baseline: `pnpm architecture:validate` must PASS first.
4. Verify new baseline reflects only intended changes (diff the generated files).
5. Run full validation: `pnpm validate`.
6. Record baseline update in session notes with: what changed, why, commands run.

## Constraint

Never run `pnpm baseline:generate` to make failing tests pass. Only run after confirming the change is intentional and the new state is correct.
