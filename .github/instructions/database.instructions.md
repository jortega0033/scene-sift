---
applyTo: 'src/database/**/*.ts'
---

- Schema and migration changes are high risk.
- Keep migration operations deterministic and reversible when possible.
- Avoid destructive data mutations without explicit, reviewed intent.
- Validate DB path and lifecycle behavior across platform startup/quit flows.
