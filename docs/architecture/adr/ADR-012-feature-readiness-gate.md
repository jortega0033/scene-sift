# ADR-012: Feature Readiness Gate

- Status: Accepted
- Date: 2026-07-19

## Context

Feature development on an unstable foundation produces compounding technical debt.
Governance gaps, architecture violations, Electron security regressions, and visual
inconsistencies discovered mid-feature are expensive to fix without breaking in-progress work.

SceneSift uses a feature-readiness gate to ensure the foundation is stable before
implementing product capabilities.

The gate requires independent evidence, not self-attestation. A readiness verdict
is not valid unless the underlying commands were actually run and evidence was recorded.

## Decision

Feature development is blocked when any of the following is true:

**Hard blockers (require resolution before any feature work):**
- Unresolved critical governance finding
- Unresolved critical or high Electron security finding
- Copilot and Claude governance conflict
- Risk classification is bypassable
- Implementer can self-verify
- Governance can self-weaken (approve its own change)
- Architecture boundaries undocumented or unenforced
- Browser QA mocks can reach production
- Design system has competing component families
- Visual tests are materially flaky
- `pnpm validate` is unreliable or silently omits checks
- Secrets or personal paths present in tracked files
- Existing UI presents fake functionality as real
- Build or Electron startup is broken
- Critical-flow accessibility defects unresolved

**Conditional blockers (feature planning may begin but implementation is blocked):**
- Only documented medium or low findings remain
- Each remaining finding has a nominated owner
- Each has a target milestone
- Core validation is green
- Independent reviewers confirm the foundation is stable
- No unresolved security or governance blocker remains

## Verdict options

```
READY FOR FEATURE DEVELOPMENT
CONDITIONALLY READY
NOT READY
```

A verdict of `CONDITIONALLY READY` permits feature planning and roadmap definition.
It does not permit feature implementation until all conditions are cleared.

A verdict upgrade from `CONDITIONALLY READY` to `READY` requires:
- All conditions resolved and independently verified
- `pnpm validate:full` passing
- Updated FEATURE_READINESS_GATE.md entry with evidence

## Consequences

- Feature planning may proceed only from a stable, truthful baseline
- Prevents AI-generated code from amplifying governance drift
- Requires honest evidence collection, not documentation theater

## Alternatives considered

- No explicit gate (rejected: permits feature work to paper over foundation problems)
- Automated gate only (rejected: some controls require human judgment)

## Security impact

Ensures Electron security and architecture controls are verified before product code
introduces new privilege paths.

## Revisit conditions

- When a critical blocker cannot be resolved within a bounded milestone
- When the project scope changes materially
- After each complete feature milestone: re-run `pnpm validate:full` and update the gate

## Required approval for changes

- Governance reviewer sign-off + human approval to change any blocker definition
- Evidence of `pnpm validate:full` passing at the time of the new verdict
