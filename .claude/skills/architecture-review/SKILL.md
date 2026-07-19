# Architecture Review Skill

Invoke: `/architecture-review <files or scope>`

## Steps

1. Run `pnpm architecture:validate` — capture full output.
2. Check layer boundary rules:
   - renderer: no electron/node/main/database imports
   - shared: no renderer/main/preload imports
   - main: no renderer imports
   - QA bridge: restricted to `src/renderer/main.tsx` behind env guard
3. For ADR-required changes: confirm ADR exists in `docs/architecture/adr/`.
4. Run `pnpm typecheck` — report errors.
5. Check for new cross-layer dependencies introduced.

## Output

PASS / FAIL. List each boundary check. Quote violations with file:line. Confirm ADR status.
