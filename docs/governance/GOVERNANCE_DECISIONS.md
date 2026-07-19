# Governance Decisions

## GD-001 — Adopt loop-engineering patterns as governance spine

- Date: 2026-07-18
- Decision: Adopt and adapt loop-style state, constraints, budget, and gate files.
- Reason: Provides practical, auditable operating controls for AI-assisted development.
- Scope: Development-agent governance only.

## GD-002 — Selective agency-agents adaptation only

- Date: 2026-07-18
- Decision: Create concise SceneSift-specific specialist agents; do not import full roster.
- Reason: Prevent role sprawl and conflicting instructions; retain only high-value expertise.

## GD-003 — Separate development and runtime AI governance

- Date: 2026-07-18
- Decision: Maintain distinct policy docs and controls for dev-agent vs runtime-product AI.
- Reason: Build-time controls do not automatically secure runtime AI behavior.

## GD-004 — Mechanical enforcement first

- Date: 2026-07-18
- Decision: Add `pnpm governance:validate` and adversarial tests.
- Reason: Avoid policy-only governance claims.

## GD-005 — Owner Override: Unattended Overnight Development (M3+)

- Date: 2026-07-20
- Context: Repository owner authorized overnight unattended run for M3+ milestone development.
- Decision: Manual human-approval phase gates WAIVED for M3+ during overnight run 2026-07-20. Independent verifier requirements NOT waived. Automated validation NOT waived. Critical/high defect waiver NOT permitted. M3+ integrated into overnight branch only, not main.
- Authorized by: Repository owner (explicit in overnight run prompt, 2026-07-19 23:52 Brussels time).
- Record: Covers all milestones on overnight/m3-plus-2026-07-20 branch during 2026-07-20 overnight run.

## GD-006 — Accept pre-existing IPC error taxonomy for M3

- Date: 2026-07-20
- Context: Independent electron-security-reviewer found MEDIUM finding: Zod validation errors on all IPC channels return `{ code: 'INTERNAL_ERROR', message: <zod message> }` rather than a distinct `INVALID_INPUT` code. Found in shared infrastructure `src/main/ipc/createIpcHandler.ts` + `src/main/utils/errors.ts`. Not introduced by M3 — pre-exists across all M1/M2/M3 channels. No secrets, file paths, or DB internals disclosed. Dev-only stack trace attached when `NODE_ENV=development` via `details` field.
- Decision: Accept current error taxonomy for M3 under overnight owner override (GD-005). Medium severity, pre-existing, no critical/high disclosure. SynchronizationService itself catches all internal errors and returns structured `check_failed` result — only Zod validation path (malformed UUID) returns INTERNAL_ERROR. Fixing requires Risk-3 change to `src/main/ipc/createIpcHandler.ts`, tracked as separate hardening task.
- Pending owner review: Owner should confirm acceptance of shared-infrastructure INTERNAL_ERROR on malformed IPC input (affects all channels) when reviewing overnight branch.
- Scope: Applies to M3 integration into overnight branch only. Main-branch merge requires owner acknowledgement.
