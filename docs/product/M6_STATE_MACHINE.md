# M6 — State Machine

Date: 2026-07-20  
Status: Planning

---

## Configuration state machine

The configuration state is persisted in `ai_provider_config`. It represents the durable posture of the AI provider integration.

### States

| State | Meaning |
|---|---|
| `unconfigured` | No API key stored, no configuration present |
| `configured_untested` | API key stored, configuration present, connection not yet tested in current app session |
| `testing` | Connection test in progress (transient — not persisted) |
| `available` | Last connection test succeeded (persisted: `last_test_status='ok'`) |
| `unavailable` | Last connection test failed with a retryable/transient error (503, network error) |
| `invalid_configuration` | Last connection test failed with auth or config error (401, 403, invalid endpoint) |
| `rate_limited` | Last connection test failed with 429 |
| `offline` | Connection test failed due to `net.isOnline() === false` |

### Transitions

```
unconfigured
  → configured_untested       : user saves valid API key + metadata

configured_untested
  → unconfigured              : user clears configuration
  → testing                  : user triggers connection test
  → available                 : connection test result: success (persisted)
  → unavailable               : connection test result: server error, network error (persisted)
  → invalid_configuration     : connection test result: 401/403/invalid endpoint (persisted)
  → rate_limited              : connection test result: 429 (persisted)
  → offline                   : connection test result: offline (persisted)

testing  [transient — not persisted]
  → available                 : test response success
  → unavailable               : test response server/network error
  → invalid_configuration     : test response auth failure
  → rate_limited              : test response rate limited
  → offline                   : net.isOnline() false before/during test
  → configured_untested        : test cancelled (user abort)

available
  → configured_untested        : app restart (status is reset to configured_untested; last_test_status persisted but session availability not assumed)
  → testing                   : user re-tests
  → unconfigured               : user clears

unavailable / invalid_configuration / rate_limited / offline
  → testing                   : user re-tests
  → unconfigured               : user clears
  → configured_untested        : app restart

[any state]
  → configured_untested        : user changes model or endpoint (test may be stale; metadata updated)
```

**Restart behavior**: On app startup, if `is_configured = true` and blob exists in `ai_secrets`, status is initialized to `configured_untested` regardless of what `last_test_status` was. This is intentional — the provider may have changed state since last test.

---

## Request execution state (transient, per-request)

These states are not persisted. They describe a single `executeStructuredRequest` call.

| State | Meaning |
|---|---|
| `idle` | No active request |
| `preparing` | Building prompt, validating input size |
| `requesting` | `fetch` in flight |
| `validating` | Parsing and Zod-validating response |
| `succeeded` | Typed result available |
| `failed` | AppError with AI_* code |
| `cancelled` | User cancelled via `cancelRequest()` |

### Transitions

```
idle → preparing : executeStructuredRequest() called
preparing → requesting : input validated, fetch starts
preparing → failed : input too large, configuration invalid
requesting → validating : HTTP 200 received, body buffered
requesting → failed : HTTP error, timeout, abort (before body)
requesting → cancelled : user called cancelRequest() during fetch
validating → succeeded : JSON parse + Zod pass + semantic pass
validating → failed : any validation failure
failed → idle : error returned to caller
succeeded → idle : result returned to caller
cancelled → idle : AI_REQUEST_CANCELLED returned to caller
```

---

## UI state mapping

The renderer receives `AiConfigurationStatus` via `window.sceneSift.ai.getConfigurationStatus()`. It maps internal states to display:

| Internal status | UI display |
|---|---|
| `unconfigured` | "AI features not configured. Enter an API key to get started." |
| `configured_untested` | "API key saved. Test connection to verify." |
| `testing` | "Testing connection…" (spinner) |
| `available` | "Connected" (green indicator) |
| `unavailable` | "Provider unavailable. Check your network or try again." |
| `invalid_configuration` | "Authentication failed. Check your API key." |
| `rate_limited` | "Rate limited. Wait before testing again." |
| `offline` | "No network connection." |

---

## Privacy consent state

Separate from configuration state. Checked before any AI network call:

| State | Meaning |
|---|---|
| `not_recorded` | `consent_recorded_at IS NULL` |
| `recorded` | `consent_recorded_at IS NOT NULL` |

```
not_recorded → recorded : user clicks "I understand" in privacy notice
recorded → not_recorded : user clears configuration (consent reset)
```

In M7+: if `configurationStatus !== 'unconfigured'` AND `consentState === 'not_recorded'`, the AI feature shows the privacy notice before proceeding. In M6, the privacy notice is shown as part of the initial configuration flow.
