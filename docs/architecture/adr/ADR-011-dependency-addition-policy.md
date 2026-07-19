# ADR-011: Dependency Addition Policy

- Status: Accepted
- Date: 2026-07-19

## Context

Unchecked dependency additions are a primary vector for:
- Supply chain compromise
- License contamination
- Bundle size regression
- Duplicate stack divergence (two icon libraries, two state libraries, etc.)
- Telemetry or tracking without consent
- Native-module packaging failures

SceneSift maintains strict baseline constraints on single-family libraries.
Without a formal ADR, the addition process was documented only in DEPENDENCY_POLICY.md
without an accepted architectural decision record.

## Decision

All dependency additions (runtime or development) require explicit review covering:

1. **Purpose and layer** — which architectural layer owns this dependency
2. **Alternatives considered** — why existing packages cannot serve the need
3. **License** — must be compatible with project license; no copyleft for bundled code
4. **Security/telemetry** — no hidden telemetry; no known critical CVEs at addition time
5. **Native-module impact** — any native module requires packaging validation (`pnpm package:dir`)
6. **Bundle/runtime impact** — renderer additions require bundle size check
7. **Removal strategy** — how the dependency would be removed if needed
8. **Validation evidence** — `pnpm dependencies:validate` must pass after addition

Single-family baselines that may not be duplicated without explicit ADR update:
- Icon library: `lucide-react`
- Schema validation: `zod`
- State management: `zustand`
- CSS framework: Tailwind CSS

Prohibited dependency categories (require architectural exception + human approval):
- Telemetry/analytics SDKs (`posthog-js`, `mixpanel-browser`, `@segment/*`, `@sentry/*`)
- Cloud storage SDKs
- External AI provider clients
- Unpinned critical MCP tooling (`@playwright/mcp`, `chrome-devtools-mcp`)

## Consequences

- Slower addition of casual dependencies
- Cleaner, more auditable dependency surface
- Prevents duplicate stacks from diverging over time
- Enables `pnpm dependencies:validate` to reliably catch violations

## Alternatives considered

- No formal policy (rejected: leads to unchecked drift)
- Allowlist-only approach (rejected: too rigid for legitimate additions)

## Security impact

Reduces supply-chain and license risk. Native-module additions require packaging validation before merge.

## Revisit conditions

- When a new library category needs a baseline constraint
- When the project introduces a framework requiring different validation

## Required approval for changes

- Dependency auditor review + governance reviewer sign-off + `pnpm dependencies:validate` passing
