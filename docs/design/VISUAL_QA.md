# SceneSift Visual QA Infrastructure

## Implemented layers

### 1) Playwright Test (durable CI-grade)

- E2E interaction coverage under `tests/e2e/**`
- Visual snapshots under `tests/visual/**`
- Electron smoke automation under `tests/electron/**`
- Deterministic browser runtime via QA fixture bridge (`VITE_SCENESIFT_BROWSER_QA=1`)

### 2) Playwright MCP (exploratory)

- Repository-local MCP config in `.vscode/mcp.json`
- Chromium-only isolated context with localhost scoping
- No personal browser-state dependency

### 3) Chrome DevTools MCP (interactive inspection)

- Repository-local MCP config in `.vscode/mcp.json`
- Isolated profile and telemetry-reduction flags
- Intended for headed/manual diagnostics, not CI gate execution

### 4) Electron smoke path

- Validates launch, window creation, title, preload bridge availability, navigation constraints, and clean shutdown
- Uses smoke IPC mode to avoid native DB dependency flake in smoke context

## Guard rails

- Console guard: fails on unexpected console/page errors.
- Network guard: fails on unexpected non-localhost requests.
- Accessibility-first selectors with limited, stable `data-testid` contracts.

## Commands

- `pnpm test:e2e`
- `pnpm test:visual`
- `pnpm test:visual:update`
- `pnpm test:electron`
- `pnpm test:qa`
- `pnpm qa:serve`
- `pnpm qa:chrome`

## Snapshot policy

- Baselines are platform-specific (`-darwin`) where rendering differs by OS/font stack.
- Snapshot updates require intentional review, not automatic acceptance.
