# M3 Risk Register — Subtitle Synchronization Check

Version: 1.0
Status: Planning
Milestone: M3

---

## Format

Each entry: ID, Title, Category, Severity, Likelihood, Impact, Mitigation (as implemented in M3), Owner, Status.

**Severity scale**: High / Medium / Low
**Likelihood scale**: High / Medium / Low
**Status**: Open / Mitigated / Accepted / Closed

---

## RISK-M3-01

**Title**: Cue analysis on 10,000 cues blocks main thread

**Category**: Performance

**Severity**: Medium

**Likelihood**: Medium — subtitle files for long-form content or dense dialogue can easily reach 5,000–10,000 cues.

**Impact**: Electron main process becomes unresponsive. UI freezes. User sees a hung application, not a loading state.

**Mitigation (implemented in M3)**:
`SynchronizationAnalyzer.ts` executes analysis in a synchronous loop but is benchmarked in TC-ANA-18 against 10,000 cues with a 500ms completion requirement. If benchmarking reveals the loop exceeds 500ms, analysis is moved to a Worker thread using Node's `worker_threads` module. Worker result is serialized back to main process before DB write. The 500ms threshold is enforced as a test assertion, not a monitoring alert.

**Owner**: Phase 3 implementer (Analyzer)

**Status**: Open — mitigation strategy defined; must be validated in TC-ANA-18.

---

## RISK-M3-02

**Title**: `cues_json` parse failure crashes analysis

**Category**: Reliability

**Severity**: Low

**Likelihood**: Low — cues_json is written by M2 parser under controlled conditions, but schema drift or partial writes are theoretically possible.

**Impact**: Unhandled JSON.parse exception propagates through SynchronizationService, leaking error internals to IPC response or crashing the handler.

**Mitigation (implemented in M3)**:
`SynchronizationService` wraps the analyzer call in a try/catch. Any thrown exception results in `sync_status: 'check_failed'` written to DB and a structured error returned (TC-SVC-05). The raw exception message is never forwarded to the renderer. Additionally, `SynchronizationAnalyzer` validates that the input cues array is an actual array before iterating; if it is not, it returns `{ warnings: [] }` with a log entry.

**Owner**: Phase 4 implementer (Service)

**Status**: Open — mitigation in design; TC-SVC-05 must pass.

---

## RISK-M3-03

**Title**: False positive LATE_SUBTITLE_START for normal long intros

**Category**: UX / Accuracy

**Severity**: Medium

**Likelihood**: Medium — documentaries, films, and educational content routinely have 2–5 minute intros before dialogue begins.

**Impact**: Users see a spurious warning for valid subtitle files, eroding trust in the sync check feature.

**Mitigation (implemented in M3)**:
The `LATE_START_THRESHOLD_RATIO` is set at 0.15 (15% of video duration). For a 2-hour film, this is 18 minutes — well beyond typical intro length. The warning message explicitly uses the language "Subtitles start after [X]% of video" without labeling it an error, allowing users to dismiss the warning as expected for their content type. No auto-suppression logic is implemented; the threshold is documented in the shared constants file so it can be adjusted in a future milestone if data shows high false-positive rates.

**Owner**: Phase 3 implementer (Analyzer) + Phase 6 implementer (Renderer copy)

**Status**: Accepted — known imprecision; threshold chosen conservatively.

---

## RISK-M3-04

**Title**: SUBTITLE_SPAN_SHORT false positive for sparse or partial subtitle files

**Category**: UX / Accuracy

**Severity**: Medium

**Likelihood**: Medium — chapter-only subtitle files, translated excerpts, and hearing-impaired-only cue sets may legitimately cover a fraction of a video.

**Impact**: Users see a warning for intentionally sparse subtitle files.

**Mitigation (implemented in M3)**:
The `SUBTITLE_SPAN_SHORT` check is gated behind a minimum cue count of 10. Files with fewer than 10 cues are treated as sparse and receive no span warning (see AC-M3-002.4 and TC-ANA-08). This suppression is implemented as a simple `if (cues.length < 10) return` guard at the top of the span check function. The 10-cue threshold is a named constant (`SPAN_CHECK_MIN_CUES = 10`) in the shared thresholds file.

**Owner**: Phase 3 implementer (Analyzer)

**Status**: Mitigated — sparse guard implemented in design.

---

## RISK-M3-05

**Title**: Warning language implies definitive sync claim

**Category**: Governance

**Severity**: High

**Likelihood**: High without controls — "sync check" and "timing check" are easily confused in copy.

**Impact**: Users believe M3 provides audio/dialogue synchronization guarantees. If the feature is later found to be a structural check only, this constitutes misleading labeling, which is a prohibited governance violation per CLAUDE.md ("No fake UI functionality or misleading AI labels").

**Mitigation (implemented in M3)**:
AC-M3-004.1 is a hard acceptance criterion: the strings "in sync," "synchronized," and "audio sync" must not appear in the sync panel. Renderer copy uses "structural timing check" and "timing check passed" exclusively. TC-E2E-03 asserts the absence of the string "in sync" programmatically. The governance verifier role must review the final renderer copy before Phase 6 is marked done.

**Owner**: Phase 6 implementer (Renderer) + governance-verifier

**Status**: Open — must be verified in AC-M3-004.1 and TC-E2E-03.

---

## RISK-M3-06

**Title**: syncWarningsJson grows large for degenerate subtitle files

**Category**: Data

**Severity**: Low

**Likelihood**: Low — only 5 distinct warning codes are possible; even with all 5 firing, the JSON is small.

**Impact**: DB row size grows unexpectedly. SQLite is unbounded on TEXT columns, so this is not a crash risk, but it is a hygiene concern.

**Mitigation (implemented in M3)**:
At most 5 warning objects are stored per check (one per code). Each warning object contains only: `code` (string, bounded), and 1–2 numerical metadata fields (integer ms, float ratio, integer count). Worst-case JSON size is approximately 300 bytes. No per-cue data is stored. The IPC contract test (TC-IPC-01) asserts that the returned warnings array contains no subtitle text fields. No additional size cap is implemented in M3; this risk is accepted as low.

**Owner**: Phase 4 implementer (Service)

**Status**: Accepted — worst-case payload is bounded by design.

---

## RISK-M3-07

**Title**: Stale detection logic off-by-one in timestamp comparison

**Category**: Correctness

**Severity**: Medium

**Likelihood**: Medium — timestamp comparison bugs (using `>` vs `>=`) are a common source of off-by-one issues that are easy to write incorrectly.

**Impact**: Sync results incorrectly shown as `stale` immediately after a check completes (if `sync_checked_at` equals `inspectedAt`), or not shown as `stale` when they should be.

**Mitigation (implemented in M3)**:
The stale detection logic uses the comparison `inspectedAt > syncCheckedAt || subtitleParsedAt > syncCheckedAt`. Strictly greater-than is intentional: a sync check run at the same millisecond as an inspect is not considered stale. The logic is unit-tested in SynchronizationService tests with exact boundary values: `inspectedAt === syncCheckedAt` (expect NOT stale) and `inspectedAt === syncCheckedAt + 1` (expect stale). Both cases must have explicit test assertions.

**Owner**: Phase 4 implementer (Service)

**Status**: Open — boundary tests must be added to TC-SVC-04 or as separate TC-SVC-06.

---

## RISK-M3-08

**Title**: SynchronizationService leaks raw exception message to renderer

**Category**: Security

**Severity**: Medium

**Likelihood**: Medium — easy mistake when wrapping async calls; raw `error.message` can contain stack traces or internal file paths.

**Impact**: Internal implementation details (file paths, module names, stack traces) exposed to renderer process and potentially to logs that a user can read.

**Mitigation (implemented in M3)**:
The IPC handler for `sync:checkForProject` wraps all service calls. Any caught exception produces a structured return value: `{ success: false, error: { code: 'SYNC_CHECK_FAILED' } }`. The `error.message` property from the exception is logged to the main-process logger at DEBUG level only and is never included in the IPC response payload. TC-SVC-05 asserts that the IPC response does not contain the literal text from a thrown exception.

**Owner**: Phase 5 implementer (IPC/preload)

**Status**: Open — must be enforced in IPC handler implementation and verified in TC-SVC-05.

---

## RISK-M3-09

**Title**: Migration fails on older SQLite version

**Category**: Infrastructure

**Severity**: Low

**Likelihood**: Low — `better-sqlite3` bundles its own SQLite version and is consistent across environments.

**Impact**: Application fails to start after update if the migration cannot be applied.

**Mitigation (implemented in M3)**:
Migration 0003 uses only `ALTER TABLE ... ADD COLUMN` statements with NULL defaults — the safest possible migration form. No new tables, no column drops, no type changes. `ALTER TABLE ADD COLUMN` with NULL default is valid in every SQLite version from 3.1.3 onward (2005). TC-MIG-01 validates that existing rows survive the migration with NULL in new columns. The migration is run in a transaction so partial application is impossible.

**Owner**: Phase 2 implementer (DB migration)

**Status**: Mitigated — migration design uses safest available form.

---

## RISK-M3-10

**Title**: Sync check runs automatically on project load

**Category**: Scope Creep

**Severity**: Low

**Likelihood**: Low — the trigger constraint is explicit in M3 scope, but accidental auto-trigger could be introduced if a developer adds a `useEffect` that fires on project mount.

**Impact**: Sync check runs without user initiation, violating the explicit-trigger requirement and creating unexpected IPC traffic and DB writes. This is a scope violation, not a security issue.

**Mitigation (implemented in M3)**:
AC-M3-001.3 specifies that a never-checked project with ready video and subtitles shows `ready_to_check`, not a loading state. The renderer component must not call the `syncCheckForProject` IPC method in any `useEffect`, `useMemo`, or component initialization code. The E2E test TC-E2E-02 asserts that the check button is present but the result state is NOT `timing_ok` or `needs_review` on initial load. Code review for Phase 6 must verify the absence of auto-trigger logic.

**Owner**: Phase 6 implementer (Renderer) + verifier

**Status**: Open — must be confirmed by code review and TC-E2E-02.
