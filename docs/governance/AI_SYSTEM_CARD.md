# AI System Card (SceneSift)

## System intent

SceneSift AI assists with transcript-informed clip candidate suggestions for human editors.

## Non-goals

- Fully autonomous publishing.
- Unreviewed legal/copyright determinations.
- Hidden cloud processing by default.

## Inputs

- Subtitle/transcript text with timestamps.
- User-configured project settings and optional prompts.

## Outputs

- Candidate clip ranges + confidence/rationale metadata.
- Never direct execution instructions.

## Human-in-the-loop points

- Candidate acceptance/rejection.
- Timing adjustments.
- Render/export confirmation.

## Known limitations

- Model outputs can be inaccurate or overconfident.
- Translation/transcription ambiguity can propagate to clip suggestions.
- Domain/content bias may affect output relevance.
