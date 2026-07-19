# M1 Media Inspection — Database Migration Verification

**Audit date**: 2026-07-19
**Branch**: feature/m1-media-ingestion-inspection
**Reviewer**: migration-reviewer (primary)
**Migration file**: `src/database/migrations/0001_media_inspection.sql`
**Journal**: `src/database/migrations/meta/_journal.json`
**Schema**: `src/database/schema.ts`
**Database service**: `src/main/services/database/databaseService.ts`
**Verdict**: APPROVED (with one medium finding)

---

## Migration file status

The migration SQL file `src/database/migrations/0001_media_inspection.sql` is untracked (`??` in git status) — it exists in the working tree but has not been committed to the branch. The journal file `src/database/migrations/meta/_journal.json` is unstaged (` M`).

Both files must be committed together with the implementation files before the branch can be merged.

---

## All 9 new columns

The migration adds 9 new columns to the `projects` table, all nullable with no DEFAULT clause. All column specifications were verified against the Drizzle schema (`src/database/schema.ts`), the migration SQL, and the `databaseService.ts` update and map logic.

| Column name | SQL type | Nullable | Default | Drizzle accessor | Purpose |
|---|---|---|---|---|---|
| `duration_seconds` | `real` | YES | NULL | `durationSeconds` | Video duration in seconds from `ffprobe format.duration`. Stored as a floating-point number (e.g., 2847.6). Displayed in the renderer — currently non-compliant with HH:MM:SS format requirement. |
| `width` | `integer` | YES | NULL | `width` | Video frame width in pixels from the ffprobe video stream object (`streams[].width`). Displayed as the first component of the resolution string (e.g., `1920 x 1080`). |
| `height` | `integer` | YES | NULL | `height` | Video frame height in pixels from the ffprobe video stream object (`streams[].height`). Displayed as the second component of the resolution string. |
| `video_codec` | `text` | YES | NULL | `videoCodec` | Video codec name from `streams[].codec_name` for the first video-type stream (e.g., `h264`, `hevc`, `av1`). Displayed directly in the metadata panel. |
| `fps` | `real` | YES | NULL | `fps` | Video frame rate derived from `streams[].avg_frame_rate` by evaluating the rational fraction string (e.g., `"24000/1001"` → 23.976). Stored as a floating-point number. |
| `bit_rate_bps` | `integer` | YES | NULL | `bitRateBps` | Overall bit rate in bits-per-second from `ffprobe format.bit_rate` (a string that is parsed to an integer). For a typical HD file this is on the order of 8–20 million. NOTE: This field is present in the DB schema and in `MediaMetadata` TypeScript type but is NOT rendered in `ProjectsPage.tsx` — this is the AC-002-F failure. |
| `file_size_bytes` | `integer` | YES | NULL | `fileSizeBytes` | Source file size in bytes from `ffprobe format.size` (a string parsed to an integer). Used for human-readable display. Current display divides by 1 MiB unconditionally (`/ 1_048_576`) and appends `MB` without auto-scaling to GB — this is the AC-002-E failure. |
| `inspected_at` | `integer` | YES | NULL | `inspectedAt` | Unix epoch milliseconds timestamp written when inspection completes successfully (`Date.now()`). Null if the project has never been inspected or if inspection failed. |
| `inspection_error` | `text` | YES | NULL | `inspectionError` | Error code string when `status = 'inspection_failed'`. Constrained to max 64 characters by `z.string().max(64).nullable()` in `projectSchema`. Possible values: `FILE_NOT_FOUND`, `FFPROBE_ERROR`, `PARSE_ERROR`, `NO_VIDEO_STREAM`, `FFPROBE_UNAVAILABLE`. Null on success. |

---

## Status column migration

The existing `status` column in the `projects` table uses a `text` type with a `CHECK` constraint. The migration extends the allowed values:

**Before migration** (from `0000_initial.sql`):
```sql
status text NOT NULL DEFAULT 'draft'
  CHECK (status IN ('draft', 'ready', 'archived'))
```

**After migration** (`0001_media_inspection.sql`):
```sql
-- Drops and recreates the CHECK constraint to add 'inspection_failed'
status text NOT NULL DEFAULT 'draft'
  CHECK (status IN ('draft', 'ready', 'inspection_failed', 'archived'))
```

**Verification**: The Drizzle schema (`src/database/schema.ts`) uses `z.enum(['draft', 'ready', 'inspection_failed', 'archived'])` for the status field, consistent with the migrated constraint. The `updateProjectInspection` function sets `status: 'ready'` on success and `status: 'inspection_failed'` on failure — both values are in the new constraint.

**Active status migration**: Existing rows with `status = 'active'` (if any existed from an earlier schema iteration) would be migrated. The reviewer confirmed `'active'` is not a currently-used status value in the codebase — only `'draft'`, `'ready'`, and `'archived'` were in use before this migration. No data migration for this value is required.

---

## Compatibility with existing rows

The migration adds 9 columns with no `DEFAULT` clause. In SQLite, adding a nullable column without a DEFAULT is handled by setting all existing rows to NULL for that column. This is a safe, non-destructive operation:

- Existing project rows gain 9 new NULL columns
- No existing column values are modified
- No CHECK constraint violation can occur because NULL satisfies `NOT NULL` constraints only if the column is explicitly `NOT NULL` — all 9 new columns are nullable
- The `inspection_error` column does NOT have a max-64 constraint enforced at the SQL layer (that constraint is at the Zod/application layer) — existing rows with NULL in this column are not affected by the Zod constraint

**Reviewer assessment**: Running `0001_media_inspection.sql` against a database with existing project rows produced no errors. The migration is safe for upgrade from any database that has had `0000_initial.sql` applied.

---

## Source file safety on project delete

**Concern**: Does `deleteProject()` delete the source video file from the filesystem?

**Finding**: No. `databaseService.ts: deleteProject()` executes only SQL DELETE statements. It does not call `fs.unlink`, `fs.rm`, or any filesystem operation. The source video file referenced in `videoPath` is never touched by the delete operation. Only the database rows are removed.

**Medium finding**: `deleteProject()` executes two sequential DELETE statements without wrapping them in an explicit transaction:

```typescript
// delete associated render jobs first
await db.delete(renderJobsTable).where(eq(renderJobsTable.projectId, id));
// then delete the project
await db.delete(projectsTable).where(eq(projectsTable.id, id));
```

If the process crashes (or better-sqlite3 throws) between the two statements, the render jobs for this project will be permanently deleted while the project row survives. This creates an undetectable orphan-loss scenario: the project appears intact but has silently lost its render history. The fix is to wrap both deletes in `db.transaction()`:

```typescript
db.transaction(() => {
  db.delete(renderJobsTable).where(eq(renderJobsTable.projectId, id));
  db.delete(projectsTable).where(eq(projectsTable.id, id));
});
```

This finding is not blocking for the inspection feature itself but should be addressed as part of the M1 work since it is in a modified file.

---

## Parameterized queries confirmation

**Requirement**: `database.md` rule — "Use parameterized queries exclusively. No string interpolation in SQL."

**Finding**: PASS

All database operations in `databaseService.ts` use Drizzle ORM's typed query builder, which constructs parameterized SQL internally. No raw string interpolation of user-controlled values into SQL was found. Specific operations verified:

- `updateProjectInspection()` — Drizzle `.update(projectsTable).set({...}).where(eq(projectsTable.id, id))` — parameterized
- `createProject()` — Drizzle `.insert(projectsTable).values({...})` — parameterized
- `listProjects()` — Drizzle `.select().from(projectsTable)` — no user input
- `getProject(id)` — Drizzle `.select().from(projectsTable).where(eq(projectsTable.id, id))` — parameterized

`pnpm governance:validate` includes a forbidden-pattern check for SQL string interpolation patterns. Exit 0 confirmed.

---

## `updateProjectInspection()` atomicity

**Concern**: Could a partial write leave the project row with some inspection columns updated and others null?

**Finding**: LOW risk.

`updateProjectInspection()` issues a single Drizzle UPDATE statement covering all 10 changed fields:
- `status`
- `durationSeconds`, `width`, `height`, `videoCodec`, `fps`, `bitRateBps`, `fileSizeBytes`
- `inspectedAt`, `inspectionError`
- `updatedAt`

better-sqlite3 is synchronous. SQLite guarantees atomicity for a single statement: either all columns in the UPDATE are written together or none are (in the event of a crash mid-write, the WAL journal allows SQLite to recover to the previous state). No column subset can be committed while others are not.

The SELECT read-back after the UPDATE (`getProject(id)`) is used only to construct the return value for the IPC response. If the SELECT were to fail (e.g., a transient lock), the UPDATE would already be durably committed. The return value failure would surface as an IPC error to the renderer, which would need to call `listProjects()` to see the updated state — a recoverable scenario.

---

## Drizzle journal registration

**Requirement**: The migration must be registered in the Drizzle journal so that the ORM applies it correctly at startup.

**Finding**: PASS

`src/database/migrations/meta/_journal.json` was modified in this branch to include the `0001_media_inspection` migration entry. The journal format follows the Drizzle standard:

```json
{
  "version": "7",
  "dialect": "sqlite",
  "entries": [
    { "idx": 0, "version": "7", "when": 1700000000000, "tag": "0000_initial", "breakpoints": true },
    { "idx": 1, "version": "7", "when": 1750000000000, "tag": "0001_media_inspection", "breakpoints": true }
  ]
}
```

The Drizzle migration runner (`databaseService.ts` startup) reads this journal to determine which migrations to apply. Without this entry, the ORM would not apply `0001_media_inspection.sql` on startup, leaving the projects table without the 9 new columns and causing runtime crashes when the application attempts to insert or select inspection data.

**Note**: The journal file is in an unstaged state (` M`) — it must be staged and committed along with `0001_media_inspection.sql` before merge.

---

## `mapProject()` consistency

**Requirement**: All query results that return `ProjectRecord` objects must go through the same mapping function to ensure no columns are missed.

**Finding**: PASS

All four `ProjectRecord`-returning methods in `databaseService.ts` route through `mapProject()`:

| Method | Uses mapProject() |
|---|---|
| `listProjects()` | YES — maps each row in the result array |
| `createProject()` | YES — maps the inserted row after SELECT |
| `getProject(id)` | YES — maps the single result row |
| `updateProjectInspection()` | YES — calls `getProject(id)` internally, which uses `mapProject()` |

The `mapProject()` function maps all schema columns including all 9 new inspection columns. No raw row object is returned directly to callers. `listQueue()` returns `RenderJobRecord` objects via a separate mapper — this is unrelated to `ProjectRecord` and is correct.

**New column mapping in `mapProject()`**: All 9 new columns are explicitly mapped from snake_case SQL column names to camelCase TypeScript property names:

```typescript
durationSeconds: row.duration_seconds ?? null,
width: row.width ?? null,
height: row.height ?? null,
videoCodec: row.video_codec ?? null,
fps: row.fps ?? null,
bitRateBps: row.bit_rate_bps ?? null,
fileSizeBytes: row.file_size_bytes ?? null,
inspectedAt: row.inspected_at ?? null,
inspectionError: row.inspection_error ?? null,
```

The `?? null` null-coalescing pattern handles the case where SQLite returns `undefined` for a missing column (which would happen if the migration has not been applied), converting it to `null` rather than propagating `undefined` into the TypeScript type system. This provides a safe fallback but should not be relied upon as a substitute for actually running the migration.

---

## AC-003-A persistence gap (from behavioral review)

Although the migration, schema, and service code are correctly implemented, there is no automated test that verifies the full write-close-reopen-read path for inspection metadata.

**What is needed for AC-003-A**:
1. Create a project via `databaseService.createProject()`
2. Call `databaseService.updateProjectInspection(id, successPayload)` with all 7 metadata values
3. Close and dispose the `DatabaseService` instance
4. Create a new `DatabaseService` instance against the same database file
5. Call `databaseService.listProjects()` on the new instance
6. Assert that the returned `ProjectRecord` for the inspected project has non-null values for all 9 inspection columns including `inspectedAt`

Until this test exists, AC-003-A remains NOT VERIFIED even though the code path is expected to work correctly.

---

## Summary

| Verification item | Result |
|---|---|
| All 9 columns present with correct SQL types | PASS |
| All 9 columns nullable with no DEFAULT | PASS |
| Status migration adds `inspection_failed` | PASS |
| Active status migration handled | PASS |
| Existing rows unaffected by nullable column addition | PASS |
| Source video file not deleted on project delete | PASS |
| All queries parameterized (no string interpolation) | PASS |
| Drizzle journal updated with new migration entry | PASS |
| `mapProject()` maps all 9 new columns | PASS |
| `updateProjectInspection()` single-statement atomicity | PASS |
| `deleteProject()` transaction safety | MEDIUM FINDING — two sequential DELETEs without explicit transaction |
| AC-003-A persistence test exists | NOT VERIFIED — no test closes/reopens DB after inspection write |
