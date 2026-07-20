# M6 — Privacy Model

Date: 2026-07-20  
Status: Planning

---

## What is sent to the AI provider

In M6:
- Connection test only: `{ role: "user", content: 'Reply with the JSON: {"ok": true}' }`. No user data.

In M7 (documented here for implementation planning):
- Transcript-derived text segments (excerpt from subtitle cue text, processed by M5 TranscriptService).
- Maximum character limit enforced before request (see `M6_ARCHITECTURE.md` bounds section).
- No raw file content.
- No file paths.
- No project names.
- No video metadata.
- No audio data.
- No video frames.

In all milestones:
- API key is sent as `Authorization: Bearer` header. This is transmitted to the provider.
- Request headers (Content-Type, Authorization) are sent.
- No SceneSift version, no device ID, no user ID, no telemetry.

---

## What is NOT sent

- Video files or video frames.
- Audio files or audio data.
- Subtitle files directly (only processed, bounded text excerpts).
- File system paths.
- Project names or IDs.
- User identity information.
- OS username or hostname.
- SceneSift configuration details.
- Any data other than the bounded, approved prompt content.

---

## Provider retention

SceneSift does not control provider data retention. The configured provider's privacy policy and data processing terms apply. Users must read and accept the provider's terms before using AI features.

SceneSift truthfully discloses:
- Data is sent to a third-party AI provider.
- The provider's data retention and processing terms govern what the provider does with the data.
- SceneSift does not receive any data back beyond the structured response.

SceneSift does not claim data is "not retained by the provider" because this cannot be verified.

---

## Consent model

**Decision**: Consent required once per configuration lifecycle, before any AI call.

Rationale: requiring consent every session is disruptive. "Once per install" is the goal UX, but the implementation resets consent on `clearConfiguration` (see below). This is by design: a user who reconfigures a different provider is starting a new data-sharing relationship and should re-read the notice.

**Implementation**:
- `ai_provider_config.consent_recorded_at` field (unix ms timestamp or NULL).
- Before any AI call: check `consent_recorded_at IS NOT NULL`.
- If NULL: `AI_NOT_CONFIGURED` error raised (renderer shows consent-required state).
- When user completes privacy notice and clicks "I understand": IPC `ai:recordConsent` → sets `consent_recorded_at = NOW`.
- Consent cannot be silently pre-recorded. Requires explicit UI action.

**Privacy notice content** (shown before first AI use after each configuration):
```
AI Features Notice

Setting up an AI provider means SceneSift can later send text from your subtitle files
to that provider to help identify clip candidates. Right now, only a short test message
is sent (to verify your key works). Subtitle text will be sent in a future step when you
use clip candidate generation.

Video and audio files are NEVER sent.

The provider processes any text you send according to its own privacy policy and terms of
service, which you should review before proceeding.

API keys are stored using your operating system's secure credential store when available.
On systems where that is unavailable, they may be stored less securely (the app will warn
you). Keys are not transmitted to SceneSift servers — SceneSift has no servers.

SceneSift is a local-first desktop application.

[ I understand and want to continue ]   [ Cancel ]
```

Note: "will send text" is replaced with a more accurate description of when subtitle text is sent (future step, not immediately on configuration). This is corrected from a previous version that described M7+ behavior as if it applied immediately.

**Consent reset**: If the user clears configuration, `consent_recorded_at` is reset to NULL. Re-entering configuration requires re-reading the notice.

---

## Logging policy

The following are prohibited in all log outputs for AI-related operations:

- API key (any form, including partial)
- Request body text (system prompt + user content)
- Response body text
- Transcript segment text
- Subtitle cue text
- Prompt template rendered with user data

Permitted in logs:
- `prompt_id`, `prompt_version`
- `input_char_count` (integer, not text)
- `output_byte_count` (integer, not bytes)
- `model`, `provider_type`
- Error codes (`AI_*`)
- Attempt number, retry delay
- HTTP status code
- Request duration in ms

---

## Telemetry

SceneSift has no telemetry. No usage data is reported to Anthropic, to app developer, or to any third party. `enable-telemetry-without-consent` is in `gate.yaml` `forbiddenAutonomousActions`.

If a future telemetry feature is proposed, it requires:
- Explicit user opt-in
- Governance review
- Privacy policy update
- New `DEPENDENCY_POLICY.md` entry for the telemetry client

---

## Claims that cannot be made truthfully

These claims must NOT appear in SceneSift UI or documentation:

- "Your data is not stored by the provider" — unverifiable
- "End-to-end encrypted" — the provider processes the plaintext
- "Zero data retention" — provider policy varies
- "GDPR compliant" — this depends on user's jurisdiction and provider's DPA
- "Privacy-preserving AI" — undefined

---

## Acceptable claims

These claims are truthful and may be used in UI:

- "Text from your subtitles is sent to the configured AI provider"
- "Video and audio are not uploaded"
- "Your API key is stored using your operating system's secure storage" (only when safeStorage is available; for env-var fallback: "Your API key is loaded from environment variable — stored less securely than keychain")
- "SceneSift has no servers or accounts"
- "AI features require explicit setup and are not enabled by default"
