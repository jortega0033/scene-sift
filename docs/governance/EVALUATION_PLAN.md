# Runtime AI Evaluation Plan

## Objectives

- Detect model regressions before enabling broader use.
- Measure clip-candidate usefulness and safety.
- Track confidence calibration quality.

## Core metrics

- Candidate acceptance rate after human review.
- Timing-adjustment delta (AI suggestion vs final human timing).
- False-positive/irrelevant clip rate.
- Confidence calibration error.
- Failure/timeout rate and fallback usage.

## Process

1. Maintain fixed evaluation dataset versions.
2. Run baseline-vs-candidate model comparison.
3. Require no safety regression and acceptable quality delta.
4. Log evaluation result in governance decision record.
