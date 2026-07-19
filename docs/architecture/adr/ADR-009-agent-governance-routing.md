# ADR-009: Dynamic Model and Agent Governance

- Status: Accepted
- Date: 2026-07-19

## Context

Higher-risk changes require stronger reasoning and independent verification.

## Decision

Use risk-tiered model routing and enforce independent verifier evidence for medium/high risk work.

## Consequences

- Better quality for sensitive changes.
- Slightly longer execution loops.

## Alternatives considered

- Single-model all tasks (rejected: insufficient governance rigor).

## Revisit conditions

- Model capability shifts or governance incidents.

## Approval requirement for changes

- Governance reviewer approval + run-log evidence.
