# SceneSift Adversarial Governance Test Results

Date: 2026-07-19

## Execution method

- Automated: `pnpm governance:scenarios` (Vitest fixtures + synthetic diffs)
- Static validators: `pnpm architecture:validate`, `pnpm design:validate`, `pnpm dependencies:validate`
- Runtime smoke evidence via `pnpm test:e2e`, `pnpm test:visual`, `pnpm test:electron`

## Scenario coverage summary

- Total scenarios automated (Vitest): 64
- Total scenarios documented (including process-enforced): 70
- Automated passed: 64
- Process-enforced scenarios (marked *): 6
- Failed: 0
- Added in Readiness Closure Sprint (2026-07-19): 6 CI SHA pinning validator scenarios, 4 memory policy validator scenarios
- Fixed in prior milestone: networkGuard.ts inverted logic, design-validate arbitrary-value gaps,
  prohibited-telemetry-dependency rule name correction, exec()-pattern fixture correction

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
|  41 | `delete-user-media` forbidden action        | Gate forbidden autonomous action             | Pass   |
|  42 | `change-signing-config` forbidden action    | Gate forbidden autonomous action             | Pass   |
|  43 | `edit-env-files` forbidden action           | Gate forbidden autonomous action             | Pass   |
|  44 | `disable-tests` forbidden action            | Gate forbidden autonomous action             | Pass   |
|  45 | `disable-security-settings` forbidden       | Gate forbidden autonomous action             | Pass   |
|  46 | Template-string `exec()` injection          | Gate `command-injection-exec-string` pattern | Pass   |
|  47 | `upload-user-media` forbidden action        | Gate forbidden autonomous action             | Pass   |
|  48 | Renderer `process.env.*TOKEN` access        | Gate `renderer-process-env-secrets` pattern  | Pass   |
|  49 | DB access outside approved boundary         | Architecture boundary validator              | Pass   |
|  50 | Shared layer imports renderer impl          | Architecture `shared-layer-leak` rule        | Pass   |
|  51 | Main imports renderer components            | Architecture `main-imports-renderer` rule    | Pass   |
|  52 | QA adapter leak into component file         | Architecture `qa-adapter-leak` rule          | Pass   |
|  53 | Arbitrary Tailwind bracket spacing          | Design `arbitrary-spacing-value` rule        | Pass   |
|  54 | Raw `rgb()` color in UI source              | Design `raw-color-function` rule             | Pass   |
|  55 | Raw hex color in CSS                        | Design `raw-hex-color` rule                  | Pass   |
|  56 | posthog analytics SDK                       | Dependency `prohibited-telemetry-dependency` | Pass   |
|  57 | @sentry/browser SDK                         | Dependency `prohibited-telemetry-dependency` | Pass   |
|  58 | gate.yaml kill-switch field present         | Gate structural integrity                    | Pass   |
|  59 | gate.yaml forbids 10 required actions       | Gate forbidden-action completeness           | Pass   |
|  60 | requiredChecksByRisk covers levels 0–4      | Gate required-checks completeness            | Pass   |
|  61 | CI pinning: floating `@v4` tag              | `validate-ci-pinning.ts` floating-tag check  | Pass   |
|  62 | CI pinning: `@main` branch pin              | `validate-ci-pinning.ts` branch-pin check    | Pass   |
|  63 | CI pinning: 40-char SHA accepted            | `validate-ci-pinning.ts` SHA passthrough     | Pass   |
|  64 | CI pinning: local `./` action exempted      | `validate-ci-pinning.ts` exemption logic     | Pass   |
|  65 | CI pinning: `docker://` action exempted     | `validate-ci-pinning.ts` exemption logic     | Pass   |
|  66 | All project workflows are SHA-pinned        | `validate-ci-pinning.ts` against real repo   | Pass   |
|  67 | Memory validator passes clean files         | `validate-memory-policy.mjs` SCENESIFT_CLAUDE_MEMORY_ROOT | Pass |
|  68 | Memory validator flags API key              | `validate-memory-policy.mjs` api_key pattern | Pass   |
|  69 | Memory validator flags bearer token         | `validate-memory-policy.mjs` bearer pattern  | Pass   |
|  70 | Memory validator warns on nonexistent path  | `validate-memory-policy.mjs` warning + exit 0 | Pass  |

\* Process-enforced/manual-review constrained scenario; cannot be fully branch-protection-enforced from repository files alone.
