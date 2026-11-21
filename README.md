# SceneSift

SceneSift is a local-first Electron tool for organizing long-form video review. It manages review projects, inspects video with FFprobe, and parses SRT and WebVTT subtitles. Timeline review and clip export are on the roadmap.

[MIT license](LICENSE)

## What works today

Everything below runs in the Electron app and is backed by code in `src/`.

- **Projects.** Create a project from a video path, with an optional subtitle path and optional output directory. List, view and delete projects. Data lives in a local SQLite database.
- **Media inspection.** The Inspect media button in the project panel runs FFprobe on the project's video file. It stores duration, width, height, video codec, frame rate, bit rate and file size, then marks the project `ready`. Missing files and probe failures show a status on the project. Inspection has a 15-second timeout and a 1 MiB output cap.
- **Subtitle import and validation.** Select a subtitle file for a project, then run Parse subtitle. Format is chosen by file extension, `.srt` or `.vtt`. Any other extension, including `.ass`, is reported as unsupported. Limits are 2 MB per file, 10,000 cues, 1 MiB of total cue text and 2,048 characters per cue. The result is a status of `ready`, `ready_with_warnings`, `parse_failed`, `unsupported` or `missing`, plus cue count and last cue end time. The panel reports issues such as invalid timing, overlaps, truncation, and unsupported VTT features. Parsed cues are stored in the `subtitle_documents` table. Clearing the subtitle removes them.
- **Settings.** Theme, FFmpeg and FFprobe override paths, and a default output directory.
- **Capability checks.** The Settings page reports app version, platform, database health and FFmpeg/FFprobe availability.
- **Queue page.** Lists render jobs and can create a demo job. A demo job is a database record only. No FFmpeg job runs.

The subtitle panel shows counts, timing and warnings. It does not list or edit individual cues yet.

## Planned product work

- Playing or scrubbing media inside the app
- Timeline, range selection or clip creation
- Clip export, FFmpeg clipping or transcoding
- Subtitle editing, clipping, rebasing or burn-in
- ASS/SSA subtitle parsing
- Real queue execution and progress

## Browser QA fixture bridge

`pnpm qa:serve` starts the renderer in a normal browser with `VITE_SCENESIFT_BROWSER_QA=1`. In that mode `src/renderer/qa/installBridge.ts` installs a mock `window.sceneSift` from `src/renderer/qa/mockSceneSiftApi.ts` and canned data from `src/renderer/qa/fixtures.ts`. Without the flag and without Electron's preload, the renderer throws an error on startup. See [the browser QA adapter decision](docs/architecture/adr/ADR-006-browser-qa-adapter.md).

The bridge provides fixed media and subtitle results for UI tests and screenshots. Real media and subtitle files are handled by the Electron app.

## Proposed offline browser clip review

The next track would add a localhost browser runtime alongside the supported Electron app. Its offline acceptance run would use generated silent video and fictional subtitle files.

- **Local generated fixtures.** Generate a silent video with local FFmpeg and matching SRT and VTT fixtures with known timings.
- **Real browser adapter.** Document an explicit browser entry point and define a focused browser contract for file selection, inspection and playback. Use browser media APIs or a loopback service for local assets. Update the architecture decision before implementation and preserve the Electron preload and QA bridge behavior.
- **Timeline and range review.** Play the media, mark a start and end on a timeline and adjust the range.
- **Keyboard review.** Every review action reachable and testable from the keyboard.
- **Persisted, revision-aware projects.** Projects and clip ranges survive reloads. Each edit records a revision so stale writes are detected.
- **Clipped and rebased subtitles.** Export the cues inside a clip range as SRT or VTT, with times shifted so the clip starts at zero.
- **Repeatable offline acceptance check.** One command generates fixtures, drives the browser through the workflow above and verifies the exported subtitle files.

See the [browser release acceptance issue](https://github.com/jortega0033/scene-sift/issues/6) for the milestone checks. Desktop package readiness is tracked separately.

## Technology stack

- Electron and TypeScript (strict)
- React, Vite and Tailwind
- Zustand, TanStack Query, React Hook Form and Zod
- better-sqlite3 and Drizzle ORM
- Vitest, React Testing Library and Playwright
- Electron Builder

## Architecture

- `src/main`: privileged process (window lifecycle, dialogs, FFmpeg and FFprobe, database, IPC handlers, subtitle parsing)
- `src/preload`: narrow `contextBridge` API exposed as `window.sceneSift`
- `src/renderer`: UI layer with no direct Node or Electron access
- `src/shared`: cross-process contracts, schemas and constants
- `src/database`: Drizzle schema and SQL migrations (`0000_initial`, `0001_media_inspection`, `0002_subtitle_parsing`)

The [architecture baseline](docs/architecture/ARCHITECTURE.md) and [decision records](docs/architecture/adr/) document the structure. Use the [M2 audit](docs/product/M2_ACCEPTANCE_AUDIT.md) for the subsequent subtitle milestone.

## Prerequisites

- Node.js 22.12 or later in the 22.x release line, matching CI
- pnpm 10, matching CI
- FFmpeg and FFprobe on the system path or set in Settings. The app starts without them. Inspect media needs FFprobe.

## Quickstart

```bash
pnpm install --frozen-lockfile
pnpm dev
```

`pnpm dev` runs the Vite renderer, watches the main and preload bundles and launches Electron.

## Validation

```bash
pnpm validate
pnpm governance:validate
```

`pnpm validate` runs governance, architecture, design and dependency checks, then typecheck, lint, unit tests and build. `pnpm validate:full` adds Playwright browser tests, visual tests, the Electron smoke test, `pnpm package:dir` and baseline generation.

## Testing

```bash
pnpm test
pnpm test:e2e
pnpm test:visual
pnpm test:electron
pnpm governance:scenarios
```

- `pnpm test` runs Vitest with coverage.
- `pnpm test:e2e` and `pnpm test:visual` run Playwright against `pnpm qa:serve`, so they exercise the QA fixture bridge with mock data.
- `pnpm test:electron` builds the app and runs the Electron smoke test. It needs a display that can launch Electron.
- `pnpm test:qa` runs all three Playwright suites in sequence.

## Database migrations

```bash
pnpm db:generate
pnpm db:migrate
```

Migrations are also applied automatically at app startup.

## Packaging

```bash
pnpm package:dir
pnpm package
```

`package:dir` builds an unpacked app and `package` builds installers. Targets come from `electron-builder.yml`, DMG and ZIP on macOS and NSIS on Windows. Signing and notarization are not configured in this repository.

Packaging rebuilds native modules for the Electron ABI. Run `pnpm rebuild better-sqlite3` before running Node-based tests again.

## FFmpeg setup

SceneSift looks for each binary in this order:

1. The override path in Settings. The file name must match the expected binary name.
2. A bundled path under `resources/ffmpeg`, reserved for future bundling.
3. `ffmpeg` and `ffprobe` on the system path.

Missing binaries are shown in the Settings status panel and the renderer keeps running.

## Security model

- `nodeIntegration: false`, `contextIsolation: true` and `sandbox: true`
- No raw `ipcRenderer` and no generic invoke exposed to the renderer
- Zod validation of IPC inputs and outputs
- Controlled navigation and new-window behavior
- Child processes start with `spawn`, argument arrays and `shell: false`
- Subtitle files are size-limited and parsed in the main process

Details are in [the security notes](docs/SECURITY.md).

## Maintainer and contributor notes

Rules for automated and human contributors live in these files:

- `AGENTS.md`, `gate.yaml` and `loop-constraints.md` for standing rules, path risk levels and forbidden actions
- `LOOP.md` and `STATE.md` for process and current run state
- `CLAUDE.md`, `.github/copilot-instructions.md`, `.github/instructions/` and `.github/agents/`
- `docs/governance/` for policies and evidence records

Use [gate.yaml](gate.yaml) and [AGENTS.md](AGENTS.md) to classify changes and find the review and approval requirements. Documentation checks include `pnpm governance:validate`.

Further docs: `docs/DEVELOPMENT.md`, `docs/ROADMAP.md` and `docs/product/`. Several product documents there are dated and describe earlier milestones, so prefer the source code when they disagree.

## Known limitations

- Inspect media runs only when requested. Creating a project does not inspect it.
- The queue runs no FFmpeg jobs.
- There is no subtitle cue viewer or editor.
- ASS subtitles are rejected as unsupported.
- Browser tests use mocked data. Only the Electron app handles real files.
- The recorded production dependency audit findings are tracked in [the desktop release issue](https://github.com/jortega0033/scene-sift/issues/5).
