# M2 — Implementation Plan

**Spec date:** 2026-07-19
**Reconciled:** 2026-07-19 (Stage A spec reconciliation run)
**Max implementation attempts per task:** 3 (per loop-constraints.md)

---

## Risk classification — actual gate.yaml results

Risk levels below reflect the actual `gate.yaml` path rules, not manually estimated labels.
Effective risk = the highest rule that matches any file in the phase.

| Path pattern | gate.yaml rule | Risk |
|---|---|---|
| `src/shared/ipc/**` | high-risk-electron | **3** |
| `src/shared/**` (non-IPC) | low-risk | 1 |
| `src/database/migrations/**` | high-risk-electron | **3** |
| `src/database/schema.ts` | medium-risk | 2 |
| `src/main/services/database/**` | medium-risk | 2 |
| `src/main/**` (all other) | high-risk-electron | **3** |
| `src/preload/**` | high-risk-electron | **3** |
| `src/renderer/features/**` | medium-risk | 2 |
| `src/renderer/hooks/**` | medium-risk | 2 |
| `src/renderer/stores/**` | medium-risk | 2 |
| `src/renderer/qa/**` | (no specific rule → nearest: renderer layer) | **2** |
| `tests/**` | low-risk | 1 |
| `docs/**` | docs-only | 0 |

Key corrections from initial plan:
- Phase 1 (channels.ts, contracts.ts): escalated from Risk 1 → **Risk 3**
- Phase 3 (parsers, normalizer, reader): escalated from Risk 1 → **Risk 3** (split 3A/3B)
- Phase 4 (SubtitleService + IPC): escalated from Risk 2 → **Risk 3**
- Phase 6 (renderer features): escalated from Risk 1 → **Risk 2**
- Phase 7 (QA fixtures in renderer): escalated from Risk 1 → **Risk 2**

---

## Owner override

All manual approval gates in this plan are subject to:

```
OWNER OVERRIDE — MANUAL PHASE APPROVAL AND MANUAL RUNTIME TESTING SKIPPED
Scope: M2 Subtitle Parsing and Validation only.
Manual phase gates: SKIPPED by repository-owner decision.
Manual runtime testing: SKIPPED, not passed.
Independent specialist verification: STILL MANDATORY.
Automated phase validation: STILL MANDATORY.
Critical/high defects: CANNOT BE WAIVED.
Security, migration, persistence, governance, and test failures: CANNOT BE WAIVED.
```

Where "Human approval: SKIPPED by owner override" appears below, this applies.
Independent verification remains mandatory at all risk-3 phases.

---

## Phase overview

```
Phase 1  — Shared contracts + IPC channel definitions (Risk 3)
Phase 2  — DB migration + schema + repository methods (Risk 3 / 2)
Phase 3A — Pure parsers and normalizer (Risk 3)
Phase 3B — Bounded filesystem reader (Risk 3)
Phase 4  — SubtitleService + IPC handlers (Risk 3)
Phase 5  — Preload exposure (Risk 3)
Phase 6  — Renderer subtitle panel + formatters (Risk 2)
Phase 7  — Browser QA fixtures (Risk 2)
Phase 8  — Tests: unit + integration + security (Risk 1–2)
Phase 9  — E2E + visual regression (Risk 1)
Phase 10 — Full validation + governance checks
Phase 11 — Independent verification
```

Sequencing: Phases 1 → 2 → 3A+3B (parallel) → 4 → 5 → 6+7 (parallel) → 8 → 9 → 10 → 11.
Phase 4 requires Phase 2 complete. Phase 5 requires Phase 4 complete.
Phases 6+7 can start after Phase 1. Phase 8 runs alongside Phases 3–7.

---

## Phase 1 — Shared contracts (Risk 3)

**Risk escalation:** `src/shared/ipc/**` matches the `high-risk-electron` rule (Risk 3).

**Files modified:**
- `src/shared/ipc/channels.ts` — add `SUBTITLE_SELECT_FOR_PROJECT`, `SUBTITLE_PARSE_FOR_PROJECT`, `SUBTITLE_CLEAR_FOR_PROJECT`
- `src/shared/ipc/contracts.ts` — add subtitle IPC input/output contracts
- `src/shared/schemas/subtitle.ts` (new, Risk 1) — Zod schemas: ParseWarningCodeSchema, ParseWarningSchema, SubtitleCueSchema, SubtitleDocumentSchema
- `src/shared/schemas/project.ts` (Risk 1) — add 5 subtitle status fields to projectSchema

**Agent:** governed-implementer
**Risk:** 3 (IPC channel files)
**Human approval:** SKIPPED by owner override
**Verifier:** architecture-reviewer (confirm channels.ts only adds constants, no runtime code)
**Required checks:** `pnpm typecheck`, `pnpm lint`, `pnpm governance:validate`

---

## Phase 2 — Database migration + schema + repository (Risk 3 / 2)

**Files modified:**
- `src/database/migrations/0002_subtitle_parsing.sql` (new) — Risk 3 (migrations path)
- `src/database/schema.ts` — Risk 2 (schema.ts path)
- `src/main/services/database/databaseService.ts` — Risk 2 (database service path)

Effective phase risk: **3** (migration file drives the escalation).

**Agent:** governed-implementer
**Risk:** 3
**Human approval:** SKIPPED by owner override
**Verifiers:** architecture-reviewer (DB layer boundary) + electron-security-reviewer (migration safety)
**Required checks:** `pnpm typecheck`, `pnpm lint`, `pnpm test` (database tests)

**Implementation notes:**
- Migration is additive only (`ALTER TABLE ADD` nullable columns, `CREATE TABLE`)
- `upsertSubtitleDocument` MUST use explicit `INSERT ... ON CONFLICT DO UPDATE SET` (not `INSERT OR REPLACE`)
- `persistSubtitleResult` MUST execute both writes inside `db.transaction()` (better-sqlite3 synchronous transaction)
- `setProjectSubtitlePath` MUST execute `clearSubtitleDocument` + project update inside `db.transaction()`
- `deleteProject` MUST call `clearSubtitleDocument` inside transaction before deleting project row
- `createProject` MUST set `subtitle_status = 'selected'` when `subtitlePath` is non-null in input
- SubtitleSummary fields (`firstCueStartMs`, `totalTextLength`, `warningCount`) reconstructed from cues/warnings on load — NOT stored as separate columns

---

## Phase 3A — Pure parsers and normalizer (Risk 3)

**Why Risk 3:** All files in `src/main/**` match the `high-risk-electron` rule. Even though
parsers are pure computation (no IO, no DB), they reside in the main process layer and
therefore carry Risk 3 per gate.yaml.

**Files created:**
- `src/main/services/subtitle/parsers/SrtParser.ts`
- `src/main/services/subtitle/parsers/VttParser.ts`
- `src/main/services/subtitle/subtitleNormalizer.ts`

**Agent:** governed-implementer
**Risk:** 3
**Human approval:** SKIPPED by owner override
**Verifier:** electron-security-reviewer (confirm no IO, no eval, no shell, no external process in parsers)
**Required checks:** `pnpm typecheck`, `pnpm lint`, `pnpm test` (parser unit tests)

**Implementation notes:**
- Parsers are pure functions — no filesystem, database, IPC, or electron imports
- All regex patterns must match M2_PARSING_RULES.md exactly
- Tag strip: `/<[^>]{0,128}>/g` — fixed bound, no unbounded quantifier
- SRT timestamp: fixed-width digit groups `(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})`
- VTT timestamp: split on `-->` first, then parse each side with fixed patterns
- Loop guard at 10,000 cues — stop parsing, add `CUES_TRUNCATED` warning
- Zero-cue result treated as fatal (parse_failed) by SubtitleService

---

## Phase 3B — Bounded subtitle reader (Risk 3)

**Files created:**
- `src/main/services/subtitle/subtitleReader.ts`

**Agent:** governed-implementer
**Risk:** 3
**Human approval:** SKIPPED by owner override
**Verifier:** electron-security-reviewer (mandatory — filesystem access, handle management, TOCTOU)
**Required checks:** `pnpm typecheck`, `pnpm lint`, `pnpm test` (reader tests)

**Implementation notes:**
- Open file handle first, then fstat through the same handle (not pre-read stat)
- Read at most `MAX_SUBTITLE_BYTES + 1` bytes; reject if `bytesRead > MAX_SUBTITLE_BYTES`
- `fh.close()` in `finally` block — handle always released
- Symlinks: followed (platform default — paths come from native OS dialog)
- UTF-8 BOM stripped if present
- CRLF normalized to LF before returning
- No subtitle content in any log statement
- Errors mapped to `AppError` with structured codes before throwing

---

## Phase 4 — SubtitleService + IPC handlers (Risk 3)

**Files created:**
- `src/main/services/subtitle/subtitleService.ts`

**Files modified:**
- `src/main/ipc/registerIpcHandlers.ts` — register 3 subtitle handlers:
  `SUBTITLE_SELECT_FOR_PROJECT`, `SUBTITLE_PARSE_FOR_PROJECT`, `SUBTITLE_CLEAR_FOR_PROJECT`

**Agent:** governed-implementer
**Risk:** 3
**Human approval:** SKIPPED by owner override
**Verifiers:** architecture-reviewer + electron-security-reviewer (both mandatory)
**Required checks:** `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`

**Implementation notes:**
- SubtitleService orchestrates: dialog (select) | path validation → file read → parse → normalize → persist
- `selectSubtitleForProject`: opens existing `selectSubtitleFile()` dialog; renderer provides only projectId
- `parseSubtitleForProject`: path.resolve() applied in service (single point of canonicalization)
- IPC handler validates projectId as UUID before calling service
- No subtitle path or format accepted via IPC payload — paths read from DB server-side for parse
- `subtitleParseError` stored as bounded error code, never raw `err.message`

---

## Phase 5 — Preload exposure (Risk 3)

**File modified:**
- `src/preload/index.ts` — expose `window.sceneSift.subtitle.{selectForProject, parseForProject, clearForProject}`

**Agent:** governed-implementer
**Risk:** 3 (preload = highest-impact change)
**Human approval:** SKIPPED by owner override
**Verifier:** electron-security-reviewer (mandatory — preload surface review)
**Required checks:** `pnpm typecheck`, `pnpm lint`, `pnpm test:electron`

**Implementation notes:**
- Expose ONLY three narrow methods
- Input parameters typed — `(projectId: string)` only; no path parameter exposed
- No generic invoke pass-through
- Keep in sync with `src/shared/ipc/channels.ts`
- Update `tests/main/ipc-contracts.test.ts` for new channels
- `selectForProject` returns `ProjectRecord | null` (null if dialog cancelled)

---

## Phase 6 — Renderer subtitle panel + formatters (Risk 2)

**Files created:**
- `src/renderer/features/projects/subtitleFormatters.ts` (Risk 2)

**Files modified:**
- `src/renderer/features/projects/ProjectsPage.tsx` (Risk 2)

**Agent:** governed-implementer
**Risk:** 2
**Human approval:** SKIPPED by owner override
**Verifier:** design-system-reviewer (token usage, no hardcoded values, no `dangerouslySetInnerHTML`)
**Required checks:** `pnpm typecheck`, `pnpm lint`, `pnpm test`

**Implementation notes:**
- `subtitleFormatters.ts` = pure functions, zero imports from main/preload/electron/node
- Subtitle panel always rendered when project selected (same pattern as M1 media info panel)
- All 7 subtitle states must render without errors
- `dangerouslySetInnerHTML` NEVER for subtitle content
- No `eval`, no dynamic script injection
- Design tokens for all colors/spacing — no hardcoded hex/px values
- "Select Subtitle" button calls `window.sceneSift.subtitle.selectForProject(projectId)`

---

## Phase 7 — Browser QA fixtures (Risk 2)

**Note — gate.yaml classification gap:** `src/renderer/qa/**` has no explicit rule in gate.yaml. Risk 2 is a conservative estimate based on the nearest matching rule (`src/renderer/features/**` = medium-risk = Risk 2). This classification is pending gate.yaml formalization with an explicit `src/renderer/qa/**` entry. Until gate.yaml is updated, treat as Risk 2 and apply all Risk-2 required checks. Escalate to governance-verifier before Phase 7 implementation if gate.yaml has not been updated by then.

**Files modified:**
- `src/renderer/qa/fixtures.ts` — add 7 subtitle state fixtures
- `src/renderer/qa/mockSceneSiftApi.ts` — add mock subtitle handlers

**Agent:** governed-implementer
**Risk:** 2 (conservative — see gate.yaml gap note above)
**Human approval:** SKIPPED by owner override
**Required checks:** `pnpm typecheck`, `pnpm test:e2e` (browser QA E2E pass)

**Implementation notes:**
- Mock `selectForProject` transitions fixture to `selected`
- Mock `parseForProject` transitions fixture state and returns updated project
- Mock `clearForProject` transitions to `not_selected`
- Mocks excluded from production via `VITE_SCENESIFT_BROWSER_QA` guard
- No impossible state combinations in mock data

---

## Phase 8 — Tests (Risk 1–2)

**Files created:**
- `tests/main/subtitle/SrtParser.test.ts` (Risk 1)
- `tests/main/subtitle/VttParser.test.ts` (Risk 1)
- `tests/main/subtitle/SubtitleNormalizer.test.ts` (Risk 1)
- `tests/main/subtitle/subtitleService.test.ts` (Risk 1)
- `tests/main/subtitle/subtitle-security.test.ts` (Risk 1–2)
- `tests/renderer/subtitleFormatters.test.ts` (Risk 1)
- `tests/fixtures/subtitles/` — fixture files (Risk 1)

**Files modified:**
- `tests/main/database-service.test.ts` — append subtitle DB method tests
- `tests/main/ipc-contracts.test.ts` — append subtitle IPC contract tests

**Agent:** governed-implementer
**Risk:** 1 (tests generally) / 2 (security adversarial tests)
**Human approval:** SKIPPED by owner override (for security tests)
**Required checks:** `pnpm test` (all unit pass)

**Coverage requirements:**
- SrtParser > 95%
- VttParser > 95%
- SubtitleNormalizer > 95%
- SubtitleService orchestration > 85%
- SubtitleFormatters (renderer) 100%
- DB subtitle methods > 90%

**Key tests required (beyond M2_TEST_PLAN.md):**
- `persistSubtitleResult` atomicity: both rows written or both rolled back
- Transaction rollback when project update fails
- Transaction rollback when subtitle_documents write fails
- Restart persistence: close DB, reopen, verify subtitle state and cue doc survive
- `parse_failed` state survives restart
- `ready_with_warnings` state survives restart
- Cleared subtitle remains cleared after restart
- No orphan subtitle_documents row after project deletion
- `selectForProject`: dialog cancel returns null, no DB change
- `clearForProject`: transitions to `not_selected`, cue doc deleted
- Logger spy: no cue text in any log output
- `subtitleParseError` is bounded code, not raw `err.message`
- `dangerouslySetInnerHTML` grep governance test

---

## Phase 9 — E2E + visual regression (Risk 1)

**Files created:**
- `tests/e2e/subtitle-parsing.e2e.spec.ts`
- `tests/visual/subtitle-panel.spec.ts`

**Agent:** governed-implementer
**Risk:** 1
**Required checks:** `pnpm test:e2e`, `pnpm test:visual` (update goldens)

**Notes:**
- E2E uses Browser QA mode only — no real filesystem access in E2E
- Visual goldens generated fresh and reviewed before commit

---

## Phase 10 — Full validation

Run all required checks:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm governance:validate
pnpm architecture:validate
pnpm design:validate
pnpm dependencies:validate
pnpm build
pnpm package:dir
pnpm test:e2e
pnpm validate
pnpm validate:full
```

All must exit 0. Do not invent or estimate results.

---

## Phase 11 — Independent verification

Four independent reviewers required:

1. **electron-security-reviewer** — verify:
   - Open-handle bounded read (not pre-read stat + readFile)
   - `path.resolve()` applied before all file access
   - No arbitrary renderer path accepted via IPC
   - Preload exposes only `subtitle.{selectForProject, parseForProject, clearForProject}`
   - No `dangerouslySetInnerHTML` in subtitle panel
   - No shell execution, no eval, no unsafe regex
   - No subtitle content in logs

2. **architecture-reviewer** — verify:
   - No renderer imports from main/electron/node
   - `subtitle_documents` only accessed via DatabaseService
   - SubtitleService does not touch DB directly
   - Parsers and Normalizer have no filesystem/DB imports
   - Browser QA mocks isolated behind env guard

3. **database reviewer** — verify:
   - Migration is additive (no destructive changes)
   - `upsertSubtitleDocument` uses explicit `ON CONFLICT DO UPDATE` (not INSERT OR REPLACE)
   - `persistSubtitleResult` uses `db.transaction()` for both writes
   - `deleteProject` calls `clearSubtitleDocument` inside transaction
   - SubtitleSummary fields reconstructed on load, not stored separately
   - Restart persistence verified by test

4. **governance-verifier** — verify:
   - Risk classification matches gate.yaml output
   - Owner override recorded truthfully at each phase
   - No governance file weakened
   - No new dependencies added without approval
   - No scope creep into M3+ features

Both electron-security-reviewer and architecture-reviewer must run `pnpm validate` independently.

---

## Risk summary

| Phase | Risk level | Human approval |
|---|---|---|
| 1 — Shared contracts | **3** | SKIPPED (owner override) |
| 2 — DB migration | **3** | SKIPPED (owner override) |
| 3A — Pure parsers | **3** | SKIPPED (owner override) |
| 3B — Bounded reader | **3** | SKIPPED (owner override) |
| 4 — SubtitleService + IPC | **3** | SKIPPED (owner override) |
| 5 — Preload | **3** | SKIPPED (owner override) |
| 6 — Renderer | 2 | SKIPPED (owner override) |
| 7 — QA fixtures | 2 | SKIPPED (owner override) |
| 8 — Tests | 1–2 | SKIPPED (owner override) |
| 9 — E2E + visual | 1 | N/A |

All phases require independent verification. All phases require automated checks.
Owner override does NOT waive independent verification or automated tests.

---

## Total files

| Category | Count |
|---|---|
| New source files | 10 (added subtitleService selectForProject) |
| Modified source files | 8 |
| New test files | 7 |
| Modified test files | 2 |
| New fixture files | ~8 |
| Migration | 1 |
| **Total** | **~36** |
