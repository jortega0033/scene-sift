# M2 — Subtitle Parse State Machine

**Spec date:** 2026-07-19

---

## States

| State | `subtitle_status` value | Meaning |
|---|---|---|
| `not_selected` | `'not_selected'` | No subtitle file selected. `subtitlePath` is null. |
| `selected` | `'selected'` | Subtitle path stored but not yet parsed. |
| `parse_failed` | `'parse_failed'` | Parse attempted but failed fatally. `subtitle_parse_error` set. |
| `unsupported` | `'unsupported'` | File format not supported (.ass or other). |
| `missing` | `'missing'` | Previously selected subtitle file no longer exists at stored path. |
| `ready` | `'ready'` | Parse succeeded. `subtitle_cue_count` and cue document available. |
| `ready_with_warnings` | `'ready_with_warnings'` | Parse succeeded with non-fatal warnings. |

`parsing` is NOT a persisted state. It exists only transiently during the IPC round-trip. If the app closes during parse, the state remains at whatever it was before parse began (typically `selected`). This guarantee holds only if the app closes before `persistSubtitleResult` begins — once inside the transaction, the DB is consistent by the time the transaction commits.

**Zero-cue rule:** If the parser completes without a fatal error but produces 0 valid cues (e.g., a `.srt` file containing VTT content where all timestamp lines fail regex match), the result is treated as `parse_failed` with `SUBTITLE_PARSE_ERROR`. A file that contains no valid cues is considered unparseable for M2's purposes. This transition: `selected → parse_failed`.

---

## Transitions

```
not_selected
  → selected             (user selects subtitle file during project creation or update)

selected
  → parsing              (user triggers parseForProject — transient, not persisted)
  → not_selected         (user removes subtitle from project)
  → missing              (re-validation at parse time finds file gone)
  → unsupported          (extension check returns unsupported)
  → parse_failed         (fatal parse error)
  → ready                (successful parse, no warnings)
  → ready_with_warnings  (successful parse with warnings)

missing
  → selected             (user re-selects a subtitle file — replaces path and resets state)
  → not_selected         (user removes subtitle)

parse_failed
  → parsing              (user retries parse)
  → selected             (user replaces subtitle file)
  → not_selected         (user removes subtitle)

unsupported
  → selected             (user replaces subtitle file with a supported format)
  → not_selected         (user removes subtitle)

ready / ready_with_warnings
  → parsing              (user re-parses, e.g. after source file edit)
  → selected             (user replaces subtitle file — old cue document cleared)
  → not_selected         (user removes subtitle — cue document cleared)
```

---

## State behavior table

| State | `subtitlePath` | `subtitle_cue_count` | `subtitle_parse_error` | Cue document | User action available |
|---|---|---|---|---|---|
| `not_selected` | null | null | null | none | Select subtitle |
| `selected` | set | null | null | none | Parse subtitle |
| `parse_failed` | set | null | error code | none | Retry parse / Replace |
| `unsupported` | set | null | `'SUBTITLE_UNSUPPORTED_FORMAT'` | none | Replace with supported |
| `missing` | set | null | `'SUBTITLE_FILE_NOT_FOUND'` | none | Re-select / Remove |
| `ready` | set | N | null | present | Re-parse / Replace |
| `ready_with_warnings` | set | N | null | present | View warnings / Re-parse |

---

## App restart behavior

All persisted states survive app restart because they are stored in SQLite:
- `not_selected`, `selected`: path retained (or null), state retained.
- `parse_failed`, `unsupported`, `missing`: error state retained.
- `ready`, `ready_with_warnings`: cue document available from `subtitle_documents`.

**What `selected` means after restart:** The subtitle path is set but the file has not been parsed in this session. The renderer shows "Not yet parsed" with a "Parse" button. This is correct — parsing is an explicit user action, not automatic.

---

## Reparse semantics

When the user parses a project that is already in `ready` or `ready_with_warnings`:
1. Main process re-validates path, reads file, re-parses.
2. If success: replaces `subtitle_documents` row (upsert), updates summary columns.
3. If failure: sets `parse_failed` or `missing`; **deletes** the old `subtitle_documents` row (stale cues are worse than no cues).

---

## Subtitle replacement semantics

When the user selects a new subtitle file while the project has an existing cue document:
1. `subtitlePath` is updated to the new path.
2. `subtitle_status` resets to `selected`.
3. `subtitle_cue_count`, `subtitle_last_cue_end_ms`, `subtitle_parse_error`, `subtitle_parsed_at` all reset to null.
4. `subtitle_documents` row is deleted for this project.

Old cue data must not survive a subtitle replacement. This prevents stale cues from being used as if they belonged to the new subtitle file.

---

## No `synchronized` state in M2

M3 adds sync checking (subtitle last-cue end vs video duration). The `synchronized` concept belongs to M3. M2 must not:
- Add a `sync_status` column
- Compute any sync result during parsing
- Display any "in sync" indicator

M2 provides `subtitle_last_cue_end_ms` as a summary field. M3 will read this plus `mediaMetadata.durationSeconds` to compute sync status independently.
