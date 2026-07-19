# M2 — Normalized Subtitle Model

**Spec date:** 2026-07-19

---

## SubtitleDocument

The canonical normalized representation returned by the parser and persisted to the `subtitle_documents` table.

```typescript
interface SubtitleDocument {
  schemaVersion: 1;          // bump if cue shape changes across milestones
  sourceFormat: 'srt' | 'vtt';
  sourceEncoding: string;    // e.g. 'UTF-8', 'UTF-8-BOM'
  cues: SubtitleCue[];
  warnings: ParseWarning[];
  summary: SubtitleSummary;
  parsedAt: number;          // Unix epoch milliseconds
}
```

---

## SubtitleCue

The normalized representation of a single subtitle cue.

```typescript
interface SubtitleCue {
  index: number;              // 1-based, auto-assigned if missing from source
  startMs: number;            // integer milliseconds from 00:00:00.000
  endMs: number;              // integer milliseconds from 00:00:00.000
  text: string;               // normalized plain text (tags stripped, whitespace trimmed)
  lines: string[];            // text split on \n (for display without re-splitting)
}
```

### Design decisions

**Milliseconds (not rational timestamps)**
Milliseconds are the universal intermediate representation. All subtitle formats express time in hours/minutes/seconds/ms. Integer milliseconds eliminate floating-point rounding issues and are natively sortable.

**No source style retained**
M2 does not retain SRT `<i>`/`<b>`/`<u>` tags or WebVTT `<c>` class tags. They are stripped to plain text. This is:
- Safe (no HTML injection surface in renderer)
- Sufficient for M2-M7 (AI transcript, clip candidate selection — plain text is what's needed)
- Revisable in M10 if subtitle editing requires style preservation (will need explicit scoping)

**No speaker field**
Speaker attribution (some subtitles use `>>` prefix or VTT voice notation `<v Speaker>`) is out of scope for M2. The plain text will include any speaker prefix if it was in the source (not stripped unless it is part of a supported tag syntax).

**No sourceStyle retained**
Retaining raw source style markup adds complexity, widens the attack surface, and is not needed for M2's use cases (display summary, feed AI transcript). Deferred to M10 subtitle editor if needed.

**Stable cue index strategy**
`index` is 1-based and reflects parse order. It is NOT the SRT sequence number (which can be missing, duplicate, or out-of-order). Index is assigned sequentially during normalization. Downstream milestones should use `index` for stable cue identity within a parsed document.

**No raw source cue text retained**
The raw source line is not persisted. The normalized `text` is canonical. If re-parsing is needed (e.g., format change, schema upgrade), the source file is re-read from `subtitlePath`.

---

## SubtitleSummary

Precomputed summary fields for display and M3 use.

```typescript
interface SubtitleSummary {
  cueCount: number;
  firstCueStartMs: number | null;  // null if no cues
  lastCueEndMs: number | null;     // null if no cues — used by M3 sync check
  totalTextLength: number;         // total chars in all cue text (post-strip)
  warningCount: number;
}
```

`lastCueEndMs` is the only field M3 needs for sync checking. It is stored as a summary column on the `projects` table (not just in the cue blob) to allow M3 to query it without loading the full cue document.

---

## ParseWarning

```typescript
type ParseWarningCode =
  | 'ZERO_DURATION_CUE'
  | 'NEGATIVE_DURATION_CUE'
  | 'OUT_OF_ORDER_CUES'
  | 'OVERLAPPING_CUES'
  | 'EMPTY_CUE_TEXT'
  | 'DUPLICATE_CUE_INDEX'
  | 'CUE_TEXT_TRUNCATED'
  | 'CUES_TRUNCATED'
  | 'UNSUPPORTED_VTT_FEATURE'
  // NOTE: TIMESTAMP_EXCEEDS_VIDEO_DURATION is M3 scope — requires comparing to video duration.
  // Do NOT add it here. It belongs to a future M3 ParseWarningCode extension.

interface ParseWarning {
  code: ParseWarningCode;
  message: string;           // human-readable, used in logs only — never raw in UI
  cueIndex?: number;         // which cue triggered the warning, if applicable
}
```

Warnings are non-fatal. Parse status becomes `ready_with_warnings` when `warnings.length > 0`. A warning does not block M3 or later milestones.

---

## Resource limits (applied during parsing)

| Limit | Value | Behavior on exceed |
|---|---|---|
| Max file size | 2,097,152 bytes (2 MB) | `SUBTITLE_FILE_TOO_LARGE` — fatal, no parse |
| Max cue count | 10,000 cues | Parsing truncates at limit; `CUES_TRUNCATED` warning |
| Max cue text length | 2,048 characters | Cue text truncated; `CUE_TEXT_TRUNCATED` warning |
| Max total parsed text | 1,048,576 chars (1 MB) | Parsing stops; `CUES_TRUNCATED` warning on last cue |

---

## Fields persisted vs derived

| Field | Persisted where | Notes |
|---|---|---|
| `subtitle_status` | `projects.subtitle_status` | State machine value |
| `subtitle_cue_count` | `projects.subtitle_cue_count` | Denormalized for fast list display |
| `subtitle_last_cue_end_ms` | `projects.subtitle_last_cue_end_ms` | For M3 sync check |
| `subtitle_parse_error` | `projects.subtitle_parse_error` | Error code string |
| `subtitle_parsed_at` | `projects.subtitle_parsed_at` | Unix ms |
| Full `SubtitleDocument` | `subtitle_documents.cues_json` | JSON blob |
| `schema_version` | `subtitle_documents.schema_version` | Integer, currently 1 |
| `source_format` | `subtitle_documents.source_format` | `'srt'` or `'vtt'` |

### What is NOT persisted

- Raw source cue text (re-parseable from subtitlePath if needed)
- Source line numbers (ephemeral to parse session)
- Per-cue raw timestamps before normalization

---

## Schema versioning

`schemaVersion: 1` in the document and `schema_version: 1` in `subtitle_documents`. If the cue shape changes in a future milestone, increment to 2. On load, if `schema_version < current`, the document is treated as stale and the renderer displays a "reparse needed" state. Reparse is triggered explicitly by the user, not automatically.
