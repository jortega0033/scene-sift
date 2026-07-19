# Verify Change Skill

Invoke: `/verify-change <change description or file list>`

Independent verification pipeline. Must be invoked by a different agent/session than the one that made the change.

## Steps

1. **Read changes** — Read all changed files. Do not accept summary from maker.
2. **Run validators** — `pnpm typecheck`, `pnpm lint`, `pnpm validate` (full pipeline).
3. **Check architecture** — `pnpm architecture:validate`.
4. **Run tests** — Targeted suite for changed layer + `pnpm test`.
5. **Risk check** — Verify risk level claimed by maker matches gate.yaml classification.
6. **Evidence** — Collect all command outputs.

## Output

Structured verdict: PASS / FAIL / CONDITIONALLY PASS.
- Each validation step listed with result.
- Exact failures quoted.
- Risk level confirmed or disputed.
- Evidence: commands run, full outputs.

## Constraint

Verifier cannot be the same agent that implemented the change.
