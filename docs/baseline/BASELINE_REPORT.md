# SceneSift Baseline Report

> Machine-readable baseline: `docs/baseline/baseline.json`

## Starting-state facts

- Repository in current environment is **not a Git worktree** (`git status` unavailable).
- Node: `v24.13.1`
- pnpm: `10.33.2`
- Existing redesign + QA infrastructure present and validated in this milestone.

## Baseline inventory

This report is paired with `baseline.json` and updated as part of governance hardening.

## Quality baseline commands

- `pnpm validate`
- `pnpm validate:full`

## Known warnings/limitations

- MCP runtime verification depends on trusted editor runtime and cannot be treated as CI evidence.
- Branch-protection state cannot be verified from repository files alone.
