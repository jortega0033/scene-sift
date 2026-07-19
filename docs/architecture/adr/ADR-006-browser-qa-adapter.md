# ADR-006: Browser QA Adapter

- Status: Accepted
- Date: 2026-07-19

## Context

Playwright browser tests need deterministic renderer behavior without Electron privileges.

## Decision

Use explicit browser QA bridge guarded by `VITE_SCENESIFT_BROWSER_QA=1`; production must fail closed when preload bridge is missing.

## Consequences

- Deterministic browser automation.
- Requires strict controls to prevent mock leakage.

## Alternatives considered

- Implicit runtime fallback mocks (rejected: unsafe and misleading).

## Revisit conditions

- Dedicated renderer simulation framework added.

## Approval requirement for changes

- Architecture + governance review and smoke/E2E proof.
