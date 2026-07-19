# Claude Code Permission Policy

## Source of truth

`.claude/settings.json` is the operative permissions file. This document explains the design rationale.

## Principle: least privilege

Claude Code is granted the minimum permissions needed to do its work. Permissions are not broadened because they are inconvenient. Deny rules are never weakened to speed up a workflow.

## Allow list rationale

Allowed patterns cover:
- Safe package manager commands (pnpm install, test, typecheck, lint, validate, build, clean, format)
- All validation scripts (governance:validate, architecture:validate, design:validate, dependencies:validate, claude:validate, claude:doctor, claude:safe, claude:test)
- Git read operations (status, diff, log, show, branch, stash list, ls-files, rev-parse, remote -v)
- Filesystem reads (ls, find .)
- Package.json reads and version checks

## Deny list rationale

Denied patterns cover:
- All git destructive/publishing operations (push force, reset --hard, clean -f, rebase -i)
- All release and deployment operations (gh pr merge, gh release, npm/pnpm publish, electron-builder --publish, firebase deploy, vercel deploy)
- Global package installation (npm install -g, pnpm add -g)
- Secret exposure (cat .env, printenv SECRET/KEY/TOKEN, echo $SECRET)
- Dangerous pipe patterns (curl|sh, wget|sh)
- --dangerously-skip-permissions
- chmod 777

## Hooks vs settings.json

`settings.json` deny rules block at the tool/command-prefix level. Hooks inspect the full command string and can match patterns that settings.json allow rules cannot. They are complementary, not redundant.

## Changes to permissions

Permission changes require:
1. Risk 3 classification
2. Human approval before change
3. Governance-verifier independent review after change
4. Adversarial test update if new patterns introduced

## What this policy does NOT cover

Claude Code session permissions do not govern CI pipelines, Copilot agents, or human developer shell sessions. Each has its own permission scope.
