# M12 — Database Strategy

## Migration 0009: render_jobs extension

```sql
ALTER TABLE render_jobs ADD COLUMN candidate_id TEXT REFERENCES clip_candidates(id) ON DELETE CASCADE;
ALTER TABLE render_jobs ADD COLUMN render_error_code TEXT;
```

Both columns are nullable for backward compatibility with existing demo jobs that have no candidateId.

`drizzle-kit generate` must be run before implementation to update the schema snapshot and produce the migration file. The Drizzle schema must be updated first:

```typescript
candidateId: text('candidate_id').references(() => clipCandidatesTable.id, { onDelete: 'cascade' }),
renderErrorCode: text('render_error_code'),
```

## RenderJob type extension

Add to `src/shared/schemas/renderJob.ts` (or create if absent):
```typescript
export type RenderJob = {
  id: string;
  projectId: string;
  candidateId: string | null;
  status: 'queued' | 'rendering' | 'complete' | 'failed';
  progress: number; // 0.0–1.0
  outputPath: string | null;
  errorMessage: string | null;
  renderErrorCode: string | null;
  createdAt: number;
  updatedAt: number;
};
```

## DatabaseService additions

New public methods on `DatabaseService`:

```typescript
createRenderJob(projectId: string, candidateId: string): RenderJob
updateRenderJobStatus(jobId: string, patch: RenderJobStatusPatch): void
getRenderJob(jobId: string): RenderJob | null
```

Where `RenderJobStatusPatch = { status: string; progress?: number; outputPath?: string; errorMessage?: string; renderErrorCode?: string }`.

## Access boundary

No direct `.db` or `.orm` access outside `DatabaseService`. `ClipRenderService` calls DB via `DatabaseService` public methods only.

## Constraint notes

- `ON DELETE CASCADE` on `candidateId`: deleting a candidate removes its render jobs.
- `PRAGMA foreign_keys = ON` already set in `DatabaseService.initialize()` — cascade works.
- Multiple render jobs can exist for the same candidate (re-render creates a new job; old jobs retained for audit).
- Migration 0009 must also create a partial unique index to make the "only one active render per candidate" invariant atomic:
  ```sql
  CREATE UNIQUE INDEX IF NOT EXISTS render_jobs_candidate_active
    ON render_jobs(candidate_id)
    WHERE status IN ('queued', 'rendering');
  ```
  This prevents TOCTOU races in the `RENDER_ALREADY_IN_PROGRESS` check — the DB enforces uniqueness, and the handler catches the `SQLITE_CONSTRAINT` error and maps it to `AppError('RENDER_ALREADY_IN_PROGRESS', ...)`.

## Startup reconciliation

On `DatabaseService.initialize()` (before migrate, after pragma), run:
```sql
UPDATE render_jobs SET status = 'failed', render_error_code = 'INTERRUPTED_BY_RESTART',
  updated_at = unixepoch() * 1000
WHERE status IN ('queued', 'rendering');
```
This ensures any jobs left in an active state from a prior crash do not permanently lock candidates. The partial unique index (above) only permits one active row per candidate; without startup reconciliation, a crash-orphaned row would block re-renders indefinitely.

## Migration dry-run requirement

Before merging, migration 0009 must be tested against a non-empty fixture database (one that has existing `render_jobs` rows from M0 demo jobs) to verify:
1. `ALTER TABLE ... ADD COLUMN` succeeds with pre-existing NULL-default rows
2. Partial index creation succeeds
3. Startup reconciliation UPDATE runs without error
4. No data is lost from pre-existing demo job rows
