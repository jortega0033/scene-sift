# Governance Change Skill

Invoke: `/governance-change <description of proposed change>`

Risk 3 minimum. Human approval required before any change takes effect.

## Steps

1. **Classify** — Apply gate.yaml risk 3 or 4. State classification with rationale.
2. **Describe impact** — What protection does this change? What risk does weakening introduce?
3. **Draft change** — Write proposed diff. Do NOT apply yet.
4. **Self-check** — Does change weaken any: forbidden-action check, deny rule, hook, adversarial test?
5. **Adversarial test plan** — Identify which adversarial tests must be added/updated.
6. **Human approval gate** — STOP. Present draft + impact + test plan to human. Await explicit approval.
7. **Apply** (only after approval) — Make change, update adversarial tests, record in `docs/governance/GOVERNANCE_DECISIONS.md`.
8. **Independent verify** — Invoke governance-verifier agent (different session).

## Forbidden

- Applying change before human approval.
- Removing adversarial tests without equivalent replacement.
- Self-verifying governance changes.
