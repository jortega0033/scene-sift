# SceneSift Loop Budget

## Daily budget caps (default)

| Loop Type                                    | Max runs/day | Max tokens/day | Max specialist spawns/run |
| -------------------------------------------- | -----------: | -------------: | ------------------------: |
| L1 report-only triage                        |            4 |           120k |                         1 |
| L2 implementation + verification             |            8 |           600k |                         3 |
| L3 allowlisted unattended (disabled default) |            2 |           200k |                         2 |

## Budget responses

1. At 80% spend, switch to report-only unless human-approved exception exists.
2. At 100% spend, pause non-emergency autonomous work.
3. Record overruns and cause in `loop-run-log.md`.

## Model routing budget guidance

- Use strongest reasoning model for risk 3/4 design/security/threat tasks.
- Use strong coding model for implementation and tests.
- Use fast/economical model for repetitive low-risk scaffolding.
- Escalate model quality when repeated failures occur instead of retrying shallow fixes.
