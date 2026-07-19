# Human Oversight Policy

## Mandatory approval points

- All risk 2+ code changes before merge.
- Any runtime AI change affecting data transfer, retention, or provider behavior.
- Any rendering/export/publishing action derived from AI recommendations.

## Required reviewer evidence

- Required checks from `gate.yaml` with command output.
- Security/privacy review notes for sensitive changes.
- Explicit residual risk statement.

## Rejection defaults

- Missing evidence.
- Failed checks.
- Policy-impacting changes without decision record.
