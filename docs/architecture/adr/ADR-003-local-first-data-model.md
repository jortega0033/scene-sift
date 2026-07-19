# ADR-003: Local-First Data Model

- Status: Accepted
- Date: 2026-07-19

## Context

SceneSift currently targets local media workflows and must avoid hidden cloud dependencies.

## Decision

Persist project/settings/queue state locally and treat remote integrations as future, gated additions.

## Consequences

- Deterministic offline behavior.
- Migration burden when introducing optional cloud sync later.

## Alternatives considered

- Immediate cloud-first architecture (rejected: outside current scope).

## Revisit conditions

- Approved roadmap milestone introducing remote collaboration.

## Approval requirement for changes

- ADR update + privacy/governance review.
