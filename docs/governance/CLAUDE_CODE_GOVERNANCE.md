# Claude Code Governance

## Scope

This document describes how Claude Code operates within SceneSift's governance framework. It does NOT replace `gate.yaml`, `AGENTS.md`, `LOOP.md`, or `.github/copilot-instructions.md`. It adapts those controls for Claude Code sessions.

## Governing principle

One repository, one governance system. Claude Code adapts the existing Copilot governance layer. It does not introduce a competing constitution.

## Authoritative sources (in order)

| Source | What it governs |
|--------|-----------------|
| `gate.yaml` | Risk classification, forbidden actions, required checks |
| `AGENTS.md` | Binding agent operation rules |
| `loop-constraints.md` | Loop and attempt constraints |
| `.github/copilot-instructions.md` | Full project governance |
| `.claude/settings.json` | Claude Code permissions enforcement |
| `.claude/rules/*.md` | Path-scoped context for Claude Code sessions |
| `CLAUDE.md` | Session startup context (not enforcement) |

## Risk classification

Risk levels 0–4 as defined in `gate.yaml`. Claude Code applies the same levels. No separate Claude Code risk scale exists.

## Permission model

`.claude/settings.json` implements least-privilege via explicit `allow` and `deny` lists. Deny rules shadow allow rules. Hooks enforce protections that settings.json allows cannot: they inspect command content, not just tool names.

## Enforcement layers (in order of strength)

1. `settings.json` deny rules — block at tool-call level
2. Hooks (PreToolUse) — block commands matching forbidden patterns
3. `.claude/rules/` — loaded context, not enforcement
4. `CLAUDE.md` — startup context, not enforcement

## Human oversight gates

Risk 3+: human approval required before proceeding.
Risk 4: human approval + governance verifier review required.
All governance file changes: human approval required.

## Claude Code does NOT

- Commit, push, merge, release, or deploy.
- Modify real credentials, `.env*` files, or signing assets.
- Install global packages.
- Configure `--dangerously-skip-permissions` or `permissionMode: bypassPermissions`.
- Weaken any existing control without explicit human authorization.

## Relationship to Copilot governance

Claude Code rules are additive and subordinate. Where Claude Code rules and Copilot instructions differ, the more restrictive applies.
