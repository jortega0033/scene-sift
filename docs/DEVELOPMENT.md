# Development Guide

## Scripts

- `pnpm dev` - run renderer + electron main/preload watchers + Electron app
- `pnpm validate` - typecheck + lint + tests + build
- `pnpm test` - Vitest unit/component tests
- `pnpm test:e2e` - Playwright smoke test
- `pnpm db:generate` - generate Drizzle migrations
- `pnpm db:migrate` - apply migrations (CLI)
- `pnpm smoke:electron` - launch/exit Electron smoke run
- `pnpm package:dir` - unpacked app build

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

- This boilerplate currently checks local/system FFmpeg paths.
- Future bundled FFmpeg binaries should be placed in `resources/ffmpeg`.
- Ensure licensing/distribution obligations are reviewed before shipping bundled binaries.
