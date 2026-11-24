# SceneSift

SceneSift is a local-first desktop tool for transforming long-form video episodes into reviewable short-form clip candidates.

## Program goal

Build a local-first video review and clipping studio: read the media files itself, understand long episodes by speech, shot and structure on the local machine, let an editor refine every clip, and render subtitled results that are frame-exact and repeatable.

The program is planned ([#59](https://github.com/jortega0033/scene-sift/issues/59)). Stage 1 is the current epic [#8](https://github.com/jortega0033/scene-sift/issues/8) and the only stage with tickets.

**Score.** Share of a fixed, licence-clean episode set where cuts, cue times and clip boundaries are within one frame of hand-made labels, with the clip ranking quality next to it.

| Stage | Content | Hours (rough) | Issue |
|---|---|---|---|
| 1 | The current epic and its tickets | 80 to 130 | [#8](https://github.com/jortega0033/scene-sift/issues/8) |
| 2 | Media engine | 130 to 220 | [#60](https://github.com/jortega0033/scene-sift/issues/60) |
| 3 | Subtitles | 110 to 190 | [#61](https://github.com/jortega0033/scene-sift/issues/61) |
| 4 | Understanding | 150 to 250 | [#62](https://github.com/jortega0033/scene-sift/issues/62) |
| 5 | Editing and rendering | 140 to 240 | [#63](https://github.com/jortega0033/scene-sift/issues/63) |
| 6 | Library and trust | 120 to 200 | [#64](https://github.com/jortega0033/scene-sift/issues/64) |

About 730 to 1230 engineer hours in total: rough estimates, not measurements. The numbers in the score and the finish lines are targets until a run shows them. Only stage 1 has tickets to work; the sub-issues of a later stage are written when it starts. No single session is expected to reach the end.

## Milestone scope (implemented now)

This repository currently implements a **production-grade Electron boilerplate**:

- Secure Electron app shell
- Typed IPC bridge (main ↔ preload ↔ renderer)
- React desktop UI with Projects / Queue / Settings
- Native file selection for video/subtitle/output directory
- FFmpeg/FFprobe capability checks
- SQLite + Drizzle schema and migrations
- Minimal project CRUD workflow
- Queue foundation with status model
- Local settings persistence
- Unit/component tests, linting, type checking, packaging config

## Not implemented yet

- AI clip candidate generation
- Subtitle parsing/rebasing/editing
- FFmpeg clipping/transcoding pipelines
- Subtitle burn-in rendering
- Transcription/translation
- Social publishing

## Technology stack

- Electron + TypeScript strict
- React + Vite + Tailwind
- Zustand + TanStack Query + React Hook Form + Zod
- better-sqlite3 + Drizzle ORM
- Vitest + React Testing Library + Playwright smoke test
- Electron Builder

## Architecture

- `src/main`: privileged process (window lifecycle, dialogs, ffmpeg checks, db, IPC handlers)
- `src/preload`: narrow `contextBridge` API (`window.sceneSift`)
- `src/renderer`: UI layer (no direct Node/Electron internals)
- `src/shared`: cross-process contracts, schemas, constants
- `src/database`: Drizzle schema and SQL migrations

See `docs/ARCHITECTURE.md` for detail.

## Prerequisites

- Node.js 20+
- pnpm 10+
- FFmpeg/FFprobe installed (optional but recommended for capability checks)

## Installation

```bash
pnpm install
```

## Development

```bash
pnpm dev
```

## Validation

```bash
pnpm validate
pnpm governance:validate
```

## Testing

```bash
pnpm test
pnpm test:e2e
pnpm governance:scenarios
```

## Database migrations

Generate migrations:

```bash
pnpm db:generate
```

Apply migrations:

```bash
pnpm db:migrate
```

Runtime app migrations are also applied automatically on startup.

## Packaging

Build unpacked app:

```bash
pnpm package:dir
```

Build installable artifacts:

```bash
pnpm package
```

After Electron packaging rebuilds native modules for Electron ABI, run `pnpm rebuild better-sqlite3` before running Node-based test suites again.

Targets:

- macOS: DMG + ZIP
- Windows: NSIS

## FFmpeg setup

SceneSift checks:

1. Settings override path
2. Bundled path (`resources/ffmpeg/...`) for future bundling
3. System binaries (`ffmpeg`, `ffprobe`)

Missing binaries are reported in UI status, without crashing renderer.

## Security model

- `nodeIntegration: false`
- `contextIsolation: true`
- `sandbox: true`
- No raw `ipcRenderer` exposed
- Input/output validation through Zod in IPC handlers
- Controlled navigation/new-window behavior
- Safe process execution (`spawn` with arg arrays, `shell: false`)

See `docs/SECURITY.md`.

## AI governance and guardrails

Repository-local governance artifacts are under:

- `.github/copilot-instructions.md`
- `.github/instructions/*`
- `.github/agents/*`
- `gate.yaml`, `AGENTS.md`, `LOOP.md`, `STATE.md`
- `docs/governance/*`

Development-agent governance and runtime-product governance are intentionally separated.

## Known limitations

- Queue does not execute real FFmpeg jobs yet
- No media probing pipeline yet
- No subtitle editor yet
- No AI provider integration yet
- Playwright smoke requires a compatible display/runtime environment

## Next recommended milestone

Phase 2: Add FFprobe media inspection + subtitle parsing and synchronization offsets in a project workspace.
