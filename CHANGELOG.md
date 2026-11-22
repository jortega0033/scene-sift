# Changelog

All notable changes to this project are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Every ticket pull request adds one line under `Unreleased`. The owner moves those lines under a version heading when releasing (`docs/RELEASING.md`).

## [Unreleased]

### Added

- Hardening pass 2: the review gate judges the proposed branch and keeps its ledger in the common git dir, `/next-ticket` picks only leaf tickets and waits for CI without polling, and issue #9 (hooks and local checks on Windows, agent-role YAML validation, pnpm floor, rule paths).
- Delivery workflow for tickets: `/next-ticket` driver, review gate hook, permission rules for ticket branches and draft pull requests, UI quality rules and the `ui-ux-pro-max` and `unslop` skills, collaboration and release files, and the owner decisions record.
