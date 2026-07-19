# ADR-005: Native FFmpeg Process Execution

- Status: Accepted
- Date: 2026-07-19

## Context

Media workflows require native binaries while maintaining command-injection safety.

## Decision

Restrict process execution to approved services using argument arrays; disallow `shell: true` and string command interpolation.

## Consequences

- Safer command execution.
- Requires helper services for shared process behavior.

## Alternatives considered

- Shell-based command composition (rejected: injection risk).

## Revisit conditions

- Sandboxed execution architecture introduced.

## Approval requirement for changes

- Security specialist review + adversarial test updates.
