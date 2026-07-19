# M3 — Current Timing State (Post-M2)

**Audit date:** 2026-07-19
**Branch:** main (post-M2 merge)

---

## Summary

M2 implemented subtitle file parsing, cue normalization, and persistence of subtitle metadata. After M2, the database holds video duration (from M1 FFprobe), subtitle cue count, and the end timestamp of the last subtitle cue. These three fields are the raw ingredients for M3's synchronization check. No sync analysis, no sync status field, and no sync UI exists.

---

## Capability Map

| Capability | Status | Evidence |
|---|---|---|
| Video duration storage | IMPLEMENTED | `schema.ts: duration_seconds REAL` (nullable float) |
| Video fps storage | IMPLEMENTED | `schema.ts: fps REAL` (nullable float) |
| Subtitle last cue end timestamp | IMPLEMENTED | `schema.ts: subtitle_last_cue_end_ms INTEGER` (nullable int) |
| Subtitle cue count | IMPLEMENTED | `schema.ts: subtitle_cue_count INTEGER` (nullable int) |
| Subtitle parse status (7 states) | IMPLEMENTED | `schema.ts: subtitle_status TEXT` |
| Full cue document (cues_json) | IMPLEMENTED | `subtitle_documents.cues_json` — JSON blob, SubtitleCue[] |
| Subtitle parse warnings | IMPLEMENTED | `subtitle_documents.warnings_json` — ParseWarning[] |
| IPC handler registration pattern | IMPLEMENTED | `registerValidatedHandler()` in `src/main/ipc/registerIpcHandlers.ts` |
| Preload contextBridge narrow method pattern | IMPLEMENTED | `src/preload/index.ts` — typed namespace methods |
| Shared channel constants | IMPLEMENTED | `src/shared/ipc/channels.ts` |
| Shared IPC contracts | IMPLEMENTED | `src/shared/ipc/contracts.ts` |
| Duration formatter (video) | IMPLEMENTED | `src/renderer/features/projects/mediaFormatters.ts` |
| Subtitle duration display (last cue end) | PARTIAL | `subtitleFormatters.ts:formatSubtitleDuration` shows ms value — not compared to video |
| `sync_status` column on projects | MISSING | No `sync_status` column in `schema.ts` |
| Sync analysis result storage | MISSING | No `sync_analysis_version`, `sync_analyzed_at`, or `sync_warnings_json` column |
| `SynchronizationAnalyzer` class | MISSING | No sync analysis logic anywhere |
| `SynchronizationService` | MISSING | No `src/main/services/sync/` directory |
| `SYNC_ANALYZE_FOR_PROJECT` IPC channel | MISSING | Not in `channels.ts` |
| Sync preload method | MISSING | No `window.sceneSift.sync.*` |
| Sync summary panel in renderer | MISSING | No sync UI in `ProjectsPage.tsx` |
| Sync state machine | MISSING | No sync states defined |
| Sync formatter functions | MISSING | No `syncFormatters.ts` |
| Browser QA sync fixtures | MISSING | No sync states in `src/renderer/qa/fixtures.ts` |
| DB migration for sync columns | MISSING | No `0003_*.sql` migration |
| Sync IPC contract tests | MISSING | Not in `tests/main/ipc-contracts.test.ts` |

---

## `durationSeconds` Field Detail

**Column:** `projects.duration_seconds`
**Type:** `REAL` (SQLite), nullable
**Units:** seconds as a floating-point value (e.g., `5423.456`)
**Precision:** FFprobe reports duration to millisecond precision (3 decimal places typical). JavaScript `number` (64-bit IEEE 754) can represent integer milliseconds exactly up to 2^53 ms (~285,616 years). No precision loss occurs at subtitle-relevant timescales.
**Null semantics:** `null` when FFprobe did not return a duration (inspection failed, container format with no duration field, or no video inspected yet). M3 must handle this case: no duration means sync analysis cannot proceed, and the project enters `not_available` sync state immediately.
**Schema type in projectSchema:** `durationSeconds: z.number().nullable()`
**Conversion to ms for M3:** `Math.floor(durationSeconds * 1000)` — see `M3_TIMING_MODEL.md` for rationale.

---

## `fps` Field Detail

**Column:** `projects.fps`
**Type:** `REAL` (SQLite), nullable
**Units:** frames per second (e.g., `23.976`, `29.97`, `59.94`)
**M3 relevance:** Not needed for M3 structural checks. Frame-level precision requires a video preview scrubber (M4). M3 analysis operates at millisecond granularity against integer cue timestamps — fps adds no information for a duration-bounds check.
**Decision:** `SynchronizationAnalyzer.analyze()` does not accept `fps` as a parameter. The field is available in the project row and may be displayed in the sync panel for context, but it does not influence analysis results in M3.

---

## `subtitleLastCueEndMs` Field Detail

**Column:** `projects.subtitle_last_cue_end_ms`
**Type:** `INTEGER` (SQLite), nullable
**Units:** milliseconds (integer)
**Source:** Set by M2 subtitle parse. Equals `cues[cues.length - 1].endMs` from the normalized `SubtitleDocument`.
**Null semantics:** `null` when subtitle status is `not_selected`, `selected`, `parse_failed`, `unsupported`, or `missing`. Also `null` when parse produced zero valid cues (treated as `parse_failed` in M2 — so in practice this null case should not coexist with a non-null `subtitle_status = 'ready'`).
**M3 use:** Primary input to span-vs-duration checks. Also available as `subtitleDocument.summary.lastCueEndMs` via the full cue document, but the projects-row column is preferred to avoid loading the full cue blob for summary-only operations.

---

## `subtitleCueCount` Field Detail

**Column:** `projects.subtitle_cue_count`
**Type:** `INTEGER` (SQLite), nullable
**M3 use:** Informational only. M3 includes cue count in the sync summary panel for display context. Not directly used in structural analysis checks.

---

## Full Cue Document Availability

The complete `SubtitleDocument` (all cues with `startMs`, `endMs`, `text`, `lines`) is available via `subtitle_documents.cues_json`. M3's `SynchronizationAnalyzer` receives the deserialized document and can compute:

- `firstCueStartMs` from `cues[0].startMs`
- `lastCueEndMs` from `cues[cues.length - 1].endMs` (matches the projects-row summary column)
- Per-cue range violations (any cue with `endMs > durationMs + TAIL_TOLERANCE_MS`)

**Analysis input policy (decided):** M3 reads from persisted data only. `SynchronizationService` fetches the project row and subtitle document from the database, then passes them to the pure `SynchronizationAnalyzer`. No file reads occur at analysis time. The subtitle file is not re-opened.

---

## M2 Normalizer Warnings: Parser Integrity vs Video-Relative

The M2 normalizer emits `ParseWarning` codes during subtitle parsing. These are stored in `subtitle_documents.warnings_json`. All ten existing codes are parser-integrity warnings — they describe problems within the subtitle file itself, independent of any video metadata.

### Parser-integrity warnings (M2 scope)

| Code | What it detects | Requires video? |
|---|---|---|
| `ZERO_DURATION_CUE` | `endMs == startMs` — zero-length cue | No |
| `NEGATIVE_DURATION_CUE` | `endMs < startMs` — reversed timestamps | No |
| `OUT_OF_ORDER_CUES` | Cue start before previous cue start | No |
| `OVERLAPPING_CUES` | Cue overlaps the previous cue's time range | No |
| `EMPTY_CUE_TEXT` | No readable text after tag stripping | No |
| `DUPLICATE_CUE_INDEX` | Two cues share the same source index | No |
| `CUE_TEXT_TRUNCATED` | Single cue text exceeded 2048-char limit | No |
| `CUES_TRUNCATED` | Parse stopped at 10,000-cue or 1 MB limit | No |
| `UNSUPPORTED_VTT_FEATURE` | VTT STYLE or REGION block encountered | No |
| `RECOVERABLE_TIMESTAMP_ERROR` | Timestamp line malformed; cue skipped | No |

### Video-relative checks (M3 scope — not yet defined as warning codes)

These checks require `durationSeconds` from the projects row. They cannot be performed during subtitle parsing because video metadata may not be available at parse time (M2 allows parsing a subtitle for a project whose video has not yet been inspected). M3 defines new `SyncWarningCode` values for these checks — they are a separate taxonomy and must not be added to `ParseWarningCode`.

| M3 check | What it detects | Status |
|---|---|---|
| Cues outside video range | Any cue with `endMs > durationMs + TAIL_TOLERANCE_MS` | Not yet defined |
| Cues before video start | Any cue with `startMs < 0` | Not yet defined |
| Subtitle span short | `lastCueEndMs - firstCueStartMs` less than 50% of `durationMs` | Not yet defined |
| Subtitle span long | `lastCueEndMs` exceeds 120% of `durationMs` | Not yet defined |
| Late first cue | `firstCueStartMs` after 15% of `durationMs` | Not yet defined |
| Large tail gap | `durationMs - lastCueEndMs` exceeds 10,000 ms | Not yet defined |
| Possible offset indicator | Consistent shift pattern across most cues | Not yet defined |

---

## IPC and Preload Patterns Available to Extend

M2 established these patterns that M3 will follow:

| Pattern | Location | M3 extension point |
|---|---|---|
| `registerValidatedHandler(channel, contractKey, handler)` | `src/main/ipc/registerIpcHandlers.ts` | Register `SYNC_ANALYZE_FOR_PROJECT` handler |
| Narrow preload namespace | `src/preload/index.ts` | Add `sync: { analyzeForProject(projectId) }` |
| Shared channel constants | `src/shared/ipc/channels.ts` | Add `SYNC_ANALYZE_FOR_PROJECT` |
| Shared IPC contracts | `src/shared/ipc/contracts.ts` | Add sync input/output contract schemas |
| `projectSchema` with nullable fields | `src/shared/schemas/project.ts` | Add `syncStatus`, `syncAnalyzedAt`, `syncAnalysisVersion` |
| Pure formatter functions | `src/renderer/features/projects/subtitleFormatters.ts` | New `syncFormatters.ts` by analogy |
| TanStack Query invalidation on IPC return | `ProjectsPage.tsx` | Invalidate `projects` query on sync result |
| Structured error codes, never raw in UI | `subtitleFormatters.ts` pattern | `formatSyncWarning(code: SyncWarningCode): string` |

---

## Existing Duration Formatters

`src/renderer/features/projects/mediaFormatters.ts` contains duration formatters for video metadata display. M3 adds `syncFormatters.ts` (by analogy with `subtitleFormatters.ts`) — a separate pure module for sync-specific formatting. Do not extend `mediaFormatters.ts` with sync concepts.

---

## Complete Missing Capability List for M3

| Missing capability | Required for |
|---|---|
| `sync_status TEXT` column on `projects` | State machine, restart persistence |
| `sync_analysis_version INTEGER` column on `projects` | Threshold-change stale detection |
| `sync_analyzed_at INTEGER` column on `projects` | Restart persistence, display |
| `sync_warnings_json TEXT` column on `projects` | Persisting sync warning list |
| DB migration `0003_sync_analysis.sql` | All of the above |
| `SynchronizationAnalyzer` class (pure, no IO) | Analysis logic |
| `SynchronizationService` (DB reads + orchestration) | Analysis trigger, persistence |
| `SYNC_ANALYZE_FOR_PROJECT` IPC channel | Renderer-triggered analysis |
| `sync.analyzeForProject` preload method | Renderer can invoke sync check |
| Sync contract in `contracts.ts` | IPC payload validation |
| `syncStatus` and related fields in `projectSchema` | Type-safe renderer access |
| Sync summary panel in `ProjectsPage.tsx` | User-visible result |
| `syncFormatters.ts` pure formatter module | Human-readable sync states and warnings |
| Browser QA sync fixture states | QA mode coverage |
| Sync mock handlers in `mockSceneSiftApi.ts` | QA mode transitions |
| IPC contract tests for sync channel | `tests/main/ipc-contracts.test.ts` |
| `SynchronizationAnalyzer` unit tests | Threshold boundary coverage |
| `SynchronizationService` unit tests | Orchestration and persistence |
| Sync formatter unit tests | `tests/renderer/` |
| Sync E2E tests | `tests/e2e/` |
| Sync visual regression tests | `tests/visual/` |
