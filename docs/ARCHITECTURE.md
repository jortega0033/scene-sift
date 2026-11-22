# SceneSift Architecture (As-Built Notes)

> Authoritative baseline and rules: `docs/architecture/ARCHITECTURE.md` and the ADRs in `docs/architecture/adr/`.
> This file describes what the code on `main` does. It was re-verified against source at commit `5633c8e` on 2026-11-22. When this file and the code disagree, the code wins: fix this file.

Each statement below is marked by how it was established:

- **Implemented**: read in source on `main`.
- **Planned**: tracked in a GitHub issue, not in source.
- **Needs verification**: not confirmed by reading or running.

## Process boundaries (implemented)

| Layer          | Path                   | Owns                                                                                                                                          |
| -------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Renderer       | `src/renderer/**`      | React UI, Zustand UI state, TanStack Query. Talks only to `window.sceneSift`.                                                                 |
| Preload        | `src/preload/index.ts` | The `contextBridge` object. One fixed `ipcRenderer.invoke` per method. No generic invoke. It forwards arguments without validating them.      |
| Shared         | `src/shared/**`        | Zod schemas, the `SceneSiftApi` type (`api/sceneSiftApi.ts`), channel names (`ipc/channels.ts`, 22 channels), contracts (`ipc/contracts.ts`). |
| Main           | `src/main/**`          | Window, CSP, navigation guard, IPC handlers, services (database, FFprobe, dialogs, subtitle parsing, jobs).                                   |
| Database files | `src/database/**`      | Drizzle schema and SQL migrations only. `client.ts` is not imported by the app.                                                               |

SQLite is opened in one place: `DatabaseService` in `src/main/services/database/databaseService.ts`. The file is `<userData>/database/scenesift.sqlite`. Migrations from `src/database/migrations` run on every start (`src/main/index.ts`, `DatabaseService.initialize`).

`BrowserWindow` uses `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`, `webSecurity: true` (`src/main/windows/createMainWindow.ts`). The production CSP in `src/main/security/csp.ts` has `default-src 'self'` and no `media-src`, so a `blob:` or custom-scheme video source would be blocked in Electron today.

## What enforces the boundaries (implemented)

`pnpm architecture:validate` runs `scripts/quality/architecture-validate.ts`. It checks:

- top-level `src/` folders are limited to `main`, `preload`, `renderer`, `shared`, `database`, `assets`
- renderer does not import `@main/`, `@database/`, `electron` or `node:`
- shared does not import `@renderer/`, `@main/`, `@preload/`, `electron` or `node:`
- main and preload do not import `@renderer/`
- `@renderer/qa/` appears only in `src/renderer/main.tsx`, and there only as `@renderer/qa/installBridge`. This is a substring match on the file text, so the string in a comment of any other file also fails.
- process spawning only in `src/main/services/ffmpeg/` and `src/main/services/process/runCommand.ts`
- `better-sqlite3` only in `src/main/services/database/` and `src/database/`
- `src/main/ipc/registerIpcHandlers.ts` refers to `IPC_CHANNELS.`
- every `*Page.tsx` has a visual spec in `tests/visual` with the page name in its file name

Limits of that script: it matches alias imports only, so a relative import such as `../../main/...` is not caught. ESLint has no import-boundary rule. Reviewers must check relative imports by hand.

## Traced workflow 1: parse a subtitle file (implemented)

Precondition: the project has a subtitle path. "Select subtitle" stores the path and sets `subtitle_status = 'selected'` (`subtitle:selectForProject`).

1. `src/renderer/features/projects/ProjectsPage.tsx`: the Parse subtitle button calls the `useParseSubtitleForProject` mutation.
2. `src/renderer/hooks/useProjects.ts`: calls `window.sceneSift.subtitle.parseForProject(projectId)` and invalidates the `['projects']` query on success.
3. `src/preload/index.ts`: `ipcRenderer.invoke('subtitle:parseForProject', { projectId })`.
4. `src/main/ipc/registerIpcHandlers.ts` registers the channel through `registerValidatedHandler` (`src/main/ipc/createIpcHandler.ts`). Input is parsed with Zod (`{ projectId: uuid }`), the handler runs, output is parsed with `projectSchema`. Any error is rethrown as an `AppError` built by `toSafeError` (`src/main/utils/errors.ts`).
5. `src/main/services/subtitle/subtitleService.ts` `parseSubtitleForProject`: loads the project, picks the format from the file extension (`.srt`, `.vtt`; anything else, including `.ass`, is stored as `unsupported`).
6. `subtitleReader.ts` (Node only): opens the file, rejects non-files, enforces 2 MiB, decodes UTF-8, strips the BOM, converts CRLF and CR to LF.
7. `parsers/SrtParser.ts` or `parsers/VttParser.ts` return `{ cues, warnings }`. `subtitleNormalizer.ts` adds warnings for zero or negative duration, out-of-order and overlapping cues. It does not reorder or repair cues.
8. `DatabaseService.persistSubtitleResult`: one transaction. It drops the result if the project's subtitle path changed in the meantime, updates the project's subtitle columns, and upserts one row in `subtitle_documents` with the cues as JSON (`cues_json`).
9. The handler returns the project record. It carries `subtitleStatus`, `subtitleCueCount`, `subtitleLastCueEndMs`, `subtitleParseError`, `subtitleParsedAt`. It carries no cues.
10. The panel re-renders from the refreshed query using `subtitleFormatters.ts`.

Observable result: a row in `subtitle_documents`, updated columns on `projects`, and the cue count, last cue time and warning badge in the project panel.

Facts an implementer should know:

- **No IPC method returns cues.** `DatabaseService.getSubtitleDocument` exists but is called only from tests. The renderer cannot list cue text today.
- The three parser files import only types from `@shared/schemas/subtitle`. They use no Node or Electron API. The Node-bound part is `subtitleReader.ts`. The parsers assume LF-only input, so any other caller must repeat the BOM strip and line-ending conversion.
- `subtitleLastCueEndMs` is the end of the last cue in file order, not the maximum end time.

## Traced workflow 2: inspect media (implemented)

1. `ProjectsPage.tsx` Inspect media button calls `useInspectProject` (`useProjects.ts`).
2. Preload sends `project:inspect`.
3. The handler in `registerIpcHandlers.ts` loads the project, resolves FFprobe (`checkFfmpegAvailability`), and calls `inspectMediaFile` in `src/main/services/ffmpeg/ffmpegService.ts`.
4. `inspectMediaFile` runs FFprobe through `src/main/services/process/runCommand.ts`: `spawn` with an argument array, `shell: false`, a 15 second timeout and a 1 MiB output cap. It parses the JSON and maps fields.
5. `DatabaseService.updateProjectInspection` stores duration, width, height, codec, frame rate, bit rate and file size, and sets the status to `ready` or `inspection_failed` with a coded reason.
6. The panel shows the values through `mediaFormatters.ts`.

## Data model (implemented)

Tables in `src/database/schema.ts`, created by migrations `0000_initial`, `0001_media_inspection`, `0002_subtitle_parsing`:

- `projects`: paths, status, inspection columns, subtitle summary columns
- `app_settings`
- `render_jobs`: queue records. No FFmpeg job runs; "Create demo job" only inserts a row.
- `subtitle_documents`: one row per project, cues stored as JSON

There are no foreign keys between these tables and no `PRAGMA` statements in `src`.

## Invariants (implemented)

- Cue times are integer milliseconds (`subtitleCueSchema` in `src/shared/schemas/subtitle.ts`). The schema does not require them to be non-negative or ordered.
- Media duration is a nullable float in seconds (`projects.duration_seconds`). The two units differ; convert explicitly.
- Subtitle limits: 2 MiB per file, 10,000 cues, 1,048,576 characters of cue text in total. Cue text longer than 2,048 characters is cut to that length with a `CUE_TEXT_TRUNCATED` warning, not rejected.
- `subtitleStatus`: `not_selected`, `selected`, `parse_failed`, `unsupported`, `missing`, `ready`, `ready_with_warnings`.
- `projectStatus`: `draft`, `ready`, `inspection_failed`, `archived`.
- Errors cross IPC as an `AppError` with `code`, `message`, optional `details`. Whether `code` survives Electron's IPC error serialization as a property on the renderer side **needs verification**.

## Browser QA mode (implemented) and what it is not

`src/renderer/main.tsx` always calls `ensureSceneSiftBridge()` from `src/renderer/qa/installBridge.ts`:

1. If `window.sceneSift` exists (Electron preload), use it.
2. Else if `VITE_SCENESIFT_BROWSER_QA === '1'`, install the mock from `mockSceneSiftApi.ts`.
3. Else throw. There is no silent fallback (ADR-006).

`pnpm qa:serve` serves this mode on `127.0.0.1:4173`. The mock keeps an in-memory array seeded from a named fixture in `fixtures.ts` (`?fixture=<name>`). Its `inspect` and `parseForProject` return fixed numbers. It reads no file and keeps nothing across a reload. The Playwright suites in `tests/e2e` and `tests/visual` all run against it and fail on any request outside loopback (`tests/helpers/networkGuard.ts`).

So the QA mode is a test fixture, not a browser product. On `main` there is no `<video>` element, timeline, range selection, cue list, browser storage or subtitle serializer (`grep` for `<video`, `currentTime`, `indexedDB`, `showOpenFilePicker`, `createObjectURL`, `new Blob` in `src` returns nothing).

`installBridge.ts` imports the mock statically. In a production build made without the QA flag the mock is removed: after `pnpm build` on 2026-11-22 the renderer bundle in `dist/renderer/assets` contained the fail-closed error message and none of the fixture strings (`sample-episode`, `multiple-projects`). A build made with `VITE_SCENESIFT_BROWSER_QA=1` would include it, so never package such a build.

## Planned: offline browser clip review

Tracked in the epic linked from `docs/product/CURRENT_PRODUCT_STATE.md`. Nothing of it is in source. Constraints the current code puts on that work:

- `SceneSiftApi` is path-based (`CreateProjectInput.video.path`). A browser file picker returns a `File` or a handle with no path, so the browser runtime needs its own contract.
- A second entry point changes the rule that `@renderer/qa/` is imported only by `src/renderer/main.tsx`. That needs an ADR that extends ADR-006.
- Reusing the SRT and WebVTT parsers outside `src/main` means moving them (for example to `src/shared`). Files under `src/main/**` are risk 3 in `gate.yaml`.
- Visual baselines in `tests/visual/*-snapshots` exist only for `chromium-darwin`. A new page needs a visual spec, and its baseline can only be created on macOS unless the snapshot policy changes.
- Unmerged branches `origin/feature/m4-video-preview` and `origin/feature/m9-clip-timing-editor` contain an Electron video player, cue list and timing editor that depend on a main-process `local://` protocol. They are not on `main`. Their ADR-013 and ADR-014 would collide with new ADR numbers.
