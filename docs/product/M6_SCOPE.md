# M6 — Scope Definition

Date: 2026-07-20  
Status: Planning

---

## One-sentence objective

Configure one approved AI provider safely in the Electron main process, execute bounded and versioned prompts, validate structured responses, and present truthful configured, unconfigured, offline, and failure states.

---

## What M6 Is

M6 is **infrastructure only**. It establishes the technical layer that future milestones (M7 clip candidate generation, M10 subtitle editing, M12 rendering) call through to reach an AI provider. M6 itself does not produce any product-visible AI output.

M6 delivers:

1. **AI provider configuration** — user enters an API key and selects provider/model in Settings. Key is stored via a safe mechanism (see `M6_CONFIGURATION_AND_SECRETS.md`). Metadata persisted in SQLite (non-secret fields only).

2. **Connection test** — user-triggered "Test connection" that calls the provider with a minimal probe and returns pass/fail with a safe error code. No transcript content is sent.

3. **Provider status display** — truthful status UI: unconfigured / configured-untested / testing / available / unavailable / invalid-configuration / rate-limited / offline.

4. **Bounded HTTP provider client** — main-process-only, with timeout, abort, response-size limit, retry with backoff, safe error redaction.

5. **Prompt registry** — typed, versioned, immutable prompt definitions in TypeScript modules. No runtime-created prompts. No renderer-controlled prompts.

6. **Structured output validator** — reusable pipeline: response byte check → JSON parse → Zod schema validation → semantic validation → typed result or error.

7. **AI error taxonomy** — stable, safe error codes matching `AppError` conventions, never including transcript content.

8. **Privacy notice** — displayed before any AI feature is used. Consent state persisted.

9. **Synthetic test provider** — injectable factory used in automated tests.

10. **M7 internal contract** — `AiService` exposes `executeStructuredRequest()` internally. M7 will call this through a task-specific IPC handler, never through a generic invoke IPC.

---

## What M6 Is Not

The following are explicitly out of scope. Any planning finding or implementation attempt to include these must be rejected.

| Non-goal | Notes |
|---|---|
| Clip candidate generation | M7 |
| Chapter / segment generation | M7+ |
| Candidate scoring or review UI | M8 |
| Transcript summarization as product feature | Not planned |
| Subtitle editing | M10 |
| Video rendering | M12 |
| yt-dlp downloading | Deferred (DL-009) |
| Translation | Deferred to M19 (DL-010) |
| Publishing | M15+ |
| Telemetry | Prohibited |
| Multi-provider routing | Deferred unless justified |
| Agent orchestration / tool calling | Not planned |
| Web search | Not planned |
| Embeddings / vector database | Not planned |
| Prompt marketplace | Not planned |
| User-defined arbitrary prompts | Not planned |
| User-supplied provider code | Not planned |
| Automatic background AI requests | Not planned |
| Media upload (video/audio) | Prohibited in M6 |
| Placeholder UI for M7 | Not planned |
| Chat interface | Not planned |
| Model playground / temperature sliders | Not planned |

---

## M6 Exit Criteria (summary)

Full criteria in `M6_ACCEPTANCE_CRITERIA.md`. Summary:

- User can enter an API key in Settings (key not stored in SQLite)
- User can test the connection and see pass/fail with safe message
- User can clear configuration
- Provider status persists across app restart (non-secret metadata only)
- Privacy notice is displayed before any AI call
- No AI call made in unconfigured state
- Full validation pass: 0 typecheck errors, 0 lint warnings, all tests pass

---

## Milestone Context

```
M5 — Transcript Preparation           CLOSED (575ccdb)
M6 — AI Provider Infrastructure       PLANNING (this milestone)
M7 — Clip Candidate Generation        Blocked on M6
M8 — Candidate Review Workflow        Blocked on M7
M10 — Subtitle Editing                Amendment: boundary overlap ACs
M12 — FFmpeg Clip Rendering           Amendment: libass detection, subtitle burn-in
```

M6 does not change the M10 or M12 scope — those amendments are recorded in `docs/research/YOUTUBE_CLIPPER_SKILL_MILESTONE_IMPACT.md`.
