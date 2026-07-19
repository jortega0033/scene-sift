# AI Tooling Interoperability

## Tooling inventory

| Tool | Type | Governance layer | Config location |
|------|------|-----------------|-----------------|
| GitHub Copilot | IDE AI assistant + agent runner | `.github/copilot-instructions.md`, `.github/agents/`, `.github/instructions/` | `.github/` |
| Claude Code | CLI AI coding assistant | `.claude/`, `CLAUDE.md`, `gate.yaml` (shared) | `.claude/`, root |
| MCP: chrome-devtools | Browser devtools access | `.mcp.json`, `.vscode/mcp.json` | Root, `.vscode/` |
| MCP: playwright | Browser automation | `.mcp.json`, `.vscode/mcp.json` | Root, `.vscode/` |

## Shared governance

Both Copilot and Claude Code are governed by `gate.yaml`. Risk classification, forbidden actions, and required checks are the same for both tools. Neither tool introduces its own competing risk scale.

## Non-duplication principle

Claude Code rules adapt Copilot governance; they do not duplicate or contradict it. Where a Copilot instruction and a Claude Code rule conflict, the more restrictive applies.

## MCP configuration consistency

`.mcp.json` (Claude Code) mirrors `.vscode/mcp.json` (Copilot / VS Code) exactly. Changes to MCP config must be made in both files simultaneously.

## Copilot agent ↔ Claude Code agent mapping

| Copilot agent | Claude Code equivalent |
|---------------|------------------------|
| scenesift-orchestrator | scenesift-orchestrator |
| electron-security-reviewer | electron-security-reviewer |
| verification-agent | governance-verifier + architecture-reviewer |
| scenesift-architect | architecture-reviewer |
| ai-governance-reviewer | governance-verifier |
| data-privacy-reviewer | (no direct equivalent — escalate to human) |
| desktop-ux-reviewer | design-system-reviewer + visual-qa-reviewer |
| media-pipeline-engineer | governed-implementer (with media-pipeline rule) |

## Tool-specific prohibitions

Both tools: no autonomous commit/push/merge/release/deploy.
Both tools: no .env or credential modification.
Both tools: same gate.yaml forbidden actions apply.

## Conflict resolution

If Claude Code and Copilot produce conflicting recommendations for the same change, escalate to human review before proceeding.
