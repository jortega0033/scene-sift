# M4 — Video Preview Workspace: Architecture

Date: 2026-07-20
Status: PLANNING

---

## Layer diagram

```
src/renderer/features/preview/
  PreviewPage.tsx           ← 4th nav route, holds project context
  VideoPlayer.tsx           ← HTMLVideoElement wrapper + controls
  SubtitleOverlay.tsx       ← timeupdate-driven cue display
  CueList.tsx               ← scrollable cue list + jump-to-cue
  useVideoPlayer.ts         ← player state + timeupdate logic
  hooks/useCues.ts          ← React Query hook for video:getCues
      ↓ window.sceneSift.video
src/preload/index.ts        ← contextBridge: video.getPlaybackUrl, video.getCues
      ↓ IPC channels
src/main/ipc/registerIpcHandlers.ts
src/main/services/video/
  videoService.ts           ← business logic: resolve URL, fetch cues
  localVideoProtocol.ts     ← Electron protocol.handle('local', ...)
src/main/services/database/databaseService.ts   ← getProject, getSubtitleDocument
src/shared/
  ipc/channels.ts           ← VIDEO_GET_CUES, VIDEO_GET_PLAYBACK_URL
  ipc/contracts.ts          ← input/output schemas
  schemas/video.ts          ← VideoPlaybackUrlOutput, VideoCueItem
```

---

## Custom protocol: `local://`

Registered in main process via `protocol.handle('local', handler)` before `app.ready` wait.

### URL scheme

`local://video/{projectId}`

- `projectId` is a UUID (validated with z.string().uuid())
- No raw file paths in URLs
- Protocol handler resolves path from DB, NOT from URL

### Protocol handler contract

```
Request: local://video/{projectId}
→ Main: validate projectId as UUID
→ DB: getProject(projectId) → project.videoPath
→ FS: stat(videoPath) → must be a file
→ HTTP range: parse Accept-Range / Range headers
→ Respond: 200 (full) or 206 (partial) with video bytes
→ Error: 404 (not found), 415 (unsupported), 500 (internal)
```

Only responds to `local:` scheme from renderer origin. No external URLs accepted.

### Range request support

Electron protocol handler must support HTTP Range requests for seeking. Without Range support, HTMLVideoElement cannot seek. Implementation:
- Parse `Range: bytes=START-END` header
- Read file slice using `fs.createReadStream({start, end})`
- Return `Content-Range: bytes START-END/TOTAL` with status 206

---

## IPC channels

### `video:getPlaybackUrl`

- Input: `{ projectId: z.string().uuid() }`
- Output: `{ url: string }` — `local://video/{projectId}`
- Notes: Does NOT read file; main validates project exists and videoPath is present before returning URL

### `video:getCues`

- Input: `{ projectId: z.string().uuid() }`
- Output: `{ cues: VideoCueItem[] }`
- `VideoCueItem` = `{ index: number; startMs: number; endMs: number; text: string }`
- Source: `db.getSubtitleDocument(projectId)` → maps to cue array
- Returns `[]` if no subtitle document

---

## Renderer: state machine

Player states (local React state, NOT persisted to DB):

| State | Description |
|---|---|
| `not_ready` | Project not selected or prerequisites not met |
| `loading` | Cues being fetched, video element initializing |
| `ready` | Video loaded (paused at frame 0) |
| `playing` | Actively playing |
| `paused` | User paused |
| `error` | HTMLVideoElement error (unsupported codec, file missing) |

---

## Navigation change

`useUiStore` — add `'preview'` to the ActiveView union. Add `selectedProjectId` persistence across nav changes (already exists). PreviewPage checks `selectedProjectId !== null && project.status === 'ready'`.

New route renders in place of current page content.

---

## Subtitle overlay logic

```
videoElement.addEventListener('timeupdate', () => {
  const currentMs = videoElement.currentTime * 1000;
  const active = cues.filter(c => currentMs >= c.startMs && currentMs <= c.endMs);
  setActiveCues(active);
});
```

Edge cases:
- Multiple simultaneous cues (overlap) → render all, stacked
- No active cue → overlay hidden
- Seeking → timeupdate fires after seek, no special handling needed

---

## Architecture boundary rules

1. `src/renderer/features/preview/**` must NOT import `electron`, `node:*`, `@main/*`, `@database/*`
2. Video URL construction on renderer side uses the returned `local://video/...` URL directly
3. File serving is entirely in main process — renderer sees only the opaque URL
4. `localVideoProtocol.ts` resides in `src/main/services/video/` — main process only
5. No raw file paths returned to renderer at any time

---

## ADR-014: HTMLVideoElement over mpv for M4

Decision: Use HTMLVideoElement (Chromium-embedded) for M4 video preview.
Reason: No IPC complexity, works for H.264 MP4 (most common format), simpler testing, no additional binary dependency.
Trade-off: No H.265/MKV support. Users with those codecs see an error state.
When to revisit: If codec limitations block >20% of users in user feedback post-M5.
