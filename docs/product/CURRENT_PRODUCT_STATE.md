# SceneSift — Current Product State

Date: 2026-07-19 (original audit), status section added 2026-11-22
Status: M1 (media inspection) and M2 (subtitle parsing) are merged on `main`. The sections after "Original audit" describe the repository before those merges and are kept as a record.

---

## Status on `main` as of 2026-11-22 (commit `5633c8e`)

Verified by reading source. The traced workflows and file references are in `docs/ARCHITECTURE.md`.

### Implemented

| Capability | Evidence |
|---|---|
| Project create, list, view, delete | `src/main/services/database/databaseService.ts`, `src/renderer/features/projects/` |
| Media inspection with FFprobe on request (M1) | `src/main/services/ffmpeg/ffmpegService.ts` `inspectMediaFile`, migration `0001_media_inspection.sql`, channel `project:inspect` |
| SRT and WebVTT parsing with limits and warnings (M2) | `src/main/services/subtitle/`, migration `0002_subtitle_parsing.sql`, channels `subtitle:*` |
| Settings, capability checks, queue page | unchanged from the original audit |
| Browser QA fixture mode for tests | `src/renderer/qa/`, `pnpm qa:serve` |

### Not implemented on `main`

- A cue list: no IPC method returns cues, the panel shows counts only
- Video playback, timeline, range selection, clips
- Subtitle export, rebasing or editing
- FFmpeg clip generation; the queue runs no job
- ASS parsing (`.ass` can be selected and is then reported as unsupported)
- Any AI feature
- Any browser product runtime; the browser QA mode serves fixtures only

### Planned next

The owner opened issues #1 to #6 on 2026-11-21 for an offline browser clip-review track. They are organized under epic #8, which holds the ordered tickets, dependencies and estimates. Nothing in that epic is implemented.

### Feature readiness gate

`docs/governance/FEATURE_READINESS_GATE.md` shows READY as of 2026-07-19. ADR-012 asks for a re-run after each feature milestone; M1 and M2 were merged after that date and the gate was not re-run. Two of its blocking conditions are open on 2026-11-22: `pnpm validate` is unreliable on a default Windows checkout (issue #9), and `pnpm security:scan` reports two high advisories in production dependencies (issue #5). The condition "browser QA mock can leak into production" was checked: a production build contained no fixture strings. The re-run is the first step of issue #1.

### Needs verification

- Whether `AppError.code` reaches the renderer as a property after Electron serializes an IPC error
- `pnpm test:electron` and `pnpm package:dir` were not run in the 2026-11-22 check
- The two high advisories reported by `pnpm security:scan` (issue #5)

## Requirement documents and where they disagree

There is no single PRD. Requirements are spread over these files, which were written at different times:

| Document | What it defines | State |
|---|---|---|
| `docs/product/MVP_SCOPE.md`, `MVP_ROADMAP.md` | MVP as M1 to M4: inspect, parse, select clips by subtitle entry, generate with FFmpeg | M1 and M2 done. M3 and M4 not started. Still says feature development has not started. |
| `docs/product/ROADMAP.md` | A longer plan, M1 to M20, with different numbering (M3 sync check, M4 video preview, M6 AI provider, M12 rendering) | Header updated on 2026-11-22. M3 to M11 exist only on unmerged branches. |
| `docs/ROADMAP.md` | Phases 2 to 5 | Undated. Lists inspection and parsing as future work. |
| `README.md` (rewritten in open PR #7) and issues #1 to #6 | The offline browser clip-review track | Newest statement of intent. Not reflected in the three documents above. |

Material drift, most important first:

1. **The browser track is not in any product document.** `MVP_SCOPE.md` lists video preview, timeline editing and custom clip bounds as excluded from the MVP. Issues #1 to #4 require all three, in a browser runtime that no document describes. The first ticket of epic #8 records the decision in an ADR and in the roadmap before code is written.
2. **Three milestone numberings.** "M3" means clip selection in `MVP_ROADMAP.md`, sync check in `docs/product/ROADMAP.md`, and nothing in `docs/ROADMAP.md`. Name the document when citing a milestone.
3. **Unmerged work.** Branches `origin/feature/m3-subtitle-synchronization` through `origin/feature/m11-composition-settings` form one linear stack (up to 51 commits ahead of `main`, about 30,000 added lines) with sync check, an Electron video preview, AI provider, clip candidates, review, timing editor, subtitle editing and composition settings. None of it is on `main`. Whether it will be merged, mined or dropped is an open owner decision; the browser epic does not depend on it.
4. **Subtitle storage differs from the plan.** `MVP_ROADMAP.md` planned a `subtitle_entries` table and a `project:parseSubtitles` channel. The code stores one JSON document per project in `subtitle_documents` and uses `subtitle:parseForProject`.
5. **Rule files point at paths and scripts that do not exist**: `src/main/services/database/migrations/` (real: `src/database/migrations/`), `src/renderer/tokens/`, `docs/design/components/`, `docs/governance/DATA_PRIVACY.md` (real: `DATA_GOVERNANCE.md`), `tests/ai/`, `tests/media/`, `tests/database/`, and scripts `pnpm test:renderer`, `pnpm test:media`, `pnpm test:database`. The correct commands are in `CLAUDE.md`.

---

## Original audit (2026-07-19, before M1 and M2)

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
