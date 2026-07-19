# M3 Database Strategy — Subtitle Synchronization Check

**Status**: Planning  
**Milestone**: M3  
**Last updated**: 2026-07-20

---

## 1. New Columns on `projects` Table

Four nullable columns are added to the existing `projects` table. No new tables are required.

```sql
sync_status text,              -- 6-state machine value (see state list below)
sync_checked_at integer,       -- unix ms timestamp; NULL = never checked
sync_warnings_json text,       -- JSON array of SyncWarning objects; NULL if unchecked
sync_analysis_version integer  -- algorithm version that produced the result; NULL if unchecked
```

**Allowed `sync_status` values (persisted to DB)**:
- `not_available` — project lacks the data needed to run a check (no video duration or no subtitle document)
- `ready_to_check` — data is present; check has not yet been run
- `timing_ok` — check ran; no blocking timing issues found
- `needs_review` — check ran; one or more error-severity warnings found
- `check_failed` — check ran but threw an unexpected error

**`stale` is a computed display state — never written to the `sync_status` column.** The renderer derives stale by comparing `sync_checked_at` against `inspected_at` / `subtitle_parsed_at` (and checking `sync_analysis_version`). The five values above are the only values ever persisted.

**Default on migration**: all four columns default to NULL for existing rows. No backfill is needed. The state machine derives `ready_to_check` or `not_available` on first load based on whether `inspected_duration_ms` and a subtitle document are present.

---

## 2. Migration File: `0003_sync_check.sql`

Path: `src/database/migrations/0003_sync_check.sql`

```sql
-- M3: Add subtitle synchronization check columns to projects table
-- All columns nullable; no backfill required.
-- Reversible: see rollback note below.

ALTER TABLE projects ADD COLUMN sync_status text;
--> statement-breakpoint
ALTER TABLE projects ADD COLUMN sync_checked_at integer;
--> statement-breakpoint
ALTER TABLE projects ADD COLUMN sync_warnings_json text;
--> statement-breakpoint
ALTER TABLE projects ADD COLUMN sync_analysis_version integer;
```

No `DEFAULT` clause is needed — SQLite sets NULL for existing rows when no default is specified.

**Rollback SQL** (for documentation; not applied automatically):

```sql
ALTER TABLE projects DROP COLUMN sync_analysis_version;
ALTER TABLE projects DROP COLUMN sync_warnings_json;
ALTER TABLE projects DROP COLUMN sync_checked_at;
ALTER TABLE projects DROP COLUMN sync_status;
```

SQLite `DROP COLUMN` requires SQLite 3.35+. Electron bundles better-sqlite3 linked against SQLite 3.42+, so DROP COLUMN is safe in this environment. Confirm via `better-sqlite3` release notes before any rollback.

---

## 3. Drizzle Schema Additions

Add to `projectsTable` in `src/database/schema.ts`:

```typescript
syncStatus: text('sync_status'),
syncCheckedAt: integer('sync_checked_at'),
syncWarningsJson: text('sync_warnings_json'),
syncAnalysisVersion: integer('sync_analysis_version'),
```

All four columns use the Drizzle nullable column pattern (no `.notNull()`, no `.default()`). TypeScript inferred type for each is `string | null` or `number | null` as appropriate.

---

## 4. New `databaseService` Methods

### `getProjectForSync(id: string): Project | null`

The existing `getProject(id)` method already performs a point-lookup on `projects` by primary key and returns the full project row including the new sync columns. No new SQL query is required. This method is listed here for clarity in the service contract — `SynchronizationService` calls `getProjectForSync` by name, which delegates to the existing implementation.

### `getCuesForProject(id: string): SubtitleCue[]`

Reads the `cues_json` column from `subtitle_documents` for the project's active subtitle document.

```typescript
async getCuesForProject(id: string): Promise<SubtitleCue[]> {
  const row = db
    .prepare(`
      SELECT cues_json
      FROM subtitle_documents
      WHERE project_id = ?
    `)
    .get(id) as { cues_json: string } | undefined;

  if (!row || !row.cues_json) return [];

  return JSON.parse(row.cues_json) as SubtitleCue[];
}
```

Returns `[]` if no subtitle document exists for the project. `SubtitleCue` is imported from `src/shared/schemas/subtitle.ts`.

### `persistSyncResult(id: string, result: SyncPersistInput): void`

```typescript
interface SyncPersistInput {
  syncStatus: 'not_available' | 'ready_to_check' | 'timing_ok' | 'needs_review' | 'check_failed';
  syncWarnings: SyncWarning[] | null;
  syncCheckedAt: number;         // Date.now() at call site
  syncAnalysisVersion: number | null;
}

persistSyncResult(id: string, result: SyncPersistInput): void {
  db.transaction(() => {
    db.prepare(`
      UPDATE projects
      SET
        sync_status           = ?,
        sync_checked_at       = ?,
        sync_warnings_json    = ?,
        sync_analysis_version = ?
      WHERE id = ?
    `).run(
      result.syncStatus,
      result.syncCheckedAt,
      result.syncWarnings !== null ? JSON.stringify(result.syncWarnings) : null,
      result.syncAnalysisVersion,
      id,
    );
  })();
}
```

Uses parameterized query — no string interpolation. All four columns update atomically within the transaction (see Section 5).

---

## 5. Atomicity Requirement

`persistSyncResult` MUST wrap its `UPDATE` in `db.transaction()`. All four sync columns must update together or not at all. Partial writes (e.g., `sync_status` updated but `sync_warnings_json` not) would create inconsistent state that the state machine cannot safely recover from.

Rationale: if the process crashes mid-write, the old values remain intact and the user can re-run the check. A partial write could leave `sync_status = 'timing_ok'` with stale `sync_warnings_json` from a prior check, causing incorrect UI display.

---

## 6. Index Strategy

No new indexes are required for M3.

All sync-related queries are point-lookups by `project_id` (primary key). The existing primary key index on `projects.id` is sufficient. The `subtitle_documents` query in `getCuesForProject` filters by `project_id` — add an index on `subtitle_documents(project_id)` if not already present (check existing schema; this may already exist from M2).

Aggregating sync status across all projects (e.g., a dashboard count of `needs_review` projects) is out of M3 scope. If added in a future milestone, an index on `projects(sync_status)` should be evaluated at that time.

---

## 7. Data Size Analysis

### `sync_warnings_json`

- Typical warning count: 0–5 warnings per project
- Typical warning size: ~100 bytes each (code string + message + severity + small context object)
- Estimated column size: ≤500 bytes per project row
- Assessment: negligible — well within SQLite row overhead

### `cues_json` read for analysis

- `subtitle_documents.cues_json` is bounded by the M2 `CUES_TRUNCATED` cap of 10,000 cues
- At ~50–80 bytes per cue, `cues_json` can reach ~500 KB–800 KB per document
- `getCuesForProject` reads and JSON-parses this column in the main process
- Assessment: acceptable for M3. The entire parse-and-analyze cycle runs synchronously in the main process before returning the IPC response. For typical subtitle files (500–2,000 cues), this is well under 10 ms. For the 10,000-cue ceiling, this may approach 50–100 ms — acceptable but worth measuring.
- M4 optimization path if needed: stream `cues_json` in chunks or move analysis to a worker thread. Flag as a known item, not a blocker.

---

## 8. Migration Safety

### Forward compatibility

- All four columns are nullable with no constraints → zero risk of constraint violations on existing rows
- Migration applies four independent `ALTER TABLE ... ADD COLUMN` statements — SQLite processes each atomically; a failure on any statement leaves the prior columns in place (safe partial state, re-runnable)

### Reversibility

- Rollback SQL documented in Section 2
- SQLite 3.35+ required for `DROP COLUMN` — confirmed safe given Electron's bundled SQLite version (3.42+)
- Drizzle schema must be reverted to match if rollback is applied — update `src/database/schema.ts` and `src/shared/schemas/project.ts` in the same commit as the rollback migration

### Existing data

- No backfill needed: NULL is a valid initial state for all four columns
- On first app launch after migration, the renderer reads the project and derives display state:
  - `sync_status IS NULL` → treat as `ready_to_check` (if video + subtitle present) or `not_available`
  - This derivation happens in `SynchronizationService.getSyncDisplay()` / renderer equivalent

### Compatibility with M2 subtitle documents

- `subtitle_documents.cues_json` is written by M2 parsing — M3 reads but never writes this column
- M3 adds no columns to `subtitle_documents`
- No M2 behavior changes required

---

## 9. Test Fixtures

Fixture rows for each sync state, for use in `tests/main/sync/SynchronizationService.test.ts` and `tests/database/` fixtures:

### State: `not_available`
```json
{
  "id": "proj-001",
  "sync_status": "not_available",
  "sync_checked_at": null,
  "sync_warnings_json": null,
  "sync_analysis_version": null
}
```
Use when: `inspected_duration_ms` is NULL or no `subtitle_documents` row exists.

### State: `ready_to_check` (initial state after data load, before any check)
```json
{
  "id": "proj-002",
  "sync_status": "ready_to_check",
  "sync_checked_at": null,
  "sync_warnings_json": null,
  "sync_analysis_version": null
}
```
Use when: video and subtitle are both present but check has never run.

### State: `timing_ok`
```json
{
  "id": "proj-003",
  "sync_status": "timing_ok",
  "sync_checked_at": 1753027200000,
  "sync_warnings_json": "[]",
  "sync_analysis_version": 1
}
```
Use when: analyzer returned no warnings.

### State: `needs_review` with `LATE_SUBTITLE_START` warning
```json
{
  "id": "proj-004",
  "sync_status": "needs_review",
  "sync_checked_at": 1753027200000,
  "sync_warnings_json": "[{\"code\":\"LATE_SUBTITLE_START\",\"startRatio\":0.18}]",
  "sync_analysis_version": 1
}
```
Use when: analyzer returned one or more warnings (any warning → `needs_review`).

### State: `needs_review`
```json
{
  "id": "proj-005",
  "sync_status": "needs_review",
  "sync_checked_at": 1753027200000,
  "sync_warnings_json": "[{\"code\":\"CUES_OUTSIDE_VIDEO_RANGE\",\"outOfRangeCount\":3}]",
  "sync_analysis_version": 1
}
```

### State: `check_failed`
```json
{
  "id": "proj-006",
  "sync_status": "check_failed",
  "sync_checked_at": 1753027200000,
  "sync_warnings_json": null,
  "sync_analysis_version": null
}
```
Use when: analyzer or DB read threw an unexpected exception.

### State: stale (display-only — not stored in DB)

To produce a stale display state in tests, use a `timing_ok` or `needs_review` fixture where `sync_checked_at` is less than `inspected_at`:

```json
{
  "id": "proj-007",
  "sync_status": "timing_ok",
  "sync_checked_at": 1753000000000,
  "inspected_at":   1753027200000,
  "sync_warnings_json": "[]",
  "sync_analysis_version": 1
}
```

`SynchronizationService.getSyncDisplay()` (or renderer equivalent) evaluates `sync_checked_at < inspected_at` → `isStale: true`. The renderer renders the stale badge. The `sync_status` column still holds `timing_ok`.
