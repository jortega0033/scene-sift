# M2 — Test Plan

**Spec date:** 2026-07-19

---

## Overview

| Suite | Tool | Location | Risk |
|---|---|---|---|
| Parser unit tests | Vitest | `tests/main/subtitle/` | 1 |
| Normalizer unit tests | Vitest | `tests/main/subtitle/` | 1 |
| SubtitleService integration | Vitest | `tests/main/subtitle/` | 2 |
| DB methods | Vitest | `tests/main/database-service.test.ts` | 2 |
| IPC contract tests | Vitest | `tests/main/ipc-contracts.test.ts` | 2 |
| Renderer formatter tests | Vitest | `tests/renderer/subtitleFormatters.test.ts` | 1 |
| Security / adversarial tests | Vitest | `tests/main/subtitle/subtitle-security.test.ts` | 2 |
| E2E happy path | Playwright | `tests/e2e/subtitle-parsing.e2e.spec.ts` | 1 |
| E2E failure states | Playwright | `tests/e2e/subtitle-parsing.e2e.spec.ts` | 1 |
| Visual regression | Playwright | `tests/visual/subtitle-panel.spec.ts` | 1 |

---

## Parser unit tests (`tests/main/subtitle/SrtParser.test.ts`)

| Test | Input | Expected |
|---|---|---|
| Parses 1 valid cue | Single SRT cue | `cues.length = 1`, correct timestamps |
| Parses 10 valid cues | 10-cue SRT | `cues.length = 10` |
| Strips `<i>` / `<b>` / `<u>` / `<font>` tags | Cue with all tag types | Plain text only |
| Handles BOM-prefixed file | UTF-8 BOM + valid SRT | Cue index 1 correct |
| Handles CRLF line endings | CRLF SRT file | Same result as LF |
| Auto-assigns index for missing index line | Cue without index | `index = 1`, no crash |
| Skips cue with malformed timestamp | `00:01:XX,000` | 0 cues, no throw |
| Returns empty array for empty input | Empty string | `cues = []` |
| Tag regex does not backtrack on long angle content | `<${'A'.repeat(200)}>` | Tag not stripped (exceeds bound), no hang |
| Stops at 10,000 cues | 15,000-cue fixture | `cues.length = 10000`, CUES_TRUNCATED |

## Parser unit tests (`tests/main/subtitle/VttParser.test.ts`)

| Test | Input | Expected |
|---|---|---|
| Parses valid VTT with cue identifier | `WEBVTT\n\n1\n00:00:01.000 --> 00:00:02.000\nHello` | `cues.length = 1`, `text = 'Hello'` |
| Fails fatally without WEBVTT header | File without header | Fatal error, 0 cues |
| Discards NOTE blocks | File with `NOTE ...` block | Note not included in cues |
| Discards STYLE blocks + adds warning | File with `STYLE` block | `UNSUPPORTED_VTT_FEATURE` warning |
| Discards REGION blocks + adds warning | File with `REGION` block | `UNSUPPORTED_VTT_FEATURE` warning |
| Strips cue settings after timestamp | `00:00:01.000 --> 00:00:02.000 position:50%` | No crash, correct timestamps |
| Parses MM:SS.mmm format (no hours) | `01:23.456 --> 01:25.789` | `startMs = 83456`, `endMs = 85789` |
| Strips voice tags | `<v Speaker>Hello</v>` | `text = 'Hello'` |
| Strips timestamp tags | `<00:00:01.000>` | Stripped, no crash |
| Stops at 10,000 cues | 15,000-cue VTT | `cues.length = 10000`, CUES_TRUNCATED |

---

## Normalizer unit tests (`tests/main/subtitle/SubtitleNormalizer.test.ts`)

| Test | Input | Expected |
|---|---|---|
| Assigns 1-based index | Cues without index | `cue[0].index = 1`, `cue[1].index = 2` |
| Zero-duration cue: warning | `startMs = endMs` | ZERO_DURATION_CUE warning |
| Negative-duration cue: warning | `endMs < startMs` | NEGATIVE_DURATION_CUE warning |
| Out-of-order cues: warning once | Cue[1].start < Cue[0].start | OUT_OF_ORDER_CUES warning, emitted once |
| Overlapping cues: warning once | Cues that overlap | OVERLAPPING_CUES warning |
| Empty cue text: warning | Cue with `text = ''` | EMPTY_CUE_TEXT warning, cue retained |
| Duplicate cue index: warning | Two cues with same source index | DUPLICATE_CUE_INDEX warning |
| Truncates text over 2048 chars | Text = 3000 chars | `text.length = 2048`, CUE_TEXT_TRUNCATED |
| Total text cap at 1MB | Many cues totaling > 1MB | CUES_TRUNCATED when accumulated > 1MB |
| Lines array populated from text | Text with `\n` | `lines = ['line1', 'line2']` |

---

## SubtitleService integration (`tests/main/subtitle/subtitleService.test.ts`)

Uses real filesystem (temp dir) and real Drizzle SQLite DB. No mocks of internal methods.

| Test | Setup | Expected |
|---|---|---|
| Returns `not_selected` when no subtitle path | Project with null subtitlePath | outcome.status = 'not_selected' |
| Returns `unsupported` for .ass file | subtitlePath ends in `.ass` | status = 'unsupported', no readFile |
| Returns `missing` when file not found | subtitlePath → non-existent file | status = 'missing' |
| Returns `parse_failed` for oversized file | File with size > 2MB | status = 'parse_failed', error = 'SUBTITLE_FILE_TOO_LARGE' |
| Returns `ready` for valid SRT | 10-cue SRT temp file | status = 'ready', cueCount = 10 |
| Returns `ready` for valid VTT | 5-cue VTT temp file | status = 'ready', cueCount = 5 |
| Returns `parse_failed` for invalid VTT | VTT file without header | status = 'parse_failed' |
| Persists cue document to DB | Valid SRT parsed | `getSubtitleDocument()` returns document |
| Re-parse replaces existing cue doc | Parse twice with different content | Second doc's cueCount in DB |
| Re-parse failure deletes old cue doc | Parse success, then parse invalid | `getSubtitleDocument()` = null after failure |
| path.resolve() applied to stored path | Path with `../` components | Resolved path used (not raw stored path) |
| selectForProject (dialog mock selected) transitions to selected | Mock dialog returns a path | status='selected', subtitlePath set, no parse |
| clearForProject removes subtitle and cue doc | `clearSubtitleForProject(projectId)` | status='not_selected', cue doc cleared |
| Re-parse success replaces cue doc | Parse twice (10 cues then 15 cues) | Second doc's cue count in DB |
| Concurrent clearForProject during in-flight parse | clearForProject mid-parse | Parse result discarded, status=not_selected |
| SRT file containing VTT content (0 cues) | VTT content in .srt file | status='parse_failed', SUBTITLE_PARSE_ERROR |
| Open-handle read: file grown past limit between stat and read | Mock fh.read returns bytesRead > MAX | SUBTITLE_FILE_TOO_LARGE error |

---

## Database method tests (appended to `tests/main/database-service.test.ts`)

| Test | Method | Expected |
|---|---|---|
| updateProjectSubtitleState sets all columns | `updateProjectSubtitleState` (ready) | All 5 subtitle columns set |
| updateProjectSubtitleState: parse_failed | `updateProjectSubtitleState` (failed) | status, error set; cue_count null |
| persistSubtitleResult writes both rows atomically | Successful parse | Project row + subtitle_documents row both written |
| persistSubtitleResult rolls back both on doc write failure | Inject DB error on subtitle_documents | Project row not updated; state unchanged |
| upsertSubtitleDocument replaces row | Second call | Only one row, new content |
| getSubtitleDocument returns parsed document | After upsert | Returns SubtitleDocument; summary fields reconstructed from cues/warnings |
| getSubtitleDocument reconstructs summary | 5-cue doc with 2 warnings | summary.warningCount=2, summary.totalTextLength computed correctly |
| clearSubtitleDocument removes row | After upsert + clear | Row gone |
| setProjectSubtitlePath: path → selected | New path set | subtitle_status='selected', cue doc cleared |
| setProjectSubtitlePath: null → not_selected | null set | subtitle_status='not_selected', cue doc cleared |
| deleteProject cascades subtitle_documents | Project delete | No subtitle_documents row for projectId |
| Subtitle data persists across DB reopen | Close + reopen | All 5 columns identical |

---

## IPC contract tests (`tests/main/ipc-contracts.test.ts`)

Add test group `subtitle IPC contracts`:

| Test | Input | Expected |
|---|---|---|
| selectForProject: accepts valid UUID | `{ projectId: 'valid-uuid-v4' }` | No validation error |
| selectForProject: rejects non-UUID | `{ projectId: 'not-a-uuid' }` | Validation error, structured error returned |
| selectForProject: rejects missing projectId | `{}` | Validation error |
| parseForProject: accepts valid UUID | `{ projectId: 'valid-uuid-v4' }` | No validation error |
| parseForProject: rejects non-UUID | `{ projectId: 'not-a-uuid' }` | Validation error, structured error returned |
| parseForProject: rejects missing projectId | `{}` | Validation error |
| clearForProject: accepts valid UUID | `{ projectId: 'valid-uuid-v4' }` | No validation error |
| clearForProject: rejects non-UUID | `{ projectId: 123 }` | Validation error |

---

## Renderer formatter tests (`tests/renderer/subtitleFormatters.test.ts`)

| Test | Input | Expected |
|---|---|---|
| `formatCueCount(null)` | null | `'—'` |
| `formatCueCount(0)` | 0 | `'0 cues'` |
| `formatCueCount(1)` | 1 | `'1 cue'` |
| `formatCueCount(42)` | 42 | `'42 cues'` |
| `formatSubtitleDuration(null)` | null | `'—'` |
| `formatSubtitleDuration(0)` | 0 | `'0:00'` |
| `formatSubtitleDuration(65000)` | 65000ms | `'1:05'` |
| `formatSubtitleDuration(3661000)` | 3661000ms | `'1:01:01'` |
| `formatSubtitleError('SUBTITLE_FILE_NOT_FOUND')` | known code | Human-readable string |
| `formatSubtitleError('SUBTITLE_FILE_TOO_LARGE')` | known code | Human-readable string |
| `formatSubtitleError('UNKNOWN_CODE')` | unknown | Fallback with code |

---

## Security / adversarial tests (`tests/main/subtitle/subtitle-security.test.ts`)

| Test | Adversarial input | Expected |
|---|---|---|
| 1M-cue SRT: truncates at 10000 | Generated 1M-cue SRT string | cues.length = 10000, no OOM |
| Tag with 200-char attribute | `<${'A'.repeat(200)}>` | Not stripped (bound), no ReDoS hang |
| Nested angle brackets | `<<inner>>` | Not catastrophic, returns quickly |
| `<script>` in cue text | `<script>alert(1)</script>` | `text = 'alert(1)'` (tags stripped) |
| Path with `../` traversal | Stored path `'../../../etc/passwd'` | `path.resolve()` applied; if not found → missing |
| BOM + 10-cue SRT | BOM prepended | 10 cues correctly parsed |
| All-whitespace cue text | `   \t   ` | EMPTY_CUE_TEXT warning |
| Cue text 2049 chars | String of length 2049 | Truncated to 2048, CUE_TEXT_TRUNCATED |
| 2MB string of `<` chars as whole file | `'<'.repeat(2_097_152)` | Tag regex completes within 2s (no catastrophic backtrack) |
| SRT file containing VTT content | VTT blocks in .srt file | `parse_failed`, 0 cues (zero-cue rule) |
| PII in cue text: logger spy | Identifiable PII as cue text | `vi.spyOn(logger)` — no log call received cue text |
| subtitleParseError is code not raw message | ENOENT fs error | Stored `subtitle_parse_error` = `'SUBTITLE_FILE_NOT_FOUND'` not `'ENOENT: ...'` |
| dangerouslySetInnerHTML absent from subtitle panel | Mechanical grep of `src/renderer/features/projects/**` | `grep -r 'dangerouslySetInnerHTML' src/renderer/features/projects/` exits 1 (no matches). Governance test in `tests/main/subtitle/subtitle-security.test.ts` runs this grep and asserts empty output. Required by AC-M2-035. |

All adversarial tests must complete within 2 seconds (Vitest `{ timeout: 2000 }` option on each test).

---

## E2E tests (`tests/e2e/subtitle-parsing.e2e.spec.ts`)

Uses Browser QA mode with subtitle fixtures.

| Scenario | Fixture | Assertion |
|---|---|---|
| Subtitle panel visible when no subtitle | `subtitle-not-selected` | "No subtitle selected" text visible |
| Parse button visible when selected not parsed | `subtitle-selected-not-parsed` | "Parse" button visible |
| Success state displays cue count and duration | `subtitle-ready` | Cue count text visible, duration formatted |
| Warning badge visible for ready_with_warnings | `subtitle-ready-with-warnings` | Warning indicator visible |
| Parse failure shows human-readable error | `subtitle-failed` | Error message visible, raw code NOT visible |
| Missing file state shows correct message | `subtitle-missing` | "Subtitle file not found" or similar visible |
| Unsupported format shows format message | `subtitle-unsupported` | Message about supported formats visible |

---

## Visual regression tests (`tests/visual/subtitle-panel.spec.ts`)

Golden images captured for each subtitle state in the project info panel. Run after any UI change to subtitle panel.

| Snapshot | Fixture |
|---|---|
| subtitle-not-selected | `subtitle-not-selected` project |
| subtitle-selected | `subtitle-selected-not-parsed` project |
| subtitle-ready | `subtitle-ready` project |
| subtitle-ready-with-warnings | `subtitle-ready-with-warnings` project |
| subtitle-parse-failed | `subtitle-failed` project |
| subtitle-missing | `subtitle-missing` project |
| subtitle-unsupported | `subtitle-unsupported` project |

---

## Coverage expectations

| Layer | Target |
|---|---|
| SrtParser | > 95% |
| VttParser | > 95% |
| SubtitleNormalizer | > 95% |
| SubtitleService orchestration | > 85% |
| SubtitleFormatters (renderer) | 100% |
| DB subtitle methods | > 90% |

---

## Test data

Test subtitle fixtures live at `tests/fixtures/subtitles/`:
- `valid-10-cue.srt`
- `valid-5-cue.vtt`
- `no-header.vtt`
- `invalid-timestamps.srt`
- `tags.srt` (various tag types)
- `bom-prefixed.srt`
- `crlf-endings.srt`
- `oversized.srt` (2MB+ — generated programmatically in test, not checked in)
- `warnings-mixed.srt` (zero-duration, overlapping cues)
