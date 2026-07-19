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
