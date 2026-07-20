# M6 — Error Taxonomy

Date: 2026-07-20  
Status: Planning

---

## Stable AI error codes

All codes are `AppError` `code` values. They follow the same convention as existing codes (`PROJECT_NOT_FOUND`, `FFPROBE_ERROR`, etc.).

| Code | Retryable | HTTP mapping | User message key |
|---|---|---|---|
| `AI_NOT_CONFIGURED` | No | — | "API key required." |
| `AI_CONSENT_REQUIRED` | No | — | "Accept the AI privacy notice before using AI features." |
| `AI_INVALID_CONFIGURATION` | No | 400 | "Configuration incomplete." |
| `AI_ENDPOINT_NOT_ALLOWED` | No | — | "Endpoint not allowed." |
| `AI_AUTHENTICATION_FAILED` | No | 401 | "Authentication failed." |
| `AI_FORBIDDEN` | No | 403 | "Access denied." |
| `AI_RATE_LIMITED` | Yes (after backoff) | 429 | "Rate limited." |
| `AI_PROVIDER_UNAVAILABLE` | Yes | 503, 500 | "Provider unavailable." |
| `AI_NETWORK_ERROR` | Yes (up to 3) | — | "Network error." |
| `AI_TIMEOUT` | Yes (once) | — | "Request timed out." |
| `AI_REQUEST_CANCELLED` | No | — | "Request cancelled." |
| `AI_REQUEST_TOO_LARGE` | No | — | "Request too large." |
| `AI_RESPONSE_TOO_LARGE` | No | — | "Response too large." |
| `AI_INVALID_RESPONSE` | Yes (once) | — | "Invalid response from provider." |
| `AI_SCHEMA_VALIDATION_FAILED` | No | — | "AI response did not match expected format." |
| `AI_OFFLINE` | No | — | "No network connection." |
| `AI_ENCRYPTION_UNAVAILABLE` | No | — | "Secure storage unavailable." |
| `AI_REDIRECT_NOT_ALLOWED` | No | 3xx | "Endpoint not allowed." |
| `AI_INTERNAL_ERROR` | No | — | "An unexpected error occurred." |

---

## Retryable classification detail

### Retryable — up to 3 attempts with exponential backoff

- `AI_RATE_LIMITED` — respects `Retry-After` header when present (integer seconds only; HTTP-date format → use exponential backoff default)
- `AI_PROVIDER_UNAVAILABLE` — HTTP 503, 500, 502
- `AI_NETWORK_ERROR` — connection refused, ECONNRESET, DNS resolution failure

### Retryable — one retry only

- `AI_TIMEOUT` — one retry after original attempt; if retry also times out, non-retryable
- `AI_INVALID_RESPONSE` — one retry only (may be transient encoding issue)

### Non-retryable

All others. Auth failures, config failures, and validation failures will not resolve with retry.

---

## finish_reason → error code mapping

`finish_reason` is checked before any content parsing. If absent or `null`, proceed to parsing.

| finish_reason | Error code | Retryable |
|---|---|---|
| `'length'` | `AI_RESPONSE_TOO_LARGE` | No |
| `'content_filter'` | `AI_SCHEMA_VALIDATION_FAILED` | No |
| `'stop'` | — (proceed to parsing) | — |
| `null` / absent | — (proceed to parsing) | — |

Note: `finish_reason: 'length'` means the model was truncated by `max_tokens` — retrying will produce the same truncation. Content filter rejections never resolve on retry.

---

## HTTP status → error code mapping

```typescript
const mapHttpStatus = (status: number): AiErrorCode => {
  if (status === 401) return 'AI_AUTHENTICATION_FAILED';
  if (status === 403) return 'AI_FORBIDDEN';
  if (status === 404) return 'AI_INVALID_CONFIGURATION'; // model not found
  if (status === 400) return 'AI_INVALID_CONFIGURATION'; // bad request
  if (status === 408) return 'AI_TIMEOUT';
  if (status === 413) return 'AI_REQUEST_TOO_LARGE';
  if (status === 422) return 'AI_INVALID_CONFIGURATION'; // unprocessable
  if (status === 429) return 'AI_RATE_LIMITED';
  if (status >= 500)  return 'AI_PROVIDER_UNAVAILABLE';
  if (status >= 300 && status < 400) return 'AI_REDIRECT_NOT_ALLOWED';
  return 'AI_PROVIDER_UNAVAILABLE';
};
```

---

## Logging policy per error code

```typescript
// Log fields — never include transcript text, response body, or API key
{
  code: 'AI_AUTHENTICATION_FAILED',
  provider: 'openai_compatible',
  model: 'gpt-4o-mini',
  attempt: 1,
  durationMs: 342,
  // NOT included: apiKey, requestBody, responseBody, transcriptText
}
```

Logged at `warn` level for retryable errors; `error` level for non-retryable; `debug` level for `AI_REQUEST_CANCELLED`.

---

## Renderer receives only safe errors

IPC handler wraps all errors via `toSafeError()` which produces `{ code, message }` where:
- `code` is one of the `AI_*` codes above
- `message` is a generic human-readable string (never includes key, response body, or user data)
- `details` is only present in development mode, contains stack trace only

The renderer maps `code` to user-facing copy from the `AI_ERROR_MESSAGES` map. The raw `code` string is not displayed to users.

---

## Relationship to existing `AppError` + `toSafeError`

M6 adds no new error infrastructure — it uses the existing `AppError` constructor and `toSafeError` utility. The new `AI_*` error codes are additional string literals, not a separate error class.

Example:
```typescript
throw new AppError('AI_AUTHENTICATION_FAILED', 'API key is invalid or expired.');
```

This propagates through `registerValidatedHandler` exactly as existing errors do.
