# Releasing SceneSift

Only the owner releases. Agents never tag, publish, sign or upload a release: `.claude/settings.json` denies `gh release`, `npm publish`, `pnpm publish` and `electron-builder --publish`, and `gate.yaml` lists `publish-release` and `change-signing-config` as forbidden autonomous actions.

No release has been published yet (checked 2026-11-22: no tags, no GitHub releases). The steps below have not been run end to end; the first release will test them. Correct this file in the same pull request as anything that turns out wrong.

## What a release is here

A release is a version number on `main`, an annotated git tag `v<version>`, and a GitHub release with the desktop installers attached. Installers come from `electron-builder.yml`: `dmg` and `zip` on macOS, `nsis` on Windows. Builds are unsigned; there is no signing or notarization configuration, and adding one is a risk 4 change (`gate.yaml`).

The offline browser mode of epic #8 is verified by issue #6 and is not a packaged product; it is not part of a desktop release.

## Before a release

1. `main` is green in all four workflows (`validate`, `governance`, `security`, `agent-evidence`). The `security` job must pass: a desktop release needs the production audit clean (issue #5).
2. The feature readiness gate (ADR-012, `docs/governance/FEATURE_READINESS_GATE.md`) has a dated READY entry after the last feature milestone.
3. On macOS with a display (visual baselines exist only for `chromium-darwin`): `pnpm install --frozen-lockfile`, then `pnpm validate:full`. Record the output. If a step cannot run, write down which one and why, and decide whether to release without it.
4. Release readiness review with `.github/prompts/release-readiness.prompt.md`, answered `ready`.

## Steps

1. Owner: on a branch from `main`: set `version` in `package.json`, move the lines under `Unreleased` in `CHANGELOG.md` to a new `## [<version>] - <date>` heading, and open a pull request. `package.json` is a protected path: add `Governance Change Approval: yes` to the pull request body yourself, then merge.
2. On the merged commit of `main`, build the installers on each target platform: `pnpm package` (runs `pnpm build`, then `electron-builder`; output in `release/`). Do not pass `--publish`.
3. Install and start each installer once on a clean machine or VM; create a project and run an inspection.
4. Tag the merged commit: `git tag -a v<version> -m "SceneSift <version>"` and `git push origin v<version>`.
5. Create the GitHub release for the tag by hand, paste the changelog section, and attach the installers from `release/`.

## Rollback

Mark the GitHub release as a pre-release or delete it, and say why in its notes. Do not move or delete a pushed tag; fix forward with a new patch version.
