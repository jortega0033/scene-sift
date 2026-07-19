---
globs: ["docs/**", "*.md", "AGENTS.md", "LOOP.md", "loop-constraints.md"]
---

# Documentation Rule

Risk: 1 default. Risk 3 for AGENTS.md, LOOP.md, loop-constraints.md, and any governance document.

## Binding documents — no weakening without human approval

- `AGENTS.md`, `LOOP.md`, `loop-constraints.md`: binding operation rules. Any weakening requires governance review and human authorization.
- `docs/governance/`: governance decision records. Append only; do not revise decisions retroactively.
- `docs/architecture/adr/`: ADR records. Once accepted, status can only change to Deprecated or Superseded (never deleted).

## Standard documentation

- Keep docs consistent with code — outdated docs are worse than no docs.
- ADRs required for architecture boundary changes (see architecture rule).
- No placeholder sections ("TBD", "TODO") in docs merged to main.

## README and CLAUDE.md

- `README.md` and `CLAUDE.md` are read by humans and AI tools at session start. Keep them accurate and concise.
- `CLAUDE.md` changes require governance-rule risk classification (see governance.md rule).
