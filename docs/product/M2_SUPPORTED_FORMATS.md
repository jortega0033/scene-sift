# M2 — Supported Subtitle Formats

**Decision date:** 2026-07-19
**Status:** DECIDED

---

## Decision: Option B — SRT + WebVTT

M2 supports `.srt` and `.vtt` only. ASS (`.ass`) is deferred.

---

## Rationale

### SRT (SubRip Text)
- Universal format. Supported by every major media player and editing tool.
- Simple structure: index, timestamp arrow, text, blank line.
- Timestamp format is well-specified: `HH:MM:SS,mmm --> HH:MM:SS,mmm`
- Minimal security surface: no styling directives, no external references.
- Highest user demand for a video clip workflow tool.

### WebVTT (Web Video Text Tracks)
- W3C standard used by all web video players and HTML5 `<track>` elements.
- Common output from auto-captioning services (YouTube, Whisper, Descript).
- Moderately more complex: WEBVTT header, optional NOTE/STYLE/REGION blocks, cue settings.
- `-->` timestamp format differs slightly (no leading zeros required on hours, uses `.` not `,` for milliseconds).
- Acceptable additional complexity for M2 — header is required and serves as format verification.

### ASS/SSA — Deferred
- ASS (Advanced SubStation Alpha) has a rich multi-section format: [Script Info], [V4+ Styles], [Events].
- Dialogue lines contain complex override tag syntax: `{\pos(x,y)}`, `{\an5}`, `{\fad(100,200)}` etc.
- Override tags require a separate lexer/parser pass to strip correctly.
- Style inheritance model is complex and varies between implementations.
- Security risks: override tags can contain arbitrary content including data URIs in uncommon extensions.
- Product value in M2: limited — clip workflows primarily use SRT/VTT for metadata-quality subtitles.
- Decision: implement ASS parsing in M3 or a dedicated ASS-handling task when the need is validated.

The `.ass` extension **can still be selected** (the file picker filter already includes it). Selecting an `.ass` file will result in `SUBTITLE_UNSUPPORTED_FORMAT` error with a human-readable message explaining why ASS is not yet supported and what formats are accepted. This is truthful behavior; it is not a silent failure.

---

## Format detection

Format is determined by file extension only (after `path.extname().toLowerCase()`):
- `.srt` → SRT parser
- `.vtt` → WebVTT parser
- `.ass` → immediate `SUBTITLE_UNSUPPORTED_FORMAT` result (no file read needed beyond size check)
- Any other extension → `SUBTITLE_UNSUPPORTED_FORMAT`

Content-sniffing (reading the first bytes to detect format) is explicitly rejected for M2:
- Extension mismatch (e.g., a `.vtt` file containing SRT content) should fail at parse time with a structured error.
- Silently inferring format from content creates ambiguous behavior and test surface.
- The file selection dialog already enforces extension filtering.

---

## ASS basic support consideration (rejected)

The prompt considered "basic ASS parser that extracts dialogue cues while ignoring styling". This was evaluated and rejected for M2 because:

1. ASS override tags appear within cue text (inline), not just in headers. Stripping them correctly requires a full state machine, not a simple tag-removal regex. A naive `replace(/\{[^}]*\}/g, '')` will mishandle nested braces, unicode braces, and ASS draw commands.
2. The Events section has a variable column count depending on [Script Info]. A basic parser that ignores this will corrupt cue data silently.
3. A parser that "works most of the time" with ASS creates user trust problems when it fails silently on common files.

If ASS is added later, it must be implemented with a proper section/event parser tested against a representative corpus of ASS files, not as a "strip the tags and hope" approach.

---

## User-facing format messaging

| Format | Status | Message shown if parse attempted |
|---|---|---|
| SRT (`.srt`) | Supported | (parse proceeds) |
| WebVTT (`.vtt`) | Supported | (parse proceeds) |
| ASS (`.ass`) | Unsupported | "ASS subtitle format is not yet supported. Convert to SRT or WebVTT first." |
| Other | Unsupported | "Subtitle format is not supported. Supported formats: .srt, .vtt" |
