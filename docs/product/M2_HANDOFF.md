# M2 — Implementation Handoff

**Status:** SPEC COMPLETE — awaiting governed implementation
**Spec date:** 2026-07-19
**Authored by:** M2 planning run (`2026-07-19T-m2-subtitle-planning`)

This document is the authoritative entry point for M2 implementation. It synthesizes all 13 spec docs into a concise, build-ready brief. An implementation agent must read this first, then the referenced spec docs.

---

## What M2 is

Add subtitle file support to SceneSift projects:
- User selects a `.srt` or `.vtt` subtitle file for a project
- User triggers parse explicitly
- Parse result (cue count, duration, format) displayed in project info panel
- Full cue document persisted to SQLite
- All state survives app restart

**One sentence:** Parse SRT/WebVTT subtitles, store cues, show summary — nothing more.

---

## What M2 is NOT

- No ASS/SSA format support (deferred — see M2_SUPPORTED_FORMATS.md)
- No sync check (M3)
- No video preview (M4)
- No transcript export (M5)
- No AI features (M6+)
- No automatic parse on subtitle select — parse is always user-triggered
- No subtitle editing

---

## Authoritative spec docs

| Topic | File |
|---|---|
| Current state of subtitle in M1 | `M2_CURRENT_SUBTITLE_STATE.md` |
| M2 scope + out-of-scope | `M2_SCOPE.md` |
| Supported formats decision | `M2_SUPPORTED_FORMATS.md` |
| Data model (SubtitleDocument, SubtitleCue, etc.) | `M2_SUBTITLE_MODEL.md` |
| Parser rules (SRT, WebVTT, regex patterns) | `M2_PARSING_RULES.md` |
| State machine (7 states, all transitions) | `M2_STATE_MACHINE.md` |
| Architecture (layers, files, IPC, DB) — **reconciled 2026-07-19** | `M2_ARCHITECTURE.md` |
| Security and resource limits — **reconciled 2026-07-19** | `M2_SECURITY_AND_LIMITS.md` |
| User stories | `M2_USER_STORIES.md` |
| Acceptance criteria (36 testable criteria) | `M2_ACCEPTANCE_CRITERIA.md` |
| Test plan (all suites, fixtures, coverage) | `M2_TEST_PLAN.md` |
| Risk register | `M2_RISK_REGISTER.md` |
| Implementation plan — **reconciled 2026-07-19** | `M2_IMPLEMENTATION_PLAN.md` |

---

## Critical implementation constraints

### MUST do

1. **`path.resolve()` before every file access.** DB-stored `subtitlePath` is untrusted. Always canonicalize before `stat()` or `readFile()`. See M2_SECURITY_AND_LIMITS.md §Path validation.

2. **`stat().size` check before `readFile`.** Must reject files > 2,097,152 bytes with `SUBTITLE_FILE_TOO_LARGE` before reading. See M2_SECURITY_AND_LIMITS.md §Resource limits.

3. **Fixed-width regex only. No `.*?`, no `[^>]+`, no nested quantifiers.**
   - Tag strip: `/<[^>]{0,128}>/g`
   - SRT timestamp: `(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})`
   - VTT timestamp: split on `-->` FIRST, then parse each side with fixed patterns
   See M2_PARSING_RULES.md §Regex safety.

4. **Parser loop guard at 10,000 cues.** Stop parsing at 10,000, add `CUES_TRUNCATED` warning.

5. **No `dangerouslySetInnerHTML` with cue text.** Render as React children string only.

6. **No cue text in logs.** Log only `{ cueIndex, startMs, endMs, warningCode }` for warnings. Log only `{ projectId, status, cueCount, durationMs }` for service outcomes.

7. **`deleteProject` must cascade.** Call `clearSubtitleDocument(projectId)` before project row delete. No orphan rows.

8. **Re-parse failure deletes old cue doc.** Stale cues are worse than no cues.

9. **Preload: narrow typed methods only.** No raw path returned to renderer. No generic invoke pass-through.

10. **Human approval required for Phase 2 (DB migration) and Phase 5 (preload).** Risk-3 work per AGENTS.md.

### MUST NOT do

- No parse triggered on subtitle path set — only on explicit IPC call
- No `shell: true` in any process execution (subtitle parsing is in-process, no subprocess needed)
- No `synchronized` state or M3 sync check in any M2 code
- No ASS parser attempt — block at extension check, return `SUBTITLE_UNSUPPORTED_FORMAT`
- No subtitle path or format accepted via IPC — read from DB server-side only
- No raw error code displayed in renderer — use `formatSubtitleError()` formatter
- No 0-cue success — if parse produces 0 valid cues, set `parse_failed`

---

## Database changes

Two-part schema change (risk-3):

**1. New columns on `projects` table:**
```sql
ALTER TABLE projects ADD subtitle_status TEXT;
ALTER TABLE projects ADD subtitle_cue_count INTEGER;
ALTER TABLE projects ADD subtitle_last_cue_end_ms INTEGER;
ALTER TABLE projects ADD subtitle_parse_error TEXT;
ALTER TABLE projects ADD subtitle_parsed_at INTEGER;
```
All nullable. Safe `ALTER TABLE ADD` (additive only).

**2. New table:**
```sql
CREATE TABLE subtitle_documents (
  project_id TEXT NOT NULL,
  schema_version INTEGER NOT NULL DEFAULT 1,
  source_format TEXT NOT NULL,
  source_encoding TEXT NOT NULL,
  cues_json TEXT NOT NULL,
  warnings_json TEXT NOT NULL,
  parsed_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX subtitle_documents_project_id ON subtitle_documents(project_id);
```

Migration file: `src/database/migrations/0002_subtitle_parsing.sql`.

---

## IPC channels

Three new channels (registered in `src/shared/ipc/channels.ts`). Risk 3 (src/shared/ipc/**).

```
subtitle:selectForProject — input: { projectId: UUID } — output: ProjectRecord | null
  Main process opens native dialog. Renderer supplies only projectId.
  Returns null if dialog cancelled. Sets subtitle_status = 'selected' on selection.

subtitle:parseForProject  — input: { projectId: UUID } — output: ProjectRecord
  Parses subtitle at stored path. Returns updated project with parse result.

subtitle:clearForProject  — input: { projectId: UUID } — output: ProjectRecord
  Removes subtitle path + all subtitle data. Returns updated project (not_selected).
```

All validated with Zod at handler. Renderer calls via `window.sceneSift.subtitle.*`.

**No `SUBTITLE_SET_PATH` channel.** Renderer must not supply an arbitrary filesystem path.
The native dialog is opened in main process via `selectForProject`.

---

## State machine summary

7 states, stored in `projects.subtitle_status`:

| State | Meaning |
|---|---|
| `not_selected` | No path set |
| `selected` | Path set, not parsed |
| `parse_failed` | Fatal parse error |
| `unsupported` | `.ass` or unknown extension |
| `missing` | File not found at stored path |
| `ready` | Parsed, no warnings |
| `ready_with_warnings` | Parsed, non-fatal warnings |

Full transition diagram: M2_STATE_MACHINE.md.

---

## Parser architecture

```
SubtitleService.selectSubtitleForProject(projectId)
  → validate projectId → selectSubtitleFile() [existing native dialog]
  → DatabaseService.setProjectSubtitlePath(projectId, selectedPath)  [transaction]
  → return updated ProjectRecord | null

SubtitleService.parseSubtitleForProject(projectId)
  → look up project → check subtitlePath → path.resolve() → detect format
  → SubtitleReader.readSubtitleFile(resolvedPath)
      open handle → fstat (size check) → read capped bytes → close (finally)
  → SrtParser.parse(text) | VttParser.parse(text)  [pure function]
  → SubtitleNormalizer.normalize(raw)              [pure function]
  → subtitle_parsed_at = Date.now()  ← ONCE
  → DatabaseService.persistSubtitleResult(...)     [single transaction — both writes]
  → return updated ProjectRecord

SubtitleService.clearSubtitleForProject(projectId)
  → DatabaseService.setProjectSubtitlePath(projectId, null)  [transaction]
  → return updated ProjectRecord
```

Parsers are pure functions — no IO, no DB, no IPC.
SubtitleReader: open-handle bounded read (not stat + readFile — see M2_SECURITY_AND_LIMITS.md).
DatabaseService: `persistSubtitleResult` executes BOTH the project-row update AND the
subtitle_documents upsert/clear inside a SINGLE `db.transaction()`. This is CRITICAL — two
separate writes are WRONG and were corrected in Stage A reconciliation.

---

## Renderer

- `subtitleFormatters.ts` — pure formatter functions (cue count, duration, error messages). Zero imports from main/electron.
- `ProjectsPage.tsx` — subtitle summary panel always rendered when project selected. All 7 states handled.
- "Select Subtitle" button calls `window.sceneSift.subtitle.selectForProject(projectId)`.
- Design tokens for all styling. No hardcoded hex/px.
- `dangerouslySetInnerHTML` NEVER for subtitle content.

---

## Browser QA fixtures

Add 7 subtitle state fixtures to `src/renderer/qa/fixtures.ts`.
Mock `subtitle.selectForProject()` sets fixture to `selected`.
Mock `subtitle.parseForProject()` transitions in-memory state.
Mock `subtitle.clearForProject()` resets to `not_selected`.
Required for E2E tests.

---

## Test files to create

```
tests/main/subtitle/SrtParser.test.ts
tests/main/subtitle/VttParser.test.ts
tests/main/subtitle/SubtitleNormalizer.test.ts
tests/main/subtitle/subtitleService.test.ts
tests/main/subtitle/subtitle-security.test.ts
tests/renderer/subtitleFormatters.test.ts
tests/e2e/subtitle-parsing.e2e.spec.ts
tests/visual/subtitle-panel.spec.ts
tests/fixtures/subtitles/*.srt / *.vtt
```

Plus additions to `tests/main/database-service.test.ts` and `tests/main/ipc-contracts.test.ts`.

---

## Acceptance criteria summary

36 testable criteria in M2_ACCEPTANCE_CRITERIA.md (AC-M2-001 through AC-M2-036) covering:
- SRT and VTT parse correctness (timestamp math, tag stripping)
- Resource limit enforcement (file size, cue count, text truncation)
- All 7 error state transitions
- DB persistence across restart
- Cascade delete on project delete + subtitle replace
- Security: UUID validation, path traversal, cue text not logged
- Renderer: human-readable errors, formatted summary, no raw ms values
- Browser QA: all 7 states render without errors

---

## Implementation sequence

All manual phase gates (Phases 2, 4, 5, 8) are skipped by owner override:

```
OWNER OVERRIDE — MANUAL PHASE APPROVAL AND MANUAL RUNTIME TESTING SKIPPED
Scope: M2 Subtitle Parsing and Validation only.
Manual phase gates: SKIPPED by repository-owner decision.
Manual runtime testing: SKIPPED, not passed.
Independent specialist verification: STILL MANDATORY.
Automated phase validation: STILL MANDATORY.
```

See M2_IMPLEMENTATION_PLAN.md for full phase breakdown with risk levels and required checks.

---

## Quality gate before M2 acceptance audit

```bash
pnpm typecheck       # 0 errors
pnpm lint            # 0 warnings
pnpm test            # all pass including new subtitle tests
pnpm test:e2e        # subtitle E2E pass
pnpm test:visual     # visual regression pass
pnpm governance:validate
pnpm architecture:validate
pnpm design:validate
pnpm validate        # full validate exit 0
```

Independent verification by electron-security-reviewer + architecture-reviewer before audit.
