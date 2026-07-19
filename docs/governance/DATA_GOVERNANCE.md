# Data Governance

## Data classes

1. **User media** (video/audio) — sensitive project content.
2. **Transcripts/subtitles** — potentially sensitive text.
3. **Project metadata** — operational context.
4. **Diagnostic logs** — minimized event data.

## Rules

- Default local storage; no silent upload.
- Least retention needed for function.
- Explicit deletion paths for project data.
- Diagnostics must redact or omit sensitive text by default.
- Any cloud transfer requires disclosure + consent checkpoint.
