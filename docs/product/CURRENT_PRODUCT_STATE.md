# SceneSift — Current Product State

Date: 2026-07-19
Status: M2 CLOSED. M3 planning in progress.

---

## Summary

SceneSift is an Electron desktop app with a working shell, navigation, project CRUD, queue visibility, settings, media inspection, and subtitle parsing. No clip workflow capability exists. The gap between "parse a subtitle" and "produce a clip" is entirely unimplemented.

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
| Parameterized queries only | ✅ Complete | No string interpolation |

### Governance and QA

| Component | Status | Notes |
|---|---|---|
| `pnpm validate` (full composite) | ✅ Green | governance + typecheck + lint + test + build |
| 223 unit tests | ✅ Pass | 20 test files |
| 13 visual regression tests | ✅ Pass | Light + dark |
| 29 E2E (Playwright browser QA) | ✅ Pass | |
| Architecture boundary enforcement | ✅ Active | `pnpm architecture:validate` |
| Dependency policy enforcement | ✅ Active | `pnpm dependencies:validate` |
| CI SHA pinning | ✅ Active | All 4 workflows pinned |

---

## What is NOT implemented

### Subtitle synchronization check (gap — target of M3)

| Missing Feature | Impact |
|---|---|
| Structural timing analysis vs. video metadata | Cannot detect cues outside video range, large span mismatch |
| Synchronization state machine | No sync status persisted |
| Optional global offset | No way to correct timing without editing source |

### Clip selection (gap — target of M4+)

| Missing Feature | Impact |
|---|---|
| Subtitle segment selection | No UI for selecting segments to clip |
| Clip time bounds review | No timeline visualization |
| Video preview workspace | No preview |
| Clip metadata (title, note) | No clip-level metadata |

### Clip generation (gap — target of M5+)

| Missing Feature | Impact |
|---|---|
| FFmpeg encoding via subtitle timestamps | No actual FFmpeg -ss/-to execution |
| Render job real progress | `progress` field always stays at 0 (demo jobs) |
| Worker thread for FFmpeg | FFmpeg encoding blocks main thread if inlined |
| Output file management | No file browser, no open-in-finder |

### Post-MVP (explicitly out of scope)

| Feature | Notes |
|---|---|
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
