# AI Risk Register

| ID      | Risk                                          | Surface                         | Severity | Mitigation                                                                 | Status   |
| ------- | --------------------------------------------- | ------------------------------- | -------- | -------------------------------------------------------------------------- | -------- |
| AIR-001 | Prompt injection from subtitle content        | Runtime AI                      | High     | Untrusted-input handling, fixed prompt scaffolds, output schema validation | Open     |
| AIR-002 | Unauthorized cloud data transfer              | Runtime AI/provider integration | High     | Explicit consent + disclosure + policy checks                              | Open     |
| AIR-003 | Weak Electron security flags                  | Main window config              | Critical | Forbidden pattern checks + security review                                 | Enforced |
| AIR-004 | Command injection via FFmpeg/process args     | Media pipeline                  | Critical | Arg arrays only; forbid `shell: true`                                      | Enforced |
| AIR-005 | Verifier theater (claims without evidence)    | Dev governance                  | High     | Independent verifier + mandatory command evidence                          | Enforced |
| AIR-006 | Model regression harms recommendation quality | Runtime AI                      | Medium   | Evaluation plan and regression checks                                      | Planned  |
| AIR-007 | Secret leakage to renderer/logs               | App security                    | Critical | Forbidden patterns + reviewer checks                                       | Enforced |
| AIR-008 | Unreviewed policy drift                       | Governance docs/config          | High     | governance validate + decision log                                         | Enforced |
