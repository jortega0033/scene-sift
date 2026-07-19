---
globs: ["src/renderer/components/ui/**", "src/renderer/styles/**", "src/renderer/tokens/**", "docs/design/**"]
---

# Design System Rule

Risk: 1 default. Risk 2 for token changes or component API breaks.

## Token usage

- All color, spacing, typography, and radius values must use design tokens from `src/renderer/tokens/`.
- No hardcoded hex/px values in component styles.
- Token changes require visual regression run before flagging done.

## Component conventions

- Follow existing component API patterns — props naming, slot structure, compound components.
- Accessibility: all interactive components need keyboard support and ARIA roles.
- No component should import from main, database, or media pipeline layers.

## Breaking changes

- Component API breaks (prop rename, removal, behavior change) require version bump in changelog.
- Visual regression tests in `tests/visual/` must pass after design system changes.

## Documentation

- New components require usage example in `docs/design/components/`.
- Run `pnpm test:visual` after any design token or component change.
