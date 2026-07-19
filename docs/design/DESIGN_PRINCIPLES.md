# SceneSift Design Principles (Baseline)

1. **Desktop-tool first**: prioritize dense, task-oriented layouts for resizable desktop windows.
2. **Local-first truthfulness**: UI must not imply cloud workflows or AI processing that does not exist.
3. **Flat monochrome system**: hierarchy through typography, spacing, borders, and alignment—not decoration.
4. **One system per concern**: one icon family, one status treatment pattern, one dialog pattern.
5. **Accessibility as contract**: semantic roles, keyboard support, visible focus, and meaningful labels.
6. **Deterministic QA compatibility**: states must be testable via stable roles and seeded fixtures.
7. **No governance theater**: style rules must be enforceable through validation where practical.

## Prohibited by default

- Gradients, glow, glassmorphism
- Decorative accent palettes
- Marketing hero sections or fake metrics
- Fake AI labels/functionality
- Arbitrary color and spacing literals
- Competing component families

## Exception policy

Exceptions require:

1. documented rationale,
2. visual evidence,
3. accessibility impact review,
4. independent reviewer sign-off.
