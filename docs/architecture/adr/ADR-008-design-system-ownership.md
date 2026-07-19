# ADR-008: Design-System Ownership

- Status: Accepted
- Date: 2026-07-19

## Context

Post-redesign drift risk is high without explicit visual ownership and token controls.

## Decision

Treat `src/renderer/styles/globals.css` tokens + `docs/design/*` policies as authoritative baseline; enforce via `pnpm design:validate`.

## Consequences

- Consistent monochrome UI baseline.
- Requires policy-compliant exceptions process.

## Alternatives considered

- Informal style guidance only (rejected: governance theater).

## Revisit conditions

- Approved theme expansion or brand update.

## Approval requirement for changes

- Design-system review + before/after evidence.
