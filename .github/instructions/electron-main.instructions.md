---
applyTo: 'src/main/**/*.ts'
---

- Treat main process code as high risk.
- Enforce secure BrowserWindow defaults.
- Validate all IPC payloads using shared contracts.
- Use argument arrays for process execution; never shell command strings.
- Require explicit errors for failure paths; no silent fallbacks.
