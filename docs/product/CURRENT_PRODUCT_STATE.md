# SceneSift — Current Product State

Date: 2026-07-19
Status: Governance milestone complete. Feature development not yet started.

---

## Summary

SceneSift is an Electron desktop app with a working shell, navigation, project CRUD, queue visibility, and settings. No clip workflow capability exists. The gap between "create a project" and "produce a clip" is entirely unimplemented.

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
| Project detail panel (UI) | ✅ Complete | Shows paths, status pill |
| Project status field | ✅ Partial | Schema has `draft`/`active`/`archived`; all projects created as `draft`; no status transitions |

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
| Single migration `0000_initial.sql` | ✅ Complete | Creates `projects`, `app_settings`, `render_jobs` |
| Parameterized queries only | ✅ Complete | No string interpolation |

### Governance and QA

| Component | Status | Notes |
|---|---|---|
| `pnpm validate` (full composite) | ✅ Green | governance + typecheck + lint + test + build |
| 89 unit tests (64 adversarial) | ✅ Pass | |
| 9 visual regression tests | ✅ Pass | 7 light, 2 dark |
| E2E (Playwright browser QA) | ✅ Pass | |
| Architecture boundary enforcement | ✅ Active | `pnpm architecture:validate` |
| Dependency policy enforcement | ✅ Active | `pnpm dependencies:validate` |
| CI SHA pinning | ✅ Active | All 4 workflows pinned |

---

## What is NOT implemented

### Media inspection (first gap — target of slice 1)

| Missing Feature | Impact |
|---|---|
| FFprobe media metadata extraction | Cannot display duration, resolution, codec, fps |
| Media metadata DB storage | Projects have no video metadata columns |
| Project status transitions | Status permanently `draft`; no path to `active` |
| File accessibility validation | No check that the stored video path is still reachable |

### Subtitle handling (gap — target of slice 2)

| Missing Feature | Impact |
|---|---|
| .srt / .vtt parsing | Subtitle content is stored as a path only; no entries, no timestamps |
| Subtitle display | No subtitle segment viewer |
| Subtitle error handling | Malformed or missing subtitle is not surfaced |

### Clip selection (gap — target of slice 3)

| Missing Feature | Impact |
|---|---|
| Subtitle segment selection | No UI for selecting segments to clip |
| Clip time bounds review | No timeline visualization |
| Clip metadata (title, note) | No clip-level metadata |

### Clip generation (gap — target of slice 4)

| Missing Feature | Impact |
|---|---|
| FFmpeg encoding via subtitle timestamps | No actual FFmpeg -ss/-to execution |
| Render job real progress | `progress` field always stays at 0 (demo jobs) |
| Worker thread for FFmpeg | FFmpeg encoding blocks main thread if inlined |
| Output file management | No file browser, no open-in-finder |
| Error recovery for failed renders | No retry; job stays `failed` permanently |

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
| `ProjectsPage.tsx:165` | "Candidate generation, timeline editing, and rendering are not yet available." | Accurate disclaimer |
| `project.status` | Shows `draft` status pill for all projects | Status field is never updated post-creation |
| `queue.createDemoJob` | Creates a queued job record | No FFmpeg execution, job stays `queued` forever |
| `projects.status === 'active'` branch | StatusPill shows "ok" for active | No project ever reaches `active` status |

---

## Source-of-truth files consulted

- `src/database/schema.ts` — table definitions
- `src/database/migrations/0000_initial.sql` — single migration
- `src/shared/ipc/channels.ts` — 19 IPC channels
- `src/shared/ipc/contracts.ts` — all Zod contracts
- `src/shared/api/sceneSiftApi.ts` — renderer API surface
- `src/main/ipc/registerIpcHandlers.ts` — handler implementations
- `src/main/services/ffmpeg/ffmpegService.ts` — capability detection only
- `src/main/services/process/runCommand.ts` — child process utility
- `src/main/services/database/databaseService.ts` — repository methods
- `src/renderer/features/projects/ProjectsPage.tsx`
- `src/renderer/features/projects/CreateProjectForm.tsx`
- `src/renderer/qa/fixtures.ts`
- `src/renderer/qa/mockSceneSiftApi.ts`
