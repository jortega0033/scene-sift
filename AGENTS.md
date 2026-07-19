# SceneSift Agent Operating Rules

This file defines standing rules for AI agents working in this repository.

## Non-negotiable controls

- No direct push to protected branches.
- No autonomous merge, release, signing, or deployment.
- No edits to `.env*`, credentials, or secrets paths.
- No `shell: true`, no untrusted command strings, and no renderer-side secret access.
- No weakening of Electron security defaults (`nodeIntegration: true`, `contextIsolation: false`, `webSecurity: false`).
- No uploads of user media or transcripts without explicit user action and disclosure.

## Verification model

- Implementer and verifier must be independent roles.
- Verifier must run real commands and provide exact evidence.
- Verifier default stance is reject-until-proven-safe.
- Failed verifier cannot be bypassed by orchestrator or implementer.

## Risk-to-gate mapping

- Risk 0: docs-only; governance validation required.
- Risk 1: low; governance + type/lint/test checks.
- Risk 2: medium; independent verifier + full validate + human approval.
- Risk 3: high; specialist reviewer + threat analysis + full validation + explicit human approval.
- Risk 4: critical; autonomous execution forbidden.

## Durable state

- `STATE.md` is authoritative for active run status and escalation.
- `loop-run-log.md` records decisions, model routing, evidence, and outcomes.
- `gate.yaml` is the machine-readable source for path sensitivity and forbidden actions.

## Runtime AI scope boundary

- Development-agent governance is not equivalent to runtime-product governance.
- Runtime AI policy is defined in `docs/governance/RUNTIME_AI_POLICY.md` and must be enforced by product code before AI-assisted rendering/publishing.
