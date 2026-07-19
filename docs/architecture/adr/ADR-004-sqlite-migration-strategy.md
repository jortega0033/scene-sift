# ADR-004: SQLite and Migration Strategy

- Status: Accepted
- Date: 2026-07-19

## Context

Local persistence requires schema evolution without data loss.

## Decision

Use SQLite with explicit migrations in `src/database/migrations`, executed by database service initialization.

## Consequences

- Stable local schema management.
- Migration correctness becomes release-critical.

## Alternatives considered

- JSON-file storage (rejected: weak schema guarantees).

## Revisit conditions

- Multi-user or remote sync requirements.

## Approval requirement for changes

- High-risk review + migration test evidence.
