# ADR-014 — Custom `local://` Electron Protocol for Video File Serving

Date: 2026-07-20
Status: Accepted
Deciders: M4 architecture-reviewer, electron-security-reviewer, overnight autonomous runner (GD-005 override)

---

## Context

M4 (Video Preview Workspace) requires the renderer to load and play video files from the user's local filesystem. Three approaches were considered:

### Option A — Return raw file path via IPC

Renderer receives absolute path string (e.g. `/Users/jake/Movies/clip.mp4`) and sets `<video src="file:///...">`.

- **Rejected**: Exposes raw filesystem structure to renderer. `file://` protocol allows renderer to enumerate parent directories, bypass CSP, and potentially access unrelated files. Violates the principle that renderer never sees privilege paths.

### Option B — FFmpeg transcode to in-memory buffer via IPC

Main process reads and transcodes video bytes, sends base64 or ArrayBuffer over IPC.

- **Rejected**: IPC payloads have an Electron soft cap around 128 MiB; a 2 GB video cannot be transmitted this way. Also prohibits seeking without full re-transcode. Unacceptable for preview use case.

### Option C — Custom Electron `local://` protocol with range-request support (CHOSEN)

Main process registers a custom scheme handler. Renderer requests `local://video/{projectId}` (UUID only — no path embedded). Protocol handler validates UUID, resolves path from DB, stat()s the file, serves bytes with HTTP 206 Range support.

---

## Decision

Adopt Option C: custom `local://` Electron protocol.

### Security properties

- Renderer URL contains only a UUID (`local://video/{projectId}`). No filesystem path crosses the IPC boundary in either direction.
- UUID is validated via regex before any DB or filesystem access.
- File path is resolved exclusively from the DB by the main process.
- `lstat().isFile()` check before serving bytes prevents serving directories, non-existent paths, and symlinks (`lstat` does not follow symlinks; a symlink reports `isFile() === false`).
- CSP `media-src` must explicitly allow `local:` scheme (see Consequences section).

### Protocol registration sequence

Electron requires:
1. `protocol.registerSchemesAsPrivileged([{ scheme: 'local', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: false, stream: true } }])` — MUST run before `app.ready` event.
2. `protocol.handle('local', handler)` — MUST run inside `app.whenReady()` callback, before `new BrowserWindow()`.

The `stream: true` privilege enables `createReadStream` body in the Response without fully buffering large files.

### Range request support

HTMLVideoElement requires HTTP 206 (Partial Content) responses to enable seeking. The protocol handler must:
- Parse `Range: bytes=N-M` headers
- Clamp start/end to valid file bounds
- Reject malformed ranges (start > end, start >= fileSize) with 416 responses
- Return `Accept-Ranges: bytes` on all video responses

---

## Consequences

### Required changes beyond VideoService and protocol handler

1. **`src/main/security/csp.ts`** — add `media-src: local:` to both `productionCsp` and `developmentCsp`. This is a risk-3 security-boundary change requiring electron-security-reviewer sign-off.
2. **`src/main/index.ts` (or equivalent entry point)** — `registerSchemesAsPrivileged` call before `app.whenReady()`.
3. **`docs/architecture/ARCHITECTURE.md`** — layer diagram updated to show `local://` protocol as a new privileged main-process data path from renderer to filesystem.

### Architecture invariants maintained

- Renderer layer: no electron/node imports, no file paths, no direct DB access.
- Protocol handler: main process only. Path resolved from DB only.
- IPC channels: `video:getPlaybackUrl` and `video:getCues` remain the typed, validated interface. Renderer constructs no URLs itself — all `local://` URLs are returned by the IPC handler.

### Known limitations

- H.264/AAC and WebM/VP9 supported by Chromium's HTMLVideoElement. H.265/HEVC, MKV, AV1 may not be supported without a native decode fallback (out of scope for M4).
- Seeking performance on large files over spinning disk is not governed by an SLO in M4.

---

## Player technology note (HTMLVideoElement vs mpv)

M4 uses the built-in Chromium HTMLVideoElement renderer rather than a native mpv/VLC process. Rationale: no new dependency, H.264 coverage sufficient for MVP, simpler integration, no IPC complexity for mpv event routing. An mpv integration ADR can be authored if codec coverage requirements expand post-M4.
