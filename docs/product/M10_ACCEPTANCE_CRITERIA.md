# M10 Acceptance Criteria — Subtitle Editing

## AC-M10-001 — IPC channel integrity

- **AC-M10-001.1**: `src/shared/ipc/channels.ts` contains exactly 17 `ai:*` channels.
- **AC-M10-001.2**: Channels `ai:generateClipCues`, `ai:listClipCues`, `ai:updateClipCue`, `ai:deleteClipCue`, `ai:addClipCue` all registered.
- **AC-M10-001.3**: `tests/main/ipc-contracts.test.ts` channel count updated to 17, schema tests added for all 5 new schemas.

## AC-M10-002 — DB migration

- **AC-M10-002.1**: Migration `src/database/migrations/0007_clip_cues.sql` creates `clip_cues` table with columns: `id TEXT PK`, `candidate_id TEXT NOT NULL`, `sequence_index INTEGER NOT NULL`, `start_ms INTEGER NOT NULL`, `end_ms INTEGER NOT NULL`, `text TEXT NOT NULL`, `created_at INTEGER NOT NULL`, `updated_at INTEGER NOT NULL`.
- **AC-M10-002.2**: `src/database/schema.ts` exports `clipCuesTable` Drizzle definition.
- **AC-M10-002.3**: `candidate_id` references `clip_candidates(id)` with `ON DELETE CASCADE`.

## AC-M10-003 — Cue extraction algorithm

- **AC-M10-003.1**: Cue entirely within clip range [clipStart, clipEnd] is included unchanged.
- **AC-M10-003.2**: Cue starts before clipStart, ends within: included with startMs clamped to clipStart.
- **AC-M10-003.3**: Cue starts within, ends after clipEnd: included with endMs clamped to clipEnd.
- **AC-M10-003.4**: Cue spans entire clip: included with both boundaries clamped.
- **AC-M10-003.5**: Cue entirely before clipStart: excluded.
- **AC-M10-003.6**: Cue entirely after clipEnd: excluded.
- **AC-M10-003.7**: Cue that becomes zero-duration after clamping (clampedEnd <= clampedStart): excluded.
- **AC-M10-003.8**: Rebased startMs = clampedStart - clipStart (minimum 0).
- **AC-M10-003.9**: Rebased endMs = clampedEnd - clipStart, clamped to clipDurationMs.
- **AC-M10-003.10**: All rebased timestamps are integer milliseconds.
- **AC-M10-003.11**: Cues renumbered 1-based sequenceIndex after rebase.
- **AC-M10-003.12**: Tests in `tests/main/clipCueService.test.ts` cover all 7 inclusion/exclusion cases and rebase correctness.

## AC-M10-004 — generateClipCues

- **AC-M10-004.1**: Calling `generateClipCues(candidateId)` replaces all existing cues for that candidate (idempotent).
- **AC-M10-004.2**: Returns `{ cueCount: number }`.
- **AC-M10-004.3**: Throws if candidateId does not exist.
- **AC-M10-004.4**: Throws `SUBTITLE_NOT_READY` if project has no parsed subtitle.
- **AC-M10-004.5**: Cues persist across DB close/reopen (tested in `clipCueService.test.ts`).

## AC-M10-005 — listClipCues

- **AC-M10-005.1**: Returns `{ cues: ClipCue[] }` ordered by `sequenceIndex` ascending.
- **AC-M10-005.2**: Returns empty array when no cues generated yet.
- **AC-M10-005.3**: Returns updated data after mutations.

## AC-M10-006 — updateClipCue

- **AC-M10-006.1**: Updates `text`, `startMs`, `endMs` on a cue.
- **AC-M10-006.2**: Returns `{ ok: true }`.
- **AC-M10-006.3**: Preload validates: cueId is UUID; startMs non-negative integer; endMs positive integer; endMs > startMs.

## AC-M10-007 — deleteClipCue

- **AC-M10-007.1**: Deletes cue by id.
- **AC-M10-007.2**: Returns `{ ok: true }`.
- **AC-M10-007.3**: Preload validates cueId is UUID.

## AC-M10-008 — addClipCue

- **AC-M10-008.1**: Inserts new cue with sequenceIndex = max(existing) + 1.
- **AC-M10-008.2**: Returns `{ cue: ClipCue }` with the newly created cue.
- **AC-M10-008.3**: Preload validates: candidateId UUID; startMs non-negative integer; endMs positive integer; endMs > startMs; text non-empty string ≤ 500 chars.

## AC-M10-009 — Renderer

- **AC-M10-009.1**: Approved candidates show "Edit cues" button (`data-testid="edit-cues-button"`).
- **AC-M10-009.2**: Clicking "Edit cues" expands/opens the `ClipCuesSection` (`data-testid="clip-cues-section"`).
- **AC-M10-009.3**: `ClipCuesSection` shows "Generate cues" button (`data-testid="generate-cues-button"`).
- **AC-M10-009.4**: Each cue row has `data-testid="clip-cue-item"` with text, startMs, endMs fields.
- **AC-M10-009.5**: Each cue has `data-testid="update-cue-button"` (save inline edits) and `data-testid="delete-cue-button"`.
- **AC-M10-009.6**: "Add cue" button (`data-testid="add-cue-button"`) adds a new cue.
- **AC-M10-009.7**: QA mock implements all 5 methods.

## AC-M10-010 — Security

- **AC-M10-010.1**: All 5 preload methods validate inputs and reject with `Promise.reject(TypeError)` before invoking IPC.
- **AC-M10-010.2**: All 5 IPC handlers use `registerValidatedHandler` with Zod schemas.
- **AC-M10-010.3**: DB queries use Drizzle ORM parameterized queries — no string interpolation.
