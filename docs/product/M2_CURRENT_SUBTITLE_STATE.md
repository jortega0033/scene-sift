# M2 — Current Subtitle Capability State (Post-M1)

**Audit date:** 2026-07-19
**Branch:** main (post-M1 merge)

---

## Summary

M1 implemented video file selection, FFprobe inspection, and media metadata persistence. Subtitle support exists as scaffolding only: file selection and path storage. No parsing, normalization, or validation exists.

---

## Capability Map

| Capability | Status | Evidence |
|---|---|---|
| Subtitle file dialog (select .srt/.vtt/.ass) | IMPLEMENTED | `dialogService.ts:selectSubtitleFile`, `DIALOG_SELECT_SUBTITLE_FILE` channel |
| Subtitle extension constants | IMPLEMENTED | `src/shared/constants/files.ts:SUBTITLE_EXTENSIONS = ['.srt', '.vtt', '.ass']` |
| Subtitle path storage in DB | IMPLEMENTED | `schema.ts:subtitle_path` column (nullable text) |
| Subtitle path in project schema | IMPLEMENTED | `project.ts:subtitlePath: z.string().nullable()` |
| Subtitle path in project display | IMPLEMENTED | `ProjectsPage.tsx:168-171` — raw path shown |
| Subtitle file create-form UI | IMPLEMENTED | `CreateProjectForm.tsx` — subtitle file picker |
| Subtitle file IPC contract | IMPLEMENTED | `contracts.ts:dialog.selectSubtitleFile` → `selectedSubtitleSchema \| null` |
| Subtitle preload method | IMPLEMENTED | `preload/index.ts:dialog.selectSubtitleFile()` |
| **Subtitle parse trigger** | **MISSING** | No IPC channel, no handler, no service |
| **Subtitle file reading** | **MISSING** | No main-process file read for subtitles |
| **SRT parser** | **MISSING** | No parser code anywhere |
| **WebVTT parser** | **MISSING** | No parser code anywhere |
| **ASS parser** | **MISSING** | No parser code anywhere |
| **Cue normalization** | **MISSING** | No timestamp normalization, no text stripping |
| **Cue validation** | **MISSING** | No overlap, order, or timestamp checks |
| **Subtitle parse state** | **MISSING** | No status column in DB |
| **Cue count persistence** | **MISSING** | No cue count stored |
| **Parse error persistence** | **MISSING** | No parse error stored |
| **Subtitle summary UI** | **MISSING** | No parse status, cue count, or format shown |
| **Human-readable subtitle errors** | **MISSING** | No subtitle error formatter |
| **Subtitle parser dependency** | **MISSING** | No package.json entry |
| **Subtitle path re-validation at parse time** | **MISSING** | Path only validated at create (implicit via dialog) |
| **Subtitle resource limits** | **MISSING** | No file-size cap, no cue-count cap |
| **Restart-persistence for subtitle state** | **MISSING** | No parse state to persist yet |

---

## What M1 Established (Relevant to M2)

- **Path validation pattern**: `path.resolve()` + `stat()` + `isFile()` check before file operations
- **Resource limit pattern**: `maxOutputBytes` in `runCommand.ts` for external process stdout
- **Error code pattern**: structured string codes (`FILE_NOT_FOUND`, `FFPROBE_ERROR`, etc.) in main, formatted to human text in renderer formatters
- **IPC handler pattern**: `registerValidatedHandler(channel, contractKey, async (payload) => { ... })` with Zod payload validation
- **DB update pattern**: `updateProjectInspection(projectId, outcome)` — updates nullable columns atomically, throws for nonexistent ID
- **Formatter pattern**: pure TS functions in `mediaFormatters.ts`, tested independently, no React/Electron imports
- **Persistence test pattern**: close + reopen DB, verify fields survive

---

## Subtitle Path Validation Gap

`dialog.selectSubtitleFile()` validates the **selected** file at creation time. However, when `parseForProject` is called in a later session, the stored `subtitlePath` may be:

- Deleted since selection
- Moved or renamed
- No longer a file (e.g., replaced by a directory)
- A symlink pointing outside expected paths

M2 must re-validate `subtitlePath` at parse time using the same `stat() + isFile()` pattern used in M1.

---

## No Parser Dependencies

No subtitle parsing library exists in `package.json`. M2 will implement SRT and WebVTT parsers as first-party TypeScript. This is deliberate: subtitle files are simple enough that a purpose-built parser is safer (no supply chain risk, no over-broad feature surface) and the formats are well-specified.
