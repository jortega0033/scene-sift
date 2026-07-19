# SceneSift AI Governance

SceneSift separates governance into two layers:

1. **Development-agent governance** (how AI agents modify this repository).
2. **Runtime-product governance** (how SceneSift runtime AI handles user data and recommendations).

## Decision summary

- `loop-engineering` patterns are adopted as governance spine (adapted, not copied wholesale).
- `agency-agents` is used selectively as inspiration for role specialization (small curated set only).
- Mechanical controls are prioritized over prose when feasible.

## Mechanically enforced controls

- Path/risk classification and forbidden patterns via `gate.yaml` + `pnpm governance:validate`.
- Required governance files and instruction frontmatter checks.
- Registry schema validation for model/prompt metadata.
- Adversarial scenario tests in `tests/governance/adversarial-scenarios.test.ts`.

## Human-gated controls

- Risk 2+ requires independent verification and human approval before merge.
- Risk 3 requires specialist review and threat notes.
- Risk 4 autonomous actions are prohibited.
