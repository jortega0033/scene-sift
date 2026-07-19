# Model Routing Policy

## Routing by risk and task type

- **Strongest reasoning model**:
  - Risk 3/4 governance architecture, security/threat review, preload/IPC review, FFmpeg safety, privacy/regulatory analysis.
- **Strong coding model**:
  - TypeScript implementation, validation scripts, tests, CI workflows, refactors under approved architecture.
- **Fast/economical model**:
  - low-risk scaffolding, repetitive docs formatting, mechanical non-sensitive tasks.

## Verification routing

- Medium/high/critical work must use independent verifier.
- Prefer different model family for verifier when available.
- Verifier receives requirements, diff, and evidence only.

## Escalation

- If weaker model fails repeatedly, escalate to stronger model.
- Record major routing decisions in `loop-run-log.md` without chain-of-thought.
