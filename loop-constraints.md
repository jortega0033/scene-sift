# SceneSift Loop Constraints (Binding)

## Merge/release constraints

- Never push directly to protected branches.
- Never merge PRs autonomously.
- Never publish releases or change signing/notarization configuration autonomously.

## Path constraints

- Never edit `.env*`, secrets, credentials, signing keys, or production release files autonomously.
- High-risk paths require specialist review + independent verification + explicit human approval:
  - `src/main/**`
  - `src/preload/**`
  - `src/shared/ipc/**`
  - `src/database/migrations/**`
  - `electron-builder.yml`

## Coding constraints

- Never use `shell: true`.
- Never create shell commands by concatenating user-controlled values.
- Never expose raw `ipcRenderer` to renderer.
- Never disable Electron security defaults.
- Never disable tests, linters, or governance checks to pass CI.

## Runtime AI constraints

- No silent cloud upload of subtitles/media.
- No model/provider calls without explicit policy check and disclosure.
- No AI-assisted rendering/publishing without explicit human confirmation.

## Process constraints

- Max 3 implementation attempts per task before escalation.
- Verifier must be independent and evidence-driven.
- If uncertain, fail closed and escalate.
