# M2 — Architecture Specification

**Spec date:** 2026-07-19
**Reconciled:** 2026-07-19 (Stage A spec reconciliation run)

---

## Reconciliation summary

This document was amended from the initial planning version to resolve five contradictions
identified during Stage A:

1. `SUBTITLE_SELECT_FOR_PROJECT` replaces `SUBTITLE_SET_PATH` — renderer must not supply an
   arbitrary filesystem path; main process opens the native dialog and persists the result.
2. `persistSubtitleResult()` documented correctly as a single SQLite transaction.
3. `upsertSubtitleDocument` uses explicit `INSERT ... ON CONFLICT DO UPDATE SET` (not `INSERT OR REPLACE`).
4. Deletion strategy resolved: explicit transaction (`clearSubtitleDocument` + project delete in one
   `db.transaction()`), not relying on unverified FK cascade.
5. SubtitleReader uses open-handle bounded read (open → fstat → read cap) instead of pre-read stat.

---

## Layer diagram

```
Renderer (React)
  window.sceneSift.subtitle.selectForProject(projectId)
  window.sceneSift.subtitle.parseForProject(projectId)
  window.sceneSift.subtitle.clearForProject(projectId)
  TanStack Query: useProjects() / projectQuery invalidation
    ↓ contextBridge
Preload (src/preload/index.ts)
  exposeInMainWorld — typed narrow methods
    ↓ ipcRenderer.invoke
IPC layer (src/main/ipc/registerIpcHandlers.ts)
  registerValidatedHandler(SUBTITLE_SELECT_FOR_PROJECT, ...)
  registerValidatedHandler(SUBTITLE_PARSE_FOR_PROJECT, ...)
  registerValidatedHandler(SUBTITLE_CLEAR_FOR_PROJECT, ...)
    ↓ service calls
SubtitleService (src/main/services/subtitle/subtitleService.ts)
  selectSubtitleForProject(projectId): ProjectRecord | null
  parseSubtitleForProject(projectId): ProjectRecord
  clearSubtitleForProject(projectId): ProjectRecord
    ↓ file select (selectForProject only)
DialogService (src/main/services/files/dialogService.ts)
  selectSubtitleFile(): SelectedSubtitle | null   [existing — re-used]
    ↓ file read (parseForProject only)
SubtitleReader (src/main/services/subtitle/subtitleReader.ts)
  readSubtitleFile(resolvedPath): string          [open-handle bounded read]
    ↓ parse
Parsers (src/main/services/subtitle/parsers/)
  SrtParser.ts: parse(text): ParsedCues
  VttParser.ts: parse(text): ParsedCues
    ↓ normalize/validate
SubtitleNormalizer (src/main/services/subtitle/subtitleNormalizer.ts)
  normalize(raw): NormalizedSubtitle
    ↓ persist
DatabaseService (src/main/services/database/databaseService.ts)
  setProjectSubtitlePath(projectId, path | null): ProjectRecord
  persistSubtitleResult(projectId, outcome, doc): ProjectRecord
  getSubtitleDocument(projectId): SubtitleDocument | null
  clearSubtitleDocument(projectId): void  [used internally in transactions]
```

---

## New files

| File | Layer | Purpose |
|---|---|---|
| `src/main/services/subtitle/subtitleService.ts` | Main (Risk 3) | Orchestrates selection, path validation, file read, parse, persist |
| `src/main/services/subtitle/subtitleReader.ts` | Main (Risk 3) | Bounded open-handle file read |
| `src/main/services/subtitle/parsers/SrtParser.ts` | Main (Risk 3) | SRT cue parser — pure function |
| `src/main/services/subtitle/parsers/VttParser.ts` | Main (Risk 3) | WebVTT cue parser — pure function |
| `src/main/services/subtitle/subtitleNormalizer.ts` | Main (Risk 3) | Timestamp normalization + warning generation |
| `src/shared/schemas/subtitle.ts` | Shared (Risk 1) | Zod schemas for subtitle contracts |
| `src/renderer/features/projects/subtitleFormatters.ts` | Renderer (Risk 2) | Pure formatter functions for subtitle display |
| `src/database/migrations/0002_subtitle_parsing.sql` | DB (Risk 3) | Migration: subtitle columns + subtitle_documents table |

---

## Modified files

| File | Layer | Risk | Change |
|---|---|---|---|
| `src/shared/ipc/channels.ts` | Shared/IPC | **3** | Add `SUBTITLE_SELECT_FOR_PROJECT`, `SUBTITLE_PARSE_FOR_PROJECT`, `SUBTITLE_CLEAR_FOR_PROJECT` |
| `src/shared/ipc/contracts.ts` | Shared/IPC | **3** | Add subtitle IPC contracts |
| `src/shared/schemas/project.ts` | Shared | 1 | Add subtitle state fields to projectSchema |
| `src/database/schema.ts` | DB | 2 | Add subtitle columns + subtitle_documents table definition |
| `src/main/ipc/registerIpcHandlers.ts` | Main | 3 | Register 3 subtitle handlers |
| `src/main/services/database/databaseService.ts` | Main (DB service) | 2 | Add subtitle DB methods |
| `src/preload/index.ts` | Preload | 3 | Expose subtitle methods |
| `src/renderer/features/projects/ProjectsPage.tsx` | Renderer | 2 | Add subtitle summary panel |
| `src/renderer/qa/fixtures.ts` | Renderer | 2 | Add subtitle parse state fixtures |
| `src/renderer/qa/mockSceneSiftApi.ts` | Renderer | 2 | Add subtitle mock handlers |

---

## Shared contracts

### New IPC channels

```typescript
// src/shared/ipc/channels.ts additions (Risk 3 — src/shared/ipc/**)
SUBTITLE_SELECT_FOR_PROJECT: 'subtitle:selectForProject'
  // Main opens native dialog → if selected, persists path → returns ProjectRecord | null
  // Input: { projectId: UUID }
  // Output: ProjectRecord | null (null if dialog cancelled)
  // Transition: any → selected (or no change if cancelled)

SUBTITLE_PARSE_FOR_PROJECT: 'subtitle:parseForProject'
  // Parses subtitle at stored path → persists result → returns updated ProjectRecord
  // Input: { projectId: UUID }
  // Output: ProjectRecord

SUBTITLE_CLEAR_FOR_PROJECT: 'subtitle:clearForProject'
  // Removes subtitle path + all subtitle data → returns updated ProjectRecord
  // Input: { projectId: UUID }
  // Output: ProjectRecord
  // Transition: any → not_selected
```

**Why selectForProject (not setPath):** For the three new subtitle channels
(`selectForProject`, `parseForProject`, `clearForProject`), the renderer never supplies a
filesystem path. The native dialog is opened in the main process; path selection stays server-side.
The renderer supplies only a projectId (validated as UUID at the IPC handler).

**Project create with subtitlePath (pre-existing pattern):** `project:create` may include
`subtitle.path` from a prior native-dialog selection. This is a pre-existing M1 pattern shared
with the video path field and is NOT changed by M2. The `subtitle.path` field in
`createProjectInputSchema` is client-asserted. Security backstop at parse time:
- `path.resolve()` canonicalizes the stored path before any file operation
- `stat().isFile()` validation confirms the path names a regular file
- Extension re-derived server-side from the **resolved** path — the client-asserted `extension`
  field from `selectedFileSchema` is NOT trusted at parse time
- The open-handle bounded read limits any read to 2MB

Residual risk: a compromised renderer could supply an arbitrary `.srt`/`.vtt`-named path via
`project:create` without going through the native dialog. This is the same risk profile as the
video path in `project:create` (established in M1). Risk accepted — bounded by file extension
re-check and 2MB read cap. No M3+ sync or AI feature will process subtitle content without a
separate user-confirmation gate.

When a non-null `subtitlePath` is provided at create time, the DatabaseService `createProject`
method must set `subtitle_status = 'selected'` (not left null). Handled at the DB layer.

### Input schemas

```typescript
// subtitle:selectForProject
const subtitleSelectInputSchema = z.object({
  projectId: z.string().uuid(),
});

// subtitle:parseForProject
const subtitleParseInputSchema = z.object({
  projectId: z.string().uuid(),
});

// subtitle:clearForProject
const subtitleClearInputSchema = z.object({
  projectId: z.string().uuid(),
});
```

### Project schema additions

```typescript
// src/shared/schemas/project.ts — add to projectSchema:
subtitleStatus: z.enum([
  'not_selected', 'selected', 'parse_failed',
  'unsupported', 'missing', 'ready', 'ready_with_warnings'
]).nullable(),
subtitleCueCount: z.number().int().nullable(),
subtitleLastCueEndMs: z.number().int().nullable(),
subtitleParseError: z.string().max(64).nullable(), // bounded error code only, never raw err.message
subtitleParsedAt: z.number().int().nullable(),
```

---

## Database additions

### Migration: `0002_subtitle_parsing.sql`

```sql
ALTER TABLE projects ADD subtitle_status TEXT;
ALTER TABLE projects ADD subtitle_cue_count INTEGER;
ALTER TABLE projects ADD subtitle_last_cue_end_ms INTEGER;
ALTER TABLE projects ADD subtitle_parse_error TEXT;
ALTER TABLE projects ADD subtitle_parsed_at INTEGER;

CREATE TABLE subtitle_documents (
  project_id TEXT NOT NULL,
  schema_version INTEGER NOT NULL DEFAULT 1,
  source_format TEXT NOT NULL,
  source_encoding TEXT NOT NULL,
  cues_json TEXT NOT NULL,
  warnings_json TEXT NOT NULL,
  parsed_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX subtitle_documents_project_id ON subtitle_documents(project_id);
```

All `ALTER TABLE ADD` operations are additive and nullable — safe for existing rows.
No `ON DELETE CASCADE` foreign key is declared because Drizzle/better-sqlite3 requires
`PRAGMA foreign_keys = ON` at connection open time for FK enforcement, and the repository
does not currently enable it. Cascade deletion is implemented explicitly in application code
(see Deletion strategy below).

### DatabaseService new methods

```typescript
// ATOMIC: opens native dialog in main process; if cancelled returns null; else persists
// and returns updated ProjectRecord. Used by SUBTITLE_SELECT_FOR_PROJECT handler.
setProjectSubtitlePath(
  projectId: string,
  subtitlePath: string | null
): ProjectRecord
// Transaction: (1) clearSubtitleDocument(projectId), (2) UPDATE projects SET
//   subtitle_path, subtitle_status = 'selected' | null,
//   subtitle_cue_count = null, subtitle_last_cue_end_ms = null,
//   subtitle_parse_error = null, subtitle_parsed_at = null
// Single db.transaction() — both succeed or both roll back.

// INTERNAL: update ONLY the projects row subtitle columns. Called inside persistSubtitleResult.
// Also usable directly in unit tests targeting the project-row update in isolation.
updateProjectSubtitleState(
  projectId: string,
  outcome: SubtitlePersistOutcome  // subtitle_status, cue_count, last_cue_end_ms, parse_error, parsed_at
): void
// UPDATE projects SET subtitle_status, subtitle_cue_count, subtitle_last_cue_end_ms,
//   subtitle_parse_error, subtitle_parsed_at WHERE id = projectId
// NOT wrapped in its own transaction — called inside persistSubtitleResult's transaction.

// TRANSACTIONAL: atomically writes parse result. Never call the two writes separately.
persistSubtitleResult(
  projectId: string,
  outcome: SubtitlePersistOutcome,  // subtitle_status, cue_count, last_cue_end_ms, parse_error, parsed_at
  doc: SubtitleDocument | null      // null on failure (cue doc cleared atomically)
): ProjectRecord
// Transaction (ALL inside one db.transaction()):
//   (0) Re-read project.subtitlePath — if it no longer matches the path that was parsed
//       (i.e. clearForProject ran concurrently) → abort; return current project state.
//   (1) updateProjectSubtitleState(projectId, outcome)
//   (2) if doc non-null: upsertSubtitleDocument; else: clearSubtitleDocument
// Single db.transaction() — both succeed or both roll back.
// The re-check in step (0) prevents stale parse results from overwriting a
// user-initiated clear that happened while parse was in flight.

getSubtitleDocument(projectId: string): SubtitleDocument | null

clearSubtitleDocument(projectId: string): void
// Deletes subtitle_documents row for projectId (no-op if not present).
// Called inside transactions; not a public IPC-facing operation.
```

**Transaction requirement (CRITICAL):** Both `setProjectSubtitlePath` and `persistSubtitleResult`
MUST use `db.transaction()` (better-sqlite3 synchronous transaction). If either write fails,
both roll back. This prevents the incoherent state where `subtitle_status = 'ready'` but
`getSubtitleDocument()` returns null.

**`upsertSubtitleDocument` SQL (CRITICAL — not INSERT OR REPLACE):**
```sql
INSERT INTO subtitle_documents
  (project_id, schema_version, source_format, source_encoding, cues_json, warnings_json, parsed_at)
VALUES
  (?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(project_id) DO UPDATE SET
  schema_version = excluded.schema_version,
  source_format = excluded.source_format,
  source_encoding = excluded.source_encoding,
  cues_json = excluded.cues_json,
  warnings_json = excluded.warnings_json,
  parsed_at = excluded.parsed_at;
```
Why not `INSERT OR REPLACE`: `INSERT OR REPLACE` deletes then re-inserts, which changes the
rowid and can interact unexpectedly with triggers and RETURNING clauses. Explicit `ON CONFLICT
DO UPDATE` updates in place, preserving rowid and being explicit about which columns change.

**Deletion strategy (explicit application-level transaction, no FK cascade):**
```typescript
// In databaseService.deleteProject():
this.db!.transaction(() => {
  this.clearSubtitleDocument(projectId);
  orm.delete(renderJobsTable).where(eq(renderJobsTable.projectId, projectId)).run();
  orm.delete(projectsTable).where(eq(projectsTable.id, projectId)).run();
})();
```
This is explicit and auditable. FK cascade with `PRAGMA foreign_keys = ON` is the preferred
long-term approach but requires connection-level configuration that is not yet standardized in
this repository. Document the decision in `docs/architecture/adr/` when upgrading to FK cascade.

**`subtitle_parsed_at` population:** Calculated ONCE in SubtitleService at the moment parse
completes (before any DB call). The same timestamp value is passed to `persistSubtitleResult`
as `outcome.parsedAt`. Never use two independent `Date.now()` calls for the same parse result.

**`setProjectSubtitlePath` behavior:** Atomically: (1) clears subtitle document,
(2) updates projects row with new path, `subtitle_status = path ? 'selected' : 'not_selected'`,
nulls all other subtitle columns. Single `db.transaction()`.

**SubtitleSummary reconstruction:** `SubtitleDocument.summary` fields `firstCueStartMs`,
`totalTextLength`, and `warningCount` are NOT stored as separate DB columns. On document load
from `subtitle_documents`, these fields are reconstructed from `cues_json` and `warnings_json`:
- `firstCueStartMs` = `cues[0]?.startMs ?? null`
- `totalTextLength` = sum of `cue.text.length` for all cues
- `warningCount` = `warnings.length`
This reconstruction happens in the DatabaseService `getSubtitleDocument` implementation.

**clearForProject during in-flight parse:** IPC handlers are sequential per Electron's event
loop. If `subtitle:clearForProject` arrives while `subtitle:parseForProject` is awaiting file
IO, clearForProject runs first (completing its transaction). SubtitleService then re-reads the
project inside the persistSubtitleResult transaction: if `subtitlePath` no longer matches the
path we parsed, the transaction is aborted and the result discarded.

---

## SubtitleService behavior

### selectSubtitleForProject

```typescript
async selectSubtitleForProject(projectId: string): Promise<ProjectRecord | null> {
  // 1. Validate projectId → getProject → throw if not found
  // 2. Call selectSubtitleFile() (existing dialogService function)
  // 3. If null (dialog cancelled) → return null
  // 4. Call databaseService.setProjectSubtitlePath(projectId, selected.path)
  // 5. Return updated ProjectRecord
}
```

### parseSubtitleForProject

```typescript
async parseSubtitleForProject(projectId: string): Promise<ProjectRecord> {
  // 1. Look up project — throw PROJECT_NOT_FOUND if missing
  // 2. Check subtitlePath set — persist 'not_selected', return if null
  // 3. path.resolve(subtitlePath) — canonicalize, eliminate traversal
  // 4. Detect format from extension — persist 'unsupported' if not .srt/.vtt
  // 5. SubtitleReader.readSubtitleFile(resolvedPath):
  //    a. open(resolvedPath, 'r') — open file handle
  //    b. fh.stat() — validate isFile(), check size <= 2MB
  //    c. read at most MAX_SUBTITLE_BYTES + 1 bytes — cap enforced at read time
  //    d. reject if bytes > MAX_SUBTITLE_BYTES (file grew between stat and read)
  //    e. fh.close() in finally
  //    f. decode Buffer as UTF-8
  //    g. Strip BOM, normalize CRLF → LF
  //    Errors: ENOENT/EACCES → 'missing'; size → 'SUBTITLE_FILE_TOO_LARGE'
  // 6. Parse: SrtParser.parse(text) | VttParser.parse(text) — pure, no IO
  // 7. Normalize: SubtitleNormalizer.normalize(raw)
  // 8. Zero-cue check: if 0 valid cues → treat as parse_failed
  // 9. subtitle_parsed_at = Date.now() — ONCE, used in both DB calls
  // 10. Build outcome + SubtitleDocument
  // 11. persistSubtitleResult(projectId, outcome, doc) — single transaction
  // 12. Return updated ProjectRecord
}
```

### clearSubtitleForProject

```typescript
async clearSubtitleForProject(projectId: string): Promise<ProjectRecord> {
  // 1. Validate projectId → getProject → throw if not found
  // 2. databaseService.setProjectSubtitlePath(projectId, null)
  //    (atomically clears path + all subtitle columns + deletes cue doc)
  // 3. Return updated ProjectRecord
}
```

Parse is synchronous in-process. No child process, no worker thread, no timeout needed
at this scale (2 MB max input = milliseconds). Parser loop guard at 10,000 cues provides
the resource bound within the synchronous parse.

---

## SubtitleReader — bounded open-handle implementation

```typescript
// src/main/services/subtitle/subtitleReader.ts
import { open } from 'node:fs/promises';
import { AppError } from '@main/utils/errors';

const MAX_SUBTITLE_BYTES = 2_097_152; // 2 MB

export async function readSubtitleFile(resolvedPath: string): Promise<string> {
  // resolvedPath is already canonicalized by path.resolve() in SubtitleService.
  // Symlinks: followed (platform default). Subtitle paths originate from native OS dialog
  // (selectForProject) or the project:create flow (pre-existing pattern, same as video path).
  const fh = await open(resolvedPath, 'r').catch(() => {
    throw new AppError('SUBTITLE_FILE_NOT_FOUND', 'Could not open subtitle file.');
  });
  try {
    const stat = await fh.stat();
    if (!stat.isFile()) {
      throw new AppError('SUBTITLE_FILE_NOT_FOUND', 'Subtitle path is not a regular file.');
    }
    if (stat.size > MAX_SUBTITLE_BYTES) {
      throw new AppError('SUBTITLE_FILE_TOO_LARGE', 'Subtitle file exceeds 2 MB limit.');
    }
    // Read one byte past limit to detect file growth between stat and read.
    const buf = Buffer.alloc(MAX_SUBTITLE_BYTES + 1);
    const { bytesRead } = await fh.read(buf, 0, MAX_SUBTITLE_BYTES + 1, 0);
    if (bytesRead > MAX_SUBTITLE_BYTES) {
      throw new AppError('SUBTITLE_FILE_TOO_LARGE', 'Subtitle content exceeds 2 MB limit.');
    }
    const raw = buf.subarray(0, bytesRead).toString('utf-8');
    // Strip UTF-8 BOM if present.
    return raw.startsWith('﻿') ? raw.slice(1) : raw;
  } finally {
    await fh.close().catch(() => { /* best-effort close */ });
  }
}
```

**Why open-handle, not pre-read stat + readFile:**
`stat().size` then `readFile()` is a TOCTOU race: a file can be replaced or grown between the
two calls. Opening a file handle first, then fstat-ing and reading through the same handle,
eliminates this race — the fstat and read operate on the same open file descriptor.

**Symlink policy:** Symlinks are followed (platform default). Subtitle paths arrive from
the native OS file picker, so a symlink in that path was explicitly navigated by the user.
Blocking symlinks would break valid user workflows. Path traversal is eliminated by
`path.resolve()` in SubtitleService before calling readSubtitleFile.

---

## IPC and preload

### Preload exposure

```typescript
// src/preload/index.ts — subtitle namespace
subtitle: {
  selectForProject: (projectId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SUBTITLE_SELECT_FOR_PROJECT, { projectId }),
  parseForProject: (projectId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SUBTITLE_PARSE_FOR_PROJECT, { projectId }),
  clearForProject: (projectId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SUBTITLE_CLEAR_FOR_PROJECT, { projectId }),
}
```

Only three narrow methods exposed. No raw path passed from renderer to preload.
No generic invoke. No raw file reading. No renderer-controlled format selection.

---

## Renderer changes

### SubtitleFormatters (pure, independently tested)

```typescript
// src/renderer/features/projects/subtitleFormatters.ts
export const SUBTITLE_ERROR_MESSAGES: Record<string, string> = {
  SUBTITLE_FILE_NOT_FOUND: 'Subtitle file not found at the stored path.',
  SUBTITLE_FILE_TOO_LARGE: 'Subtitle file exceeds the 2 MB size limit.',
  SUBTITLE_ENCODING_ERROR: 'Subtitle file encoding is not supported. Use UTF-8.',
  SUBTITLE_INVALID_FORMAT: 'Subtitle file content is not valid.',
  SUBTITLE_UNSUPPORTED_FORMAT: 'This subtitle format is not yet supported. Use .srt or .vtt.',
  SUBTITLE_PARSE_ERROR: 'Subtitle parsing failed. The file may be corrupted or contain no valid cues.',
};
export const formatSubtitleError = (code: string): string =>
  SUBTITLE_ERROR_MESSAGES[code] ?? `Subtitle error (${code}).`;
export const formatCueCount = (count: number | null): string => ...
export const formatSubtitleDuration = (lastEndMs: number | null): string => ...
```

### ProjectsPage subtitle panel

Always rendered when a project is selected, with placeholders when data is null — same
pattern as M1 media info section. Never hidden when `subtitleStatus` is `not_selected` or null.

States displayed:
- `not_selected`: "No subtitle selected" placeholder + "Select Subtitle" button
- `selected`: "Not yet parsed" + "Parse" button
- `parse_failed` / `missing` / `unsupported`: human-readable error + retry/replace
- `ready` / `ready_with_warnings`: cue count, duration, format, warning count
- Warning badge when `ready_with_warnings`

All error messages via `formatSubtitleError()`. No raw error codes visible to user.
No `dangerouslySetInnerHTML` for any subtitle content.

---

## Browser QA mock additions

New fixture states needed:
- `subtitle-not-selected`: `{ subtitleStatus: 'not_selected' }`
- `subtitle-selected-not-parsed`: `{ subtitleStatus: 'selected' }`
- `subtitle-ready`: `{ subtitleStatus: 'ready', subtitleCueCount: N, subtitleLastCueEndMs: N }`
- `subtitle-ready-with-warnings`: `{ subtitleStatus: 'ready_with_warnings', subtitleCueCount: N }`
- `subtitle-failed`: `{ subtitleStatus: 'parse_failed', subtitleParseError: 'SUBTITLE_PARSE_ERROR' }`
- `subtitle-missing`: `{ subtitleStatus: 'missing', subtitleParseError: 'SUBTITLE_FILE_NOT_FOUND' }`
- `subtitle-unsupported`: `{ subtitleStatus: 'unsupported', subtitleParseError: 'SUBTITLE_UNSUPPORTED_FORMAT' }`

Mock `subtitle.parseForProject()` transitions in-memory fixture state and returns updated project.
Mock `subtitle.selectForProject()` sets the fixture state to `selected` and returns updated project.
Mock `subtitle.clearForProject()` resets to `not_selected` and returns updated project.

---

## Architecture boundary compliance

- Renderer: no imports from main, database, or node:* modules. Subtitle formatters are pure.
- Shared/IPC: channels.ts and contracts.ts contain only constants and types — no runtime privilege.
- Main: SubtitleService owns all parsing logic. SubtitleReader owns filesystem access.
  DatabaseService owns persistence. Parsers and Normalizer are pure functions.
- Preload: three narrow typed methods. No generic IPC. No raw paths returned to renderer.
- Database: SQLite access restricted to `src/main/services/database/`. No subtitle parser
  touches DB directly.
- Browser QA: mock bridge imports behind `VITE_SCENESIFT_BROWSER_QA` guard in
  `src/renderer/main.tsx`. Production does not import QA mocks.

No architecture boundaries are violated. No ADR is required — M2 follows the established
Main→IPC→Preload→Renderer pattern with no new boundary types.
