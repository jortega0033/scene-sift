---
globs: ["src/main/services/database/**"]
---

# Database Rule

Risk: 2 default. Risk 3 for schema changes, migrations, or changes to query construction.

## Query construction

- Use parameterized queries exclusively. No string interpolation in SQL.
- No dynamic SQL generation from user input.
- Validate all inputs before they reach query layer.

## Schema changes

- Schema changes require a migration file in `src/database/migrations/` (generated with `pnpm db:generate`).
- Migrations must be reversible where possible; document why if not.
- Test migrations against existing data fixtures before merge.

## Access restriction

- Direct SQLite usage is restricted to `src/main/services/database/`.
- Other layers access data only through repository interfaces.
- No raw database handles passed outside the database service boundary.

## Tests

Run `pnpm exec vitest run tests/main/database-service.test.ts` after schema or query changes, and `pnpm test` before flagging done. Include migration rollback test.
