# M6 — Provider Interface

Date: 2026-07-20  
Status: Planning

---

## Design constraint

The provider interface knows nothing about SceneSift UI or business logic. It handles only HTTP communication, error normalization, timeout, abort, and response parsing. Business logic (what to do with a response) lives in the calling service.

---

## AiHttpClient — internal only, not IPC-exposed

```typescript
// src/main/services/ai/aiHttpClient.ts

export type AiRequestPayload = {
  model: string;
  messages: ReadonlyArray<{ role: 'system' | 'user'; content: string }>;
  responseFormat: { type: 'json_schema'; jsonSchema: { name: string; schema: object } }
                | { type: 'json_object' };
  maxTokens: number;
  temperature: 0;
};

export type AiResponseRaw = {
  /** Parsed response body — only the 'choices[0].message.content' string */
  content: string;
  /** Usage metadata when supplied by provider */
  usage: {
    promptTokens: number | null;
    completionTokens: number | null;
    totalTokens: number | null;
  };
};

export type AiHttpOptions = {
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
  maxResponseBytes: number;
  signal?: AbortSignal;
};

export interface AiHttpClient {
  /**
   * POST /v1/chat/completions. Returns raw string content (not parsed).
   * Throws AppError with AI_* code on any failure.
   */
  post(payload: AiRequestPayload, options: AiHttpOptions): Promise<AiResponseRaw>;

  /**
   * Minimal probe request. Returns true on HTTP 200 with any valid JSON body.
   * Does not send transcript. Does not use response_format.
   */
  testConnection(options: Pick<AiHttpOptions, 'baseUrl' | 'apiKey' | 'timeoutMs'>): Promise<true>;
}
```

The `AiHttpClient` implementation:
- Uses `fetch` (built-in Node 18+ / Electron).
- Constructs `Authorization: Bearer {apiKey}` header internally.
- Validates URL passes endpoint policy before any request.
- Enforces response size limit.
- Maps HTTP status codes to `AiErrorCode` values.
- Never logs `apiKey` or response body text.

---

## AiService — orchestrates provider calls

```typescript
// src/main/services/ai/aiService.ts

export type StructuredRequest = {
  requestId: string;   // caller-provided UUID, used for cancellation
  promptId: string;
  promptVersion: number;
  systemPrompt: string;
  userContent: string;
  outputSchema: object;  // JSON Schema object
  outputSchemaName: string;
  maxTokens: number;
  timeoutMs: number;
};

export type StructuredResult<T> = {
  data: T;
  usage: { promptTokens: number | null; completionTokens: number | null; totalTokens: number | null };
};

export interface AiService {
  /** Returns current configuration status synchronously (no network). */
  getConfigurationStatus(): AiConfigurationStatus;

  /** 
   * Runs connection test. Returns safe result.
   * Single attempt, no retry. ~5s timeout.
   */
  testConnection(): Promise<AiConnectionTestResult>;

  /**
   * Executes a structured request.
   * Validates output against Zod schema (caller provides schema + schemaValidator).
   * Retries on retryable errors per retry policy.
   * Throws AppError with AI_* code on failure.
   */
  executeStructuredRequest<T>(
    request: StructuredRequest,
    schemaValidator: (raw: unknown) => T,  // Zod .parse() or similar
  ): Promise<StructuredResult<T>>;

  /** Aborts an in-flight request by ID. No-op if not found. */
  cancelRequest(requestId: string): void;
}
```

---

## AiConfigurationStatus type

```typescript
export type AiConfigurationStatus = {
  status:
    | 'unconfigured'
    | 'configured_untested'
    | 'testing'
    | 'available'
    | 'unavailable'
    | 'invalid_configuration'
    | 'rate_limited'
    | 'offline';
  providerType: 'openai_compatible' | null;
  model: string | null;
  maskedEndpoint: string | null;   // first 8 chars of base URL or null
  lastTestedAt: number | null;     // unix ms
  lastTestError: string | null;    // safe error code
};
```

---

## AiConnectionTestResult type

```typescript
export type AiConnectionTestResult = {
  success: boolean;
  errorCode: AiErrorCode | null;  // null on success
  testedAt: number;               // unix ms
};
```

---

## Provider error taxonomy

Full taxonomy in `M6_ERROR_TAXONOMY.md`. Interface contract:
- All `AiHttpClient` errors are `AppError` instances with `code` in the `AI_*` namespace.
- `AiService` re-throws as `AppError` after adding context (attempt number, model).
- `registerValidatedHandler` in IPC converts to `SafeError` before renderer sees it.

---

## Abort controller lifecycle

```
AiService.executeStructuredRequest(request, validator)
  → creates AbortController
  → stores in Map<requestId, AbortController>
  → passes signal to AiHttpClient.post()
  → on completion/error: deletes from Map
  → on cancelRequest(id): controller.abort(), deletes from Map
  → on app quit: all controllers aborted
```

A request that is cancelled returns `AppError('AI_REQUEST_CANCELLED', ...)`.

---

## Usage metadata

`AiResponseRaw.usage` is populated from `response.usage` in the OpenAI-compatible response. Fields are `null` when provider does not return them. Usage is returned to the caller but not logged with content. It may be persisted in `ai_request_log` at M6/M7 boundary.

---

## Model metadata

`AiService` does not enumerate models. The model name is a user-supplied string validated as non-empty, max 128 chars, alphanumeric + hyphens + dots + slashes. Model existence is determined at connection test time (the test call will fail with `AI_INVALID_RESPONSE` or HTTP 404 if the model does not exist).

---

## Raw response retention

**M6 default**: No raw response body is retained after validation. Content goes to the caller's Zod validator immediately, then is discarded from the HTTP layer.

**Development mode** (`developmentDiagnosticsEnabled: true`):
- Raw response body bytes count is logged at debug level.
- Not the body content itself.

M7+ may choose to persist validated structured output in `ai_request_log`. That is a M7 decision, not M6.
