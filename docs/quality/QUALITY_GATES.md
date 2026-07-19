# SceneSift Quality Gates

## Canonical commands

- `pnpm validate` (default local + CI baseline)
- `pnpm validate:full` (extended QA + packaging gate)

## `pnpm validate` includes

1. `pnpm governance:validate`
2. `pnpm architecture:validate`
3. `pnpm design:validate`
4. `pnpm dependencies:validate`
5. `pnpm typecheck`
6. `pnpm lint`
7. `pnpm test`
8. `pnpm build`

## `pnpm validate:full` includes

- `pnpm validate`
- `pnpm test:e2e`
- `pnpm test:visual`
- `pnpm test:electron`
- `pnpm package:dir`

## Non-goals for baseline commands

- No dependence on user-level MCP runtime.
- No dependence on personal files/secrets.
- No dependence on external AI providers.

## Optional hygiene gate

- `pnpm format:check` is tracked separately from baseline readiness because legacy formatting debt remains in non-critical files.

## Drift classes monitored

- Governance drift
- Architecture drift
- Design drift
- Dependency drift
- Quality/test drift
