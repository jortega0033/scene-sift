# ADR-002: Typed IPC Contract

- Status: Accepted
- Date: 2026-07-19

## Context

IPC drift and untyped payloads are a common source of privilege escalation and runtime bugs.

## Decision

Define and consume shared IPC channels/contracts through `src/shared/**`; preload and main must adhere to these contracts.

## Consequences

- Safer runtime interactions.
- Contract updates require coordinated changes across layers.

## Alternatives considered

- Ad hoc string channels (rejected: brittle and unsafe).

## Revisit conditions

- Migration to a stricter transport abstraction.

## Approval requirement for changes

- Independent architecture review + governance checks.
