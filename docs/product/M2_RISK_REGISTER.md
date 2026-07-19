# M2 — Risk Register

**Spec date:** 2026-07-19

Risk classification follows `gate.yaml` scale. Probability × impact = risk score.

---

## Risk table

| ID | Risk | Probability | Impact | Score | Status |
|---|---|---|---|---|---|
| R-01 | ReDoS via subtitle parser regex | Low | High | Medium | **Mitigated** |
| R-02 | Path traversal via DB-stored subtitle path | Low | High | Medium | **Mitigated** |
| R-03 | Memory exhaustion via large subtitle file | Low | High | Medium | **Mitigated** |
| R-04 | Memory exhaustion via cue count explosion | Low | High | Medium | **Mitigated** |
| R-05 | XSS via cue text rendered in UI | Low | High | Medium | **Mitigated** |
| R-06 | PII leakage via subtitle content in logs | Medium | High | High | **Mitigated** |
| R-07 | Stale cues persisted after subtitle replace | Low | Medium | Low | **Mitigated** |
| R-08 | Orphan subtitle_documents rows after project delete | Low | Low | Low | **Mitigated** |
| R-09 | DB migration failure on upgrade | Low | High | Medium | **Mitigated** |
| R-10 | Schema version mismatch on document load | Medium | Low | Low | **Mitigated** |
| R-11 | Silent parse success with wrong cue data (UTF-16 file) | Medium | Medium | Medium | **Residual — documented** |
| R-12 | Subtitle path set but file at that path is different content | Medium | Low | Low | **Residual — by design** |
| R-13 | SubtitleDocument JSON blob too large for SQLite | Low | Low | Low | **Mitigated** |
| R-14 | IPC projectId not validated, enables SQL injection or SSRF | Low | High | Medium | **Mitigated** |
| R-15 | ASS format accepted but silently corrupted | Low | Medium | Low | **Mitigated (blocked)** |

---

## Risk details

### R-01 — ReDoS via subtitle parser regex

**Threat:** Adversarial subtitle file constructed with many unclosed `<` characters exploits backtracking in a naive tag-strip regex.

**Mitigation:**
- Tag strip regex: `/<[^>]{0,128}>/g` — character class `[^>]` with hard bound `{0,128}`. No unbounded lazy/greedy quantifiers.
- VTT timestamp parsing: split on `-->` before regex. No single regex spanning both timestamps.
- SRT timestamp: `\d{2}:\d{2}:\d{2},\d{3}` — fixed-width digits only.

**Residual:** None. Adversarial test case in `tests/main/subtitle/subtitle-security.test.ts` must demonstrate no hang.

---

### R-02 — Path traversal via DB-stored subtitle path

**Threat:** DB-stored `subtitlePath` contains `../` segments that resolve outside intended directories.

**Mitigation:** `path.resolve(subtitlePath)` called at parse time before any file access. Produces canonical absolute path. `../` components eliminated.

**Residual:** Directory allowlist not enforced in M2. `path.resolve()` prevents explicit traversal but does not prevent access to arbitrary absolute paths the user has chosen. This is acceptable — the subtitle path is user-selected. Directory restriction is a future hardening item (M5+).

---

### R-03 — Memory exhaustion via large subtitle file

**Threat:** User selects a 500 MB log file renamed to `.srt`. `readFile` loads entire file into memory.

**Mitigation:** `stat().size` checked before `readFile`. Size > 2 MB → immediate rejection with `SUBTITLE_FILE_TOO_LARGE`. `readFile` never called.

**Residual:** None.

---

### R-04 — Memory exhaustion via cue count explosion

**Threat:** Adversarial `.srt` file with 1,000,000 cue blocks constructs 1M objects in memory.

**Mitigation:** Parser exits loop at 10,000 cues. Normalizer rejects total text over 1 MB. Combined: maximum in-memory cue array is well-bounded.

**Residual:** None. Adversarial test must pass within 2-second timeout.

---

### R-05 — XSS via cue text rendered in UI

**Threat:** Subtitle file contains `<script>` or `<img onerror=...>` in cue text. Rendered via `dangerouslySetInnerHTML` → XSS.

**Mitigation:**
- All tags stripped during parse. `cue.text` is plain text.
- Renderer MUST NOT use `dangerouslySetInnerHTML` for cue text. Hard requirement.
- Code review gate enforced by architecture reviewer.

**Residual:** None (provided `dangerouslySetInnerHTML` prohibition enforced).

---

### R-06 — PII leakage via subtitle content in logs

**Threat:** Subtitle file contains PII (names, SSNs, dialogue). Log statements include raw cue text in structured logs → log aggregator exposes PII.

**Mitigation:**
- Log rule: no `console.log(cueText)` or `logger.debug({text})` anywhere.
- Log format for warnings: `{ cueIndex, startMs, endMs, warningCode }` only.
- Log format for service calls: `{ projectId, status, cueCount, durationMs }` only.
- Adversarial test verifies cue text not in captured log output.

**Residual:** Developer discipline required. Enforced by test and code review.

---

### R-07 — Stale cues persisted after subtitle replace

**Threat:** User replaces subtitle file. Old cue document remains in `subtitle_documents`. M3+ reads old cues.

**Mitigation:** SubtitleService.clearSubtitleDocument called whenever:
- User replaces subtitle path (updateProject with new subtitlePath)
- Re-parse fails (old cues deleted, not retained)
- deleteProject (cascade delete)

**Residual:** None.

---

### R-08 — Orphan subtitle_documents rows after project delete

**Threat:** `deleteProject` removes `projects` row but not `subtitle_documents` row. DB grows indefinitely.

**Mitigation:** `deleteProject` in DatabaseService calls `clearSubtitleDocument(projectId)` before deleting project row.

**Residual:** None.

---

### R-09 — DB migration failure on upgrade

**Threat:** Migration `0002_subtitle_parsing.sql` fails on existing DB with data.

**Mitigation:**
- Migration is additive only: `ALTER TABLE projects ADD ...` (new nullable columns with no default constraint). `CREATE TABLE subtitle_documents`. No column drops, no renames.
- `ALTER TABLE ADD` on SQLite with nullable column is safe on existing data.
- Migration tested against fixture DB in integration tests.

**Residual:** None.

---

### R-10 — Schema version mismatch on document load

**Threat:** `schema_version = 1` document loaded by code expecting `schema_version = 2`. Cue field access fails.

**Mitigation:**
- `schemaVersion: 1` literal in `SubtitleDocument`. On load: check `schema_version` from DB. If mismatch → treat as stale → renderer shows "reparse needed" state.
- M2 only writes and reads schema_version 1. Version check guards future upgrades.

**Residual:** Low. Version mismatch handling must be implemented before any schema_version bump.

---

### R-11 — Silent parse success with wrong cue data (UTF-16 file)

**Threat:** User selects a UTF-16 encoded subtitle file. Node `readFile('utf-8')` reads it as mojibake. Parser does not detect encoding error. Returns 0 or garbage cues.

**Mitigation:** Partial only. VTT: missing WEBVTT header (due to mojibake) → fatal error. SRT: timestamp regex fails on all cues → 0 cues → `parse_failed`.

**Residual:** Documented limitation. M2 does not detect or transcode non-UTF-8 encodings. User-facing message for `SUBTITLE_PARSE_ERROR` should suggest checking file encoding. Full encoding detection deferred to M5+.

---

### R-12 — Subtitle path set but file replaced with different content

**Threat:** User selects a subtitle path. Later, they replace the file at that path with different content (without changing the path). Parse uses new file content without warning.

**Mitigation:** This is correct behavior by design. Parse reads from the stored path. If content changed, re-parse reflects new content. `subtitle_parsed_at` timestamp allows user to detect staleness.

**Residual:** Acceptable. M3 may add a "file modified since parse" indicator if needed.

---

### R-13 — SubtitleDocument JSON blob too large for SQLite

**Threat:** 10,000 cues × 2,048 chars each = ~20 MB JSON blob. SQLite has no per-row size limit but large blobs degrade performance.

**Mitigation:** Maximum cue count 10,000 × max cue text 2,048 chars = 20,480,000 chars. Plus structure overhead. Practical maximum ~25 MB. SQLite handles this without issue at this scale. `listProjects()` reads only scalar columns from `projects` table, never touches `subtitle_documents` blob.

**Residual:** Acceptable for M2. If 10,000-cue files at max text become common, store cues as compressed blob (M5+ hardening).

---

### R-14 — IPC projectId not validated

**Threat:** Renderer (or malicious renderer-side JS) sends arbitrary string as `projectId` to IPC handler. Malformed input reaches DB query. SQL injection or unexpected DB state.

**Mitigation:** All IPC handlers use registered validated handlers with Zod schema. `projectId` must match `z.string().uuid()`. Non-UUID input rejected before DB query. Drizzle ORM parameterized queries prevent SQL injection regardless.

**Residual:** None (defense in depth: Zod validation + ORM parameterization).

---

### R-15 — ASS format accepted but silently corrupted

**Threat:** M2 tries to parse `.ass` files with a simple tag-strip approach. Override tags with nested braces or complex syntax produce garbled cue text. User sees wrong cue data without error.

**Mitigation:** ASS format explicitly blocked. `.ass` extension → immediate `SUBTITLE_UNSUPPORTED_FORMAT` state. No parse attempted. No silent corruption possible.

**Residual:** None.
