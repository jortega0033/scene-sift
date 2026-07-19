# Security Notes and Threat Model

## Controls implemented

- BrowserWindow hardening:
  - `nodeIntegration: false`
  - `contextIsolation: true`
  - `sandbox: true`
  - `webSecurity: true`
- Preload exposes only explicit methods (`window.sceneSift.*`).
- Renderer has no direct access to Node/Electron internals.
- IPC channel names are static constants, not renderer-controlled strings.
- IPC request/response payloads are validated with Zod.
- Navigation is constrained; unexpected in-app navigation is blocked.
- New windows are denied; external links are opened via OS browser only.
- Command execution uses `spawn(binary, args, { shell: false })`.
- FFmpeg override paths are constrained to expected binary names (`ffmpeg` / `ffprobe`).
- FFmpeg override paths are chosen via native file picker methods, not arbitrary renderer text IPC.
- No `eval`, `new Function`, or dangerous HTML injection patterns used.

## Threat model (milestone 1)

### 1) Malicious media/subtitle filenames

- Risk: path traversal tricks, malformed names, UI injection.
- Mitigation: paths are treated as opaque strings, no shell interpolation, sanitized display.

### 2) IPC misuse

- Risk: renderer sends malformed payloads to privileged handlers.
- Mitigation: strict input parsing in each handler; invalid payloads reject.

### 3) Command injection

- Risk: user-controlled values injected into shell commands.
- Mitigation: no shell command strings; fixed arguments for version checks.

### 4) Renderer compromise

- Risk: compromised renderer accessing privileged APIs.
- Mitigation: minimal bridge surface and no raw ipc/fs/child_process exposure.

### 5) Navigation hijacking

- Risk: renderer forced to untrusted origin.
- Mitigation: deny unexpected navigation and window opens.

### 6) Database path handling

- Risk: unsafe DB location or source-tree writes.
- Mitigation: runtime DB path is in Electron user-data directory.

### 7) Unsafe external links

- Risk: loading arbitrary remote content inside app window.
- Mitigation: remote content is never loaded into main window; external URLs open in browser.

### 8) Future AI credential handling

- Current: no provider credentials implemented.
- Future recommendation: OS keychain/secure store + backend token brokering for distributed builds.
