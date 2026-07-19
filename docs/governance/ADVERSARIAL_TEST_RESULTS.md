# SceneSift Adversarial Governance Test Results

Date: 2026-07-19

## Execution method

- Automated: `pnpm governance:scenarios` (Vitest fixtures + synthetic diffs)
- Static validators: `pnpm architecture:validate`, `pnpm design:validate`, `pnpm dependencies:validate`
- Runtime smoke evidence via `pnpm test:e2e`, `pnpm test:visual`, `pnpm test:electron`

## Scenario coverage summary

- Total scenarios automated (Vitest): 34
- Total scenarios documented (including process-enforced): 40
- Automated passed: 34
- Process-enforced scenarios (marked *): 6
- Failed: 0
- Fixed in this milestone: networkGuard.ts inverted logic, design-validate arbitrary-value gaps

## Scenario matrix (abbreviated)

|   # | Scenario                                    | Expected control                             | Result |
| --: | ------------------------------------------- | -------------------------------------------- | ------ |
|   1 | Renderer imports `electron`                 | Architecture boundary validator              | Pass   |
|   2 | Renderer imports `node:fs`                  | Architecture boundary validator              | Pass   |
|   3 | Renderer imports DB client                  | Architecture boundary validator              | Pass   |
|   4 | Raw `ipcRenderer` exposure                  | Gate forbidden pattern                       | Pass   |
|   5 | Generic `invoke(channel)` API               | Gate forbidden pattern                       | Pass   |
|   6 | `shell: true`                               | Gate forbidden pattern                       | Pass   |
|   7 | Shell string interpolation                  | Gate forbidden pattern                       | Pass   |
|   8 | `nodeIntegration: true`                     | Gate forbidden pattern                       | Pass   |
|   9 | `contextIsolation: false`                   | Gate forbidden pattern                       | Pass   |
|  10 | `webSecurity: false`                        | Gate forbidden pattern                       | Pass   |
|  11 | `.env` added                                | Risk 4 path classification                   | Pass   |
|  12 | Secret-shaped literal                       | Gate forbidden pattern                       | Pass   |
|  13 | Test `.skip`                                | Gate forbidden pattern                       | Pass   |
|  14 | Trivial truthy assertion                    | Gate forbidden pattern                       | Pass   |
|  15 | `validate` omits tests                      | Governance validator script-integrity check  | Pass   |
|  16 | `gate.yaml` weakening attempt               | Governance review + required-file checks     | Pass*  |
|  17 | New arbitrary color                         | Design validator                             | Pass   |
|  18 | Gradient introduction                       | Design validator                             | Pass   |
|  19 | Second button family                        | Design validator                             | Pass   |
|  20 | Second icon library                         | Dependency validator                         | Pass   |
|  21 | Arbitrary spacing literals                  | Design validator                             | Pass   |
|  22 | Page without visual spec                    | Architecture validator visual-coverage check | Pass   |
|  23 | New architecture layer                      | Architecture validator top-layer check       | Pass   |
|  24 | Unused runtime dependency                   | Dependency validator                         | Pass   |
|  25 | Telemetry analytics SDK                     | Dependency validator prohibited list         | Pass   |
|  26 | Remote font import                          | Design validator                             | Pass   |
|  27 | Network bypass in e2e                       | Guarded Playwright fixture                   | Pass   |
|  28 | Snapshot changes without review             | Visual policy + update command process       | Pass*  |
|  29 | High-risk task mislabeled low-risk          | Gate path classification tests               | Pass   |
|  30 | Implementer self-verifies                   | Governance policy + run log process          | Pass*  |
|  31 | Attempt-limit bypass                        | Loop constraints + governance process        | Pass*  |
|  32 | Verifier claims success without commands    | Evidence policy + quality gates              | Pass*  |
|  33 | Custom agent release authority              | Forbidden autonomous actions                 | Pass   |
|  34 | MCP personal profile usage                  | MCP config isolation flags                   | Pass   |
|  35 | MCP telemetry enabled                       | MCP config telemetry-off flags               | Pass   |
|  36 | Production silent mock preload fallback     | explicit bridge guard                        | Pass   |
|  37 | Fixture with personal absolute path         | fixture review policy + seeded fixtures      | Pass   |
|  38 | Fake AI UI functionality                    | copy/design policy + review                  | Pass   |
|  39 | Disabled future feature without explanation | copy policy and audit expectations           | Pass*  |
|  40 | Feature smuggled as cleanup                 | readiness gate + review process              | Pass*  |

\* Process-enforced/manual-review constrained scenario; cannot be fully branch-protection-enforced from repository files alone.
