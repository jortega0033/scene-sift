# Development Guide

Checked against `package.json` and the workflows in `.github/workflows/` on 2026-11-22.

## Setup

- Node.js 22 and pnpm 10.26.0 or newer in the 10 line (not enforced with an `engines` field: pnpm 10 refuses to run any command when it is older, including the ones that would tell you what is wrong). CI uses `version: 10`, which resolves to a current 10 release.
- `pnpm install --frozen-lockfile`. The install builds `better-sqlite3` and downloads Electron, so the first run takes several minutes.
- Minimum pnpm version: 10.26.0. `pnpm-workspace.yaml` allows the native builds with `allowBuilds`, a setting that pnpm 10.26.0 introduced (its release notes: "Added support for `allowBuilds`"). pnpm 10.15.0 ignored the setting and printed "Ignored build scripts: better-sqlite3, electron, ..."; the Electron binary and the SQLite binding were then missing and `tests/main/database-service.test.ts` and `tests/main/navigation-security.test.ts` failed (observed 2026-11-22). With pnpm 10.34.9, `pnpm rebuild better-sqlite3 electron` built both (observed 2026-11-22). How the minimum was confirmed: from the pnpm release notes, not by a fresh install with 10.26.0, so treat 10.26.0 as the documented floor until a fresh install with it is recorded here.
- If the install printed "Ignored build scripts", the native builds were skipped: upgrade pnpm, then run `pnpm rebuild better-sqlite3 electron`.
- FFmpeg and FFprobe are optional for starting the app. Inspect media needs FFprobe on the path or set in Settings.

## Scripts

- `pnpm dev` - Vite renderer, watchers for the main and preload bundles, then Electron
- `pnpm qa:serve` - the renderer in a plain browser on `127.0.0.1:4173` with the fixture bridge (`VITE_SCENESIFT_BROWSER_QA=1`). Fixture data only; see `docs/ARCHITECTURE.md`.
- `pnpm validate` - governance, architecture, design and dependency checks, then typecheck, lint, unit tests with coverage, and build. This is the `validate` CI job.
- `pnpm test` - Vitest unit and component tests with coverage
- `pnpm test:e2e`, `pnpm test:visual` - Playwright against `pnpm qa:serve` (fixture bridge, Chromium). Not run in CI.
- `pnpm test:electron` - builds, rebuilds native modules for Electron, runs the Electron smoke test. Needs a display. Not run in CI.
- `pnpm governance:scenarios` - adversarial governance tests (run in the `governance` CI job)
- `pnpm claude:validate`, `pnpm claude:test:hooks`, `pnpm claude:test:adversarial` - checks for `.claude/`. Not run in CI; run them locally when `.claude/` changes.
- `pnpm security:scan` - `pnpm audit --prod --audit-level=high` (the `security` CI job)
- `pnpm db:generate` - generate Drizzle migrations
- `pnpm db:migrate` - apply migrations from the command line (the app also applies them at startup)
- `pnpm smoke:electron` - launch and exit Electron
- `pnpm package:dir` - unpacked app build

There is no `test:renderer`, `test:media` or `test:database` script. Use `pnpm test`, or `pnpm exec vitest run <path>` for one file.

## Windows checkouts

Both checks that used to behave differently on Windows now give the same answer as CI (issue #9):

- `pnpm governance:validate` splits workflow files on CRLF or LF, so `core.autocrlf=true` no longer makes the action-pinning check report SHA-pinned `uses:` lines. A floating tag is still reported in both line-ending styles (regression tests in `tests/governance/adversarial-scenarios.test.ts`).
- The hooks in `.claude/hooks/` read standard input from file descriptor 0, which works on Windows and POSIX. `protect-file-write.mjs` turns absolute and backslash paths into repository-relative paths before matching, and the two `protect-*` hooks block when their input cannot be read (`pnpm claude:test:hooks`).

`pnpm claude:validate:agents` parses each role's frontmatter as YAML and fails on a role that does not parse or lacks `name` or `description` (`pnpm claude:test:agents`). `pnpm claude:test:rules` checks that every path and script named in `.claude/rules/*.md` exists.

## Visual baselines

The committed snapshots in `tests/visual/*-snapshots/` are named `*-chromium-darwin.png`. Playwright looks for a per-platform file, so on Windows and Linux `pnpm test:visual` has no baseline to compare with. Do not commit baselines from another platform without following `docs/design/VISUAL_CHANGE_POLICY.md`.

## Native modules

- `better-sqlite3` is native and must match the Electron runtime ABI.
- Packaging config unpacks `better-sqlite3` assets.
- If ABI mismatch appears, rebuild native deps for the target Electron version.
- If tests fail after packaging due ABI mismatch, run `pnpm rebuild better-sqlite3` for the local Node runtime.

## Packaging/signing notes

- macOS signing/notarization credentials are not committed.
- Windows code signing certs are not committed.
- Use CI secrets for production signing pipeline setup.

## FFmpeg binary distribution notes

- The app checks an override path from Settings, then `resources/ffmpeg`, then the system path.
- Future bundled FFmpeg binaries should be placed in `resources/ffmpeg`.
- Ensure licensing/distribution obligations are reviewed before shipping bundled binaries.
