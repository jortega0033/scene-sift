# M4 — Video Preview Workspace: Implementation Plan

Date: 2026-07-20
Status: PLANNING

---

## Branch

`feature/m4-video-preview`

Base: merge from `overnight/m3-plus-2026-07-20` after M4 planning review passes.

---

## Phase 1 — Shared schemas + IPC channels (Risk 1)

### Files

**New: `src/shared/schemas/video.ts`**
```typescript
import { z } from 'zod';

export const videoGetPlaybackUrlInputSchema = z.object({ projectId: z.string().uuid() });
export const videoGetPlaybackUrlOutputSchema = z.object({ url: z.string() });

export const videoGetCuesInputSchema = z.object({ projectId: z.string().uuid() });
export const VideoCueItemSchema = z.object({
  index: z.number().int().nonneg(),
  startMs: z.number().int().nonneg(),
  endMs: z.number().int().nonneg(),
  text: z.string().max(2000), // capped to prevent oversized IPC payloads
  // Note: SubtitleCue.lines is intentionally excluded (not needed for overlay display)
});
export type VideoCueItem = z.infer<typeof VideoCueItemSchema>;
export const videoGetCuesOutputSchema = z.object({ cues: z.array(VideoCueItemSchema) });
```

**Modified: `src/shared/ipc/channels.ts`**
```typescript
VIDEO_GET_PLAYBACK_URL: 'video:getPlaybackUrl',
VIDEO_GET_CUES: 'video:getCues',
```

**Modified: `src/shared/ipc/contracts.ts`**
```typescript
video: {
  getPlaybackUrl: { input: videoGetPlaybackUrlInputSchema, output: videoGetPlaybackUrlOutputSchema },
  getCues: { input: videoGetCuesInputSchema, output: videoGetCuesOutputSchema },
},
```

**Modified: `tests/main/ipc-contracts.test.ts`**
Add coverage for `VIDEO_GET_CUES` and `VIDEO_GET_PLAYBACK_URL`.

**Checks**: pnpm typecheck, pnpm lint

---

## Phase 2 — Main: VideoService + protocol handler (Risk 3)

**Requires**: Independent electron-security-reviewer verification + architecture-reviewer verification before Phase 3.

### Files

**New: `src/main/services/video/videoService.ts`**

```typescript
// Structured error codes (no raw exception messages to renderer)
export type VideoServiceError = { code: 'PROJECT_NOT_FOUND' | 'NO_VIDEO_PATH' | 'SUBTITLE_DATA_CORRUPT' };

export class VideoService {
  constructor(private db: DatabaseService) {}

  // Returns local:///video/{projectId} URL (triple-slash = empty host, pathname = /video/{uuid})
  // Validates project exists and videoPath is set before returning URL.
  public getPlaybackUrl(projectId: string): string {
    const project = this.db.getProject(projectId);
    if (!project) throw { code: 'PROJECT_NOT_FOUND' } as VideoServiceError;
    if (!project.videoPath) throw { code: 'NO_VIDEO_PATH' } as VideoServiceError;
    return `local:///video/${projectId}`;
  }

  // Resolves the filesystem path for use by the protocol handler only.
  // Protocol handler must call this instead of accessing db directly.
  public resolveVideoPath(projectId: string): string | null {
    const project = this.db.getProject(projectId);
    return project?.videoPath ?? null;
  }

  public getCues(projectId: string): VideoCueItem[] {
    const project = this.db.getProject(projectId);
    if (!project) throw { code: 'PROJECT_NOT_FOUND' } as VideoServiceError;
    // Prerequisite gate: only return cues for projects with parsed subtitles
    if (project.subtitleStatus !== 'ready' && project.subtitleStatus !== 'ready_with_warnings') {
      return [];
    }
    try {
      const doc = this.db.getSubtitleDocument(projectId);
      if (!doc) return [];
      return doc.cues.map(c => ({
        index: c.index,
        startMs: c.startMs,
        endMs: c.endMs,
        text: c.text,
      }));
    } catch {
      throw { code: 'SUBTITLE_DATA_CORRUPT' } as VideoServiceError;
    }
  }
}
```

**New: `src/main/services/video/localVideoProtocol.ts`**

```typescript
// Protocol registration sequence (Electron requirement):
// 1. protocol.registerSchemesAsPrivileged — MUST run at module level BEFORE app.ready
// 2. protocol.handle — MUST run inside app.whenReady() callback, before new BrowserWindow()
// See src/main/index.ts for registration order.

// URL scheme is local:///video/{uuid} (triple-slash — empty host, pathname = /video/{uuid})
// Confirmed: new URL('local:///video/<uuid>').pathname === '/video/<uuid>'
// NOT: local://video/<uuid> (that puts 'video' as hostname, pathname = '/<uuid>')

const UUID_PATH_REGEX =
  /^\/video\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

export function registerLocalVideoProtocol(videoService: VideoService): void {
  protocol.handle('local', async (request) => {
    const pathname = new URL(request.url).pathname;
    const match = pathname.match(UUID_PATH_REGEX);
    if (!match) return new Response(null, { status: 404 });

    // Path resolved from DB via VideoService only — never from URL
    const projectId = match[1];
    const videoPath = videoService.resolveVideoPath(projectId);
    if (!videoPath) return new Response(null, { status: 404 });

    // Use lstat (not stat) to reject symlinks
    const stat = await fsLstat(videoPath).catch(() => null);
    if (!stat?.isFile()) return new Response(null, { status: 404 });

    const totalSize = stat.size;
    const rangeHeader = request.headers.get('Range');

    if (rangeHeader) {
      const range = parseRange(rangeHeader, totalSize);
      // Return 416 Range Not Satisfiable for invalid/inverted ranges
      if (!range) {
        return new Response(null, {
          status: 416,
          headers: { 'Content-Range': `bytes */${totalSize}` },
        });
      }
      const [start, end] = range;
      // Use Readable.toWeb() to convert Node.js Readable to Web ReadableStream
      const nodeStream = createReadStream(videoPath, { start, end });
      const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;
      return new Response(webStream, {
        status: 206,
        headers: {
          'Content-Range': `bytes ${start}-${end}/${totalSize}`,
          'Content-Length': String(end - start + 1),
          'Content-Type': mimeForExtension(videoPath),
          'Accept-Ranges': 'bytes',
        },
      });
    }

    // Full file response
    const nodeStream = createReadStream(videoPath);
    const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;
    return new Response(webStream, {
      status: 200,
      headers: {
        'Content-Length': String(totalSize),
        'Content-Type': mimeForExtension(videoPath),
        'Accept-Ranges': 'bytes',
      },
    });
  });
}

function mimeForExtension(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimes: Record<string, string> = {
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mov': 'video/quicktime',
    '.avi': 'video/x-msvideo',
    '.mkv': 'video/x-matroska',
  };
  return mimes[ext] ?? 'application/octet-stream';
}

// Returns null for invalid/inverted ranges (caller returns 416)
function parseRange(header: string, total: number): [number, number] | null {
  const match = header.match(/^bytes=(\d+)-(\d*)$/);
  if (!match) return null; // invalid format → 416
  const start = Math.min(parseInt(match[1], 10), total - 1);
  const end = match[2] ? Math.min(parseInt(match[2], 10), total - 1) : total - 1;
  if (start > end || start >= total) return null; // inverted or out-of-range → 416
  return [start, end];
}
```

**Modified: `src/main/index.ts` (or equivalent entry point)**

Two-step registration (order is critical):
```typescript
// Step 1: BEFORE app.whenReady() — at module load
protocol.registerSchemesAsPrivileged([
  { scheme: 'local', privileges: { standard: true, secure: true, stream: true, supportFetchAPI: true, corsEnabled: false } },
]);

// Step 2: INSIDE app.whenReady() — after ready, before new BrowserWindow()
app.whenReady().then(async () => {
  registerLocalVideoProtocol(videoService); // protocol.handle('local', ...)
  // ... then create BrowserWindow
});
```

**Modified: `src/main/security/csp.ts`** — add `media-src 'self' local:` to both production and development CSP strings. This is a security-boundary change; electron-security-reviewer must verify Phase 2 includes this. Without it, `<video src="local:///video/...">` is blocked by CSP `default-src 'self'`.

**Modified: `src/main/ipc/registerIpcHandlers.ts`**
- Register `video:getPlaybackUrl` and `video:getCues` handlers using `registerValidatedHandler`

**New: `tests/main/video/videoService.test.ts`**
Unit tests:
1. `getPlaybackUrl` — valid project with videoPath → returns local:// URL
2. `getPlaybackUrl` — project not found → throws
3. `getPlaybackUrl` — project with no videoPath → throws
4. `getCues` — valid project with subtitle doc → returns cue array
5. `getCues` — valid project with no subtitle doc → returns []
6. `getCues` — project not found → throws
7. `getCues` — cue text preserved verbatim

**New: `tests/main/video/localVideoProtocol.test.ts`**
Unit tests (use mock db and mock fs.stat):
1. Valid UUID → file found → returns 200 with correct Content-Type
2. Valid UUID → range request → returns 206 with Content-Range
3. Non-UUID path → returns 404
4. Valid UUID → file not found (stat fails) → returns 404
5. Valid UUID → project has no videoPath → returns 404

**Checks**: pnpm typecheck, pnpm lint, pnpm test, pnpm test:database, pnpm governance:validate, pnpm architecture:validate

**Independent verification required before Phase 3.**

---

## Phase 3 — Preload bridge (Risk 3)

**New in `src/preload/index.ts` contextBridge:**
```typescript
video: {
  getPlaybackUrl: (projectId: string) => {
    // Validate input before forwarding (rule: preload-ipc.md all methods must validate inputs)
    if (typeof projectId !== 'string' || !projectId) throw new TypeError('projectId must be a non-empty string');
    return ipcRenderer.invoke(IPC_CHANNELS.VIDEO_GET_PLAYBACK_URL, { projectId });
  },
  getCues: (projectId: string) => {
    if (typeof projectId !== 'string' || !projectId) throw new TypeError('projectId must be a non-empty string');
    return ipcRenderer.invoke(IPC_CHANNELS.VIDEO_GET_CUES, { projectId });
  },
},
```

**Modified: `src/shared/api/sceneSiftApi.ts`**
Add video namespace types.

**Checks**: pnpm typecheck, pnpm lint, pnpm test

---

## Phase 4 — Renderer: preview page (Risk 1)

### New files

**`src/renderer/features/preview/PreviewPage.tsx`**
- Reads `selectedProjectId` from uiStore
- Checks prerequisites (canPreview)
- Shows not-available or VideoPlayer

**`src/renderer/features/preview/VideoPlayer.tsx`**
- HTMLVideoElement wrapped
- `src={playbackUrl}` where `playbackUrl` is loaded via `window.sceneSift.video.getPlaybackUrl(projectId)` IPC call — renderer NEVER constructs the URL from projectId directly
- Playback controls
- Time display
- Speed picker
- Exposes callbacks: `onTimeUpdate`, `onStateChange`

**`src/renderer/features/preview/SubtitleOverlay.tsx`**
- Props: `activeCues: VideoCueItem[]`
- Renders cue text (escaped), bottom-center overlay position
- `aria-live="polite"`

**`src/renderer/features/preview/CueList.tsx`**
- Props: `cues: VideoCueItem[]`, `currentTimeMs: number`, `onCueClick: (startMs: number) => void`
- Scrollable list
- Active cue highlight via `data-testid="preview-cue-item-active"`
- Auto-scroll to active cue

**`src/renderer/features/preview/useVideoPlayer.ts`**
- Player state machine (not_ready/loading/ready/playing/paused/error)
- timeupdate handler → active cue filtering
- Exposes player controls (play, pause, seek, setSpeed)

**`src/renderer/features/preview/hooks/useCues.ts`**
- React Query hook: `window.sceneSift.video.getCues(projectId)`
- Returns `{ cues, isLoading, error }`

**`src/renderer/features/preview/videoFormatters.ts`**
- `formatCueTime(ms: number): string` → `HH:MM:SS.mmm` for cue list
- `formatPlayerTime(ms: number): string` → `H:MM:SS` for playback display

**Modified: `src/renderer/app/App.tsx`**
- Add `preview` route to render PreviewPage

**Modified: `src/renderer/components/Layout.tsx`**
- Add Preview nav item (icon + label)

**Modified: `src/shared/api/sceneSiftApi.ts`**
- Add `video` namespace type

**Modified: `src/renderer/qa/fixtures.ts`**
- Add `preview-not-available`, `preview-ready`, `preview-no-cues` fixtures
- Add `preview-with-subtitle` fixture (project with cues in mockSceneSiftApi)

**Modified: `src/renderer/qa/mockSceneSiftApi.ts`**
- Add `video.getPlaybackUrl()` → returns blank/silent mp4 data URI (e.g. `'data:video/mp4;base64,...'`) — NOT `'local://video/{projectId}'` (local: scheme not available in browser QA mode)
- Add `video.getCues()` → returns fixture cue array

### Unit tests

**`tests/renderer/preview/videoFormatters.test.ts`**
- `formatCueTime`: 0 → '00:00:00.000', 65432 → '00:01:05.432', 3661000 → '01:01:01.000'
- `formatPlayerTime`: 0 → '0:00', 65 → '1:05', 3661 → '1:01:01'

**`tests/renderer/preview/useVideoPlayer.test.ts`** (Vitest)
- Player state transitions (not_ready → loading, error state, playing/paused)

**Checks**: pnpm typecheck, pnpm lint, pnpm test

---

## Phase 5 — QA fixtures + E2E + visual (Risk 1)

**`tests/e2e/preview.spec.ts`**
- not_available state (no project) → `preview-not-available` visible
- prerequisites not met → shows reason
- prerequisites met → `preview-video` present, `preview-cue-list` visible
- cue click → seek (verify via mock)
- speed picker → selects option

**`tests/visual/preview.visual.spec.ts`**
- `preview-not-available` snapshot
- `preview-ready` (player loaded, paused)
- `preview-with-active-cue` (cue highlighted in list + overlay text)

**Checks**: pnpm test:e2e, pnpm test:visual

---

## Phase 6 — Full validation (Risk 0)

```bash
pnpm validate
pnpm test:e2e
pnpm test:visual
pnpm test:electron
```

All must exit 0.

---

## Modified files summary

| Action | Path | Risk |
|---|---|---|
| New | `src/shared/schemas/video.ts` | 1 |
| Mod | `src/shared/ipc/channels.ts` | 1 |
| Mod | `src/shared/ipc/contracts.ts` | 1 |
| New | `src/main/services/video/videoService.ts` | 3 |
| New | `src/main/services/video/localVideoProtocol.ts` | 3 |
| Mod | `src/main/app.ts` (or equivalent) | 3 |
| Mod | `src/main/security/csp.ts` | 3 |
| Mod | `src/main/ipc/registerIpcHandlers.ts` | 3 |
| Mod | `src/preload/index.ts` | 3 |
| New | `src/renderer/features/preview/*.tsx` | 1 |
| Mod | `src/renderer/app/App.tsx` | 1 |
| Mod | `src/renderer/components/Layout.tsx` | 1 |
| Mod | `src/renderer/qa/fixtures.ts` | 0 |
| Mod | `src/renderer/qa/mockSceneSiftApi.ts` | 0 |
| New | `tests/main/video/*.test.ts` | 1 |
| New | `tests/renderer/preview/*.test.ts` | 1 |
| New | `tests/e2e/preview.spec.ts` | 1 |
| New | `tests/visual/preview.visual.spec.ts` | 1 |
| Mod | `tests/main/ipc-contracts.test.ts` | 1 |

---

## Attempt limit

Max 3 implementation attempts per task before escalation (per `loop-constraints.md`).
