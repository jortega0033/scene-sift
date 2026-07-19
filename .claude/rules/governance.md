---
globs: ["CLAUDE.md", ".claude/**", ".github/**", "gate.yaml", "loop-constraints.md", "loop-budget.md", "loop-run-log.md", "STATE.md", "AGENTS.md", "LOOP.md", "docs/governance/**", "scripts/governance/**", "scripts/claude/**"]
---

# Governance Files Rule

These files define or enforce project governance. Changes carry the highest risk.

## Requirements

- Classify as risk 3 minimum (risk 4 for `gate.yaml`, `.env*`, credentials, signing).
- Require independent governance review before merge.
- No self-approval: the agent proposing a governance change cannot be its own verifier.
- Any change that weakens a control must explicitly state what protection is reduced and why.
- Human approval is required before reducing protection on any enforcement mechanism.
- When a control changes, update the adversarial test suite to cover the new behavior.
- Record governance decisions in `docs/governance/GOVERNANCE_DECISIONS.md`.

## Forbidden without explicit human authorization

- Removing or weakening forbidden-pattern checks in `gate.yaml`
- Raising risk level thresholds to allow previously forbidden actions
- Removing required-check entries from `gate.yaml.requiredChecksByRisk`
- Disabling or removing hooks from `.claude/settings.json`
- Weakening deny rules in `.claude/settings.json`
- Deleting adversarial test scenarios
- Modifying approval records

## Authoritative source

`gate.yaml` is the machine-readable authority for all risk classification, forbidden actions, and required checks. All other governance files must remain consistent with it.
