# ADR-007: Visual QA Strategy

- Status: Accepted
- Date: 2026-07-19

## Context

UI redesign requires deterministic evidence and regression detection.

## Decision

Use layered QA:

- Playwright E2E (behavior)
- Playwright visual snapshots (rendering)
- Electron smoke (runtime launch/security boundary)
- MCP tools for exploratory/manual diagnostics

## Consequences

- Stronger confidence before feature work.
- Snapshot maintenance overhead.

## Alternatives considered

- Manual screenshot-only QA (rejected: non-repeatable).

## Revisit conditions

- CI rendering environment changes.

## Approval requirement for changes

- Independent reviewer + visual policy compliance.
