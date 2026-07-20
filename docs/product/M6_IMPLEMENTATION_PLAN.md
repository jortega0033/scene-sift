# M6 — Implementation Plan

Date: 2026-07-20  
Status: Planning

---

## Constraint summary

- All risk-3 paths: specialist review + independent verifier + human approval required.
- All risk-2 paths: independent verifier + human approval required.
- Max 3 implementation attempts per task before escalation.
- No M7 features. No new npm dependencies. No direct git push.
- Each phase runs `pnpm typecheck && pnpm lint && pnpm test` before sign-off.

---

## Phase ordering

Dependency graph:
```
shared schemas + prompts (risk 1)
  → database migration (risk 3)
  → AiSecretsService (risk 3)
  → AiConfigurationService (risk 3)
    → AiHttpClient (risk 3)
      → AiService (risk 3)
        → IPC channels + handlers (risk 3)
          → preload additions (risk 3)
            → renderer component (risk 2)
              → E2E + visual tests (risk 2)
```

---

## Phase 0 — Loop state update

**Risk**: 0  
**Agent**: orchestrator  
**Files**: `STATE.md`, `loop-run-log.md`  

Update STATE.md: milestone=M6, run_id=`M6-impl-001`, risk_level=3, status=in_progress.  
Record planning-complete entry in loop-run-log.md.

---

## Phase 1a — Shared schemas and prompt infrastructure (risk 1)

**Risk**: 1  
**Agent**: governed-implementer  
**Verifier**: architecture-reviewer  
**Required checks**: typecheck, lint, test  

**Deliverables**:
1. `src/shared/schemas/ai.ts` — aiConfigurationStatusSchema, aiSetApiKeyInputSchema, aiTestConnectionOutputSchema, aiClearConfigurationOutputSchema, aiRecordConsentOutputSchema
2. `src/shared/prompts/types.ts` — PromptDefinition<TInput, TOutput> type (including `skipResponseFormat?: boolean` field; `maxInputChars: 0` documents "no variable user content")
3. `src/shared/prompts/registry.ts` — PROMPT_REGISTRY object
4. `src/shared/prompts/prompts/connectionTest.ts` — connection test prompt definition (skipResponseFormat: true)

**Verifier checks**:
- No runtime privilege imports in `src/shared/**`
- Schemas use Zod
- `architecture:validate` passes

---

## Phase 1b — IPC channels and contracts (risk 3)

**Risk**: 3  
**Agent**: governed-implementer  
**Verifier**: electron-security-reviewer  
**Required checks**: governance:validate, typecheck, lint, test, build, package:dir, test:e2e  

Note: `src/shared/ipc/channels.ts` and `src/shared/ipc/contracts.ts` are classified risk 3 per gate.yaml (`high-risk-electron: "Electron main/preload, IPC..."`). Must be in a separate phase with correct verifier and full risk-3 check set.

**Deliverables**:
1. `src/shared/ipc/channels.ts` — add 5 AI_* channel constants
2. `src/shared/ipc/contracts.ts` — add `ai` namespace with 5 contract entries
3. `tests/main/ipc-contracts.test.ts` additions — channel existence check + payload schema tests for all 5 channels

**Verifier checks**:
- Channel name convention: `namespace:verb` matching existing pattern
- Contract schemas use Zod
- All 5 channel constants exist in channels.ts (not just referenced in contracts)
- Contract tests pass
- No generic `ai:invoke` channel added

---

## Phase 2 — Database migration

**Risk**: 3  
**Agent**: governed-implementer  
**Verifier**: architecture-reviewer (database migration expertise; independent from implementer)  
**Required checks**: governance:validate, typecheck, lint, test, build, package:dir  

**Deliverables**:
1. `src/database/schema.ts` additions — aiProviderConfigTable + aiSecretsTable Drizzle definitions
2. `pnpm drizzle-kit generate` — generates `0004_ai_provider.sql` AND updates `meta/_journal.json` atomically; hand-written SQL must not be used (journal update is mandatory or migration silently skips)
3. `tests/database/migrations.test.ts` update — run 0000–0004 in sequence, verify tables; include migration rollback test per database rule

**Verifier checks**:
- `meta/_journal.json` contains entry for migration 4 (index: 4, tag: "0004_ai_provider")
- No DROP TABLE or DROP COLUMN in generated migration
- `CREATE TABLE IF NOT EXISTS` used
- `created_at` has `DEFAULT` value on ai_provider_config (or upsert is UPDATE-only — must be explicit)
- `ai_secrets.encrypted_key` is BLOB type, not TEXT
- Migration test runs clean; rollback test passes
- Migration file format matches drizzle-kit output format (backtick identifiers)

---

## Phase 3 — AiSecretsService

**Risk**: 3  
**Agent**: governed-implementer  
**Verifier**: electron-security-reviewer  
**Required checks**: governance:validate, typecheck, lint, test, build, package:dir  

**Deliverables**:
1. `src/main/services/ai/aiSecretsService.ts`
2. `tests/main/aiSecrets.test.ts`

**Verifier checks**:
- safeStorage.isEncryptionAvailable() checked before encrypt/decrypt
- No key material in log statements
- Env var fallback path covered
- Unit tests pass

---

## Phase 4 — AiConfigurationService + DatabaseService additions

**Risk**: 3  
**Agent**: governed-implementer  
**Verifier**: electron-security-reviewer  
**Required checks**: governance:validate, typecheck, lint, test, build, package:dir  

**Deliverables**:
1. `src/main/services/database/databaseService.ts` additions — getAiProviderConfig, updateAiProviderConfig (UPDATE-only; row guaranteed by ensureAiProviderConfigRow), getAiSecretBlob, setAiSecretBlob, clearAiSecretBlob, ensureAiProviderConfigRow, ensureAiSecretsRow
2. `src/main/services/ai/aiConfigurationService.ts`
3. `tests/main/aiConfiguration.test.ts`

**Verifier checks**:
- `setApiKey` transaction also clears `lastTestStatus=NULL, lastTestAt=NULL` (stale test status must not survive key change)
- `setApiKey` and `clearConfiguration` wrapped in transactions
- `getConfigurationStatus` output contains no raw key
- `getApiKey()` is a private method (not accessible from IPC handler registration code)
- Restart behavior: status=configured_untested on startup when configured
- env var path: `SCENESIFT_AI_API_KEY` is read once, stored in private field, then unset from `process.env` to prevent child-process inheritance
- All 9 database test cases pass

---

## Phase 5 — AiHttpClient

**Risk**: 3  
**Agent**: governed-implementer  
**Verifier**: electron-security-reviewer  
**Required checks**: governance:validate, typecheck, lint, test, build, package:dir  

**Deliverables**:
1. `src/main/services/ai/aiHttpClient.ts`
2. `tests/main/aiHttpClient.test.ts`

**Verifier checks**:
- `redirect: 'manual'` present in fetch options
- Redirect detection checks `response.type === 'opaqueredirect'` (Node.js/undici `redirect:manual` returns status=0 with type='opaqueredirect', not a 3xx status code)
- HTTPS-only and `app.isPackaged` check guards ALLOW_LOCAL_AI_ENDPOINT (env var cannot override HTTPS check in production builds)
- Private IP blocklist covers RFC 1918 IPv4 (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16), loopback (127.0.0.0/8), link-local IPv4 (169.254.0.0/16), IPv6 loopback (::1), IPv6 link-local (fe80::/10), and IPv6 ULA (fc00::/7)
- DNS rebinding documented as residual risk — IP check applies to literal IP hostnames only
- 512KB response cap via streaming reader
- Retry policy: AI_RATE_LIMITED, AI_PROVIDER_UNAVAILABLE, AI_NETWORK_ERROR: up to 3 attempts; AI_TIMEOUT: 1 retry; AI_INVALID_RESPONSE: 1 retry; all others: non-retryable
- Retry-After: if header present, parse as integer seconds (max 60s); if not parseable as integer (e.g., HTTP-date format), use exponential backoff default
- finish_reason checked before content parsing: 'length' → AI_RESPONSE_TOO_LARGE; 'content_filter' → AI_SCHEMA_VALIDATION_FAILED (non-retryable); missing/null finish_reason → proceed to content parsing
- max_tokens vs max_completion_tokens: send both fields (max_tokens for legacy providers, max_completion_tokens for newer OpenAI models); document this as belt-and-suspenders
- AbortController wired correctly
- No key, no request body in log statements
- All unit test cases pass (including HTTP 404, 408, 413, 422, 502 mappings)

---

## Phase 6 — Structured output parser

**Risk**: 3  
**Agent**: governed-implementer  
**Verifier**: electron-security-reviewer  
**Required checks**: governance:validate, typecheck, lint, test, build, package:dir  

Note: `src/main/services/ai/structuredOutputParser.ts` is in `src/main/**` (risk 3 per gate.yaml). Processes raw AI model output — security-relevant.  

**Deliverables**:
1. `src/main/services/ai/structuredOutputParser.ts`
2. `tests/main/structuredOutputParser.test.ts`

**Verifier checks**:
- 7-step pipeline implemented in order (finish_reason → byte cap → JSON extract → unknown-key strip → Zod validate → semantic validate → typed result)
- AI_SCHEMA_VALIDATION_FAILED has retryable=false
- All 8 test scenarios pass

---

## Phase 7 — AiService

**Risk**: 3  
**Agent**: governed-implementer  
**Verifier**: electron-security-reviewer  
**Required checks**: governance:validate, typecheck, lint, test, build, package:dir  

**Deliverables**:
1. `src/main/services/ai/aiService.ts`
2. `tests/main/aiService.test.ts`

**Verifier checks**:
- Consent check before any network call — including `testConnection()`, not only `executeStructuredRequest()`
- Configuration check before any network call
- cancelRequest wires AbortController correctly
- AI_NOT_CONFIGURED and AI_CONSENT_REQUIRED returned pre-flight (both methods)
- `AI_SCHEMA_VALIDATION_FAILED` non-retryable enforcement tested here (not in aiHttpClient tests)
- All service unit tests pass

---

## Phase 8 — IPC handlers

**Risk**: 3  
**Agent**: governed-implementer  
**Verifier**: electron-security-reviewer  
**Required checks**: governance:validate, typecheck, lint, test, build, package:dir, test:e2e  

**Deliverables**:
1. `src/main/ipc/registerIpcHandlers.ts` additions — 5 new ai:* channel handlers
2. `tests/main/ipc-contracts.test.ts` additions
3. `src/main/index.ts` additions — AiSecretsService, AiConfigurationService, AiHttpClient, AiService instantiation and DI

**Verifier checks**:
- All 5 handlers use registerValidatedHandler
- No generic invoke pass-through
- DI wiring correct in main/index.ts
- Contract tests pass for all 5 channels

---

## Phase 9 — Preload additions

**Risk**: 3  
**Agent**: governed-implementer  
**Verifier**: electron-security-reviewer  
**Required checks**: governance:validate, typecheck, lint, test, build, package:dir  

**Deliverables**:
1. `src/preload/index.ts` additions — ai namespace with 5 typed methods

**Verifier checks**:
- apiKey: non-empty string, max 512 chars, trimmed
- baseUrl (if included in setApiKey payload): must start with `https://`, max 2048 chars
- model (if included in setApiKey payload): non-empty string, max 128 chars
- No generic invoke
- All preload methods have input validation before ipcRenderer.invoke
- TypeScript types match contracts
- No new `ipcRenderer.on` or event subscriptions added

---

## Phase 10 — Renderer component

**Risk**: 2  
**Agent**: governed-implementer  
**Verifier**: design-system-reviewer  
**Required checks**: typecheck, lint, test, design:validate  

**Deliverables**:
1. `src/renderer/features/settings/AiProviderSection.tsx`
2. `src/renderer/hooks/useAiConfiguration.ts`
3. `src/renderer/qa/mockBridge.ts` additions — mock implementations for 5 ai channels
4. `tests/renderer/AiProviderSection.test.tsx`
5. Update `src/renderer/features/settings/SettingsPage.tsx` to include AiProviderSection

**Verifier checks**:
- No direct electron/node imports
- All IPC via window.sceneSift.ai.*
- No hardcoded hex/px colors
- aria-live, role=alert, labels present
- API key never in component state after save
- All 14 component unit tests pass

---

## Phase 11 — E2E and visual tests

**Risk**: 2  
**Agent**: visual-qa-reviewer  
**Verifier**: governed-implementer (different agent from the one who wrote tests; reviews test assertions and golden files)  
**Required checks**: test:e2e, test:visual  

**Deliverables**:
1. `tests/e2e/ai-provider-config.e2e.spec.ts`
2. `tests/visual/ai-provider-config.visual.spec.ts`

**Verifier checks**:
- All 8 E2E scenarios pass
- All 8 visual scenarios generate golden files

---

## Phase 12 — Governance adversarial tests

**Risk**: 1  
**Agent**: governed-implementer  
**Verifier**: governance-verifier  
**Required checks**: claude:test:adversarial  

**Deliverables**:
1. `tests/governance/ai-security.test.ts` — 5 adversarial pattern checks

**Verifier checks**:
- Tests check for forbidden patterns (key logging, no redirect:manual, generic invoke)
- Tests cannot be trivially bypassed
- No `describe.skip` or `it.skip` without authorization

---

## Phase 13 — Full validation

**Risk**: 0 (run only — no code changes)  
**Agent**: orchestrator  

```bash
pnpm governance:validate
pnpm architecture:validate
pnpm design:validate
pnpm dependencies:validate
pnpm claude:validate
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm validate
```

All must exit 0. Evidence recorded in loop-run-log.md.

---

## Phase 14 — Independent acceptance audit

**Risk**: 0  
**Agent**: specialist reviewers (not implementers)  

Specialist agents verify M6 acceptance criteria per M6_ACCEPTANCE_CRITERIA.md (39 ACs).  
Audit returns ACCEPT or REJECT with evidence.

---

## Phase 15 — Human merge review

**Risk**: 0 (no code change — human decision)  

Present diff summary, specialist findings, and validation evidence to user.  
No autonomous merge.

---

## Models by phase

| Phase | Risk | Recommended model | Reason |
|---|---|---|---|
| 1 | 1 | Haiku 4.5 | Mechanical schema work |
| 2 | 3 | Sonnet 5 | Migration safety review |
| 3 | 3 | Sonnet 5 | Security-sensitive encryption |
| 4 | 3 | Sonnet 5 | Transaction + secrets logic |
| 5 | 3 | Opus 4.8 | Most complex — network + security |
| 6 | 2 | Sonnet 5 | Parsing pipeline |
| 7 | 3 | Sonnet 5 | Service orchestration |
| 8 | 3 | Sonnet 5 | IPC wiring |
| 9 | 3 | Opus 4.8 | Preload security — highest exposure |
| 10 | 2 | Sonnet 5 | Renderer component |
| 11 | 2 | Haiku 4.5 | Test writing |
| 12 | 1 | Haiku 4.5 | Adversarial tests |

---

## Escalation rules

- After 3 failed attempts on any phase: escalate to human.
- Any governance check failure: stop, file incident, escalate.
- Any verifier rejection: implementer must address findings — no override.
- Any new dependency proposed during implementation: stop, file dependency audit, escalate.
