# M2 — Security and Resource Limits

**Spec date:** 2026-07-19

---

## Resource limits

| Limit | Value | Enforcement point | Error code |
|---|---|---|---|
| Max file size | 2,097,152 bytes (2 MB) | `stat().size` before `readFile` | `SUBTITLE_FILE_TOO_LARGE` |
| Max cue count | 10,000 cues | Loop guard inside parser | `CUES_TRUNCATED` (warning) |
| Max cue text length | 2,048 chars | Per-cue truncation in normalizer | `CUE_TEXT_TRUNCATED` (warning) |
| Max total parsed text | 1,048,576 chars | Accumulator in normalizer | `CUES_TRUNCATED` (warning) |
| Max tag attribute length | 128 chars | Regex bound `{0,128}` in tag strip | (tag stripped by bound) |

All limits are mandatory — not configurable by user, renderer, or IPC caller.

---

## Path validation requirements

DB-stored `subtitlePath` is treated as untrusted at parse time. Stored path may have been set
in a prior session or by a future import feature. Re-validation is required every parse call.

### Open-handle bounded read (TOCTOU-safe)

Pre-read `stat().size` + `readFile()` has a TOCTOU race: the file can be replaced or grown
between the two calls. The correct approach is to open a file handle, then stat and read
through the same handle:

```
1. path.resolve(subtitlePath) — canonicalize. Eliminates '..' traversal. Absolute path only.
2. open(resolvedPath, 'r') — open file handle. ENOENT/EACCES → 'missing' state.
3. fh.stat() — stat through the OPEN HANDLE. isFile() must be true.
4. fh.stat().size <= MAX_SUBTITLE_BYTES — must pass (→ 'SUBTITLE_FILE_TOO_LARGE').
5. fh.read(buf, 0, MAX_SUBTITLE_BYTES + 1, 0) — read at most MAX+1 bytes.
6. if bytesRead > MAX_SUBTITLE_BYTES → 'SUBTITLE_FILE_TOO_LARGE' (file grew during read).
7. buf.subarray(0, bytesRead).toString('utf-8') — decode.
8. fh.close() — always in 'finally' block.
```

Steps 3–6 operate on the SAME open file descriptor as step 2. This eliminates the race
between checking size and reading content.

**Symlink policy:** Symlinks are followed (Node.js platform default). Subtitle paths arrive
from the native OS file picker (`dialog:selectSubtitleFile`), so a symlink in the selected
path was explicitly navigated by the user. Blocking symlinks would break valid workflows.
Path traversal is eliminated by `path.resolve()` before opening.

**No path validation at subtitle select time** — `selectForProject` stores the path returned
by the native dialog. Re-validation at parse time catches files moved/deleted between sessions.

**No directory restriction in M2** — user may store subtitle files anywhere accessible.
Directory allowlist is a future hardening concern for M5+.

---

## IPC input validation

All subtitle IPC handlers must validate payloads before forwarding to SubtitleService.

```typescript
// subtitle:parseForProject
const schema = z.object({ projectId: z.string().uuid() });
// reject if parse fails — return structured error to renderer
```

`projectId` must be a valid UUID. Non-UUID strings rejected before DB lookup.

No subtitle path or format selector accepted via IPC — both are read from DB server-side.

---

## Cue content safety

**Plain text only.** Tags are stripped, not escaped. Rationale: stripped plain text has no XSS surface. Escaped HTML would require renderer to `dangerouslySetInnerHTML` to display, which is worse.

Tag stripping rules:
- SRT: `/<[^>]{0,128}>/g` — strips all tag-like constructs with bounded attribute length.
- VTT: voice tags `<v ...>`, timestamp tags `<HH:MM:SS.mmm>`, class tags `<c.x>` stripped first; remaining `/<[^>]{0,128}>/g` pass.
- Tags with unclosed `>` are NOT stripped — they get included as-is as plain text (no partial-match attempt).

**Never `dangerouslySetInnerHTML` with cue text in renderer.** Cue text is always rendered as React children string or `{text}` expression. This is a hard requirement enforced by:
1. Automated lint: ESLint `react/no-danger` rule must be enabled in `.eslintrc` for renderer files, or a governance test must grep for `dangerouslySetInnerHTML` in `src/renderer/**` and fail if found outside pre-approved non-subtitle uses.
2. Architecture-reviewer verification in Phase 11 of the implementation plan.
Code review alone is insufficient — this requires a mechanical check.

**`subtitleParseError` field:** The value stored in `projects.subtitle_parse_error` and returned in `ProjectRecord.subtitleParseError` MUST be a bounded error-code string matching the keys of `SUBTITLE_ERROR_MESSAGES` (e.g., `'SUBTITLE_FILE_NOT_FOUND'`, `'SUBTITLE_FILE_TOO_LARGE'`). It MUST NOT be a raw `err.message` from Node.js (which can contain absolute filesystem paths). Map all `fs` errors and parse errors to a known code at the service boundary before persisting.

**Cue text in logs:** do NOT log full cue text. Log only cue index, timestamps, and warning codes. User subtitle content may contain PII; log format must be: `{ cueIndex, startMs, endMs, warningCode }`.

---

## Regex safety (ReDoS prevention)

Identified ReDoS risk: complex regex patterns with nested quantifiers or alternation can cause catastrophic backtracking on adversarial input.

**Mitigation: split before regex.** For timestamp parsing:
- SRT: `(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})` — fixed-width groups. No nested quantifiers. Safe.
- VTT: split line on `-->` first, then parse each side with `(\d+):(\d{2}):(\d{2})\.(\d{3})` or `(\d{2}):(\d{2})\.(\d{3})`. Never single regex spanning both timestamps.

**Tag strip regex:** `/<[^>]{0,128}>/g` — character class `[^>]` with explicit bound `{0,128}`. Not `.*?` or `[^>]+`. Safe against nested angle brackets because `{0,128}` is a hard upper bound.

**Do NOT use:**
- `/<.*?>/g` — unbounded lazy quantifier
- `/<[^>]+>/g` — unbounded `+`
- Any regex with nested quantifiers like `/(a+)+/`

---

## Adversarial file cases

| Case | Expected behavior |
|---|---|
| File with 1,000,000 cue blocks | `CUES_TRUNCATED` after 10,000. No OOM. Parser exits loop. |
| File with all cue text = 100,000 chars each | Each truncated to 2,048. `CUE_TEXT_TRUNCATED` warning. |
| File that is a 2MB string of `<` characters | Tag regex runs bounded `{0,128}` per match. No catastrophic backtrack. |
| File with nested angle brackets `<<...<<...>>...>>` | Not matched by `[^>]{0,128}` (first `>` terminates match). Included as plain text. |
| File with UTF-16 encoding | `readFile('utf-8')` on a UTF-16 file returns mojibake. No parse error from Node; VTT header check fails (fatal) or SRT timestamp regex fails (per-cue skip). `SUBTITLE_ENCODING_ERROR` not triggered (would require explicit encoding detection). Documented limitation. |
| `.srt` file containing VTT content | SRT parser skips all cue blocks (no matching timestamp line). 0 cues parsed. `parse_failed` if zero cues treated as fatal, else `ready` with 0 cues. Decision: 0 cues = `parse_failed` with `SUBTITLE_PARSE_ERROR`. |
| `.vtt` file missing WEBVTT header | Fatal. `SUBTITLE_INVALID_FORMAT`. |
| File containing `../../../../etc/passwd` as subtitle text | Text is plain text after tag strip. No path interpretation in renderer. |
| File containing `<script>alert(1)</script>` in cue text | Stripped by `/<[^>]{0,128}>/g` → `alert(1)`. Rendered as text literal. No XSS. |
| File where stat() succeeds but readFile() fails (race) | `SUBTITLE_FILE_NOT_FOUND` or `SUBTITLE_PARSE_ERROR` depending on error code. Handled. |
| Subtitle path with `../` segments | `path.resolve()` canonicalizes. `../` components eliminated. No traversal. |

---

## Log safety rules

- Log parse outcome: `{ projectId, status, warningCount, cueCount, durationMs }`. No cue text.
- Log parse errors: `{ projectId, errorCode, filePath: '[REDACTED]' }`. No raw fs error messages containing paths.
- Log IPC inputs: `{ channel, projectId }`. No subtitle path logged at IPC layer.
- No `console.log(rawFileContent)` or `console.log(cueText)` at any log level.

---

## Threat model summary

| Threat | Mitigation |
|---|---|
| Path traversal via DB-stored path | `path.resolve()` at parse time |
| TOCTOU race (file changed between check and read) | Open-handle: stat and read through same file descriptor |
| DoS via large file | Open-handle stat check + read byte cap |
| DoS via cue count explosion | Parser loop guard at 10,000 |
| DoS via ReDoS | Fixed-width regex, split before parse |
| XSS via cue text injection | Tags stripped to plain text; no `dangerouslySetInnerHTML` |
| PII leakage via logs | Cue text not logged |
| IPC injection via projectId | UUID validation at handler |
| Stale cues from replaced subtitle | Cascade delete on subtitle replace |
