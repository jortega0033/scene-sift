# .claude/ — Claude Code Operating Layer

Repository-local configuration for Claude Code. Adapts existing SceneSift governance (gate.yaml, AGENTS.md, Copilot instructions) for Claude Code sessions.

**Authoritative governance source: `gate.yaml`**
**Binding operation rules: `AGENTS.md`, `LOOP.md`, `loop-constraints.md`**

## Directory structure

```
.claude/
  settings.json          # Permissions (allow/deny) + hook registration
  README.md              # This file
  rules/                 # Path-scoped context rules (globs frontmatter)
    governance.md        # Governance files — risk 3+ always
    architecture.md      # Layer boundaries
    electron-main.md     # Main process — Electron security rules
    preload-ipc.md       # Preload and IPC contracts
    renderer.md          # React renderer layer
    media-pipeline.md    # Media processing and external processes
    database.md          # SQLite access — parameterized queries only
    runtime-ai.md        # AI service integration
    tests.md             # Test suite — adversarial tests never removed
    design-system.md     # Design tokens and component conventions
    documentation.md     # Docs and binding document rules
  agents/                # Subagent definitions
    scenesift-orchestrator.md   # Top-level planner
    governed-implementer.md     # Risk 0–2 implementation
    architecture-reviewer.md    # Layer boundary verifier
    electron-security-reviewer.md  # Electron security verifier
    design-system-reviewer.md   # Design system verifier
    visual-qa-reviewer.md       # Visual regression + E2E verifier
    dependency-auditor.md       # Package audit
    governance-verifier.md      # Governance control verifier
    incident-reviewer.md        # Post-incident analysis
  skills/                # Callable procedures (/skill-name)
    governed-task/       # Standard risk 0–2 implementation
    verify-change/       # Independent verification pipeline
    architecture-review/ # Architecture boundary review
    visual-qa/           # Visual regression QA
    dependency-review/   # Dependency audit
    governance-change/   # Risk 3+ governance change with human gate
    baseline-update/     # Update test baselines (intentional changes only)
    memory-audit/        # Audit stale/invalid memory entries
    incident-response/   # Post-incident analysis and reporting
  hooks/                 # Node.js enforcement hooks
    protect-file-write.mjs      # PreToolUse: blocks protected path writes
    protect-bash-command.mjs    # PreToolUse: blocks forbidden commands
    validate-config-change.mjs  # PostToolUse: validates config changes
    stop-validation.mjs         # Stop: session-end audit
    record-agent-event.mjs      # SubagentStop: logs agent completions
  schemas/               # JSON schemas for structured artifacts
    task-manifest.schema.json
    evidence.schema.json
    memory-entry.schema.json
```

## What this is NOT

- Not a replacement for gate.yaml, AGENTS.md, or Copilot governance.
- Not an override of the repository's risk classification system.
- Not a mechanism to bypass any existing control.

Rules files are **context** (loaded at session start). Hooks and settings.json are **enforcement**. `gate.yaml` is the single authoritative risk/forbidden-action source.

## Governance

Changes to `.claude/settings.json` or any hook require risk 3 classification, human approval, and governance-verifier independent review. See `/governance-change` skill.
