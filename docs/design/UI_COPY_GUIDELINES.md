# SceneSift UI Copy Guidelines

## Product language goals

- Short, direct, task-oriented labels.
- Honest current-state messaging (no implied future capability).
- Consistent terminology across pages, tests, and docs.
- Error messages that explain action, not blame users.

## Canonical terminology

| Preferred term                                    | Avoid unless semantically different          |
| ------------------------------------------------- | -------------------------------------------- |
| Project                                           | Workspace, Studio                            |
| Video                                             | Source media, Asset                          |
| Subtitle                                          | Captions, Transcript file                    |
| Output directory                                  | Export path (unless same meaning context)    |
| Queue                                             | Pipeline, Processing lane                    |
| Job                                               | Task unit, Batch item                        |
| FFmpeg                                            | Encoder engine                               |
| FFprobe                                           | Probe utility                                |
| Available                                         | Ready (unless readiness has broader meaning) |
| Missing / Unavailable                             | Broken (unless verified failure)             |
| Queued / Running / Completed / Failed / Cancelled | ad hoc status verbs                          |

## Prohibited patterns

- Marketing slogans in core workflow UI.
- “AI-powered”, “intelligent”, “magic”, “viral”, or “instant” claims without implementation.
- Fake progress or fake analytics language.
- Raw stack traces in user-facing surfaces.

## Error-copy standards

- Include the failed action context.
- Include one practical next step where possible.
- Keep language neutral and specific.
