# M6 — Implementation Handoff

Date: 2026-07-20  
Status: Planning complete — awaiting implementation

---

## Entry point for implementation agents

**Start with M6_IMPLEMENTATION_PLAN.md — Phase 0.**

Do not begin Phase 1 until STATE.md is updated with the M6 implementation run ID.

---

## What M6 adds

AI provider configuration infrastructure in SceneSift's Settings page. No AI clip generation — only the plumbing: secure key storage, connection testing, prompt/structured-output scaffolding.

When M6 is complete, a user can:
1. Accept a privacy notice.
2. Enter an API key, base URL, and model name.
3. Save the configuration (key encrypted via OS keychain/DPAPI/libsecret).
4. Test the connection and see a pass/fail result.
5. Clear the configuration.

No transcript data is ever sent in M6. That begins in M7.

---

## Critical decisions already made — do not revisit

| Decision | Value |
|---|---|
| Provider strategy | Option A: OpenAI-compatible interface, built-in `fetch`, no new npm dependency |
| Secret storage | `electron.safeStorage` + BLOB in `ai_secrets` SQLite table; env var fallback for headless |
| Network | HTTPS-only, no private IP, `redirect: 'manual'`, 512KB response cap, 3-attempt retry |
| IPC | 5 narrow channels, no generic `ai:invoke` |
| Prompts | TypeScript module registry, versioned, no renderer-controlled content |
| Output | 7-step validation pipeline (finish_reason → byte cap → JSON extract → unknown-key strip → Zod validate → semantic validate → typed result), `AI_SCHEMA_VALIDATION_FAILED` non-retryable |
| Privacy | consent once per install, `consent_recorded_at` column |
| DB | `ai_provider_config` + `ai_secrets` via `0004_ai_provider.sql` migration |

---

## High-priority files for Phase 1 implementer

Read these before writing any code:

| File | Why |
|---|---|
| `src/shared/ipc/channels.ts` | Add 5 AI_* channel constants here |
| `src/shared/ipc/contracts.ts` | Add `ai` namespace contracts here |
| `src/preload/index.ts` | Study existing UUID validation pattern |
| `src/main/ipc/createIpcHandler.ts` | Use `registerValidatedHandler` — all new handlers |
| `src/main/utils/errors.ts` | Use `AppError` + `toSafeError` — no new error class |
| `src/main/services/process/runCommand.ts` | Analogue for HTTP client bounds |
| `src/database/schema.ts` | Add aiProviderConfigTable + aiSecretsTable here |
| `src/database/migrations/` | 0004 goes here, pattern from 0003 |
| `src/main/index.ts` | DI wiring for new services |

---

## Universal prohibitions (enforced by hooks + CI)

- No raw API key in any log, IPC response, or committed file
- No `shell: true`
- No generic IPC `invoke` channel
- No `nodeIntegration: true` / `contextIsolation: false`
- No new npm dependency (built-in `fetch` only)
- No `git push` / merge / release
- No M7 functionality (no transcript data in any AI call)

---

## Risk-3 paths — require specialist review + verifier + human approval

- `src/main/**`
- `src/preload/index.ts`
- `src/shared/ipc/channels.ts`
- `src/shared/ipc/contracts.ts`
- `src/database/migrations/0004_ai_provider.sql`

---

## Acceptance criteria summary

39 ACs across 7 categories. See M6_ACCEPTANCE_CRITERIA.md.

Key blocking ACs for M6:
- AC-M6-006: Key never returned via IPC
- AC-M6-019: Non-HTTPS rejected server-side
- AC-M6-020: Private IP blocked
- AC-M6-021: Redirect not followed
- AC-M6-022: Response size cap
- AC-M6-025: Migration runs on existing database
- AC-M6-026: Atomic setApiKey
- AC-M6-029: All 5 channels registered
- AC-M6-032: No generic IPC invoke
- AC-M6-037: 7-step parser implemented
- AC-M6-038: Schema failure non-retryable
- AC-M6-039: Prompt registry functional

---

## Test baseline before implementation

Current test suite: **419 passing tests** (as of M5 completion, commit 575ccdb).

M6 implementation must not reduce this count. All new tests additive.

After M6 implementation, expected test count: ≥419 + ~70 new tests (estimated from M6_TEST_PLAN.md).

---

## Document index

| Document | Purpose |
|---|---|
| M6_CURRENT_AI_STATE.md | Capability gaps baseline |
| M6_SCOPE.md | What M6 is and is not |
| M6_PROVIDER_STRATEGY.md | Provider decision + synthetic test design |
| M6_CONFIGURATION_AND_SECRETS.md | Key storage architecture |
| M6_NETWORK_ARCHITECTURE.md | HTTP client design + network policy |
| M6_PROVIDER_INTERFACE.md | AiHttpClient + AiService interfaces |
| M6_PROMPT_ARCHITECTURE.md | Prompt registry design |
| M6_STRUCTURED_OUTPUT.md | 7-step output validation pipeline |
| M6_PRIVACY_MODEL.md | Consent model + logging constraints |
| M6_STATE_MACHINE.md | Configuration + request state machines |
| M6_ARCHITECTURE.md | Full file ownership + IPC surface + bounds table |
| M6_DATABASE_STRATEGY.md | Schema + migration + transaction design |
| M6_UX_SPECIFICATION.md | Settings UI states + copy + accessibility |
| M6_ERROR_TAXONOMY.md | All AI_* error codes + HTTP mapping + log policy |
| M6_USER_STORIES.md | 15 user stories |
| M6_ACCEPTANCE_CRITERIA.md | 39 ACs |
| M6_TEST_PLAN.md | Unit/integration/E2E/visual/adversarial tests |
| M6_RISK_REGISTER.md | 10 risks with mitigations |
| M6_IMPLEMENTATION_PLAN.md | 15 phases with risk levels + agent assignments |
| M6_HANDOFF.md | This document |
