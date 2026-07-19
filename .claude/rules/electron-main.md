---
globs: ["src/main/**"]
---

# Electron Main Process Rule

Risk: 3 minimum. All changes require specialist review + independent verification + human approval.

## Required security configuration

BrowserWindow must always use:
- `nodeIntegration: false`
- `contextIsolation: true`
- `sandbox: true`
- `webSecurity: true`

Navigation must reject all non-local URLs (`will-navigate`, `did-navigate`).
External links must use `shell.openExternal` only for verified http/https.

## Process execution

- Use argument arrays for all child process execution. Never construct command strings.
- Validate all executable paths before invocation. No renderer-controlled exec paths.
- No `shell: true` in any `spawn`/`exec` call.
- Surface process errors explicitly; no silent fallbacks.

## IPC handling

- Validate every IPC payload against shared contracts (`src/shared/ipc/contracts.ts`).
- Reject unknown channels silently (no error surface to renderer).
- Return structured errors, not raw exception messages.

## Tests

Every change to privileged main-process behavior requires:
- A regression test in `tests/main/`
- Re-running `pnpm test:electron` for packaging-related changes
