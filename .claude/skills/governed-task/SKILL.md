# Governed Task Skill

Invoke: `/governed-task <task description>`

Standard implementation pipeline for risk 0–2 tasks.

## Steps

1. **Classify** — Read `gate.yaml`. Apply risk level. If risk 3+, stop and escalate.
2. **Read rules** — Read `.claude/rules/` files matching target paths.
3. **Read context** — Read relevant source files before touching them.
4. **Implement** — Maximum 3 attempts. Follow architecture rules.
5. **Test** — Run targeted test suite for changed layer. Run `pnpm typecheck`. Run `pnpm lint`.
6. **Report** — State: files changed, tests run, results, risk level, attempt count.

## Outputs required

- Files changed (list)
- Test command run + result
- Typecheck result
- Risk level applied
- Attempt count

## Stops if

- Task reclassifies to risk 3+ during implementation.
- 3 attempts reached without passing tests.
- Architecture violation detected.
