# SceneSift Loop Engineering Profile

This repository uses a Loop-Engineering-style governance spine adapted for SceneSift.

## Current rollout level

- **L2 default**: implemented changes happen in isolation, independently verified, then approved by a human.
- **L1 allowed**: report-only tasks (docs, analysis, triage).
- **L3+ disabled by default** until explicit approval and successful governance audits.

## Required sequence per non-trivial task

1. Orchestrator assigns risk level.
2. Implementer works in isolated branch/worktree.
3. Specialist reviewer runs for risk 2+ and required domains.
4. Verification agent executes required checks from `gate.yaml`.
5. Human approves before merge.

## Sensitive domains requiring elevated review

- `src/main/**`
- `src/preload/**`
- `src/shared/ipc/**`
- FFmpeg argument construction and execution
- filesystem writes/deletes
- database migrations
- updater, packaging, signing, release paths
- runtime AI provider integration

## Mechanical controls

- `pnpm governance:validate` enforces required files, instruction frontmatter, registry schemas, and forbidden pattern checks.
- `gate.yaml` defines risk classes, forbidden autonomous actions, and mandatory checks.
- `.github/workflows/governance.yml` runs governance validation in CI.
- `.github/pull_request_template.md` requires explicit evidence and AI disclosure.

## Kill switches

- Set `killSwitch.enabled: true` in `gate.yaml` for immediate pause.
- Set `loopPaused: true` in `STATE.md` to force report-only operations.

## Escalation policy

- Max 3 implementation attempts per task.
- Escalate to stronger model or human review after repeated failure.
- Never weaken tests or gates to force success.
