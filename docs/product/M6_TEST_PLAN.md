# M6 — Test Plan

Date: 2026-07-20  
Status: Planning

---

## Overview

Testing strategy for M6 AI Provider and Prompt Infrastructure. M6 is a planning milestone — this plan specifies what the implementation must produce, not what has been run.

All test files follow existing project conventions: Vitest for unit/integration, Playwright for E2E/visual.

---

## Unit tests

### `tests/main/aiHttpClient.test.ts`

Tests for `AiHttpClientImpl`. Uses `vi.stubGlobal('fetch', ...)` to mock global fetch.

| Test | What it verifies |
|---|---|
| `sends HTTPS request with authorization header` | Correct URL composition, Bearer token from config |
| `returns AI_REDIRECT_NOT_ALLOWED for opaqueredirect (redirect:manual)` | undici opaqueredirect detection |
| `returns AI_AUTHENTICATION_FAILED for 401` | HTTP 401 → error code mapping |
| `returns AI_FORBIDDEN for 403` | HTTP 403 → error code mapping |
| `returns AI_INVALID_CONFIGURATION for 404` | HTTP 404 → error code mapping (model not found) |
| `returns AI_TIMEOUT for 408` | HTTP 408 → error code mapping |
| `returns AI_REQUEST_TOO_LARGE for 413` | HTTP 413 → error code mapping |
| `returns AI_INVALID_CONFIGURATION for 422` | HTTP 422 → error code mapping |
| `returns AI_RATE_LIMITED for 429` | HTTP 429 → error code mapping |
| `returns AI_PROVIDER_UNAVAILABLE for 500` | HTTP 500 → error code mapping |
| `returns AI_PROVIDER_UNAVAILABLE for 502` | HTTP 502 → error code mapping |
| `returns AI_PROVIDER_UNAVAILABLE for 503` | HTTP 503 → error code mapping |
| `returns AI_INVALID_CONFIGURATION for 400` | HTTP 400 → error code mapping |
| `returns AI_TIMEOUT when AbortSignal fires before response` | AbortController integration |
| `returns AI_RESPONSE_TOO_LARGE when body exceeds 512KB` | streaming reader byte cap |
| `retries AI_PROVIDER_UNAVAILABLE up to 3 times` | retry loop, attempt count |
| `retries AI_NETWORK_ERROR up to 3 times` | retry count (not just once) |
| `retries AI_RATE_LIMITED up to 3 times` | retry loop for rate limit |
| `does not retry AI_AUTHENTICATION_FAILED` | non-retryable enforcement |
| `does not retry AI_SCHEMA_VALIDATION_FAILED` | non-retryable enforcement |
| `respects Retry-After integer header on 429` | backoff from header value |
| `falls back to exponential backoff when Retry-After is HTTP-date format` | date format not parseable as int |
| `rejects non-HTTPS base URL before making request` | endpoint policy guard |
| `rejects RFC1918 private IP (10.x) before making request` | SSRF prevention |
| `rejects RFC1918 private IP (172.16.x) before making request` | SSRF prevention |
| `rejects RFC1918 private IP (192.168.x) before making request` | SSRF prevention |
| `rejects loopback 127.0.0.1 before making request` | loopback block |
| `rejects link-local 169.254.x.x before making request` | link-local block |
| `rejects IPv6 loopback ::1 before making request` | IPv6 loopback block |
| `rejects IPv6 ULA fc00::/7 before making request` | IPv6 ULA block |
| `does not log API key at any log level` | log scrubbing |
| `does not log request body at any log level` | privacy constraint |

### `tests/main/aiSecrets.test.ts`

Tests for `AiSecretsService`. Mocks `app.safeStorage`.

| Test | What it verifies |
|---|---|
| `storeKey encrypts via safeStorage.encryptString` | encryption used |
| `retrieveKey decrypts via safeStorage.decryptString` | round-trip |
| `storeKey throws AI_ENCRYPTION_UNAVAILABLE when safeStorage.isEncryptionAvailable() false` | availability check |
| `isAvailable returns false when safeStorage unavailable` | fallback detection |
| `env var fallback: returns key from SCENESIFT_AI_API_KEY when safeStorage unavailable` | env var path |

### `tests/main/aiConfiguration.test.ts`

Tests for `AiConfigurationService` + `DatabaseService` AI methods. Uses real in-memory SQLite.

| Test | What it verifies |
|---|---|
| `getAiProviderConfig returns default row after initialize` | default row init |
| `setApiKey stores encrypted blob and sets is_configured=1` | happy path |
| `setApiKey and clearConfiguration are atomic` | transaction integrity |
| `clearConfiguration sets encrypted_key=NULL and is_configured=0` | full clear |
| `consentRecordedAt persists and clears` | consent persistence |
| `restart: initialized status is configured_untested when key present` | restart behavior |
| `restart: initialized status is unconfigured when key absent` | restart behavior |
| `restart: last_test_at persists and is readable after re-initialize` | last_test_at persistence |
| `getConfigurationStatus never returns raw API key` | key not in output |
| `recordConsent idempotent (double-call safe)` | idempotency |

### `tests/main/aiService.test.ts`

Tests for `AiServiceImpl`. Mocks `AiHttpClient`.

| Test | What it verifies |
|---|---|
| `testConnection calls httpClient.testConnection with correct args` | DI wiring |
| `testConnection returns AI_NOT_CONFIGURED when unconfigured` | pre-flight check |
| `testConnection returns AI_CONSENT_REQUIRED when consent absent` | consent gate (AC-M6-001) |
| `executeStructuredRequest returns AI_NOT_CONFIGURED when unconfigured` | pre-flight check |
| `executeStructuredRequest returns AI_CONSENT_REQUIRED when consent absent` | consent gate applies to all AI calls |
| `cancelRequest fires AbortController signal` | cancellation wiring |
| `getConfigurationStatus returns current state after test` | state reflection |
| `AI_INVALID_RESPONSE retries exactly once before surfacing error` | one-retry policy for parse failure |
| `model/endpoint change → getConfigurationStatus shows configured_untested` | stale test status cleared on setApiKey |

### `tests/main/structuredOutputParser.test.ts`

Tests for the 7-step structured output parsing pipeline.

| Test | What it verifies |
|---|---|
| `passes valid JSON matching schema` | happy path |
| `extracts JSON from markdown code fence` | fence detection |
| `returns AI_RESPONSE_TOO_LARGE for finish_reason=length (step 1)` | finish_reason check before parsing |
| `returns AI_SCHEMA_VALIDATION_FAILED for finish_reason=content_filter (step 1)` | content filter mapping |
| `returns AI_RESPONSE_TOO_LARGE when byte count exceeded (step 2)` | byte cap |
| `returns AI_INVALID_RESPONSE when no JSON found (step 3)` | JSON extraction failure |
| `strips unknown keys — succeeds (step 4)` | Zod .strip() behavior; does NOT return error |
| `returns AI_SCHEMA_VALIDATION_FAILED on Zod type mismatch (step 5)` | Zod validation |
| `returns AI_SCHEMA_VALIDATION_FAILED on semantic validation failure — ok:false (step 6)` | semantic check |
| `returns typed result on full success (step 7)` | happy path typed output |

### `tests/main/ipc-contracts.test.ts` (updated)

Add test cases for all 5 new `ai:*` channels:
- Verify all 5 channel name constants present in `IPC_CHANNELS` (AC-M6-029)
- `ai:setApiKey` — rejects empty string apiKey
- `ai:setApiKey` — rejects apiKey length > 512
- `ai:setApiKey` — rejects non-string apiKey
- `ai:setApiKey` — rejects non-HTTPS baseUrl
- `ai:setApiKey` — rejects baseUrl > 2048 chars
- `ai:setApiKey` — rejects model > 128 chars
- `ai:getConfigurationStatus` — returns valid `AiConfigurationStatus` shape
- `ai:testConnection` — output schema valid

### `tests/renderer/AiProviderSection.test.tsx`

Unit tests for React component. Uses `vi.mock('window.sceneSift')`.

| Test | What it verifies |
|---|---|
| `renders privacy notice when consent not recorded` | consent gate |
| `disables Save button until consent given` | AC-M6-001 |
| `enables Save button after consent click` | AC-M6-002 |
| `shows validation error for empty API key` | AC-M6-003 |
| `shows validation error for http:// endpoint` | AC-M6-004 |
| `transitions to configured state after save` | AC-M6-007 |
| `clears API key input after save` | AC-M6-008 |
| `shows spinner during connection test` | AC-M6-012 |
| `shows Cancel button during connection test` | AC-M6-012 |
| `shows green Connected after successful test` | AC-M6-013 |
| `shows human-readable error after test failure` | AC-M6-014/015 |
| `shows Retry button after test failure` | AC-M6-018 |
| `transitions to unconfigured after clear` | AC-M6-009 |
| `never displays API key value in DOM` | AC-M6-006 |
| `status indicator has aria-live="polite"` | AC-M6-033 |
| `error messages have role="alert"` | AC-M6-034 |
| `all form inputs have associated labels` | AC-M6-035 |
| `prompt registry: PROMPT_REGISTRY.connectionTest has all required fields` | AC-M6-039 |
| `returns AI_OFFLINE when net.isOnline() is false` | offline pre-flight check |

### `tests/renderer/mediaFormatters.test.ts` (existing)

No changes required for M6.

---

## Integration tests

### Restart persistence (in `tests/main/aiConfiguration.test.ts`)

Full flow: initialize → setApiKey → close DatabaseService → re-initialize → verify is_configured=1 + blob present + status=configured_untested.

### Migration forward compatibility

`tests/database/migrations.test.ts`: run 0000 through 0004 in sequence, verify ai_provider_config and ai_secrets tables exist with correct columns.

---

## Security tests

### `tests/main/aiHttpClient.test.ts` (security scenarios)

Already covered in unit tests above: private IP rejection, non-HTTPS rejection, redirect non-follow, key not logged.

### `tests/governance/ai-security.test.ts` (new)

Adversarial test file verifying forbidden patterns in M6 implementation files. All checks are static grep against source files — no runtime execution required.

| Test | Pattern checked |
|---|---|
| `AiSecretsService must not log any string containing "key"` | grep `console\.(log\|warn\|error\|info).*key` in aiSecrets.ts |
| `AiHttpClient must use redirect:manual` | grep `redirect.*manual` in aiHttpClient.ts (AC-M6-021) |
| `AiHttpClient must not use shell:true` | grep `shell\s*:\s*true` in aiHttpClient.ts |
| `preload ai namespace must not expose generic invoke` | grep `invoke.*channel.*any\|channel.*any.*invoke` in preload ai block |
| `AiSecretsService must call safeStorage.encryptString` | grep `encryptString` in aiSecrets.ts |
| `AiHttpClient must not reference console.log with request body content` | grep for logging of request/response body content paths in aiHttpClient.ts (AC-M6-024) |
| `No AI file may import from renderer layer` | grep `from.*renderer/` in src/main/services/ai/** |

---

## IPC contract tests

`tests/main/ipc-contracts.test.ts` additions:

- `ai:setApiKey` rejects empty string apiKey
- `ai:setApiKey` rejects apiKey length > 512
- `ai:setApiKey` rejects non-string apiKey
- `ai:getConfigurationStatus` returns valid AiConfigurationStatus shape
- `ai:testConnection` output schema valid

---

## E2E tests

### `tests/e2e/ai-provider-config.e2e.spec.ts`

Playwright tests against browser QA mode (`VITE_SCENESIFT_BROWSER_QA=1`). Mock bridge simulates IPC responses.

| Test | Covers |
|---|---|
| `navigates to Settings and sees AI Provider section` | section renders |
| `privacy notice shown before configuration` | AC-M6-001 |
| `consent enables configuration form` | AC-M6-002 |
| `saves configuration and shows configured state` | AC-M6-007 |
| `test connection sends probe to {baseUrl}/v1/chat/completions with configured model` | AC-M6-011 (probe payload) |
| `test connection shows spinner then Connected` | AC-M6-012, AC-M6-013 |
| `test connection shows human-readable error on auth failure` | AC-M6-014 |
| `test connection shows human-readable error on rate limit` | AC-M6-015 |
| `cancel stops in-progress test` | AC-M6-016 |
| `clear configuration returns to unconfigured state` | AC-M6-009 |

---

## Visual regression tests

### `tests/visual/ai-provider-config.visual.spec.ts`

Captures screenshots via Playwright for visual diffing.

| Scenario | Viewport |
|---|---|
| Unconfigured state (with privacy notice) | 1280×800 |
| Unconfigured state (with privacy notice) | 800×700 compact |
| Configured/untested state | 1280×800 |
| Testing state (spinner) | 1280×800 |
| Available state (green indicator) | 1280×800 |
| Error: authentication failed | 1280×800 |
| Error: rate limited | 1280×800 |
| Error: network error | 1280×800 |
| Error: timeout | 1280×800 |
| Dark mode: unconfigured | 1280×800 |
| Dark mode: configured/untested | 1280×800 |
| Dark mode: testing | 1280×800 |
| Dark mode: available | 1280×800 |
| Dark mode: error (auth failure) | 1280×800 |

---

## Test run commands

```bash
pnpm test                    # all unit + integration (includes new ai tests)
pnpm test:e2e                # E2E including ai-provider-config.e2e.spec.ts
pnpm test:visual             # visual regression including ai-provider-config.visual.spec.ts
pnpm claude:test:adversarial # governance adversarial tests including ai-security.test.ts
```

---

## Coverage targets

| Area | Required coverage |
|---|---|
| `AiHttpClientImpl` | ≥90% branch coverage |
| `AiSecretsService` | ≥90% branch coverage |
| `AiConfigurationService` | ≥85% branch coverage |
| `parseStructuredOutput` | 100% branch coverage (all 7 steps) |
| `AiProviderSection` | ≥85% branch coverage |

---

## Test file locations summary

| File | Type | New/Updated |
|---|---|---|
| `tests/main/aiHttpClient.test.ts` | unit | New |
| `tests/main/aiSecrets.test.ts` | unit | New |
| `tests/main/aiConfiguration.test.ts` | unit + integration | New |
| `tests/main/aiService.test.ts` | unit | New |
| `tests/main/structuredOutputParser.test.ts` | unit | New |
| `tests/main/ipc-contracts.test.ts` | contract | Updated |
| `tests/renderer/AiProviderSection.test.tsx` | unit | New |
| `tests/governance/ai-security.test.ts` | adversarial | New |
| `tests/database/migrations.test.ts` | integration | Updated |
| `tests/e2e/ai-provider-config.e2e.spec.ts` | E2E | New |
| `tests/visual/ai-provider-config.visual.spec.ts` | visual | New |
