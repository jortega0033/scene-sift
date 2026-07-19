# SceneSift Copilot Repository Rules

These rules apply to all AI-assisted work in this repository.

## Core controls

- Follow `gate.yaml` risk classification before implementing.
- For risk 2+ changes, require independent verifier evidence before approval.
- For risk 3 changes, require specialist reviewer and written threat notes.
- Risk 4 actions are forbidden autonomously.

## Security and safety invariants

- Do not enable insecure Electron flags.
- Do not use `shell: true` or untrusted command strings.
- Do not expose raw IPC primitives to the renderer.
- Do not leak secrets to renderer or logs.
- Do not upload user media or transcript data without explicit user action.

## Verification requirements

- Required checks are defined in `gate.yaml` (`requiredChecksByRisk`).
- Never claim command success without actual output evidence.
- Never disable tests/checks to pass validation.

## Governance artifacts

- Keep `STATE.md`, `loop-run-log.md`, and governance docs synchronized with behavior.
- Update model/prompt registries when runtime AI behavior changes.
