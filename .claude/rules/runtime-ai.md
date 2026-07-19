---
globs: ["src/main/services/ai/**", "src/main/services/runtime-ai/**"]
---

# Runtime AI Rule

Risk: 2 default. Risk 3 for prompt construction, model selection, output handling, or privacy-relevant data processing.

## Prompt construction

- No user data injected directly into system prompts without sanitization.
- Prompt templates must be in dedicated template files, not inlined in logic.
- Log prompt templates (not user content) for audit.

## Model and API usage

- Model selection via configuration, not hardcoded strings.
- API keys via environment variables only — never in source or logs.
- Rate limits and quotas enforced before calls, not just after errors.
- Graceful degradation when AI service unavailable.

## Output handling

- Validate and sanitize all model outputs before use in UI or data store.
- Never pass raw model output to `eval` or dynamic script contexts.
- Log AI errors with structured codes; do not surface raw API errors to renderer.

## Privacy

- Scene data sent to external AI APIs must be stripped of PII per privacy policy.
- User consent state must be checked before any network AI call.
- See `docs/governance/DATA_PRIVACY.md` for current consent requirements.

## Tests

`tests/ai/` covers prompt construction and output validation. Run after any change.
