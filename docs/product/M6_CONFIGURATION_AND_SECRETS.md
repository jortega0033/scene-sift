# M6 — Configuration and Secret Ownership

Date: 2026-07-20  
Status: Planning

---

## What must be stored

| Field | Secret? | Storage |
|---|---|---|
| API key | YES — must not be in SQLite | OS keychain (safeStorage) |
| Provider type | No | SQLite `ai_provider_config` |
| Base URL | No | SQLite `ai_provider_config` |
| Model name | No | SQLite `ai_provider_config` |
| Configuration present flag | No | SQLite `ai_provider_config` |
| Last connection-test status | No | SQLite `ai_provider_config` (transient, overwritten) |
| Last connection-test timestamp | No | SQLite `ai_provider_config` |
| Consent recorded flag | No | SQLite `ai_provider_config` |

---

## Secret storage decision: Electron `safeStorage`

**Decision**: Use `electron.safeStorage` for API key storage.

**Rationale**:
- `safeStorage` is built into Electron — no new dependency.
- Encrypts using OS-provided keychain/credential store (macOS Keychain, Windows DPAPI, Linux libsecret/kwallet).
- Returns a `Buffer` of encrypted bytes. Only the app binary that encrypted the data can decrypt it.
- `safeStorage.encryptString(plaintext)` → `Buffer` stored as BLOB in a separate `ai_secrets` SQLite table.
- `safeStorage.decryptString(buffer)` → plaintext, only callable in main process.
- Decryption result never leaves main process.
- `safeStorage.isEncryptionAvailable()` must be checked; if unavailable (e.g., headless CI), fall back to env-variable mode.

**Implementation**:

```typescript
// src/main/services/ai/secretsService.ts
import { safeStorage } from 'electron';

export class SecretsService {
  storeApiKey(key: string): Buffer {
    if (!safeStorage.isEncryptionAvailable()) throw new AppError('AI_ENCRYPTION_UNAVAILABLE', '...');
    return safeStorage.encryptString(key);
  }
  retrieveApiKey(encrypted: Buffer): string {
    if (!safeStorage.isEncryptionAvailable()) throw new AppError('AI_ENCRYPTION_UNAVAILABLE', '...');
    return safeStorage.decryptString(encrypted);
  }
}
```

`ai_secrets` table: `project_id TEXT PRIMARY KEY` (value `'ai_provider'`), `encrypted_key BLOB`, `updated_at INTEGER`.

This table exists in the same SQLite file but the encrypted bytes are unreadable without `safeStorage.decryptString` from the same Electron build — defense-in-depth even if SQLite file is extracted.

---

## Alternative: environment variables only

If `safeStorage.isEncryptionAvailable()` returns false (Linux without libsecret, headless environments):

- `SCENESIFT_AI_API_KEY` environment variable is read at startup.
- **Immediately unset from `process.env`** after reading: `delete process.env.SCENESIFT_AI_API_KEY`. This prevents the raw key from remaining accessible to any later code that reads `process.env`.
- Held in memory only as private field of `AiConfigurationService`. Never written to SQLite.
- `isConfigured()` checks either safeStorage blob presence OR env var presence.
- UI shows "API key loaded from environment" status (read-only, no edit/clear).

This is the fallback mode for CI and headless testing, not the primary production path.

**Plaintext prohibition**: When safeStorage is unavailable, the `ai:setApiKey` IPC handler MUST throw `AI_ENCRYPTION_UNAVAILABLE` — never store the key as plaintext in SQLite or any file. The env var path bypasses IPC entirely (read-only at startup). There is no code path that results in a plaintext API key on disk.

---

## What the renderer never receives

The renderer must never receive:
- Raw API key string
- Decrypted key
- `Authorization` header value
- Provider client object
- Any function that can issue arbitrary HTTP
- `safeStorage.decryptString` result

The renderer receives only:
- `configurationStatus`: one of `unconfigured | configured_untested | testing | available | unavailable | invalid_configuration | rate_limited | offline`
- `maskedEndpoint`: first 8 chars of base URL (e.g., `https://`) — sufficient to confirm endpoint without revealing key
- `model`: model name string
- `providerType`: `'openai_compatible'`
- `lastTestedAt`: timestamp or null
- `lastTestError`: safe error code string or null

---

## Key entry flow

1. User opens Settings → AI Provider section.
2. User types API key into a `<input type="password">` field.
3. On "Save", renderer calls `window.sceneSift.ai.setApiKey({ apiKey })`.
4. Preload validates: non-empty string, max 512 chars.
5. IPC handler `ai:setApiKey` receives string, encrypts via `SecretsService.storeApiKey()`, stores encrypted blob in `ai_secrets`.
6. Updates `ai_provider_config.is_configured = true`.
7. Returns `{ ok: true }` — NOT the key or its hash.
8. Renderer clears the input field after success (component state reset).
9. Subsequent `getConfigurationStatus()` calls see `is_configured = true` without key data.

---

## Key update flow

Same as entry flow. New `storeApiKey` call overwrites the existing blob.

---

## Key removal flow

1. User clicks "Clear configuration".
2. `window.sceneSift.ai.clearConfiguration()` → IPC → `ai:clearConfiguration`.
3. Handler deletes row from `ai_secrets`.
4. Sets `ai_provider_config.is_configured = false`, nulls last-test fields.
5. Returns `{ cleared: true }`.

---

## App restart behavior

On startup:
1. `AiConfigurationService.initialize()` called from `index.ts`.
2. Reads `ai_provider_config` row (non-secret metadata).
3. Checks `ai_secrets` blob exists and `safeStorage.isEncryptionAvailable()`.
4. If yes: `configurationStatus = 'configured_untested'` (not re-tested automatically).
5. If blob missing: `configurationStatus = 'unconfigured'`.
6. If env var present: `configurationStatus = 'configured_untested'` (env-var mode).
7. Status is never `'available'` without an explicit test in the current session.

---

## Development vs packaged differences

| Scenario | Behavior |
|---|---|
| `pnpm dev` (dev build) | safeStorage uses dev Electron binary key. Keys encrypted for dev binary. |
| `pnpm build` + packaged app | safeStorage uses production binary key. Dev-encrypted blobs unreadable in production. |
| CI / headless | `safeStorage.isEncryptionAvailable() === false` → env-var mode. |
| Test suite | Uses synthetic provider. No real key needed. |

This means dev and production API keys are separate — intentional. User must re-enter key after installing a new app build.

---

## No keychain migration in M6

If the user upgrades the app, their encrypted blob may be unreadable (new binary key). This is an accepted limitation documented in M6. A migration path (re-entry prompt on startup when blob unreadable) may be added in a future milestone. M6 treats decryption failure as `unconfigured`.

---

## Compliance with gate.yaml

- `**/secrets/**` and `**/*_key*` are risk-4 (critical-forbidden).
- The `ai_secrets` table stores a `Buffer` blob — not a string secret in source code.
- No API key appears in any source file, test file, or log.
- `hardcoded-secret-shape` pattern check in `gate.yaml` catches accidental literal keys.
- `SecretsService` tests use the synthetic provider (no real keys). `safeStorage` mocked in Vitest via `vi.mock('electron', ...)`.
