# SceneSift Governance Reality Check

Date: 2026-07-19

## Scope

- Governance controls audit (documented vs enforced)
- Architecture/design/dependency enforcement reality
- QA and MCP truthfulness classification

## Control status classification

Legend: ENFORCED / TESTED / DOCUMENTED / PARTIAL / PLANNED / BROKEN / MISSING / N/A

| Control                              | Claimed     | Actual                                                        | Classification                          | Remediation                                                 |
| ------------------------------------ | ----------- | ------------------------------------------------------------- | --------------------------------------- | ----------------------------------------------------------- |
| Risk classification by path          | Yes         | `gate.yaml` + tests                                           | ENFORCED + TESTED                       | Keep adversarial fixtures updated                           |
| Forbidden Electron security flags    | Yes         | regex checks + tests + runtime config                         | ENFORCED + TESTED                       | Maintain pattern coverage                                   |
| Independent verification requirement | Yes         | documented + run-log expectation, no branch-level enforcement | PARTIAL                                 | Keep explicit verifier evidence + manual review requirement |
| Protected governance file hardening  | Yes         | CI jobs + governance validator on required files              | PARTIAL                                 | Requires branch protection at hosting layer                 |
| Architecture boundary enforcement    | Newly added | `pnpm architecture:validate` + tests                          | ENFORCED + TESTED                       | Monitor false positives                                     |
| Design-system drift enforcement      | Newly added | `pnpm design:validate` + tests                                | ENFORCED + TESTED                       | Add dark-theme baseline later                               |
| Dependency governance enforcement    | Newly added | `pnpm dependencies:validate` + tests                          | ENFORCED + TESTED                       | Extend policy per feature growth                            |
| MCP safety config                    | Yes         | `.mcp.json` with isolated constraints; both servers pinned in package.json | DOCUMENTED + TESTED (config) | Runtime MCP tool integration still editor-dependent |
| AI tooling parity (Copilot ↔ Claude) | Newly added | `docs/governance/AI_TOOLING_PARITY_MATRIX.md` — 25 concerns, no conflicts | DOCUMENTED                    | Update on new governance concern additions |
| Memory policy enforcement            | Claimed     | `validate-memory-policy.mjs` slug fix + env override; scans real memory path via `pnpm claude:validate` | ENFORCED + TESTED (TD-005 closed 2026-07-19) | Monitor on path changes |
| CI action SHA pinning                | Enforced    | All 4 CI workflows SHA-pinned; `validate-ci-pinning.ts` integrated into `pnpm governance:validate`; 6 adversarial tests | ENFORCED + TESTED (TD-004 closed 2026-07-19) | Add Dependabot for SHA refresh |

## Governance theater findings removed

- Added mechanical checks for architecture, design, and dependency drift.
- Added validation-script integrity checks in governance validator.
- Added adversarial scenarios for skipped tests, trivial assertions, generic invoke, shell interpolation, and secret shapes.
- Added 20 new adversarial scenarios (34→54 automated, 40→60 total) including: forbidden autonomous actions, architecture fixture tests, design fixture tests, dependency prohibition tests, gate.yaml structural integrity.
- AI_TOOLING_PARITY_MATRIX.md created: unified cross-tool governance map, no conflicts found.
- ADR-011 and ADR-012 created and accepted.

## Remaining limitations

- Branch-protection and review rules cannot be asserted from repository files alone; manual host-level configuration remains required (requires GitHub Pro for private repos).
- TD-001, TD-004, TD-005: all closed in Readiness Closure Sprint (2026-07-19).

## Updated: 2026-07-19 (run_id: 2026-07-19T-readiness-closure-sprint)
