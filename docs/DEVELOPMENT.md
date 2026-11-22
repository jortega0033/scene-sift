# Development Guide

Checked against `package.json` and the workflows in `.github/workflows/` on 2026-11-22.

## Setup

- Node.js 22 and pnpm 10, the versions CI uses.
- `pnpm install --frozen-lockfile`. The install builds `better-sqlite3` and downloads Electron, so the first run takes several minutes.
- Use a current pnpm 10 release. `pnpm-workspace.yaml` allows the native builds with `allowBuilds`. pnpm 10.15.0 ignored that setting and printed "Ignored build scripts: better-sqlite3, electron, ..."; the Electron binary and the SQLite binding were then missing and `tests/main/database-service.test.ts` and `tests/main/navigation-security.test.ts` failed. With pnpm 10.34.9, `pnpm rebuild better-sqlite3 electron` built both (observed 2026-11-22). CI uses `version: 10`, which resolves to a current release. The minimum version that honors `allowBuilds` has not been determined.
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

Two checks behave differently on Windows than in CI (all observed 2026-11-22; tracked in issue #9):

`pnpm governance:validate` reads the workflow files line by line. With `core.autocrlf=true` the working copy has CRLF line endings, and the action-pinning check then reports every `uses:` line as a violation (observed 2026-11-22). The committed files are LF and the check passes in CI. To run it locally on Windows, use a clone or worktree with `core.autocrlf=false`. `pnpm governance:scenarios`, and therefore `pnpm test`, fails the same way.

The hooks in `.claude/hooks/` read their input from `/dev/stdin`. That path does not exist on Windows, so each hook exits 0 without checking anything, and `pnpm claude:test:hooks` fails its blocking cases. On Windows the write and command protections therefore come only from the deny rules in `.claude/settings.json` and from following the rules; do not rely on the hooks to stop a write to `gate.yaml`, `AGENTS.md`, `LOOP.md`, `loop-constraints.md` or `.github/workflows/`.

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
