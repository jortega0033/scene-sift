---
globs: ["src/preload/**", "src/shared/ipc/**"]
---

# Preload and IPC Rule

Risk: 3. Changes require Electron security review + full validation.

## Preload requirements

- Expose ONLY narrow, typed APIs through `contextBridge.exposeInMainWorld`.
- Never expose raw `ipcRenderer`, `require`, or `process`.
- Never implement generic `invoke(channel)` pass-throughs.
- All exposed methods must validate inputs before forwarding.
- Keep bridge API in sync with `src/shared/ipc/channels.ts`.

## IPC channel requirements

- All channels must be registered in `src/shared/ipc/channels.ts`.
- All payloads must be validated with shared contracts.
- New channels require: documented purpose, input schema, output schema, error contract.
- Removing or renaming channels is a breaking change — document migration.

## Contract tests

`tests/main/ipc-contracts.test.ts` must be updated for any channel change.
