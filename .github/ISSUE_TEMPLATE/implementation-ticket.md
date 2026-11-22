---
name: Implementation ticket
about: One piece of app work for an epic, small enough for one pull request
title: ''
labels: ''
assignees: ''
---

Part of epic #<epic>. Priority P<n>. Depends on #<n> (or: no dependencies).

## Outcome and scope

What a user can do when this is merged, in one or two sentences. Then what is in scope and what is explicitly out of scope.

## Code paths and boundaries

- Files and directories this ticket changes, and the `gate.yaml` risk level they match.
- Layer boundaries it must respect (`docs/architecture/ARCHITECTURE.md`), and any ADR it needs.
- Protected paths it touches (for example `package.json`), which need the owner's `Governance Change Approval: yes` in the pull request.

## Prerequisites and dependencies

Issues that must be merged first, and what can run in parallel.

## Acceptance criteria

- [ ] Observable, testable statement, with the test or command that shows it.
- [ ] For a changed screen: no breach of `docs/ui-quality.md`.

## Verification

The commands from `gate.yaml` `requiredChecksByRisk` for this risk level, any extra check from `CLAUDE.md` ("Before claiming a ticket done"), and the verifier roles that must pass.

## Estimate

Hours as a range, with what drives the spread.
