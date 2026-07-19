---
globs: ["src/renderer/**"]
---

# Renderer Rule

Risk: 1 default. Risk 2 for state management and routing changes. Risk 3 for QA bridge, context isolation, or security-relevant changes.

## Layer constraints

- No imports from `electron`, `node:*`, `@main/*`, `@database/*`, or any main-process module.
- IPC access only through `window.sceneSift` (contextBridge API).
- QA mock bridge (`window.__sceneSiftMock`) only in files behind `VITE_SCENESIFT_BROWSER_QA` guard, restricted to `src/renderer/main.tsx`.
- No `eval`, `new Function`, or dynamic script injection.

## Component requirements

- React 19. No class components.
- TypeScript strict mode. No `any` without explicit comment justification.
- Follow existing component patterns (see `src/renderer/components/`).
- All user-facing strings extracted for i18n (see existing pattern).

## Testing

- Unit tests in `tests/renderer/` using Vitest.
- Visual regression in `tests/visual/` using Playwright.
- Run `pnpm test:renderer` before flagging renderer change as done.
