# M5 — Transcript Preparation: Scope

**Status**: Planning

---

## Goal

Export a clean, readable transcript from subtitle cues attached to a project. Strip formatting noise from cue text, optionally merge adjacent cues with configurable gap threshold, preview the result in-app, and export as plain text or structured JSON.

---

## In scope

| Feature | Details |
|---|---|
| Tag stripping | Remove HTML tags (`<i>`, `<b>`, `<u>`, `<font ...>`, `</...>`, `<v ...>`, `<c.class>`), ASS/SSA curly-brace blocks (`{...}`), any remaining angle-bracket tokens |
| Cue merging | Merge consecutive cues where gap ≤ gapThresholdMs. Default: 500 ms. UI slider range: 0–2000 ms (step 100). Schema validation range: 0–10000 ms. Overlapping cues (negative gap) are merged. |
| Transcript generation | IPC handler reads subtitle_documents from DB, strips tags, merges cues, returns `TranscriptEntry[]` |
| In-app preview | Scrollable list of `{ startMs, endMs, text }` entries with formatted timestamps |
| Export as .txt | One paragraph per entry, separated by blank lines; optional timestamp prefix |
| Export as .json | Pretty-printed array of `TranscriptEntry` objects |
| Export via dialog | `dialog.showSaveDialog` in main process, filter `.txt` / `.json` |

## Out of scope

| Feature | Reason |
|---|---|
| Speaker diarization | No speaker metadata in subtitle documents |
| Translation | No AI providers yet (M6) |
| DB persistence of transcript | Generated on demand; no schema change |
| Subtitle editing | Separate feature (M10) |
| Batch export | Post-MVP |
| ASS/SSA parsing | Subtitles stored as SRT/VTT cues only |

---

## Dependencies satisfied

- M1 CLOSED: project + video metadata in DB
- M2 CLOSED: `subtitle_documents` table populated; `getSubtitleDocument(projectId)` on DatabaseService
- M3 CLOSED: subtitle sync check (informational; not a hard dependency for transcript)
- M4 CLOSED: preview workspace (nav pattern available for new route)

---

## Risk classification

- TranscriptService (main process) → Risk 3
- New IPC channels + preload methods → Risk 3
- Renderer components → Risk 1
- Planning docs → Risk 0

---

## Constraints

- No new runtime dependencies
- Tag regex must handle malformed tags without catastrophic backtracking (ReDoS guard)
- Export file write must use atomic temp-file + rename pattern
- Max transcript text: 10 MB (input subtitle document already capped at 2 MB, stripped text will be smaller)
- gapThresholdMs range: 0–10000 ms (validated in shared schema); UI slider restricted to 0–2000 ms
- Tag regex requires first char after `<` to be a letter or `/` — avoids stripping bare `<` and `>` inequality operators in technical subtitles
- ADR: No new ADR required. TranscriptService is a pure CPU computation service; new IPC channels follow the identical `registerValidatedHandler` pattern already established.
