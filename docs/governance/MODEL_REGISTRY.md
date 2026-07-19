# Model Registry Policy

Canonical machine-readable registry: `docs/governance/model-registry.json`

## Requirements

- Every runtime-capable model must be registered.
- Each record must declare allowed use, forbidden use, risk ceiling, and verification mode.
- Status values: `active`, `restricted`, `disabled`.
- Model/provider changes require governance decision log entry.

## Enforcement

- `pnpm governance:validate` validates registry schema.
- Runtime AI integration must reference registered model IDs only.
