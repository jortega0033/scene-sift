# M6 — Acceptance Criteria

Date: 2026-07-20  
Status: Planning

---

## Format

All criteria are testable. Each maps to user stories in M6_USER_STORIES.md and test cases in M6_TEST_PLAN.md.

AC-ID format: `AC-M6-NNN`

---

## Configuration flow

**AC-M6-001** — Privacy consent gate  
Given no consent recorded, when user opens AI Provider section, the privacy notice is displayed and the "Save configuration" button is disabled until consent is recorded.

**AC-M6-002** — Consent records permanently  
Given user clicks "I understand", the `consent_recorded_at` column is set in the database, the privacy notice is replaced with a one-line summary, and the "Save configuration" button becomes enabled.

**AC-M6-003** — Form validation: API key required  
Given user submits form with empty API key, form submission is prevented and a validation error is displayed before any IPC call is made.

**AC-M6-004** — Form validation: HTTPS only (client-side)  
Given user enters an `http://` base URL, form submission is prevented with error "Endpoint must use HTTPS."

**AC-M6-005** — Successful key save  
Given user enters valid non-empty API key, valid model, valid HTTPS base URL, and clicks "Save configuration", the key is encrypted via safeStorage and stored as a BLOB in `ai_secrets.encrypted_key`, and `ai_provider_config.is_configured` becomes 1.

**AC-M6-006** — Key never returned via IPC  
Given any IPC call to `ai:getConfigurationStatus`, the response object must not contain the raw API key string at any nesting level.

**AC-M6-007** — Configured state shown after save  
Given successful save, the settings UI transitions to "configured" state showing provider, endpoint (masked), and model — with "Test connection" and "Clear configuration" buttons visible.

**AC-M6-008** — API key input cleared after save  
Given successful save, the `<input type="password">` for API key is cleared (value becomes empty string); the key is not stored in any in-memory React state.

**AC-M6-009** — Clear configuration resets all state  
Given user clicks "Clear configuration" and confirms, `ai_secrets.encrypted_key` is NULL, `ai_provider_config.is_configured` is 0, `consent_recorded_at` is NULL, `last_test_status` is NULL, and UI returns to unconfigured state.

**AC-M6-010** — Restart persistence  
Given user saves configuration and restarts app, upon restart `ai_provider_config.is_configured` is 1, the encrypted key blob is present, and configuration status is `configured_untested`.

---

## Connection testing

**AC-M6-011** — Test sends minimal probe  
Given user clicks "Test connection", exactly one request is made to `{base_url}/v1/chat/completions` or equivalent probe endpoint with model set to `{configured_model}` and a single low-token system message; no user transcript data is included.

**AC-M6-012** — Test shows spinner during test  
Given test is in progress, the UI shows a spinner with text "Testing connection…" and a "Cancel" button.

**AC-M6-013** — Successful test updates state to available  
Given test receives HTTP 200 with valid JSON, `last_test_status` is set to `'ok'`, `last_test_at` is set, and UI shows green "Connected" indicator.

**AC-M6-014** — Auth failure mapped correctly  
Given test receives HTTP 401, error code `AI_AUTHENTICATION_FAILED` is returned; UI shows "Authentication failed. Check your API key."

**AC-M6-015** — Rate limit mapped correctly  
Given test receives HTTP 429, error code `AI_RATE_LIMITED` is returned; UI shows "Rate limited. Wait a moment and try again."

**AC-M6-016** — Cancel aborts in-flight test  
Given user clicks "Cancel" during an in-progress test, the `AbortController` signal fires, the request is aborted, and state returns to `configured_untested` with no error displayed.

**AC-M6-017** — Test timeout enforced  
Given provider does not respond within 10,000ms, `AI_TIMEOUT` is returned and displayed to user.

**AC-M6-018** — Re-test available after error  
Given connection test resulted in error state, "Retry" button is displayed and triggers another test run.

---

## Security / network

**AC-M6-019** — Non-HTTPS endpoint rejected  
Given user saves configuration with `http://` base URL (even if client-side check is bypassed), the server-side IPC handler returns `AI_ENDPOINT_NOT_ALLOWED` and no HTTP request is made.

**AC-M6-020** — Private IP blocked  
Given base URL resolves to a private IP range (10.x, 192.168.x, 127.x, 169.254.x, ::1), the HTTP client returns `AI_ENDPOINT_NOT_ALLOWED` without making the network request.

**AC-M6-021** — Redirect not followed  
Given provider returns HTTP 301 with a different Location header, `fetch` with `redirect: 'manual'` receives the opaque redirect response, and `AI_REDIRECT_NOT_ALLOWED` is returned without following the redirect.

**AC-M6-022** — Response size cap enforced  
Given provider returns a response body exceeding 512KB, reading is aborted and `AI_RESPONSE_TOO_LARGE` is returned.

**AC-M6-023** — No key in logs  
Given any successful or failed AI operation, no log line (console, file, or IPC trace) contains the raw API key value.

**AC-M6-024** — Log infrastructure contains no transcript-logging pathways  
Verified by adversarial grep in `tests/governance/ai-security.test.ts`: the `AiHttpClient` and `AiService` log call sites must contain no code pathway that could emit request body content (transcript text). This is verified statically in M6; the runtime scenario where transcript text exists begins in M7 and will be verified there with live data.

---

## Database / persistence

**AC-M6-025** — Migration runs on existing database  
Given database at migrations 0003, running `0004_ai_provider.sql` produces `ai_provider_config` and `ai_secrets` tables without data loss on existing tables.

**AC-M6-026** — Atomic setApiKey  
Given power failure simulation (forced rollback) between updating `ai_provider_config` and `ai_secrets`, neither table is in a half-written state; both update atomically.

**AC-M6-027** — safeStorage encryption available check  
Given `safeStorage.isEncryptionAvailable()` returns false and no env var fallback, IPC handler returns `AI_ENCRYPTION_UNAVAILABLE`; configuration is not saved.

**AC-M6-028** — Env var fallback  
Given `safeStorage.isEncryptionAvailable()` returns false and `SCENESIFT_AI_API_KEY` env var is set, the env var value is used as the key with `is_configured` set to 1 in database. Consent must still be recorded via the normal UI flow — the env var path does not auto-record `consent_recorded_at`. The env var value is read once at startup, stored in a private in-memory field, and `process.env.SCENESIFT_AI_API_KEY` is unset to prevent child-process inheritance. In production packaged builds (`app.isPackaged === true`), HTTPS enforcement is not bypassable by env var.

---

## IPC and preload

**AC-M6-029** — All 5 IPC channels registered  
`src/shared/ipc/channels.ts` contains `AI_GET_CONFIGURATION_STATUS`, `AI_SET_API_KEY`, `AI_TEST_CONNECTION`, `AI_CLEAR_CONFIGURATION`, `AI_RECORD_CONSENT`.

**AC-M6-030** — Preload rejects empty API key  
Given `window.sceneSift.ai.setApiKey({ apiKey: '' })` called from renderer, preload layer rejects with error before making IPC call.

**AC-M6-031** — Preload rejects API key over 512 chars  
Given `window.sceneSift.ai.setApiKey({ apiKey: 'x'.repeat(513) })` called, preload rejects before IPC call.

**AC-M6-032** — No generic IPC invoke channel  
`src/preload/index.ts` must not expose a generic `invoke(channel, ...args)` pass-through on the `ai` namespace.

---

## UI / accessibility

**AC-M6-033** — Status indicator accessible  
Status indicator element has `aria-live="polite"` and announces state changes to screen readers.

**AC-M6-034** — Error messages announced as alerts  
Error message elements have `role="alert"`.

**AC-M6-035** — All form inputs have labels  
Each of: API key input, endpoint input, model input, provider selector — has an associated `<label>` with matching `htmlFor`.

**AC-M6-036** — Dark/light token compliance  
`AiProviderSection` uses no hardcoded hex/px color values; all color styling via design-system tokens.

---

## Structured output pipeline (M6 foundation for M7+)

**AC-M6-037** — 7-step validation pipeline implemented  
`parseStructuredOutput()` function in `src/main/services/ai/structuredOutputParser.ts` implements: finish_reason check → byte count check → JSON extraction → unknown-key stripping → Zod validation → semantic validation → typed result.

**AC-M6-038** — Schema validation failure is non-retryable  
Given provider returns JSON that fails Zod validation, `AI_SCHEMA_VALIDATION_FAILED` is returned with `retryable: false`.

**AC-M6-039** — Prompt registry functional  
`PROMPT_REGISTRY.connectionTest` exists in `src/shared/prompts/registry.ts` with required fields: `promptId`, `version`, `purpose`, `systemInstructions`, `buildUserContent`, `outputJsonSchema`, `outputValidator`, `maxInputChars`, `maxOutputTokens`, `maxDurationMs`.

---

## Test counts summary

| Category | ACs |
|---|---|
| Configuration flow | AC-M6-001 through AC-M6-010 (10) |
| Connection testing | AC-M6-011 through AC-M6-018 (8) |
| Security / network | AC-M6-019 through AC-M6-024 (6) |
| Database / persistence | AC-M6-025 through AC-M6-028 (4) |
| IPC and preload | AC-M6-029 through AC-M6-032 (4) |
| UI / accessibility | AC-M6-033 through AC-M6-036 (4) |
| Structured output | AC-M6-037 through AC-M6-039 (3) |
| **Total** | **39** |
