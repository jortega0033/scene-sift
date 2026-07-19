---
applyTo: 'src/preload/**/*.ts'
---

- Expose only narrow, typed APIs through preload.
- Never expose raw `ipcRenderer` or unrestricted invoke/send.
- Keep preload bridge synchronized with `src/shared/ipc/channels.ts` and contracts.
- Reject unknown channels and unvalidated payloads.
