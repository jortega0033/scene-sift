# Development Agent Policy

## Scope

Applies to AI agents making changes in this repository.

## Role separation

- **Orchestrator**: assigns risk and coordinates flow.
- **Implementer**: produces code/docs changes.
- **Verifier**: independently validates requirements and evidence.

Implementer cannot self-approve.

## Risk model

- Risk 0: docs-only.
- Risk 1: low-risk code/tests/types.
- Risk 2: medium-risk business/UI/data flows.
- Risk 3: high-risk Electron/IPC/FFmpeg/filesystem/migrations/network/security.
- Risk 4: critical/forbidden autonomous actions.

Risk assignment is governed by `gate.yaml`.

## Required process

1. Risk classify.
2. Implement in isolated branch/worktree.
3. Run required checks from `gate.yaml`.
4. Independent verification.
5. Human approval for risk 2+.

## Forbidden autonomous actions

Defined in `gate.yaml` (`forbiddenAutonomousActions`) and include merge/release/secrets/policy-critical actions.
