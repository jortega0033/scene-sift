# SceneSift Architecture Baseline

Status: **Accepted Baseline (2026-07-19)**

## Layer model

```
Renderer
  -> typed preload bridge (window.sceneSift)
    -> shared IPC channel contracts
      -> main-process IPC handlers
        -> privileged services (database/files/dialog/process)
```

## Layer ownership

- `src/renderer/**` — UI, state, query orchestration, and user-facing workflows.
- `src/preload/**` — strict typed bridge only.
- `src/shared/**` — contracts and schemas, no privileged runtime imports.
- `src/main/**` — Electron runtime, IPC handlers, privileged services.
- `src/database/**` — schema and migrations.

## Non-negotiable boundaries

- Renderer must not import `electron`, `node:*`, `@main/*`, or `@database/*`.
- Shared modules must not import renderer/main/preload implementation code.
- Main must not import renderer.
- Native process execution is restricted to approved process/ffmpeg services.
- Direct SQLite usage is restricted to main database service layer.
- QA bridge imports are restricted to `src/renderer/main.tsx` via explicit guard.

## Browser QA adapter boundary

- Browser QA mode is explicit (`VITE_SCENESIFT_BROWSER_QA=1`).
- Production does not silently fall back to mocks.
- Mock API remains synthetic/local and excludes privileged filesystem/process/sqlite access.

## Enforcement

- `pnpm architecture:validate` performs static boundary checks.
- Governance adversarial tests include architecture bypass scenarios.
- CI governance job executes architecture validation.

## Change control

Architecture changes require:

1. ADR update in `docs/architecture/adr/`.
2. Risk classification and threat notes for high-risk paths.
3. `pnpm architecture:validate` + full baseline checks.
4. Independent architecture review.

See ADR set for detailed rationale.
