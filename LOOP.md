# SceneSift Loop Engineering Profile

This repository uses a Loop-Engineering-style governance spine adapted for SceneSift.

## Current rollout level

- **L1**: loop runs are report-only (health check, triage, docs analysis) and unscheduled (owner decision, 2026-11-22, `docs/owner-decisions.md`).
- **L2 and above disabled** until the owner approves a change, after stable L1 runs and successful governance audits.

## Ticket work is not a loop run

Implementing a ticket is not a loop run. The owner starts it with `/next-ticket` (`.claude/skills/next-ticket/SKILL.md`), one ticket per run, and it is governed by `CLAUDE.md` (Delivery workflow), the `governed-task` playbook, the review gate hook `.claude/hooks/role-gate.mjs`, CI and branch protection. Implemented changes keep the isolation, independent verification and human approval this file describes below; the run ends at a ready pull request and only the owner merges.

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
- `.claude/hooks/role-gate.mjs` blocks opening or readying a pull request until `architecture-reviewer` and `governance-verifier` ran after the last code edit.

## Kill switches

- Set `killSwitch.enabled: true` in `gate.yaml` for immediate pause.
- Set `loopPaused: true` in `STATE.md` to force report-only operations.

## Escalation policy

- Max 3 implementation attempts per task.
- Escalate to stronger model or human review after repeated failure.
- Never weaken tests or gates to force success.
