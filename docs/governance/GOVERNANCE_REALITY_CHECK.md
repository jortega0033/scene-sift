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
| MCP safety config                    | Yes         | `.vscode/mcp.json` with isolated constraints                  | DOCUMENTED + SYNTAX-VALIDATED + STARTED | Runtime MCP tool integration still editor-dependent         |

## Governance theater findings removed

- Added mechanical checks for architecture, design, and dependency drift.
- Added validation-script integrity checks in governance validator.
- Added adversarial scenarios for skipped tests, trivial assertions, generic invoke, shell interpolation, and secret shapes.

## Remaining limitation

- Branch-protection and review rules cannot be asserted from repository files alone; manual host-level configuration remains required.
