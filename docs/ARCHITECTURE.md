# SceneSift Architecture (Legacy Summary)

> Authoritative baseline: `docs/architecture/ARCHITECTURE.md`

## Process boundaries

### Electron main process

- Owns native capabilities:
  - BrowserWindow lifecycle
  - Native dialogs
  - SQLite initialization and migrations
  - FFmpeg/FFprobe execution checks
  - Typed IPC handler registration

### Electron preload

- Exposes a narrow `window.sceneSift` API via `contextBridge`.
- No generic invoke/send methods are exposed.

### React renderer

- Consumes only typed API methods from `window.sceneSift`.
- Contains UI state (Zustand), async state (TanStack Query), and forms (React Hook Form + Zod).
- No direct `fs`, `child_process`, `ipcRenderer`, or DB access.

## Core modules

- `src/main/services/database/databaseService.ts`
  - project CRUD
  - settings persistence
  - queue records
  - health status
- `src/main/services/ffmpeg/ffmpegService.ts`
  - ffmpeg/ffprobe binary discovery and version checks
- `src/main/services/files/dialogService.ts`
  - safe file and directory selection with extension constraints
- `src/main/ipc/registerIpcHandlers.ts`
  - static channel registration and validation

## Data model

- `projects`
- `app_settings`
- `render_jobs`

Migrations are stored in `src/database/migrations`.

## Current workflow

1. User opens Projects page
2. User creates project with video (+ optional subtitle/output dir)
3. Project is validated then persisted to SQLite
4. Project can be viewed and deleted with confirmation
5. Queue page reflects queue records
6. Settings page persists local app settings
