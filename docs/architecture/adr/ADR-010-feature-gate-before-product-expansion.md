# ADR-010: No Product Feature Work Without Baseline Gates

- Status: Accepted
- Date: 2026-07-19

## Context

Feature development on unstable governance/QA foundations causes regressions and unverifiable behavior.

## Decision

Block product-feature milestones until governance, architecture, design, and QA baseline gates pass.

## Consequences

- Slower short-term velocity.
- Stronger long-term delivery reliability.

## Alternatives considered

- Parallel feature + governance work (rejected: high drift risk).

## Revisit conditions

- Baseline gates consistently pass and debt registry has no blocking findings.

## Approval requirement for changes

- Explicit human approval and updated readiness gate.
