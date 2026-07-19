# Prompt Registry Policy

Canonical machine-readable registry: `docs/governance/prompt-registry.json`

## Requirements

- Runtime prompts must have stable IDs and owners.
- Input/output policy and injection defenses must be declared.
- Status values: `active`, `deprecated`, `disabled`.
- Deprecated prompts remain for audit traceability.

## Enforcement

- `pnpm governance:validate` validates prompt registry schema.
- Runtime AI features should reference prompt IDs, not ad-hoc prompt text blobs.
