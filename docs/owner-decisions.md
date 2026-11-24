# Owner decisions

A dated record of the decisions the owner made for this repository, so the rules do not depend on anyone's memory of a conversation. Changing an entry needs the owner. An agent that finds a decision blocking a ticket stops and says so.

All entries below were made on 2026-11-22. They are carried out by the pull request that adds this file and take effect when the owner merges it. Governance record: GD-007 in `docs/governance/GOVERNANCE_DECISIONS.md`.

| # | Decision | Where it is implemented |
|---|---|---|
| 1 | The instructions, tooling and playbook live on the default branch (`main`), not on a preparation branch. | This file and everything it links, merged to `main` |
| 2 | Persona agents run automatically during ticket work and carry instructions tailored to this project. | The "Use proactively" sentence in each `description` in `.claude/agents/*.md`; the role table in `.claude/skills/governed-task/SKILL.md`; `docs/governance/CLAUDE_CODE_AGENT_MATRIX.md` |
| 3 | Every open ticket is about app implementation; tooling is installed, not ticketed. | Epic #8 and its children. Exception recorded by the owner: issue #9 (hooks and local checks on Windows) is tooling, stays outside the epic and gets its own pull request. |
| 4 | Agents may take a ticket up to a ready pull request. Only the owner merges and releases. This overrides the earlier rule that agents never push or open pull requests here. | `CLAUDE.md` (Git workflow, Universal prohibitions, Delivery workflow); `AGENTS.md`; `.claude/skills/next-ticket/SKILL.md`; `.claude/settings.json`; `docs/RELEASING.md` |
| 5 | No scheduler. Ticket work starts only on the owner's go signal (`/next-ticket`), because the repository is used to train AI models. | `.claude/skills/next-ticket/SKILL.md` (`disable-model-invocation: true`); `LOOP.md`; `STATE.md` (`schedulers: none`) |
| 6 | A review gate hook blocks opening or readying a pull request until the gate roles have run after the last code edit. Here the gate roles are `architecture-reviewer` (review) and `governance-verifier` (acceptance). | `.claude/hooks/role-gate.mjs`, registered in `.claude/settings.json`; gate sections in `.claude/agents/architecture-reviewer.md` and `.claude/agents/governance-verifier.md` |
| 7 | Loop Engineering stays at L1, report-only and unscheduled. Ticket work is not a loop run. | `LOOP.md`; `STATE.md` (`defaultMode: L1`) |
| 8 | Continuous integration runs on Linux and Windows; the default branch requires a pull request and green checks. | The four workflows in `.github/workflows/` run on `ubuntu-latest` only. They are left as they are: the kit does not replace existing CI, and a workflow change is risk 3 and needs the owner. Windows behaviour of the local checks is issue #9. Branch protection is set on GitHub by the owner's orchestrator after the merge, not in a file. |
| 9 | Permission rules: documented commands are allowed; force pushes, pushes to the default branch, merges, releases and reads of secrets are denied; edits to CI, agent configuration and Loop files ask first. | `.claude/settings.json`; `docs/governance/CLAUDE_CODE_PERMISSION_POLICY.md` |
| 10 | Open decisions on tickets are settled with the ticket's stated default. Where a ticket states none, the conservative option is taken and flagged in the issue. | The list below |
| 12 | The ten UI rules in `docs/ui-quality.md` are binding, and the `ui-ux-pro-max` and `unslop` skills are installed in the repository and used for UI work and for copy. | `docs/ui-quality.md`; `.claude/skills/ui-ux-pro-max/`; `.claude/skills/unslop/`; checklists in `.claude/agents/design-system-reviewer.md`, `visual-qa-reviewer.md`, `accessibility-auditor.md`; `.claude/skills/governed-task/SKILL.md` |

Entry 11 of the owner's list (Rust is verified in CI only) does not apply: this repository has no Rust code.

## Entry 10: ticket decisions settled by default

The open owner decisions are listed in epic #8 under "Decisions for the owner".

| Issue | Decision | Settled as | How |
|---|---|---|---|
| #8, affects #1 | Readiness gate: #5 and #9 land before #1's code, or a waiver; where the gate re-run happens | No waiver. #5 and #9 are merged before #1's product code starts (the ADR draft in slice 1 may start earlier, as #1 allows). The gate is re-run on macOS with a display, where `pnpm validate:full` can pass; on any other platform the steps that cannot run are recorded as not run and do not count towards a READY verdict. | No default stated: conservative option, flagged in the issue |
| #8, affects #1 | Product scope: browser track alongside, or instead of, MVP M3 and M4 | Alongside. #1 records it in an ADR and the roadmap; M3 and M4 stay in the plan. | Stated in the epic |
| #8, affects #1 and #2 | Unmerged stack `feature/m3-…` to `feature/m11-…` | Not merged and not depended on. #1 uses ADR-015. #2 does not port code from `feature/m4-video-preview` or `feature/m9-clip-timing-editor`. | Stated in the epic and in #2 |
| #8 | Open PR #7 rewrites `README.md` | Tickets do not edit `README.md` until PR #7 is merged. | Stated in the epic |

## Program decisions (owner, 2026-11-24)

The owner accepted the goal and each suggestion below. They apply from the stage they name; the rules of `CLAUDE.md` hold for stage 1 as written.

| Decision | Implemented in |
|---|---|
| The repository has a program goal above stage 1: a local-first video review and clipping studio, in six stages. | Program issue #59 |
| The main epic here is #8, with #1 as its first ticket. Suggested: #8 becomes stage 1. | Program issue #59 |
| Local speech and picture models need weights. Suggested: never commit them, choose the licence when the stage starts, upload nothing. | Program issue #59 |
| The repository has its own feature gate and governance records. Suggested: the goal is documentation only, and each later stage passes that gate before it starts. | Program issue #59 |
