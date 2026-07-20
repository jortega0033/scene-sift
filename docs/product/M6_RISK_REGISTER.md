# M6 — Risk Register

Date: 2026-07-20  
Status: Planning

---

## Format

Each risk has:
- **Likelihood** (1–4): 1=rare, 2=possible, 3=likely, 4=almost certain
- **Impact** (1–4): 1=minor, 2=moderate, 3=major, 4=critical
- **Score** = Likelihood × Impact
- **Blocking?** Whether this risk blocks M6 READY verdict if not mitigated

---

## R-M6-001 — API key leaks into log or IPC response

**Likelihood**: 2 (possible — code must be written carefully)  
**Impact**: 4 (critical — user key exposed, trust destroyed)  
**Score**: 8  
**Blocking**: YES

**Mitigation**:
- `toSafeError` already redacts details in production.
- `AiSecretsService.retrieveKey()` returns key only to `AiConfigurationService.getApiKey()`, which is marked `internal` and never called from IPC handlers directly.
- All log statements explicitly list allowed fields (code, model, duration, attempt, status) and must not include key.
- Adversarial test in `tests/governance/ai-security.test.ts` greps for key-logging patterns.

**Detection**: Code review; adversarial test; static analysis (`pnpm lint` catches `console.log(key)`).

**Owner**: Electron-security reviewer (independent verifier for risk-3 changes).

---

## R-M6-002 — SSRF via user-controlled base URL

**Likelihood**: 2 (possible — requires user to enter malicious endpoint)  
**Impact**: 3 (major — internal network probing, credential forwarding)  
**Score**: 6  
**Blocking**: YES

**Mitigation**:
- HTTPS-only policy enforced in `AiHttpClientImpl` before any fetch.
- Private IP blocklist: RFC 1918 (10.x, 172.16–31.x, 192.168.x), loopback (127.x), link-local (169.254.x.x), IPv6 loopback (::1), IPv6 link-local (fe80::/10), IPv6 ULA (fc00::/7) — all blocked.
- `redirect: 'manual'` prevents credential forwarding to redirect targets.
- `AI_ENDPOINT_NOT_ALLOWED` returned before fetch is called.
- Unit tests cover all private IP ranges (IPv4 + IPv6) and http:// rejection.
- DNS rebinding residual risk documented separately as R-M6-011.

**Detection**: Unit tests; `tests/governance/ai-security.test.ts`.

**Owner**: Electron-security reviewer.

---

## R-M6-003 — safeStorage unavailable causes silent no-op

**Likelihood**: 2 (possible — headless CI, some Linux configurations)  
**Impact**: 2 (moderate — AI features non-functional, but no data loss)  
**Score**: 4  
**Blocking**: NO (env var fallback provided)

**Mitigation**:
- `AiSecretsService.isAvailable()` checked before storing.
- If unavailable and no env var: `AI_ENCRYPTION_UNAVAILABLE` returned; key not saved.
- If unavailable but `SCENESIFT_AI_API_KEY` set: env var used.
- Clear UX message: "Secure storage unavailable. Set SCENESIFT_AI_API_KEY environment variable."

**Detection**: Unit test for unavailable path.

**Owner**: QA reviewer.

---

## R-M6-004 — Prompt injection via model output contaminating future prompts

**Likelihood**: 1 (rare — not applicable in M6 which only runs connection test)  
**Impact**: 3 (major — would affect M7+ if not designed correctly now)  
**Score**: 3  
**Blocking**: NO for M6; planning constraint for M7

**Mitigation**:
- Prompt architecture separates system instructions (static, from registry) from user content (dynamic, in user message only).
- No model output is fed back into system prompts.
- `buildUserContent()` is the only injection point; M6 connectionTest prompt has no user content.

**Detection**: Prompt architecture doc review; M7 planning must enforce containment.

**Owner**: AI-platform reviewer.

---

## R-M6-005 — Unbounded fetch causes memory exhaustion

**Likelihood**: 2 (possible — adversarial provider could return multi-MB response)  
**Impact**: 2 (moderate — app crash, not data loss)  
**Score**: 4  
**Blocking**: YES (must be implemented before shipping)

**Mitigation**:
- Streaming reader with 512KB byte cap in `AiHttpClientImpl`.
- `AI_RESPONSE_TOO_LARGE` returned on cap hit; reading aborted.
- Unit tests simulate oversized response.

**Detection**: Unit test `returns AI_RESPONSE_TOO_LARGE when body exceeds 512KB`.

**Owner**: Electron-security reviewer.

---

## R-M6-006 — 0004_ai_provider.sql migration breaks existing databases

**Likelihood**: 1 (rare — uses `CREATE TABLE IF NOT EXISTS`, additive-only)  
**Impact**: 3 (major — user data loss if migration corrupts existing tables)  
**Score**: 3  
**Blocking**: YES

**Mitigation**:
- Migration is additive: only creates new tables, no column drops, no table drops.
- `CREATE TABLE IF NOT EXISTS` is safe to run on databases that already have the table.
- Migration integration test runs 0000 through 0004 in sequence on test fixture.

**Detection**: Migration integration test.

**Owner**: Database reviewer.

---

## R-M6-007 — IPC contracts diverge from preload implementation

**Likelihood**: 2 (possible — two files must stay in sync manually)  
**Impact**: 2 (moderate — type errors in production, or runtime failures)  
**Score**: 4  
**Blocking**: YES

**Mitigation**:
- `tests/main/ipc-contracts.test.ts` validates all 5 new channels against their contracts.
- `pnpm typecheck` enforces TypeScript types match between preload and contracts.
- Contract test added for each new channel before implementation is considered complete.

**Detection**: `pnpm typecheck`; `pnpm test`.

**Owner**: QA reviewer.

---

## R-M6-008 — Structured output parser returns invalid typed result

**Likelihood**: 2 (possible — edge cases in JSON extraction from markdown fences)  
**Impact**: 2 (moderate — bad data passed to M7+ features)  
**Score**: 4  
**Blocking**: YES

**Mitigation**:
- 7-step pipeline: finish_reason check → byte cap → JSON extraction → unknown-key strip → Zod validation → semantic validation → typed result.
- `additionalProperties: false` in all output schemas (provider-side) + Zod `.strip()` (parsing-side).
- `AI_SCHEMA_VALIDATION_FAILED` non-retryable — no bad data proceeds.
- 10-scenario test matrix in `tests/main/structuredOutputParser.test.ts`.

**Detection**: `pnpm test`.

**Owner**: QA reviewer.

---

## R-M6-009 — Consent bypass (user accesses AI feature without recording consent)

**Likelihood**: 1 (rare — enforced server-side, not just client-side)  
**Impact**: 3 (major — privacy violation, regulatory risk)  
**Score**: 3  
**Blocking**: YES

**Mitigation**:
- BOTH `AiService.testConnection()` AND `AiService.executeStructuredRequest()` check `consent_recorded_at IS NOT NULL` before any network call.
- `AI_CONSENT_REQUIRED` returned from either path if not recorded — no fetch made.
- Client-side check (Save button disabled) is secondary; server-side is authoritative.
- Env var fallback does NOT auto-record consent — user must complete UI consent flow regardless of how the key is provided.

**Detection**: Unit tests for both `testConnection` and `executeStructuredRequest` consent paths.

**Owner**: Privacy reviewer.

---

## R-M6-010 — Implementation scope creep into M7

**Likelihood**: 2 (possible — AI infrastructure is tempting to build out)  
**Impact**: 2 (moderate — scope blow-up, governance non-compliance)  
**Score**: 4  
**Blocking**: YES

**Mitigation**:
- M6_SCOPE.md non-goal table explicitly lists 25 forbidden items.
- No clip candidate generation, no transcript scoring, no subtitle data sent during M6.
- Connection test probe sends only a minimal system message with no user data.
- Independent reviewer checks scope compliance.

**Detection**: Product-scope reviewer.

**Owner**: Product manager / orchestrator.

---

## R-M6-011 — DNS rebinding bypass of private IP check

**Likelihood**: 1 (rare — requires attacker-controlled DNS TTL manipulation + specific user action)  
**Impact**: 3 (major — bypasses SSRF IP check; allows main-process connection to internal services)  
**Score**: 3  
**Blocking**: NO (documented residual risk; atomic DNS-check-then-connect not feasible in user-space Node.js)

**Mitigation**:
- `redirect: 'manual'` limits credential forwarding even if rebinding succeeds.
- HTTPS-only policy restricts to HTTPS endpoints; most internal services do not present valid TLS certificates.
- Pre-flight IP check covers literal IP addresses robustly; hostname checks are best-effort.
- Documented in `M6_NETWORK_ARCHITECTURE.md` as residual risk.

**Detection**: Not directly testable (requires live DNS manipulation). Coverage via R-M6-002 mitigations.

**Owner**: Electron-security reviewer. Accept residual risk at M6; consider OS-level network policy in future.

---

## Risk summary table

| ID | Description | Score | Blocking |
|---|---|---|---|
| R-M6-001 | API key leak | 8 | YES |
| R-M6-002 | SSRF via base URL | 6 | YES |
| R-M6-003 | safeStorage unavailable | 4 | NO |
| R-M6-004 | Prompt injection | 3 | NO (M6) |
| R-M6-005 | Unbounded fetch | 4 | YES |
| R-M6-006 | Migration breaks existing DB | 3 | YES |
| R-M6-007 | IPC contract drift | 4 | YES |
| R-M6-008 | Invalid structured output | 4 | YES |
| R-M6-009 | Consent bypass | 3 | YES |
| R-M6-010 | M7 scope creep | 4 | YES |
| R-M6-011 | DNS rebinding | 3 | NO (accepted residual) |

All blocking risks have explicit mitigations. Implementation must address R-M6-001, R-M6-002, R-M6-005, R-M6-006, R-M6-007, R-M6-008, R-M6-009, R-M6-010 before M6 can be accepted.
