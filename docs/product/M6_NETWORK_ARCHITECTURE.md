# M6 — Network Architecture

Date: 2026-07-20  
Status: Planning

---

## Data flow

```
Renderer (React)
  → window.sceneSift.ai.getConfigurationStatus()   [read-only, no network]
  → window.sceneSift.ai.setApiKey(input)            [M6 only — write secret, no network]
  → window.sceneSift.ai.testConnection()            [triggers network call]
  → window.sceneSift.ai.clearConfiguration()        [local cleanup, no network]

  [M7+, not M6]
  → window.sceneSift.clipCandidates.generateForProject(projectId)
        ↓ IPC: clipCandidate:generateForProject
        ↓ CandidateService.generate()
        ↓ AiService.executeStructuredRequest()
        ↓ AiHttpClient.post()
        ↓ fetch(endpoint, { signal: AbortController.signal })
        ↓ External AI provider HTTPS endpoint
```

**The renderer never calls the AI provider directly.** All provider communication is main-process only.

---

## Endpoint policy

### Allowed endpoints

An endpoint passes validation if it meets ALL of:

1. URL parses successfully (`new URL(input)` does not throw).
2. Protocol is `https:`.
3. Hostname does not resolve to any private/reserved IP range. Blocked ranges:
   - RFC 1918 IPv4: 10.x, 172.16–31.x, 192.168.x
   - IPv4 loopback: 127.x
   - IPv4 link-local: 169.254.x.x
   - IPv6 loopback: ::1
   - IPv6 link-local: fe80::/10
   - IPv6 ULA: fc00::/7
   **Unless** `SCENESIFT_ALLOW_LOCAL_AI_ENDPOINT=1` is set AND `app.isPackaged === false` (dev only — cannot be overridden in production builds).
4. Hostname does not resolve to link-local (169.254.x.x) — covered by item 3 above.
5. No credentials in URL (no `user:pass@`).
6. No query string in base URL (query params added per-request only).

**Default allowed endpoints** (pre-populated, user-editable):
- `https://api.openai.com`

**Custom endpoints**: user may enter any HTTPS URL that passes policy. This supports OpenRouter, local proxies via ngrok, enterprise gateway endpoints.

**SSRF consideration**: Electron main process runs with full network access. A user-controlled base URL is a potential SSRF vector. Mitigations:
- HTTPS-only policy prevents `file://`, `ftp://`, `data://`.
- Private IP blocklist prevents internal network probing (dev bypass requires `app.isPackaged === false`).
- No redirect-following that crosses host boundaries (see redirect policy).
- URL is validated before any request. Validation is synchronous, before `fetch`.

**Residual risk — DNS rebinding**: Pre-flight IP checks (`dns.lookup` or equivalent) are NOT atomic with `fetch()`. An attacker-controlled DNS server could return a valid IP for the check, then switch to a private IP for the actual connection. Mitigation: hostname-based checks are best-effort; literal IP addresses are robustly blocked. `redirect: 'manual'` limits credential forwarding exposure. This risk is documented and accepted in `M6_RISK_REGISTER.md` as R-M6-011.

### Localhost policy

`http://localhost:*` and `http://127.0.0.1:*` are allowed only when ALL of:
- `SCENESIFT_ALLOW_LOCAL_AI_ENDPOINT=1` is set in environment, AND
- `app.isPackaged === false` (enforced in code — production builds cannot override this)

This enables:
- Running `ollama` locally during development.
- Local HTTP test server in `tests/main/`.

The `app.isPackaged` check is mandatory. Even if the env var is somehow set in a production build, the code path must gate on `app.isPackaged === false` first — env var alone is not sufficient authorization.

---

## Redirect policy

All `fetch` calls use:
```typescript
redirect: 'manual'  // do not follow redirects automatically
```

Redirect detection in Node.js/Electron (undici): with `redirect: 'manual'`, the response does NOT carry the 3xx status code. Instead:
- `response.type === 'opaqueredirect'` — this is the undici/Node.js signal for a blocked redirect
- `response.status === 0` — accompanies opaqueredirect; not a reliable standalone check

Detection logic (belt-and-suspenders for runtime compatibility):
```typescript
if (response.type === 'opaqueredirect' || (response.status >= 300 && response.status < 400)) {
  throw new AppError('AI_REDIRECT_NOT_ALLOWED', '...');
}
```

Do not follow. Do not re-send credentials to the redirect target.

This prevents open-redirect attacks that could exfiltrate the Authorization header to an attacker-controlled server.

---

## TLS / HTTPS

- `fetch` in Node.js 18+ / Electron uses the system certificate store by default.
- Certificate errors are not suppressed.
- No `rejectUnauthorized: false` in any path.
- No custom CA injection in M6.

---

## Timeout

Every request has two timeout mechanisms:

1. **Absolute timeout** (`timeoutMs`): `AbortController` + `setTimeout`. Default: 30,000 ms for connection test; 120,000 ms for structured request. Both configurable per `PromptDefinition.maxDurationMs`.

2. **Idle timeout**: If the response body starts streaming but stops, an additional 60,000 ms idle timeout fires. Implemented by tracking last data event and firing the abort signal.

On timeout: abort signal fires, `fetch` rejects, `AI_TIMEOUT` error returned.

---

## Response size limit

All responses are read with a size cap:

```typescript
const MAX_RESPONSE_BYTES = 512_000; // 512 KB
```

Implementation:
```typescript
const reader = response.body.getReader();
let received = 0;
const chunks: Uint8Array[] = [];
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  received += value.length;
  if (received > MAX_RESPONSE_BYTES) {
    reader.cancel();
    throw new AppError('AI_RESPONSE_TOO_LARGE', '...');
  }
  chunks.push(value);
}
```

512 KB is ~100× a typical structured clip candidate response. Prevents memory exhaustion from pathological provider responses.

---

## Retry policy

Retryable errors:
- `AI_RATE_LIMITED` (HTTP 429) — up to 3 attempts
- `AI_PROVIDER_UNAVAILABLE` (HTTP 503, 500, 502) — up to 3 attempts; 429 does NOT map here
- `AI_NETWORK_ERROR` (connection refused, DNS failure) — up to 3 attempts
- `AI_TIMEOUT` — one retry only
- `AI_INVALID_RESPONSE` (JSON parse error) — one retry only

Non-retryable errors (retry immediately returns error to caller):
- `AI_AUTHENTICATION_FAILED` (401)
- `AI_FORBIDDEN` (403)
- `AI_INVALID_CONFIGURATION`
- `AI_ENDPOINT_NOT_ALLOWED`
- `AI_REQUEST_TOO_LARGE`
- `AI_RESPONSE_TOO_LARGE`
- `AI_SCHEMA_VALIDATION_FAILED`
- `AI_REQUEST_CANCELLED` (user abort)
- HTTP 400

Retry parameters:
- Maximum attempts: 3 (including initial attempt)
- Backoff: exponential, base 1,000 ms, multiplier 2, max 8,000 ms
- Jitter: ±200 ms random to prevent thundering herd
- `Retry-After` header respected when present: attempt `parseInt(header, 10)` first; if result is NaN (HTTP-date format), fall back to exponential backoff default; cap at 60 seconds

Connection test does not retry — single attempt.

---

## Abort / cancellation

Each request receives a fresh `AbortController`. The signal is passed to `fetch`:

```typescript
const controller = new AbortController();
const result = await fetchWithTimeout(url, options, controller.signal, timeoutMs);
```

The controller is stored in `AiService` keyed by a request ID. To cancel:
```typescript
aiService.cancelRequest(requestId);
// → controller.abort() → fetch rejects with AbortError → AI_REQUEST_CANCELLED
```

M7 will call `cancelRequest()` when the user clicks "Cancel" in the UI.

Cleanup: on app close, all active controllers are aborted.

---

## Authorization header ownership

The `Authorization: Bearer {apiKey}` header is constructed in `AiHttpClient` inside the main process. It is never:
- Passed from renderer via IPC
- Stored in any IPC payload
- Logged at any level
- Included in error messages

The renderer only triggers named operations (test connection, generate candidates). It cannot specify headers.

---

## Offline detection

Before any request:
1. Check `net.isOnline()` (Electron `net` module).
2. If offline: return `AI_OFFLINE` immediately without attempting `fetch`.

`net.isOnline()` is a fast synchronous check. It may have false positives (network reachable but DNS down) — these surface as `AI_NETWORK_ERROR` from the fetch.

---

## Safe error redaction

Provider response bodies are never logged. Provider error messages are mapped to safe codes:

```typescript
// This is the authoritative mapping — keep in sync with M6_ERROR_TAXONOMY.md
const mapHttpStatus = (status: number): AiErrorCode => {
  if (status === 401) return 'AI_AUTHENTICATION_FAILED';
  if (status === 403) return 'AI_FORBIDDEN';
  if (status === 404) return 'AI_INVALID_CONFIGURATION'; // model/endpoint not found
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

Raw response body from provider is discarded after reading. Only parsed content (after JSON validation) is used.

---

## No transcript in logs

At every logging point in the HTTP path:
- Request body is logged at debug level as `{ prompt_id, prompt_version, input_char_count }` — never the text.
- Response body is logged at debug level as `{ output_byte_count, valid: boolean }` — never the content.
- Errors are logged as `{ code, provider, model, attempt }` — never the transcript or response text.
