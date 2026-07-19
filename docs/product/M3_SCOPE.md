# M3 — Subtitle Synchronization Check: Scope

**Milestone:** M3 — Subtitle Synchronization Check
**Spec date:** 2026-07-19
**Prerequisite:** M2 merged (subtitle parsing complete)

---

## Primary objective

When a project has both an inspected video (with `durationSeconds`) and a successfully parsed subtitle (with `subtitleLastCueEndMs` and full cue document), the user can trigger a synchronization check. The main process reads the persisted project row and subtitle document from the database, runs a pure structural analysis of subtitle cue timing against video duration, and persists the result. The renderer displays a sync summary panel with the check state and any sync warnings. The sync state survives app restart.

No file reads occur at analysis time. No audio processing occurs. No offset is applied or persisted in M3.

---

## Bounded workflow

```
User opens project with video inspected and subtitle parsed
→ user triggers "Check synchronization" action
→ IPC: sync:analyzeForProject(projectId)
→ main: look up project row from DB
→ main: look up subtitle document from subtitle_documents table
→ main: validate prerequisites:
        durationSeconds not null
        subtitle_status in ['ready', 'ready_with_warnings']
→ main: if prerequisites absent → persist not_available → return
→ main: SynchronizationAnalyzer.analyze(durationSeconds, subtitleDocument)
        — pure function, no IO, no file reads, no Date.now()
→ main: sync_analyzed_at = Date.now() — once, in SynchronizationService
→ main: persist sync result to DB (sync_status, sync_analysis_version,
        sync_analyzed_at, sync_warnings_json)
→ IPC: return updated ProjectRecord to renderer
→ renderer: invalidate project query (TanStack Query)
→ renderer: display sync summary panel with state and sync warnings
→ app restart: project loads with persisted sync state
```

---

## In scope

- Structural analysis of subtitle cue timeline against video duration using persisted data only
- Detection of cues with timestamps outside the video range `[0, durationMs]` beyond tolerance
- Detection of cues with timestamps before video start (`startMs < 0`)
- Detection of subtitle span shorter than 50% of video duration (SPAN_SHORT)
- Detection of subtitle span extending beyond 120% of video duration (SPAN_LONG)
- Detection of first cue starting after 15% of video duration (LATE_START)
- Detection of last cue followed by more than 10 seconds of empty video (LARGE_TAIL_GAP)
- Detection of a consistent cross-cue shift pattern (POSSIBLE_OFFSET — informational warning only)
- Synchronization state machine with 6 states (see below)
- Sync summary panel in project detail — always rendered when project has video inspected
- Restart persistence of sync analysis result: sync status, analysis version, sync warnings, analyzed_at
- `analysisVersion` integer on persisted result to support future threshold-triggered re-analysis
- DB migration (`0003_sync_analysis.sql`) adding sync columns to `projects` table
- Browser QA fixtures for all 6 sync states
- Mock `sync.analyzeForProject()` transition in-memory fixture state
- IPC contract tests for `SYNC_ANALYZE_FOR_PROJECT` channel
- Unit tests for `SynchronizationAnalyzer` — pure function, exhaustively testable against threshold boundaries
- Unit tests for `SynchronizationService` — orchestration and persistence
- Unit tests for `syncFormatters.ts` — human-readable state and warning display
- E2E tests for the sync check workflow in browser QA mode
- Visual regression tests for all sync panel states

---

## Synchronization state machine (6 states)

| State | `sync_status` value | Meaning |
|---|---|---|
| `not_available` | `'not_available'` | Prerequisites not met: `durationSeconds` is null, or `subtitle_status` is not `ready`/`ready_with_warnings` |
| `not_checked` | `'not_checked'` | Prerequisites met but user has not triggered analysis yet |
| `check_passed` | `'check_passed'` | Analysis ran and found no structural timing issues |
| `check_passed_with_warnings` | `'check_passed_with_warnings'` | Analysis ran; timing is structurally within bounds but soft warnings exist |
| `check_failed` | `'check_failed'` | Analysis ran; one or more hard structural problems detected |
| `needs_recheck` | `'needs_recheck'` | A previously completed check is stale: subtitle was re-parsed, or video re-inspected, since the last sync check |

`analyzing` is NOT a persisted state — same pattern as M2 `parsing`. If the app closes during IPC, the state remains at whatever it was before the IPC call began.

**`not_checked` vs `null`:** On project load after M3 migration, `sync_status` for existing projects will be `null`. The application treats `null` identically to `not_checked` for display purposes, then persists `not_checked` on first display load or on next trigger attempt. An explicit `not_checked` value is persisted after the first prerequisite check that confirms prerequisites are met.

---

## Prerequisite states for analysis

Analysis is only meaningful when both of the following are true:
1. `durationSeconds` is non-null (video has been inspected and FFprobe returned a duration)
2. `subtitle_status` is `ready` or `ready_with_warnings` (subtitle successfully parsed with at least one cue)

If either prerequisite is absent, the sync action button is disabled. The sync panel shows the `not_available` state with a contextual reason ("Video not yet inspected" or "Subtitle not yet parsed").

---

## Stale check semantics (`needs_recheck`)

When the user re-parses the subtitle or re-inspects the video after a sync check has been completed, the sync status transitions to `needs_recheck`. This signals that the previous analysis result was computed from data that may have changed.

`needs_recheck` is set by the service responsible for the triggering action:
- `SubtitleService.parseSubtitleForProject()` sets `sync_status = 'needs_recheck'` if the project's existing `sync_status` was `check_passed`, `check_passed_with_warnings`, or `check_failed`.
- `InspectionService.inspectForProject()` (M1 service) similarly sets `needs_recheck` when reinspecting a project with an existing sync result.

`needs_recheck` is never set automatically on every project load — only when a parse or inspection event follows a completed sync check in the same session or across sessions.

---

## Explicitly out of scope (M3)

| Feature | Deferred to |
|---|---|
| Global subtitle offset persistence | M4 or later |
| Offset sign convention definition | M4 (defined alongside offset persistence) |
| Per-cue timing editing | M9 |
| Audio analysis or speech recognition | Not on roadmap for SceneSift v1 |
| Video preview or waveform display | M4 |
| Timeline scrubber | M4 |
| AI synchronization | Not planned |
| ASS subtitle support | Still deferred from M2 |
| Subtitle editing of any kind | M10 |
| Per-cue UI review or approval | Not planned for v1 |
| Subtitle burn-in | M11/M12 |
| Cloud sync of analysis results | Never |
| Automatic sync check without user action | Never |

---

## Scope guard — M4 must not appear in M3

M3 detects and reports timing structure problems. It does not fix them. M3 must NOT:

- Apply any offset to subtitle timestamps in the database or in memory
- Modify any cue timestamp
- Display an "apply offset" or "correct timing" control
- Define or persist an offset value
- Define a sign convention for offsets
- Trigger analysis automatically on project open
- Make any claim that a subtitle is "perfectly synchronized" or "in sync"

---

## Definition of done

M3 is complete when:

1. User can trigger a synchronization check from the project detail panel via an explicit action.
2. Check runs in the main process using only persisted DB data — no new file reads at analysis time.
3. `SynchronizationAnalyzer` is a pure function with no IO dependencies and no `Date.now()` call.
4. All prerequisite-state guards prevent analysis when `durationSeconds` or parsed subtitle is absent.
5. All six sync states are defined, persisted correctly, and displayed in the sync panel.
6. `needs_recheck` is set when subtitle or video data is updated after a completed sync check.
7. Sync result (state, analysis version, sync warnings, analyzed_at) survives app restart.
8. Sync summary panel always renders — with a contextual placeholder when sync has not been run.
9. All sync warning types display human-readable messages; no raw `SyncWarningCode` values visible.
10. `analysisVersion` is persisted on every result; stale version on load produces `needs_recheck`.
11. Browser QA fixtures and mock handlers reflect all 6 sync states.
12. IPC contract tests cover the `SYNC_ANALYZE_FOR_PROJECT` channel.
13. `SynchronizationAnalyzer` unit tests cover all threshold boundary conditions (at, above, below).
14. `SynchronizationService` unit tests cover orchestration including prerequisite-absent and stale paths.
15. E2E test covers the full sync check workflow in browser QA mode.
16. Visual tests pass for all sync panel states.
17. Full validation passes (`pnpm validate` exit 0).
18. No M4 or later capability (offset, waveform, scrubber) was introduced.
19. Sync panel never claims "perfectly synchronized", "in sync", or equivalent positive assertion.
