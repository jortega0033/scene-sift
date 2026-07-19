# Dependency Review Skill

Invoke: `/dependency-review <package name(s) or "audit">`

## Steps

1. Run `pnpm audit` — report all findings.
2. Run `pnpm dependencies:validate` — report pass/fail.
3. For new packages: check license compatibility (MIT/Apache-2.0/BSD preferred).
4. Verify no global install flags (`-g`) introduced.
5. Check version pinning: security-sensitive packages should not use `^` ranges.
6. Report any known supply chain risks for named packages.

## Output

APPROVED / FLAGGED / BLOCKED per package.
- Audit finding count and severity breakdown.
- License status per new package.
- Any supply chain concerns.

## Note

Does not install packages. Reports findings; human or orchestrator decides whether to proceed.
