# AI Tooling Parity Matrix

Date: 2026-07-19

## Purpose

This document is the authoritative cross-tool parity map for SceneSift.
It records how every governance concern is handled in GitHub Copilot and Claude Code,
identifies the shared authority for each concern, specifies which tool provides mechanical
enforcement, and records the status of each control.

Shared authority always takes precedence over tool-specific adapters.

---

## Authority precedence order

1. Human instruction
2. Repository governance policy (`gate.yaml`, `AGENTS.md`, `loop-constraints.md`, `LOOP.md`)
3. CI and mechanical validators
4. Approved architecture and ADRs
5. Tool-specific repository instructions (`.github/`, `.claude/`)
6. Agent and skill instructions
7. Persistent memory
8. Model-generated assumptions

Memory must never override current code, current human instruction, governance policy, CI evidence, ADRs, or actual command output.

When Copilot and Claude produce conflicting recommendations, escalate to human review.

---

## Status legend

| Code | Meaning |
|------|---------|
| ENFORCED | Blocked by CI, hook, or validator before merge |
| TESTED | Covered by automated adversarial test |
| DOCUMENTED | Written in authoritative file, not mechanically enforced |
| PARTIAL | Some paths covered; gaps documented |
| PLANNED | Policy defined; enforcement not yet implemented |
| MISSING | No coverage at any level |
| N/A | Not applicable to this tool |

---

## Parity matrix

| Governance concern | Shared authority | Copilot adapter | Claude adapter | Mechanical enforcement | Status |
|---|---|---|---|---|---|
| **Universal project rules** | `AGENTS.md`, `loop-constraints.md` | `.github/copilot-instructions.md` (summarizes, references gate) | `CLAUDE.md` (imports AGENTS.md, loop-constraints.md) | `pnpm governance:validate` | ENFORCED + TESTED |
| **Risk classification** | `gate.yaml` (authoritative) | Referenced in orchestrator + instructions | `.claude/rules/governance.md`; orchestrator agent reads at startup | `pnpm governance:validate`, `pnpm governance:scenarios` | ENFORCED + TESTED |
| **Protected paths** | `gate.yaml` `pathRules` | `.github/workflows/governance.yml` detects changes | `.claude/hooks/protect-file-write.mjs` blocks writes | Hook (pre-execution) + CI path check | ENFORCED + TESTED |
| **Model routing** | `docs/governance/MODEL_ROUTING_POLICY.md` | Referenced in orchestrator agent | `.claude/agents/scenesift-orchestrator.md` enforces selection | DOCUMENTED (model routing not mechanically verifiable) | PARTIAL |
| **Agent roles** | `docs/governance/CLAUDE_CODE_AGENT_MATRIX.md`; `AI_TOOLING_INTEROPERABILITY.md` | `.github/agents/*.md` (8 agents) | `.claude/agents/*.md` (9 agents) | Agent definitions are context; overlap documented in interop doc | DOCUMENTED |
| **Implementer/verifier separation** | `AGENTS.md` §Verification model | Copilot orchestrator agent forbids self-approval | `.claude/agents/scenesift-orchestrator.md`; governed-implementer refuses risk 3+ | `pnpm governance:scenarios` tests process violations | PARTIAL (process-enforced for humans; agent context for AI) |
| **Attempt limits** | `loop-constraints.md` (max 3) | Verification agent documentation | governed-implementer agent max 3 attempts | DOCUMENTED | PARTIAL |
| **Worktree isolation** | `loop-constraints.md` | Not explicitly specified | governed-implementer invokes worktrees for risk 2+ | DOCUMENTED | PARTIAL |
| **Secret protection** | `gate.yaml` `forbiddenPatterns` (`hardcoded-secret-shape`) | Security workflow + instructions | `.claude/hooks/protect-bash-command.mjs`; protect-file-write blocks .env* | Hook (pre-execution) + `pnpm governance:scenarios` (pattern tests) | ENFORCED + TESTED |
| **Electron security flags** | `gate.yaml` forbidden patterns (nodeIntegration, contextIsolation, webSecurity) | `.github/instructions/electron-main.instructions.md`; electron-security-reviewer agent | `.claude/rules/electron-main.md`; electron-security-reviewer agent | `pnpm governance:scenarios` (Vitest) | ENFORCED + TESTED |
| **Architecture boundaries** | `docs/architecture/ARCHITECTURE.md`; ADRs | `.github/instructions/*.instructions.md` (file-scoped) | `.claude/rules/architecture.md`, renderer.md, database.md, etc. | `pnpm architecture:validate` + adversarial tests | ENFORCED + TESTED |
| **Preload / IPC contracts** | `src/shared/ipc/channels.ts`, `contracts.ts` | `.github/instructions/electron-preload-ipc.instructions.md` | `.claude/rules/preload-ipc.md` | `pnpm architecture:validate` (import patterns) | ENFORCED + TESTED |
| **Design-system rules** | `docs/design/DESIGN_SYSTEM.md`, `DESIGN_PRINCIPLES.md` | `.github/instructions/` (no explicit design instructions) | `.claude/rules/design-system.md` | `pnpm design:validate` + adversarial tests | ENFORCED + TESTED (Claude-side only) |
| **Dependency policy** | `docs/quality/DEPENDENCY_POLICY.md` | Not explicitly listed in Copilot instructions | `.claude/rules/` (referenced in docs) | `pnpm dependencies:validate` | ENFORCED + TESTED |
| **MCP permissions** | `docs/governance/CLAUDE_CODE_MCP_POLICY.md`; `.mcp.json` mirrors `.vscode/mcp.json` | `.vscode/mcp.json` (Copilot/VS Code MCP) | `.mcp.json`; `pnpm claude:validate:config` | `pnpm claude:test:adversarial` checks .mcp.json | ENFORCED + TESTED |
| **Memory policy** | `docs/governance/CLAUDE_CODE_MEMORY_POLICY.md` | N/A (Copilot has no persistent memory mechanism) | `pnpm claude:validate:memory` scans for secrets | Memory validator does not locate `~/.claude/projects/*/memory/` path — silently skips; manual review required (see TD-005) | PARTIAL (Claude only; validator gap) |
| **CI validation** | `.github/workflows/validate.yml`, `governance.yml`, `security.yml` | Three CI workflows: validate, governance, security | Not duplicated in Claude layer (CI is shared) | CI runs on PR + push | ENFORCED |
| **Evidence requirements** | `AGENTS.md` §Verification model; gate.yaml `requiredChecksByRisk` | Verification agent requires real command output | `loop-run-log.md`; governed-implementer requires evidence | DOCUMENTED; `pnpm governance:scenarios` tests theater | PARTIAL |
| **Human approval gates** | `gate.yaml` risk-4 = forbidden autonomous; risk-3 requires approval | Risk 3 agents stop and escalate | risk 3 requires approval per governance rules | DOCUMENTED (branch protection requires hosting config) | PARTIAL |
| **Release prohibition** | `gate.yaml` forbiddenAutonomousActions (publish-release, merge-pr) | `.github/copilot-instructions.md`: no autonomous commit/push/merge | `.claude/hooks/protect-bash-command.mjs` blocks npm/pnpm publish, push | Hook + gate forbidden-action tests | ENFORCED + TESTED |
| **Test skip/only protection** | `gate.yaml` forbiddenPatterns (`test-skip-usage`) | Referenced in copilot-instructions | `.claude/rules/tests.md`; forbidden pattern | `pnpm governance:scenarios` | ENFORCED + TESTED |
| **Shell injection protection** | `gate.yaml` forbiddenPatterns (`shell-true`, `command-injection-exec-string`) | Electron main instructions + security agent | `.claude/rules/electron-main.md`, `media-pipeline.md` | `pnpm governance:scenarios` | ENFORCED + TESTED |
| **Renderer isolation** | Architecture docs + ADR-001, ADR-002 | `.github/instructions/renderer.instructions.md` | `.claude/rules/renderer.md` | `pnpm architecture:validate` | ENFORCED + TESTED |
| **Database access boundaries** | ADR-003, ADR-004; architecture docs | `.github/instructions/` (implicit in architecture) | `.claude/rules/database.md` | `pnpm architecture:validate` | ENFORCED + TESTED |
| **Runtime AI scope** | `docs/governance/RUNTIME_AI_POLICY.md` | `.github/instructions/runtime-ai.instructions.md` | `.claude/rules/runtime-ai.md` | DOCUMENTED; product-code enforcement pending feature milestones | DOCUMENTED |

---

## Tool-specific controls (no parity required)

| Control | Tool | Reason for tool-specific handling |
|---|---|---|
| Claude Code hooks (PreToolUse/PostToolUse) | Claude Code only | Copilot has no equivalent hook system |
| Claude Code settings.json permissions (allow/deny) | Claude Code only | Copilot permission model differs |
| Claude Code skills | Claude Code only | Copilot uses prompts instead |
| Claude Code memory policy + scan | Claude Code only | Copilot has no persistent memory |
| GitHub Actions CI | Shared infrastructure | Both tools use the same CI; no duplication needed |
| PR approval marker check (`Governance Change Approval: yes`) | Copilot/GitHub only | Claude has hooks; Copilot uses PR metadata |
| Copilot agent `data-privacy-reviewer` | Copilot only | No direct Claude equivalent; escalate to human |

---

## Confirmed conflicts: none

Both tools use `gate.yaml` as the single risk/forbidden-action authority. Copilot instructions and
Claude rules are compatible; both defer to `gate.yaml` and shared governance docs for substantive
policy. No conflicting risk levels, path scopes, or allowed actions were identified.

**If a conflict arises:** the more restrictive control applies, and the conflict must be documented
in `docs/governance/GOVERNANCE_DECISIONS.md` before proceeding.

---

## Deferred controls (documented only, enforcement not yet possible)

- **Implementer/verifier separation** — AI tools cannot be mechanically forced to use separate contexts.
  Enforced through process documentation, run-log expectations, and adversarial test scenarios.
- **Model routing** — Cannot be mechanically verified at runtime from repository files alone.
- **Attempt limits** — Process-enforced; not mechanically blocked at the tool level.
- **Host-level branch protection** — Requires manual configuration at the Git hosting provider;
  cannot be asserted from repository files.

---

## Update policy

This matrix must be updated when:
- A new governance concern is introduced in either tool
- A control changes status (e.g., from DOCUMENTED to ENFORCED)
- A parity gap is identified and resolved
- A conflict is found and resolved

Update requires: governance reviewer sign-off, entry in `GOVERNANCE_DECISIONS.md`.
