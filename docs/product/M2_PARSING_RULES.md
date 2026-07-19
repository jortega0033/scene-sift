# M2 — Subtitle Parsing Rules

**Spec date:** 2026-07-19

---

## General rules (both formats)

### Encoding
- Read file as UTF-8.
- Strip UTF-8 BOM (EF BB BF) if present at start.
- On encoding error: return `SUBTITLE_ENCODING_ERROR` (fatal).
- Do NOT attempt to detect or transcode non-UTF-8 encodings in M2. Fail with a clear error.

### Line endings
- Normalize CRLF (`\r\n`) to LF (`\n`) before any parsing.
- Treat bare `\r` (old Mac) as LF.

### Blank lines
- SRT uses blank lines as cue delimiters.
- Trailing blank lines at end of file are ignored.
- Multiple consecutive blank lines are treated as one delimiter.

### Error levels

| Level | Definition | Behavior |
|---|---|---|
| **Fatal** | File cannot produce any valid cues | Return `parse_failed` state; no cues saved |
| **Zero cues** | Parse completes but 0 valid cues found | Treated as fatal: return `parse_failed` with `SUBTITLE_PARSE_ERROR`. 0-cue success is not allowed in M2. |
| **Recoverable warning** | Individual cue is malformed | Skip or truncate that cue; add warning; continue |
| **Normalized** | Non-standard but resolvable | Silently normalize (e.g., extra whitespace) |
| **Ignored with disclosure** | Unsupported feature present | Skip; add `UNSUPPORTED_VTT_FEATURE` warning |
| **Unsupported** | Format not supported | Return `unsupported` state immediately |

---

## SRT parsing rules

### Cue structure
```
[blank line(s)]
<index_line>
<timestamp_line>
<text_line(s)>
[blank line]
```

**Index line**
- Expected: one line containing only an integer (possibly with whitespace).
- If missing or non-integer: assign auto-incremented index; add `DUPLICATE_CUE_INDEX` warning if index would duplicate.
- Negative or zero index: normalize to auto-incremented.

**Timestamp line**
- Format: `HH:MM:SS,mmm --> HH:MM:SS,mmm` (optionally with extra whitespace or a tab before/after `-->`).
- Strict regex (safe, no nested quantifiers):
  - `(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})`
- On mismatch: skip cue entirely; add `RECOVERABLE_TIMESTAMP_ERROR` warning. Do NOT attempt to salvage a malformed timestamp — ambiguous timestamp recovery silently corrupts timing.
- `HH` allowed beyond 99 (valid in SRT for long recordings).
- Convert to milliseconds: `h*3600000 + m*60000 + s*1000 + ms`

**Text lines**
- All lines between timestamp and next blank line form the cue text.
- Joined with `\n`.
- Strip SRT formatting tags: `<i>`, `</i>`, `<b>`, `</b>`, `<u>`, `</u>`, `<font ...>`, `</font>`. Use fixed-string matching or a simple tag-stripping regex: `/<[^>]{0,128}>/g`. The `{0,128}` bound prevents catastrophic backtracking on unclosed angles.
- After stripping: trim leading/trailing whitespace from each line.
- If all lines are empty after stripping: add `EMPTY_CUE_TEXT` warning; cue is still included (some players use blank cues as clearers).

---

## WebVTT parsing rules

### Header
- First line must be `WEBVTT` (or `WEBVTT ` followed by any text, or `WEBVTT\t`).
- If absent: return `SUBTITLE_INVALID_FORMAT` (fatal) — VTT without a WEBVTT header is not VTT.
- Consume optional header metadata block (lines after WEBVTT until first blank line).

### Block types
- `NOTE`: discard entirely.
- `STYLE`: discard entirely (no style support in M2; add `UNSUPPORTED_VTT_FEATURE` warning once if any STYLE blocks present).
- `REGION`: discard entirely; add `UNSUPPORTED_VTT_FEATURE` warning once if any REGION blocks present.
- Cue block: process as below.

### Cue structure
```
[blank line]
[optional: cue identifier line — not containing '-->']
<timestamp_line>
<text_line(s)>
[blank line]
```

**Timestamp line**
- Format: `HH:MM:SS.mmm --> HH:MM:SS.mmm` (note `.` not `,` for VTT)
- Hours optional in VTT spec: `MM:SS.mmm` is valid.
- Optional cue settings after the end timestamp: `position:50% align:center` etc. — discard (strip after end timestamp).
- Parse via split on `-->` then parse each side independently.
- Left side and right side each parsed via: `(\d+):(\d{2}):(\d{2})\.(\d{3})` for HH:MM:SS.mmm or `(\d{2}):(\d{2})\.(\d{3})` for MM:SS.mmm.
- Do NOT use a single complex regex spanning both sides; split on `-->` first.
- On mismatch: skip cue; add `RECOVERABLE_TIMESTAMP_ERROR` warning.

**Text lines**
- All lines until blank line (or EOF) form cue text.
- Strip VTT voice tags: `<v Name>text</v>` — strip the `<v ...>` and `</v>` tags, retain text.
- Strip VTT timestamp tags: `<00:00:01.000>` — strip entirely.
- Strip VTT class tags: `<c.className>text</c>` — strip tags, retain text.
- Strip all remaining tags: `/<[^>]{0,128}>/g` (same bound as SRT).
- After stripping: trim, handle empty same as SRT.

---

## Cross-format validation rules (applied after initial parse)

These produce warnings, not fatal errors.

| Rule | Warning code | Behavior |
|---|---|---|
| `endMs <= startMs` | `NEGATIVE_DURATION_CUE` | Include cue; warn |
| `endMs == startMs` | `ZERO_DURATION_CUE` | Include cue; warn |
| Cue start < previous cue start | `OUT_OF_ORDER_CUES` | Include cue; warn (once per file, not per cue) |
| Cue overlaps with prior cue | `OVERLAPPING_CUES` | Include cue; warn (once per file) |
| Cue text empty after stripping | `EMPTY_CUE_TEXT` | Include cue; warn per cue |
| Two cues share source index | `DUPLICATE_CUE_INDEX` | Both included; warn |
| Cue text > 2048 chars | `CUE_TEXT_TRUNCATED` | Truncate; warn per cue |
| Cue count > 10,000 | `CUES_TRUNCATED` | Stop parsing; warn once |
| Total text > 1 MB chars | `CUES_TRUNCATED` | Stop parsing; warn once |

---

## What is NOT silently repaired

- Ambiguous timestamps: if timestamp parsing fails, the cue is skipped with a warning.
- Mixed format files: a VTT file without a `WEBVTT` header is not quietly treated as SRT.
- Overlapping timestamps: not reordered, not merged — included as-is with a warning.
- Missing cue indices: auto-assigned index, but a warning is NOT generated for this (it is too common and non-harmful).

---

## What is NOT in scope for parser

- Automatic timestamp offset correction (M3)
- Language detection
- Speaker diarization
- Transcript text analysis
- Line wrapping or display formatting
- Rendering subtitle overlays
