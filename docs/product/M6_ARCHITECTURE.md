# M6 — Architecture

Date: 2026-07-20  
Status: Planning  
Risk: 3 (main process, IPC, preload, database migration, network)

---

## Layer diagram

```
src/renderer/features/settings/AiProviderSection.tsx   [risk 2]
  → window.sceneSift.ai.{getConfigurationStatus, setApiKey, testConnection, clearConfiguration, recordConsent}

src/preload/index.ts   [risk 3]
  → validates inputs → ipcRenderer.invoke(AI_* channels)

src/shared/ipc/channels.ts   [risk 3 — new channels]
  AI_GET_CONFIGURATION_STATUS
  AI_SET_API_KEY
  AI_TEST_CONNECTION
  AI_CLEAR_CONFIGURATION
  AI_RECORD_CONSENT

src/shared/ipc/contracts.ts   [risk 3 — new contracts]
  ai: { getConfigurationStatus, setApiKey, testConnection, clearConfiguration, recordConsent }

src/shared/schemas/ai.ts   [risk 1]
  aiConfigurationStatusSchema
  aiSetApiKeyInputSchema
  aiTestConnectionOutputSchema
  aiClearConfigurationOutputSchema
  aiRecordConsentOutputSchema

src/main/ipc/registerIpcHandlers.ts   [risk 3 — new handler registrations]

src/main/services/ai/aiConfigurationService.ts   [risk 3]
  getConfigurationStatus()
  setApiKey(key)
  clearConfiguration()
  recordConsent()
  getApiKey() : string | null  — internal, never exposed via IPC

src/main/services/ai/aiSecretsService.ts   [risk 3]
  storeKey(key: string): Buffer
  retrieveKey(encrypted: Buffer): string
  isAvailable(): boolean

src/main/services/ai/aiHttpClient.ts   [risk 3]
  post(payload, options): Promise<AiResponseRaw>
  testConnection(options): Promise<true>

src/main/services/ai/aiService.ts   [risk 3]
  getConfigurationStatus()
  testConnection()
  executeStructuredRequest(request, validator)
  cancelRequest(requestId)

src/shared/prompts/types.ts   [risk 1]
src/shared/prompts/registry.ts   [risk 1]
src/shared/prompts/prompts/connectionTest.ts   [risk 1]

src/database/schema.ts   [risk 2 — new tables]
  aiProviderConfigTable
  aiSecretsTable

src/database/migrations/0004_ai_provider.sql   [risk 3 — migration]

tests/main/aiHttpClient.test.ts   [risk 1]
tests/main/aiService.test.ts   [risk 1]
tests/main/aiConfiguration.test.ts   [risk 1]
tests/main/aiSecrets.test.ts   [risk 1]
tests/main/ipc-contracts.test.ts   [risk 1 — updated]
tests/renderer/AiProviderSection.test.tsx   [risk 1]
tests/e2e/ai-provider-config.e2e.spec.ts   [risk 2]
tests/visual/ai-provider-config.visual.spec.ts   [risk 2]
src/renderer/qa/mockBridge.ts   [risk 3 — QA bridge additions]
```

---

## New IPC channels

```typescript
// src/shared/ipc/channels.ts additions
AI_GET_CONFIGURATION_STATUS: 'ai:getConfigurationStatus',
AI_SET_API_KEY: 'ai:setApiKey',
AI_TEST_CONNECTION: 'ai:testConnection',
AI_CLEAR_CONFIGURATION: 'ai:clearConfiguration',
AI_RECORD_CONSENT: 'ai:recordConsent',
```

All follow `namespace:verb` convention matching existing channels.

---

## New preload surface

```typescript
// src/preload/index.ts additions
ai: {
  getConfigurationStatus: () =>
    ipcRenderer.invoke(IPC_CHANNELS.AI_GET_CONFIGURATION_STATUS),
  setApiKey: (input: { apiKey: string; baseUrl?: string; model?: string }) => {
    if (typeof input?.apiKey !== 'string' || !input.apiKey.trim())
      return Promise.reject(new Error('apiKey must be a non-empty string'));
    if (input.apiKey.length > 512)
      return Promise.reject(new Error('apiKey too long'));
    if (input.baseUrl !== undefined) {
      if (typeof input.baseUrl !== 'string')
        return Promise.reject(new Error('baseUrl must be a string'));
      if (input.baseUrl.length > 2048)
        return Promise.reject(new Error('baseUrl too long'));
      try {
        const parsed = new URL(input.baseUrl);
        if (parsed.protocol !== 'https:')
          return Promise.reject(new Error('baseUrl must use HTTPS'));
      } catch {
        return Promise.reject(new Error('baseUrl must be a valid URL'));
      }
    }
    if (input.model !== undefined) {
      if (typeof input.model !== 'string' || !input.model.trim())
        return Promise.reject(new Error('model must be a non-empty string'));
      if (input.model.length > 128)
        return Promise.reject(new Error('model too long'));
    }
    return ipcRenderer.invoke(IPC_CHANNELS.AI_SET_API_KEY, {
      apiKey: input.apiKey.trim(),
      baseUrl: input.baseUrl?.trim(),
      model: input.model?.trim(),
    });
  },
  testConnection: () =>
    ipcRenderer.invoke(IPC_CHANNELS.AI_TEST_CONNECTION),
  clearConfiguration: () =>
    ipcRenderer.invoke(IPC_CHANNELS.AI_CLEAR_CONFIGURATION),
  recordConsent: () =>
    ipcRenderer.invoke(IPC_CHANNELS.AI_RECORD_CONSENT),
},
```

No generic `invoke` channel. No prompt text or system prompt accepted from renderer. `setApiKey` payload includes `{ apiKey, baseUrl?, model? }` — preload validates each field before forwarding to IPC.

Note: `getApiKey()` in `AiConfigurationService` is a private method — not accessible from IPC handlers. The API key never crosses back to the renderer.

---

## Request bounds

| Bound | Value | Rationale |
|---|---|---|
| Max API key length | 512 chars | OpenAI keys are ~51 chars; Anthropic ~108 chars; 512 is safe ceiling |
| Max model name length | 128 chars | Covers known model IDs + future expansion |
| Max base URL length | 2048 chars | Standard URL max |
| Max transcript chars per request | 50,000 chars | ~12,500 tokens at 4 chars/token; typical transcripts 5,000–20,000 chars |
| Max transcript entries per request | 500 entries | Prevents unbounded M7 requests |
| Max serialized request bytes | 256,000 bytes | ~256 KB |
| Max provider response bytes | 512,000 bytes | See `M6_NETWORK_ARCHITECTURE.md` |
| Max content string chars | 128,000 chars | After response body read |
| Max JSON parse input | 512,000 bytes | Same as response cap |
| Max array items in output schema | 50 items | Per prompt; M7 clip candidates typically 5–20 |
| Max string field length in output | 2,000 chars | Per prompt definition |
| Connection test timeout | 10,000 ms | |
| Structured request timeout | 120,000 ms | |
| Max retry attempts | 3 | Including initial |

---

## File ownership by layer

| Path | Layer | Risk |
|---|---|---|
| `src/shared/schemas/ai.ts` | shared | 1 |
| `src/shared/prompts/**` | shared | 1 |
| `src/renderer/features/settings/AiProviderSection.tsx` | renderer | 2 |
| `src/renderer/hooks/useAiConfiguration.ts` | renderer | 2 |
| `src/renderer/qa/mockBridge.ts` | renderer (QA) | 3 |
| `src/database/schema.ts` | database | 2 |
| `src/database/migrations/0004_ai_provider.sql` | database | 3 |
| `src/main/services/ai/**` | main | 3 |
| `src/main/ipc/registerIpcHandlers.ts` | main | 3 |
| `src/shared/ipc/channels.ts` | shared IPC | 3 |
| `src/shared/ipc/contracts.ts` | shared IPC | 3 |
| `src/preload/index.ts` | preload | 3 |

---

## Service initialization in main process

```typescript
// src/main/index.ts additions
const aiSecretsService = new AiSecretsService();
const aiConfigurationService = new AiConfigurationService(dbService, aiSecretsService);
const aiHttpClient = new AiHttpClientImpl();
const aiService = new AiServiceImpl(aiConfigurationService, aiSecretsService, aiHttpClient);

registerIpcHandlers({ databaseService: dbService, videoService, aiService, aiConfigurationService });
```

Dependency injection enables test mocking without module-level side effects.

---

## Architecture constraints (must-not-violate)

1. `src/renderer/**` must not import from `src/main/**` or `src/database/**`. AI client is main-only.
2. `src/shared/**` may contain AI schemas and prompt definitions — no runtime privileges needed.
3. API key must never appear in `window.sceneSift` return values.
4. No new generic IPC channel (no `ai:invoke`, no `ai:fetch`, no `ai:prompt`).
5. `safeStorage` used only in `AiSecretsService` — not elsewhere.
6. All new IPC channels registered via `registerValidatedHandler`.
7. Outbound HTTP in `AiHttpClientImpl` only — no other service makes external HTTP calls.
