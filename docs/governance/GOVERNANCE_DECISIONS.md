# Governance Decisions

## GD-001 — Adopt loop-engineering patterns as governance spine

- Date: 2026-07-18
- Decision: Adopt and adapt loop-style state, constraints, budget, and gate files.
- Reason: Provides practical, auditable operating controls for AI-assisted development.
- Scope: Development-agent governance only.

## GD-002 — Selective agency-agents adaptation only

- Date: 2026-07-18
- Decision: Create concise SceneSift-specific specialist agents; do not import full roster.
- Reason: Prevent role sprawl and conflicting instructions; retain only high-value expertise.

## GD-003 — Separate development and runtime AI governance

- Date: 2026-07-18
- Decision: Maintain distinct policy docs and controls for dev-agent vs runtime-product AI.
- Reason: Build-time controls do not automatically secure runtime AI behavior.

## GD-004 — Mechanical enforcement first

- Date: 2026-07-18
- Decision: Add `pnpm governance:validate` and adversarial tests.
- Reason: Avoid policy-only governance claims.

## GD-005 — Add three read-only preparation roles from agency-agents

- Date: 2026-11-22
- Status: Proposed. Takes effect when a human approves the pull request that adds this record.
- Decision: Install three role definitions from agency-agents at pinned revision `8ae6164602c95ca78828b148b9052460ee426885` under `.claude/agents/`: `codebase-onboarding-engineer`, `software-architect`, `accessibility-auditor`. Each is limited to `Read, Grep, Glob`, is advisory, and is not a verifier under `AGENTS.md`.
- Reason: The planned offline browser clip-review work needs onboarding into the code, design advice ahead of an ADR that extends ADR-006, and keyboard and assistive-technology review. No existing role covers these.
- Relation to GD-002: this is an explicit, scoped exception. GD-002 says to create concise SceneSift-specific agents and not to import the roster. These three files are not concise and not SceneSift-specific: below a short SceneSift scope section they hold 100 to 330 lines of unmodified upstream text, including upstream commands (`npx @axe-core/cli`, `npx lighthouse`) that the roles cannot run and that are not approved dependencies. The exception is limited to these three read-only files; GD-002 still applies to every other role. The files carry a provenance comment and the upstream license is stored in the repository.
- Protection changed: none reduced. No hook, deny rule, required check, required agent or `gate.yaml` entry is changed. The roles cannot write files or run commands.
- Also in this change: the `description` of `design-system-reviewer` is quoted so that Claude Code can parse it; before, the role did not load. Its text and tools are unchanged.
- Evidence and file list: `docs/governance/THIRD_PARTY_AGENT_ATTRIBUTION.md` section 3.

## GD-006 — Replace the out-of-date milestone statement in CLAUDE.md

- Date: 2026-11-22
- Status: Proposed. Takes effect when a human approves the pull request that adds this record.
- Decision: In `CLAUDE.md`, replace "Current milestone: Claude Code governance layer. No product features in this milestone." with a dated statement of the current state: governance layer complete, M1 and M2 merged, next planned work is the offline browser clip-review epic, and product code changes only inside a ticket, only while the feature readiness gate (ADR-012) is current, and under the risk workflow. Also correct the feature list, the commands and the description of where SQLite is opened, and add sections on Git workflow, evidence before a ticket is called done, and agent roles.
- Reason: The old sentence was written for the governance milestone. M1 and M2 were merged afterwards by owner override, and `STATE.md` has said "Feature development may begin" since 2026-07-19. Leaving it in place made the file contradict the repository.
- Restriction lifted: the sentence "No product features in this milestone" no longer appears. The universal prohibition "No product features during governance tasks" is unchanged, and the new text adds an explicit reference to the readiness gate, which the old text did not have.
- Verdict it relies on: none new. The last gate verdict is READY of 2026-07-19 and has not been re-run since M1 and M2. This decision does not declare the gate current; the re-run is the first step of GitHub issue #1 and two blocking conditions are open (see `docs/product/CURRENT_PRODUCT_STATE.md`).
- Review: independent read-only review by a different model in the proposing session found this change unrecorded; this record is the fix. `governance-verifier` in a separate session and human approval are still required.

## GD-007 — Delivery workflow from the owner's SDLC kit

- Date: 2026-11-22
- Status: Decided by the owner on 2026-11-22 (`docs/owner-decisions.md`). Takes effect when the owner merges the pull request that adds this record.
- Decision: agents may take one ticket per owner-started `/next-ticket` run up to a ready pull request: push the ticket branch, open a draft pull request after both gate roles passed, and mark it ready when CI is green. Only the owner merges and releases. This overrides the earlier rule that agents never push or open pull requests in this repository.
- Protection changed: the deny rules `Bash(git push*)` and `Bash(gh pr create*)` are replaced by an allow for `git push -u origin <branch>`, `gh pr create --draft` and `gh pr ready`, and by narrower deny rules for pushes to `main`, force pushes, bare `git push`, all-ref and mirror pushes and remote deletes. `git merge`, `gh pr merge`, `gh release`, publish and secret reads stay denied. No hook, `gate.yaml` entry, required check or adversarial test is removed.
- Protection added: `.claude/hooks/role-gate.mjs` blocks `gh pr create` and `gh pr ready` until `architecture-reviewer` and `governance-verifier` ran after the last code edit; `ask` rules for edits to agent configuration, `.github/**`, `gate.yaml` and the loop files; deny rules for PowerShell pushes, merges and releases and for reading `.env` and `secrets/`. Loop runs drop to L1 (report-only, unscheduled); ticket work is not a loop run.
- Also in this change: a "Use proactively" sentence in every role description, the gate sections in `architecture-reviewer` and `governance-verifier`, `docs/ui-quality.md` with the `ui-ux-pro-max` and `unslop` skills, collaboration and release files, and `docs/owner-decisions.md`.
- Review: `governance-verifier` in a separate session and the owner's merge.
