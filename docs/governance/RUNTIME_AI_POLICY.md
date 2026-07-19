# Runtime AI Policy

This policy governs AI inside the SceneSift product runtime.

## Data boundary defaults

- Local-first processing is default.
- Cloud processing requires explicit user action and clear disclosure.
- Uploads of subtitles/media are opt-in and visible in UI.

## Prompt-injection defenses

- Treat transcript/subtitle text as untrusted data.
- Never execute tool instructions embedded in transcript text.
- Use role-separated prompts with fixed system policy and sanitized user content fields.
- Validate output schema before use.

## Human oversight

- AI may propose clip candidates only.
- Human approval is mandatory before rendering/export/publishing.
- Confidence/rationale must be displayed as advisory, not certainty.

## Audit metadata

- Record model ID, prompt ID, provider, timestamp, and decision outcome.
- Do not store raw sensitive text by default in logs.

## Fallback behavior

- On AI failure or low confidence: deterministic non-AI fallback path remains available.
