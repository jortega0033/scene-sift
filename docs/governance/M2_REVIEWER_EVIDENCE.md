# M2 Subtitle Parsing — Reviewer Evidence Record

**Date**: 2026-07-19  
**Milestone**: M2 Subtitle Parsing and Validation  

---

## Phase 11 — Implementation Specialist Verification (pre-audit)

| Reviewer | Verdict | Key Evidence |
|---|---|---|
| electron-security-reviewer | PASS | preload narrow API, IPC validated with Zod, all channels registered, typecheck+lint exit 0 |
| architecture-reviewer | PASS | architecture:validate exit 0, no cross-layer imports, subtitleFormatters.ts pure functions |
| database-reviewer | FAIL → RESOLVED | `clearSubtitleDocument` contract; fixed by making method private + restructuring tests |
| governance-verifier | PASS | governance:validate exit 0, adversarial tests 34/34, forbidden patterns clean |

---

## M2 Acceptance Audit — Specialist Reviewers

### Parser Correctness + Regex Safety

**Verdict**: FAIL → PASS (after remediation)

**Findings found**:
- MEDIUM: SRT >10,000 cues test missing (guard untested)
- MEDIUM: VTT cue limit test missing
- LOW: SRT zero-duration test missing
- LOW: VTT WEBVTT header dead code — `WEBVTTx` silently accepted
- LOW: MAX_TOTAL_TEXT code/spec mismatch (1,000,000 vs 1,048,576)

**Remediation applied**:
- Added SRT cue limit test (`tests/main/subtitle/SrtParser.test.ts`)
- Added VTT cue limit test (`tests/main/subtitle/VttParser.test.ts`)
- Added SRT zero-duration parser test
- Fixed VTT header validation: replaced double-if with single throw (`VttParser.ts:53`)
- Updated `MAX_TOTAL_TEXT` to `1_048_576` in both parsers
- Added VTT `WEBVTTx` test to prove fix

**Post-fix test count**: 15 SRT / 17 VTT / 9 Normalizer = 41 parser+normalizer tests, all pass

---

### Bounded Reader + Filesystem Safety

**Verdict**: PASS

**Evidence**:
- TOCTOU-safe: `fs.open()` → `fh.stat()` → `fh.read()` → `finally fh.close()`
- `path.resolve()` called before any FS access
- `stat.isFile()` verifies not directory/symlink
- Pre-read + post-read byte cap both enforced
- No logging in subtitleReader or subtitleService
- All 3 IPC channels accept only `projectId` UUID

**Medium finding**: Security test suite only tested ENOENT path. Remediated: added directory rejection test + oversized file test. Post-fix: 9/9 security tests pass.

---

### Database Migration + Atomicity

**Verdict**: FAIL → PASS (after remediation)

**Findings found**:
- HIGH: `clearSubtitleDocument` still `public` — previous phase-11 "resolution" (comment + test) did not prevent misuse
- MEDIUM: No test for stale doc deletion when reparse fails
- MEDIUM: Restart persistence test only verified `subtitle_documents` table, not project-row columns

**Remediation applied**:
- Changed `public clearSubtitleDocument` → `private clearSubtitleDocument` in `databaseService.ts`
- Removed 3 tests that directly called the now-private method
- Added `subtitle document lifecycle` describe block testing via public API (`setProjectSubtitlePath(null)` atomically clears both doc and project-row status)
- Added `deletes stale subtitle document when reparse fails` test in `persistSubtitleResult` describe
- Added `persists subtitle project-row columns across close and reopen` test

**Post-fix test count**: 19 database tests, all pass (was 18)

**Atomicity confirmed**: `persistSubtitleResult` uses single `db.transaction()` wrapping both project-row and subtitle_documents writes. TOCTOU abort re-reads path inside transaction. Both verified by tests.

---

### IPC/Preload + UI/UX + Scope

**Verdict**: PASS (no remediation needed)

**Key evidence**:
- 3 subtitle channels registered in `channels.ts`
- All input schemas: `z.object({ projectId: z.string().uuid() })` only
- No generic `invoke` passthrough in preload
- `ipcRenderer` not exposed
- All 7 subtitle states render correctly in `ProjectsPage.tsx`
- Raw error codes not rendered directly — all pass through `formatSubtitleError()`
- No `dangerouslySetInnerHTML` in renderer
- Parse is NOT automatic on subtitle select — always explicit
- 15/15 IPC contract tests pass
- No external network calls in subtitle pipeline
- No logging that could expose cue text

---

## Final Independent Reviews — Post-Remediation

### electron-security-reviewer (final)

**Verdict**: PASS

- Preload: `private clearSubtitleDocument` confirmed in databaseService (grep evidence)
- VTT header fix: single throw confirmed (not double-if)
- MAX_TOTAL_TEXT: `1_048_576` confirmed in both parsers
- Full test suite: 223 passed / EXIT:0
- Governance: passed / EXIT:0

### database/scope reviewer (final)

**Verdict**: PASS

- Database tests: 19 passed (lifecycle tests via public API confirmed)
- `clearSubtitleDocument` private in source: confirmed
- Zero direct calls to `clearSubtitleDocument` in test file: confirmed
- Cue limit tests in both parser test files: confirmed
- Security tests 9 passed (directory + oversized + ENOENT all covered)
- No M3/M4 scope: grep empty
- Architecture + dependency validation: both EXIT:0

---

## Final State

| Metric | Value |
|---|---|
| Unit tests | 223 / 223 pass |
| E2E tests | 29 / 29 pass |
| Visual tests | 13 / 13 pass |
| typecheck | exit 0 |
| lint (max-warnings=0) | exit 0 |
| governance:validate | exit 0 |
| architecture:validate | exit 0 |
| design:validate | exit 0 |
| dependencies:validate | exit 0 |
| build | exit 0 |

**Verdict: M2 ACCEPTED — READY FOR OWNER-OVERRIDE MERGE**
