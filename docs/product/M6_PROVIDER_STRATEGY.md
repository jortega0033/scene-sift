# M6 — Provider Strategy

Date: 2026-07-20  
Status: Planning — Decision required

---

## Options evaluated

### Option A — One OpenAI-compatible provider interface

Support any endpoint that speaks the OpenAI Chat Completions JSON protocol (POST /v1/chat/completions, Bearer auth). Configuration: base URL, model name, API key.

Concrete providers that work without code changes:
- OpenAI (api.openai.com)
- Any OpenRouter-style compatible endpoint
- Local proxies (localhost, tested via HTTP when explicitly configured)

**Pros**:
- Single code path. No provider-specific dispatch.
- Supports Anthropic via their OpenAI-compatible endpoint (when available) or a minimal shim.
- Testable with local HTTP test server.
- No SDK dependency required — standard `fetch` with a typed request/response structure.
- Swappable endpoint for future providers without code change.
- Small surface area.

**Cons**:
- Does not use Anthropic Messages API natively (no system-prompt-as-first-message, no vision, no tool_use differences).
- OpenAI schema differences (max_tokens vs max_completion_tokens) need version handling.
- No streaming. M6 does not need streaming — all responses are schema-validated JSON.

### Option B — One concrete provider (Anthropic SDK)

Add `@anthropic-ai/sdk` as a dependency. Implement against Anthropic Messages API.

**Pros**:
- Native Anthropic types.
- Cleaner API for system prompts and structured output.

**Cons**:
- New npm dependency requiring governance review and `DEPENDENCY_POLICY.md` compliance.
- Bundle size: ~200 KB minified.
- Packages a client that may make background requests (telemetry, update checks) without explicit control.
- Vendor lock-in: M7–M14 becomes Anthropic-only unless a second adapter is added.
- API key management is different from OpenAI-compatible pattern.
- Electron packaging: SDK is not certified for Electron main-process asar bundling.

### Option C — Multiple provider adapters

Design a provider interface and implement both Anthropic and OpenAI adapters.

**Why rejected**: No immediate product need. Speculative abstraction. Violates "no multi-provider routing unless strongly justified" constraint. Doubles M6 scope without delivering user value.

---

## Decision: Option A — One OpenAI-compatible interface

**Rationale**:

1. No new dependency. Node.js built-in `fetch` is available in Electron's Chromium runtime for main-process code as of Node 18+. SceneSift targets Electron 28+ (Node 18+). Verified: `node:https` module also available.

2. OpenAI-compatible JSON protocol is well-documented, stable, and testable with a local HTTP server.

3. Users who want Anthropic can configure the Anthropic OpenAI-compatible endpoint. If that endpoint does not provide full feature parity, a native Anthropic adapter can be added in a later governance cycle with proper dependency review.

4. Single code path reduces risk surface. One timeout, one abort, one retry, one error normalizer.

5. Aligns with M6 non-goals: no SDK, no bundled client, no background provider activity.

**Confirmed provider for M6 default**: OpenAI (api.openai.com). Configuration allows any HTTPS base URL passing the URL validation policy. OpenAI is chosen because it has the largest user base and most predictable structured-output behavior via `response_format: { type: "json_schema" }`.

---

## Synthetic provider for tests

One additional in-memory synthetic provider is defined:

```typescript
interface SyntheticProviderConfig {
  behavior: 
    | 'success'
    | 'auth_failure'
    | 'rate_limit'
    | 'server_error'
    | 'timeout'
    | 'abort'
    | 'invalid_json'
    | 'schema_invalid'
    | 'oversized_response'
    | 'network_error'
    | 'retry_then_success';
  responseOverride?: object;
  delayMs?: number;
}
```

The synthetic provider:
- Is selected only when `process.env.SCENESIFT_AI_TEST_PROVIDER === 'synthetic'` or passed explicitly in test DI.
- Never appears in the production provider selection path.
- Is not exposed via any IPC channel.

---

## OpenAI-compatible request format (canonical)

```http
POST {baseUrl}/v1/chat/completions
Authorization: Bearer {apiKey}
Content-Type: application/json

{
  "model": "{model}",
  "messages": [
    { "role": "system", "content": "{systemPrompt}" },
    { "role": "user", "content": "{userContent}" }
  ],
  "response_format": { "type": "json_schema", "json_schema": { "name": "{schemaName}", "schema": {...} } },
  "max_tokens": {maxTokens},
  "temperature": 0
}
```

Notes:
- `temperature: 0` for deterministic structured output.
- `response_format.json_schema` used when provider supports it. Fallback: `response_format: { type: "json_object" }` if schema mode unavailable.
- `max_tokens` enforced to prevent unbounded cost.
- No `stream: true`. All M6+ requests are single-shot structured responses.

---

## Connection test probe

The connection test sends a minimal valid request:
- `model`: configured model
- `messages`: `[{ role: "user", content: "Reply with the JSON: {\"ok\":true}" }]`
- `max_tokens`: 20
- No transcript content.
- No system prompt.
- Response validated only for HTTP 200 + valid JSON body (not schema-validated).

This confirms authentication, endpoint reachability, and model availability without sending user data.
