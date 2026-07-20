# M6 — User Stories

Date: 2026-07-20  
Status: Planning

---

## Epic: AI Provider Configuration

**US-M6-001** — First-time setup  
As a user who wants AI-assisted clip selection, I want to enter my API key and save it securely so that SceneSift can call the AI provider on my behalf.

**US-M6-002** — Privacy consent  
As a user, I want to see a clear explanation of what data will be sent to the AI provider before I configure it, so that I can make an informed decision.

**US-M6-003** — Connection test  
As a user who has configured an API key, I want to test whether my key works before using AI features, so that I can catch configuration errors early.

**US-M6-004** — Test cancellation  
As a user whose connection test is taking too long, I want to cancel it so that I can adjust my configuration and retry.

**US-M6-005** — Clear configuration  
As a user who wants to remove their API key (e.g., switching providers, security concern), I want to clear the configuration so that SceneSift removes my key from secure storage.

**US-M6-006** — Endpoint and model configuration  
As a user running a local or self-hosted OpenAI-compatible endpoint, I want to enter a custom base URL and model name, so that SceneSift uses my chosen provider.

**US-M6-007** — Persistent configuration  
As a user who restarts SceneSift, I want my API key and provider settings to be remembered so that I don't have to reconfigure after every restart.

**US-M6-008** — Secure storage fallback  
As a developer or CI user running in a headless environment, I want SceneSift to fall back to the `SCENESIFT_AI_API_KEY` environment variable when OS secure storage is unavailable, so that I can test AI features without a GUI session.

---

## Epic: Connection Status Visibility

**US-M6-009** — Status at a glance  
As a user returning to Settings, I want to see the current AI provider connection status (configured/untested, connected, error) so I know whether AI features are ready to use.

**US-M6-010** — Error explanation  
As a user whose connection test failed, I want to see a human-readable explanation of what went wrong (auth failure, network error, endpoint not allowed) so that I can fix the issue without guessing.

**US-M6-011** — Re-test after error  
As a user who has fixed their configuration, I want to re-test the connection without clearing and re-entering my key so that the workflow is efficient.

---

## Epic: Security and Privacy (Non-negotiable)

**US-M6-012** — Key not displayed  
As a security-conscious user, I want confidence that my API key is never displayed after entry and is stored using OS-level encryption, not plaintext.

**US-M6-013** — Provider redirection safety  
As a user, I want confidence that SceneSift will not follow HTTP redirects that could forward my API key to an unintended endpoint.

**US-M6-014** — Endpoint restrictions  
As a security-conscious user, I want confidence that SceneSift will reject attempts to configure private-network or non-HTTPS endpoints, preventing SSRF.

**US-M6-015** — Offline behavior  
As a user on an intermittent network, I want connection test failures caused by offline state to be clearly distinguished from provider errors, so that I don't mistakenly delete a valid configuration.

---

## Non-user stories (internal / not in scope for M6)

The following are system-level behaviors visible only to developers/testers:

- **INTERNAL-M6-001**: IPC contracts updated for 5 new `ai:*` channels.
- **INTERNAL-M6-002**: `0004_ai_provider.sql` migration runs cleanly on existing databases.
- **INTERNAL-M6-003**: Request bounds enforced (512KB response cap, 10s connection test timeout).
- **INTERNAL-M6-004**: No API key, transcript text, or response body in any log.
- **INTERNAL-M6-005**: Retry policy (3 attempts, exponential backoff) applied to retryable errors.
