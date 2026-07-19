# ADR-001: Electron Process Boundaries

- Status: Accepted
- Date: 2026-07-19

## Context

SceneSift is an Electron desktop app with privileged local filesystem, process, and database operations.

## Decision

Keep renderer unprivileged and enforce privileged operations in main process behind preload + typed IPC.

## Consequences

- Improved security boundary.
- Slightly more boilerplate for typed contracts.

## Alternatives considered

- Enabling Node integration in renderer (rejected: high risk).

## Revisit conditions

- Electron security model changes or runtime capability requirements.

## Approval requirement for changes

- High-risk review + independent verifier + human approval.
