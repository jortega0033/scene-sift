---
name: next-ticket
description: Owner-started driver that takes the next ready ticket of epic 8 from the queue to a ready pull request, one ticket per run, and never merges.
disable-model-invocation: true
argument-hint: "[issue number]"
---

# Next Ticket

Invoke: `/next-ticket [issue number]`

Only the owner starts this skill; starting it is the go signal for one ticket (`docs/owner-decisions.md`, entries 4 and 5). It covers one issue of epic #8 in `jortega0033/scene-sift`, takes it as far as a ready pull request, and stops. It never merges, never releases, and never starts another run.

The ticket work itself is the `governed-task` playbook (`.claude/skills/governed-task/SKILL.md`). This file only adds the queue, the branch and the pull request around it.

## Labels

- `status:ready`: every prerequisite in the epic's dependency table is closed (or waived by the owner in the epic).
- `status:blocked`: at least one prerequisite is open.
- `status:in-progress`: a `/next-ticket` run has taken it.
- `needs-decision`: the owner must decide something before work can go on.

## Steps

1. **Preconditions.** Stop if `gate.yaml` has `killSwitch.enabled: true` or `STATE.md` has `loopPaused: true`. Stop if the working tree you start from has uncommitted changes you did not make.
2. **Refresh the queue.** Read the dependency table in epic #8 (`gh issue view 8 -R jortega0033/scene-sift`) and the open issues (`gh issue list -R jortega0033/scene-sift --state open --json number,title,labels`). A `status:blocked` ticket whose prerequisites are all closed, or waived by an owner waiver recorded in the epic, becomes `status:ready` (`gh issue edit <n> --remove-label status:blocked --add-label status:ready`). Issue #9 is outside the epic but is listed as a prerequisite of #1; treat it like any other prerequisite.
3. **Pick one ticket.** With an issue number: use it if it is a child of epic #8 and `status:ready`; if it is `status:in-progress` with an open draft pull request from an earlier run, resume at step 8; otherwise stop and say why. Without a number: take the first ticket in the epic's dependency order that is `status:ready`, not `status:in-progress` and not `needs-decision`. If none qualifies, report the queue and stop.
4. **Claim it.** `gh issue edit <n> --remove-label status:ready --add-label status:in-progress`.
5. **Branch.** `git fetch origin`, then a fresh worktree from the tip of `origin/main`: `git worktree add .claude/worktrees/issue-<n> -b ticket/<n>-<short-slug> origin/main`. Change the session's working directory to the worktree and stay there for the rest of the run: the gate hook and its ledger (`.claude/state/`) use the working directory of each command, so a `gh pr` command run from the main checkout is not checked against the ticket's diff. One ticket per branch; name the issue in each commit body.
6. **Do the ticket** with the `governed-task` playbook: classify the risk from `gate.yaml`; for risk 3, present the plan and wait for the owner's explicit approval in this session; never execute risk 4. Run the roles in its table, implement, and record the local evidence listed in `CLAUDE.md` under "Before claiming a ticket done".
7. **Gates, then a draft pull request**, in this fixed order (`CLAUDE.md`, Delivery workflow):
   1. Local checks pass, output recorded.
   2. `CHANGELOG.md` line under `Unreleased` (a `.md` file, so it does not reset the role gate); pull request text drafted from `.github/pull_request_template.md` with `Closes #<n>` and the evidence, passed through the `unslop` skill.
   3. Specialists for the changed paths, then `architecture-reviewer` (review gate), then `governance-verifier` (acceptance gate), on the full diff, the recorded evidence, the CHANGELOG line and the drafted text. A FAIL goes back to step 6; after any code edit redo 1 and run both gates again. After the gates, only the `governance-verifier` verdict is appended to the drafted text.
   4. `git push -u origin ticket/<n>-<short-slug>`, then `gh pr create --draft --base main`. `.claude/hooks/role-gate.mjs` refuses the command if a gate has not run after the last code edit; run the missing gate, never work around the hook.
8. **CI.** Wait for the checks on the draft (`gh pr checks <pr> --watch`). If a check fails because of the change, fix it, re-run the local checks and both gates, and push again. Two failures are not the ticket's to fix: the `security` job fails until issue #5 is resolved, and the `governance` job fails when the change touches a protected path (for example `package.json`) until the owner adds `Governance Change Approval: yes` to the pull request body. Never add that line and never disable a job. In either case leave the pull request as a draft, comment on the issue with what is waiting on the owner, and stop.
9. **Ready.** When every check is green: `gh pr ready <pr>` (the gate hook checks the gates again), then one comment on the issue with the pull request and the CI run link. The issue keeps `status:in-progress` until the owner merges.
10. **Stop.** Report the issue, branch, pull request, checks and the roles run with their verdicts. Do not pick another ticket.

## When the run cannot finish

After three failed attempts, a blocking gate finding outside the ticket's scope, or an owner decision that blocks the ticket: do not open a pull request. Commit the work on the ticket branch locally, replace `status:in-progress` with `needs-decision`, comment on the issue with the reason and the branch name, and stop.

## Never

- `git merge`, `gh pr merge`, a push to `main`, a force push, a release, a tag or a deploy.
- Opening or readying a pull request with a gate not run on the current diff, or switching the gate off with `ROLE_GATE=off` (that switch is the owner's).
- Editing `.claude/agents/**`, `.claude/skills/**`, `.claude/hooks/**`, `.claude/settings.json`, `gate.yaml` or the loop files as part of a ticket, unless the ticket is about them and the owner approved it.
- Starting a second ticket in the same run, or scheduling a run.
