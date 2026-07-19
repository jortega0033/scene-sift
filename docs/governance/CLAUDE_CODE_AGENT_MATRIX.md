# Claude Code Agent Matrix

Maps Claude Code agents to their scope, risk authority, and maker/verifier roles.

## Maker agents (implement)

| Agent | Scope | Max risk authorized |
|-------|-------|---------------------|
| governed-implementer | renderer, tests, docs, risk 0–2 | 2 |
| scenesift-orchestrator | planning only, no direct implementation | N/A |

## Verifier agents (review only — never implement)

| Agent | Verifies | Risk scope |
|-------|----------|------------|
| architecture-reviewer | Layer boundaries, ADRs | Any |
| electron-security-reviewer | Electron security flags, IPC, preload | Risk 3+ main/preload |
| design-system-reviewer | Tokens, component API, a11y | Risk 1–2 UI |
| visual-qa-reviewer | Visual regression, E2E | Any UI change |
| dependency-auditor | Package licenses, audit findings | Any dependency change |
| governance-verifier | gate.yaml, hooks, settings, adversarial tests | Risk 3+ governance |
| incident-reviewer | Post-incident analysis | Any incident |

## Maker/verifier separation

A session or agent that proposes a change CANNOT be its own verifier. Verification must be performed by a different agent, ideally in a separate session.

## Model routing

| Agent | Model |
|-------|-------|
| scenesift-orchestrator | claude-sonnet-5 |
| electron-security-reviewer | claude-sonnet-5 |
| governance-verifier | claude-sonnet-5 |
| dependency-auditor | claude-sonnet-5 |
| incident-reviewer | claude-sonnet-5 |
| architecture-reviewer | claude-sonnet-5 |
| governed-implementer | inherit (session model) |
| design-system-reviewer | inherit |
| visual-qa-reviewer | inherit |

## Escalation path

Risk 0–2: governed-implementer → verifier agent → done.
Risk 3: orchestrator → specialist reviewer → human approval → governed-implementer (if applicable) → governance-verifier.
Risk 4: orchestrator → human approval → specialist reviewer → implementation → governance-verifier → human sign-off.
