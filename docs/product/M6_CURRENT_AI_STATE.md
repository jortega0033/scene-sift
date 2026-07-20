# M6 — Current AI Infrastructure State Audit

Date: 2026-07-20  
Baseline: M5 ACCEPTED (commit 575ccdb, 419/419 tests)  
Branch: overnight/m3-plus-2026-07-20  
Method: Source inspection of all main-process services, shared schemas, preload, IPC channels, database schema, settings schema, CSP configuration, package.json dependencies, and gate.yaml path classifications.

---

## Capability Map

| Capability | Status | Evidence |
|---|---|---|
| Secure secret storage | MISSING | `appSettingsTable` stores only FFmpeg paths, output dir, theme, diagnostics. No keychain or encrypted storage exists. `AppSettings` schema has no API key fields. |
| Provider configuration schema | MISSING | No `aiProvider`, `aiModel`, `aiEndpoint` in `appSettingsSchema` or `appSettingsTable`. |
| HTTP client abstraction | MISSING | No fetch wrapper, no retry helper, no timeout configuration beyond `runCommand.ts` (subprocess only). |
| Request timeout helper | PARTIAL | `runCommand.ts` has `timeoutMs` option for subprocess. No `fetch` or HTTP timeout helper exists. |
| Retry helper | MISSING | No retry or backoff utility in any service. |
| Abort support | MISSING | No `AbortController` usage anywhere in main process. |
| Structured AI error model | MISSING | `AppError` + `toSafeError` exist and provide safe error codes, but no AI-specific error taxonomy. |
| Prompt registry | MISSING | No prompt definitions, templates, or versioning exist. |
| Token estimator | MISSING | |
| Usage tracking | MISSING | |
| AI request persistence | MISSING | No `ai_requests` table or schema. |
| AI response persistence | MISSING | No `ai_responses` table or schema. |
| Network allowlist | MISSING | CSP `connect-src 'self'` blocks renderer network calls. Main process has no outbound URL allowlist. |
| Synthetic test provider | MISSING | No injectable test provider or mock AI service. |
| Consent gate | MISSING | No consent-recorded flag, no privacy disclosure mechanism. |
| AI configuration IPC | MISSING | No `ai:*` channels in `IPC_CHANNELS`. |
| AI configuration preload | MISSING | `window.sceneSift` has no `ai` namespace. |

---

## Reusable M1–M5 Patterns

The following implemented capabilities are directly reusable or directly analogous for M6:

### 1. `registerValidatedHandler` — risk-3 IPC pattern
**File**: `src/main/ipc/createIpcHandler.ts`  
**Reuse**: All new M6 AI IPC handlers must use this. Input validated by Zod before handler, output validated by Zod before response. AppError converted to safe error.

### 2. `runCommand` timeout + output bounds
**File**: `src/main/services/process/runCommand.ts`  
**Pattern**: `timeoutMs`, `maxOutputBytes`, process kill, `PROCESS_TIMEOUT`/`PROCESS_OUTPUT_LIMIT_EXCEEDED` error strings.  
**Reuse**: M6 HTTP provider service needs analogous timeout + response size bounds for `fetch`.

### 3. `AppError` + `toSafeError`
**File**: `src/main/utils/errors.ts`  
**Reuse**: All AI error codes extend this pattern. `toSafeError` redacts stack in production. AI codes must never include transcript content in `message` or `details`.

### 4. Zod schema validation pattern
**Files**: `src/shared/schemas/*.ts`, `src/shared/ipc/contracts.ts`  
**Reuse**: M6 adds `src/shared/schemas/ai.ts` with provider config, request, response schemas following the same structure.

### 5. Settings table + `updateSettings` pattern
**Files**: `src/database/schema.ts`, `src/main/services/database/databaseService.ts`  
**Reuse**: AI provider configuration metadata (non-secret fields: provider type, model, endpoint, configured flag, last test status) follows same pattern. Secret key is NOT in this table.

### 6. `appSettingsSchema` + Settings UI pattern
**Files**: `src/shared/schemas/settings.ts`, `src/renderer/features/settings/SettingsPage.tsx`  
**Reuse**: M6 AI configuration panel lives inside or alongside `SettingsPage`. Same `useForm + zodResolver + window.sceneSift.settings` IPC pattern. Secret key never returned to renderer.

### 7. Drizzle migration conventions
**Files**: `src/database/migrations/`, `src/database/schema.ts`  
**Reuse**: New `ai_provider_config` and optional `ai_request_log` tables follow `0004_*.sql` naming. Migration applied at startup by existing `migrate()` call.

### 8. Browser QA mode
**File**: `src/renderer/main.tsx` (behind `VITE_SCENESIFT_BROWSER_QA`)  
**Reuse**: QA adapter must add AI stubs returning all M6 UX states. Main-process integration tests use a real local HTTP server — not the QA adapter.

---

## CSP Analysis for AI Provider Calls

Current `connect-src 'self'` in both production and development CSPs.

**Critical finding**: AI provider calls (api.openai.com, api.anthropic.com, custom endpoints) are made from the **Electron main process**, not from the renderer. CSP applies to the renderer's network requests only. Main-process `fetch` is unrestricted by CSP.

**Implication**: M6 must enforce outbound endpoint policy in the main-process AI service (URL validation + HTTPS enforcement), not by relying on CSP. CSP does not change.

**Renderer impact**: If M6 needed to signal provider status to renderer, that flows through existing `window.sceneSift` IPC only, not a renderer network call.

---

## Settings Schema Gap

Current `appSettingsSchema`:
```typescript
{
  ffmpegPathOverride: string | null,
  ffprobePathOverride: string | null,
  defaultOutputDirectory: string | null,
  preferredTheme: 'system' | 'light' | 'dark',
  developmentDiagnosticsEnabled: boolean,
}
```

M6 requires additional fields in a separate AI configuration store. These must NOT be merged into `appSettingsTable` alongside non-AI settings because:
1. Secret key must never go in SQLite at all
2. AI configuration represents a distinct concern
3. Migration is cleaner if scoped

M6 adds `ai_provider_config` table (non-secret metadata only) and defines the secret storage strategy separately.

---

## Identified Gaps Summary

| Gap | Severity | Blocks M6? |
|---|---|---|
| No API key storage mechanism | CRITICAL | Yes |
| No HTTP client with timeout/abort | HIGH | Yes |
| No AI error taxonomy | HIGH | Yes |
| No prompt registry | HIGH | Yes |
| No structured output validator | HIGH | Yes |
| No consent gate mechanism | HIGH | Yes |
| No AI IPC channels | HIGH | Yes |
| No AI preload surface | HIGH | Yes |
| No retry/backoff utility | MEDIUM | Yes |
| No synthetic test provider | MEDIUM | Yes |
| No AI configuration schema | HIGH | Yes |
| No `ai_provider_config` DB table | MEDIUM | Yes |

All gaps must be filled by M6 implementation.
