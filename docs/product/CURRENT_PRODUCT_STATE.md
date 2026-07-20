# SceneSift — Current Product State

Date: 2026-07-20
Status: M5 CLOSED (commit 575ccdb, overnight branch 2026-07-20). M6 planning COMPLETE — 20 spec documents in `docs/product/`, CONDITIONALLY READY conditions cleared. M6 implementation next.

---

## Summary

SceneSift is an Electron desktop app with a working shell, navigation, project CRUD, queue visibility, settings, media inspection, subtitle parsing, subtitle synchronization checking, in-app video preview, and transcript preparation. Clip generation, AI selection, and publishing are not yet implemented. M6 AI Provider Infrastructure is planned (spec complete) and ready for implementation.

---

## What is implemented

### App shell and navigation

| Component | Status | Notes |
|---|---|---|
| Electron BrowserWindow | ✅ Complete | `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true` |
| Preload bridge (`window.sceneSift`) | ✅ Complete | Typed, narrow, no raw ipcRenderer exposed |
| Navigation (projects / queue / settings) | ✅ Complete | State in `useUiStore`, 3 routes |
| Dark/light/system theme | ✅ Complete | CSS class-based, persisted in DB, tested visually |
| Dev server + HMR | ✅ Complete | Vite |
| Browser QA mode | ✅ Complete | `VITE_SCENESIFT_BROWSER_QA=1`, fixture-driven |

### Project management

| Feature | Status | Notes |
|---|---|---|
| Create project (name + video path) | ✅ Complete | `PROJECT_CREATE` IPC, dialog picker, DB write |
| Optional subtitle path on creation | ✅ Complete | Stored as `projects.subtitle_path` |
| Optional output directory on creation | ✅ Complete | Stored as `projects.output_directory` |
| List projects | ✅ Complete | Ordered by `updated_at DESC` |
| Get project by ID | ✅ Complete | Returns `null` if not found |
| Delete project | ✅ Complete | Cascades to `render_jobs` |
| Project detail panel (UI) | ✅ Complete | Shows paths, status pill, media info, subtitle panel |
| Project status field | ✅ Partial | Schema has `draft`/`active`/`archived`; all projects created as `draft`; no status transitions |

### Media inspection (M1 — CLOSED)

| Feature | Status | Notes |
|---|---|---|
| FFprobe media metadata extraction | ✅ Complete | codec, resolution, duration, fps, bitrate, filesize |
| Media metadata DB storage | ✅ Complete | 9 columns in `projects` table |
| `inspection_status` field | ✅ Complete | `not_inspected` / `inspecting` / `ready` / `inspection_failed` |
| Human-readable error messages | ✅ Complete | `formatInspectionError()` maps all codes |
| Restart persistence | ✅ Complete | All 9 metadata fields survive DB close/reopen |
| Bounded process output | ✅ Complete | `maxOutputBytes: 1_048_576` on FFprobe call |

### Subtitle parsing (M2 — CLOSED)

| Feature | Status | Notes |
|---|---|---|
| SRT parser | ✅ Complete | ReDoS-guarded, 10k cue limit, 1 MiB text cap |
| WebVTT parser | ✅ Complete | W3C header validation, NOTE/STYLE/REGION handling |
| Subtitle normalizer | ✅ Complete | Ordering, zero-cue check, cue text cap, warnings |
| Bounded subtitle reader | ✅ Complete | TOCTOU-safe, 2 MB cap, `isFile()` check |
| 7-state subtitle state machine | ✅ Complete | `not_selected`/`selected`/`parse_failed`/`unsupported`/`missing`/`ready`/`ready_with_warnings` |
| Subtitle summary panel | ✅ Complete | Cue count, last cue end, format, warnings |
| Atomic subtitle persistence | ✅ Complete | `db.transaction()` wraps project-row + subtitle_documents |
| TOCTOU abort on path mismatch | ✅ Complete | `persistSubtitleResult` re-reads path inside transaction |
| Restart persistence | ✅ Complete | All subtitle columns survive DB close/reopen |
| Human-readable subtitle errors | ✅ Complete | `formatSubtitleError()` maps all codes |
| IPC channels (3) | ✅ Complete | `subtitle:selectForProject`, `subtitle:parseForProject`, `subtitle:clearForProject` |

### Queue

| Feature | Status | Notes |
|---|---|---|
| List render jobs | ✅ Complete | Read-only list, ordered by `updated_at DESC` |
| Create demo job | ✅ Complete | Stub only — inserts record with status `queued`, no actual FFmpeg execution |
| Queue status display | ✅ Complete | Renders queued/running/completed/failed/cancelled states |

### Settings

| Feature | Status | Notes |
|---|---|---|
| Get/update settings | ✅ Complete | Theme, FFmpeg/FFprobe override paths, output dir, diagnostics flag |
| FFmpeg path override | ✅ Complete | Binary name validation, DB persist |
| FFprobe path override | ✅ Complete | Binary name validation, DB persist |
| Default output directory override | ✅ Complete | Dialog picker, DB persist |

### System capabilities

| Feature | Status | Notes |
|---|---|---|
| FFmpeg availability check | ✅ Complete | `ffmpeg -version` / `ffprobe -version`; returns version string |
| Database health check | ✅ Complete | Returns `ok`, `dbPath`, `migrationsApplied` |
| System capabilities panel | ✅ Complete | Shows app version, platform, DB health, FFmpeg status in Settings |

### Database

| Component | Status | Notes |
|---|---|---|
| Drizzle ORM + better-sqlite3 | ✅ Complete | Main process only |
| Migration `0000_initial.sql` | ✅ Complete | Creates `projects`, `app_settings`, `render_jobs` |
| Migration `0001_media_inspection.sql` | ✅ Complete | Adds 9 media metadata columns to `projects` |
| Migration `0002_subtitle_parsing.sql` | ✅ Complete | Adds 5 subtitle columns to `projects` + `subtitle_documents` table |
| Migration `0003_sync_check.sql` | ✅ Complete | Adds 4 sync columns to `projects` (sync_status, sync_checked_at, sync_warnings_json, sync_analysis_version) |
| Parameterized queries only | ✅ Complete | No string interpolation |

### Subtitle synchronization check (M3)

| Feature | Status | Notes |
|---|---|---|
| SynchronizationAnalyzer | ✅ Complete | Pure timing analysis, 5 warning codes, no IO |
| SynchronizationService | ✅ Complete | Orchestration: DB reads + analyze + persist |
| sync:checkForProject IPC channel | ✅ Complete | UUID-validated input, structured output |
| SyncPanel renderer | ✅ Complete | 6-state display, relative timestamps, warning list |
| Stale detection | ✅ Complete | Computed from syncCheckedAt vs inspectedAt/subtitleParsedAt |

### Video preview workspace (M4 — CLOSED)

| Feature | Status | Notes |
|---|---|---|
| Local video protocol (`local:///video/{uuid}`) | ✅ Complete | `registerSchemesAsPrivileged` + `protocol.handle`, range support, lstat symlink check |
| VideoService | ✅ Complete | `resolveVideoPath`, `getPlaybackUrl`, `getCues` |
| IPC channels | ✅ Complete | `video:getPlaybackUrl`, `video:getCues` |
| Preload bridge (video namespace) | ✅ Complete | Input validation, narrow typed API |
| CSP update | ✅ Complete | `media-src 'self' local:` added |
| `useVideoPlayer` hook | ✅ Complete | State machine: `not_ready/loading/paused/playing/error` |
| VideoPlayer component | ✅ Complete | Purely presentational, video-bg/video-fg tokens |
| CueList component | ✅ Complete | Scrollable, active-cue highlighting, auto-scroll |
| SubtitleOverlay component | ✅ Complete | Centered overlay, token-based colors |
| PreviewPage | ✅ Complete | Lifted state, canPreview gate, two-column layout |
| Design tokens | ✅ Complete | `--video-bg`, `--video-fg` with opacity modifier support |
| Component usage docs | ✅ Complete | `docs/design/components/{VideoPlayer,CueList,SubtitleOverlay,PreviewPage}.md` |

### Governance and QA

| Component | Status | Notes |
|---|---|---|
| `pnpm validate` (full composite) | ✅ Green | governance + typecheck + lint + test + build |
| 353 unit tests | ✅ Pass | 27 test files |
| 22 visual regression tests | ✅ Pass | Light + dark; all pages including preview |
| 41 E2E (Playwright browser QA) | ✅ Pass | |
| Architecture boundary enforcement | ✅ Active | `pnpm architecture:validate` |
| Dependency policy enforcement | ✅ Active | `pnpm dependencies:validate` |
| CI SHA pinning | ✅ Active | All 4 workflows pinned |

---

## What is NOT implemented

### Clip selection (gap — target of M7+)

| Missing Feature | Impact |
|---|---|
| Subtitle segment selection | No UI for selecting segments to clip |
| Clip time bounds review | No timeline visualization |
| Clip metadata (title, note) | No clip-level metadata |

### Clip generation (gap — target of M12+)

| Missing Feature | Impact |
|---|---|
| FFmpeg encoding via subtitle timestamps | No actual FFmpeg -ss/-to execution |
| Render job real progress | `progress` field always stays at 0 (demo jobs) |
| Worker thread for FFmpeg | FFmpeg encoding blocks main thread if inlined |
| Output file management | No file browser, no open-in-finder |

### Post-MVP (explicitly out of scope)

| Feature | Notes |
|---|---|
| AI provider configuration UI | Planned in M6 — not yet implemented |
| AI-assisted clip selection | No AI providers, no model calls |
| Remote publishing | No cloud APIs |
| Subtitle translation | No translation services |
| Batch export | No batch workflows |
| Collaborative review | Local-only |

---

## Honest placeholder inventory

These UI elements exist but are fake or non-functional:

| Location | Placeholder | Reality |
|---|---|---|
| `ProjectsPage.tsx` | "Candidate generation, timeline editing, and rendering are not yet available." | Accurate disclaimer |
| `project.status` | Shows `draft` status pill for all projects | Status field is never updated post-creation |
| `queue.createDemoJob` | Creates a queued job record | No FFmpeg execution, job stays `queued` forever |
| `projects.status === 'active'` branch | StatusPill shows "ok" for active | No project ever reaches `active` status |

---

## Source-of-truth files consulted

- `src/database/schema.ts` — table definitions
- `src/database/migrations/` — 3 migrations
- `src/shared/ipc/channels.ts` — IPC channels
- `src/shared/ipc/contracts.ts` — all Zod contracts
- `src/shared/api/sceneSiftApi.ts` — renderer API surface
- `src/main/ipc/registerIpcHandlers.ts` — handler implementations
- `src/main/services/subtitle/` — subtitle service + parsers + reader
- `src/main/services/database/databaseService.ts` — repository methods
- `src/renderer/features/projects/ProjectsPage.tsx`
