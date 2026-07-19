---
globs: ["src/**", "docs/architecture/**"]
---

# Architecture Boundaries Rule

Authoritative source: `docs/architecture/ARCHITECTURE.md`

## Non-negotiable layer boundaries

- `src/renderer/**` must not import `electron`, `node:*`, `@main/*`, or `@database/*`.
- `src/shared/**` must not import renderer, main, or preload implementation code.
- `src/main/**` must not import renderer code.
- Native process execution is restricted to approved services in `src/main/services/`.
- Direct SQLite usage is restricted to `src/main/services/database/`.
- QA mock bridge imports are restricted to `src/renderer/main.tsx` behind the `VITE_SCENESIFT_BROWSER_QA` guard.

## Change requirements

- Architecture boundary changes require an ADR in `docs/architecture/adr/`.
- Run `pnpm architecture:validate` after any change to layer boundaries or import patterns.
- High-risk boundary changes (main/preload/IPC) require risk-3 review.

## Enforcement

`pnpm architecture:validate` performs static checks. Do not bypass or weaken it.
