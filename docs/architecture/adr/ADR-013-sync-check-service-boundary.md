# ADR-013: SynchronizationService and SYNC_CHECK_FOR_PROJECT IPC Channel

- Status: Accepted
- Date: 2026-07-20
- Milestone: M3 — Subtitle Synchronization Check

## Context

M3 requires structural analysis of subtitle cue timing against video metadata. The analysis must:
- Run on explicit user action only (not automatically)
- Use only persisted SQLite data (no new file reads at analysis time)
- Keep analysis logic pure and IO-free (testable without DB or IPC)
- Persist the result (status, warnings, timestamp, version) to the projects table

## Decision

1. **New IPC channel**: `SYNC_CHECK_FOR_PROJECT` (`sync:checkForProject`) registered in `src/shared/ipc/channels.ts` as a key in the existing `IPC_CHANNELS` object. Input validated with `z.object({ projectId: z.string().uuid() })`.

2. **Two-layer service split**:
   - `SynchronizationAnalyzer` (pure function, no IO): accepts `(durationMs: number, cues: SubtitleCue[])`, returns `SyncAnalysisResult`. No Date.now(), no DB calls, no file reads. Fully unit-testable with deterministic inputs.
   - `SynchronizationService` (orchestration layer): reads project + subtitle_documents from DB, invokes analyzer, persists result, returns updated project data to IPC handler.

3. **No new external dependencies**: analysis uses only existing DB data and built-in arithmetic. No FFprobe re-invocation at check time.

4. **DB migration `0003_sync_check.sql`**: adds 4 columns to `projects` table: `sync_status TEXT`, `sync_checked_at INTEGER`, `sync_warnings_json TEXT`, `sync_analysis_version INTEGER`.

## Consequences

- Positive: SynchronizationAnalyzer is trivially unit-testable (pure function over numbers).
- Positive: No new external process execution in M3.
- Positive: Follows established M1/M2 service architecture pattern.
- Negative: Synchronous analysis on main thread for large cue sets (10k cues ~50-100ms). Worker thread offload deferred to M4.
- Negative: New IPC channel requires IPC contract test update.

## Alternatives considered

- Single-class service with embedded analysis logic (rejected: makes analysis logic harder to test in isolation).
- Worker thread for analysis (deferred: acceptable latency for M3 scale; revisit in M4).

## Revisit conditions

- Cue-set size exceeds 10k regularly and analysis latency becomes user-visible.
- M4 introduces offset computation requiring stateful analysis across checks.
