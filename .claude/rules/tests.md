---
globs: ["tests/**", "vitest.config.*", "playwright.config.*"]
---

# Tests Rule

Risk: 1 default. Risk 2 for changes to test infrastructure or adversarial/governance test removal.

## Never remove or weaken

- Adversarial governance tests (`tests/governance/`, `tests/claude/`).
- IPC contract tests (`tests/main/ipc-contracts.test.ts`).
- Electron security baseline tests.

Removing these requires explicit human authorization and governance review.

## Test scope

- Unit tests: `tests/renderer/`, `tests/main/`, `tests/database/`, `tests/ai/`, `tests/media/`.
- E2E: `tests/e2e/` (Playwright).
- Visual regression: `tests/visual/` (Playwright).
- Governance/adversarial: `tests/governance/`, `tests/claude/`.

## Quality requirements

- New features require at least one unit test and one E2E scenario.
- Bug fixes require a regression test that would have caught the bug.
- Tests must be deterministic — no reliance on external network or wall-clock time.
- Mock at system boundaries only; do not mock internal implementation details.

## Running tests

Use `pnpm test` (all unit), `pnpm test:e2e` (E2E), `pnpm test:visual` (visual), `pnpm claude:test:adversarial` (governance adversarial).
