# SceneSift Dependency Policy

## Purpose

Prevent dependency drift, duplicate stacks, and hidden security/supply-chain risk.

## Addition requirements

Any new dependency must include:

1. Purpose and owning layer (renderer/main/shared/tests/tooling).
2. Alternatives considered.
3. License compatibility.
4. Security and telemetry implications.
5. Native-module impact (if any).
6. Bundle/runtime impact.
7. Removal strategy.
8. Validation evidence.

## Baseline constraints

- Single icon family (`lucide-react`).
- Single schema validation baseline (`zod`).
- Single state-management baseline (`zustand`).
- Critical MCP tooling must be pinned exactly:
  - `@playwright/mcp`
  - `chrome-devtools-mcp`
- Prohibited telemetry/analytics dependencies by default:
  - `posthog-js`
  - `mixpanel-browser`
  - `@segment/analytics-next`
  - `@sentry/browser`
  - `@sentry/electron`

## Enforcement

- `pnpm dependencies:validate` checks pinning, duplicate categories, prohibited packages, and unused runtime dependencies.
