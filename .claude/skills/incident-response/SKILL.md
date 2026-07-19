# Incident Response Skill

Invoke: `/incident-response <incident description>`

## Steps

1. **Contain** — Identify if incident is still active. If yes: note what to stop (e.g., cancel running loop, block a path). Do not implement containment — flag for human action.
2. **Collect evidence** — Read `loop-run-log.md`, `STATE.md`, hook outputs, relevant logs.
3. **Timeline** — Reconstruct what happened and when.
4. **Root cause** — Identify: which control failed, what rule was absent, what agent behavior caused issue.
5. **Classify severity** — Critical (data loss, security breach, credentials exposed) / High (governance bypass, forbidden action executed) / Medium (unexpected behavior, test failure) / Low (cosmetic, recoverable).
6. **Draft incident report** — Write to `docs/governance/incidents/YYYY-MM-DD-<slug>.md`.
7. **Propose remediations** — List gate.yaml/hook/rule changes needed. Do not implement.
8. **Escalate** — Critical/High incidents: present to human immediately before further action.

## Output

Structured incident report with: summary, timeline, root cause, severity, evidence, proposed remediations, risk levels of proposed changes.
