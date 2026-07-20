# YouTube Clipper Skill — License and Dependency Review

**Audit commit**: f31f077ee0905c95a510a6f34bbd0c3c85b15129  
**Date**: 2026-07-20

---

## License

**License**: MIT  
**Copyright**: Copyright (c) 2026 op7418  
**Full text location**: https://github.com/op7418/Youtube-clipper-skill/blob/main/LICENSE

### MIT License obligations

If SceneSift copies substantial portions of source code from this repository:
- Must preserve the MIT license notice
- Must preserve the copyright notice
- May use, modify, distribute, sublicense without restriction

### Clean-room reimplementation

If SceneSift reimplements algorithms and patterns from scratch in TypeScript without copying source text:
- No license obligation applies
- Ideas and algorithms are not copyrightable
- Recommended approach for all ADAPT-classified patterns

**Recommendation**: Reimplement all ADAPT patterns clean-room in TypeScript. No source code needs to be copied. No attribution obligation applies to algorithmic ideas.

If any test cases, prompt templates, or documentation examples are directly adapted from this repository, add attribution comment: `// Inspired by op7418/Youtube-clipper-skill (MIT License)`.

---

## External Dependencies

### Python Runtime

| Attribute | Value |
|---|---|
| Dependency | Python 3.8+ |
| Purpose | Runtime for all scripts |
| License | PSF License (permissive) |
| Maintenance | Stable |
| Security | Active CVE tracking required |
| Packaging | Requires bundling Python or requiring pre-installed Python |
| SceneSift equivalent | Node.js / Electron |
| Recommendation | **REJECT** — Python not compatible with SceneSift's architecture |

### yt-dlp

| Attribute | Value |
|---|---|
| Dependency | yt-dlp (Python package + binary) |
| Purpose | YouTube video and subtitle download |
| License | Unlicense (public domain) |
| Maintenance | Active, frequent updates |
| Security | Network call, no user consent gate; complex format parsing |
| Packaging | Python package or standalone binary |
| SceneSift equivalent | None |
| Recommendation | **DEFER** — Not in M6–M14 scope. If downloading is added post-M14, evaluate as standalone binary invocation (not Python dependency) |

### pysrt

| Attribute | Value |
|---|---|
| Dependency | pysrt (Python package) |
| Purpose | SRT subtitle file parsing and manipulation |
| License | GNU LGPL v3 |
| Maintenance | Minimal activity (last release 2014-era) |
| Security | Unbounded file reads; pure Python |
| Packaging | Python dependency |
| SceneSift equivalent | SceneSift M2 already implements bounded SRT parsing natively in TypeScript |
| Recommendation | **REJECT** — SceneSift already has better implementation |

**Note on LGPL**: pysrt is LGPL. If it were to be used in SceneSift (which it should not be), dynamic linking would be required to comply with LGPL, which conflicts with Electron's bundled module system.

### python-dotenv

| Attribute | Value |
|---|---|
| Dependency | python-dotenv (Python package) |
| Purpose | Load .env file for configuration |
| License | BSD-3-Clause |
| Maintenance | Active |
| Security | Reads .env file from disk — API keys stored in .env |
| Packaging | Python dependency |
| SceneSift equivalent | Electron-specific keychain storage (M6) |
| Recommendation | **REJECT** — SceneSift must use OS keychain for secrets, never .env files |

### FFmpeg

| Attribute | Value |
|---|---|
| Dependency | FFmpeg binary (system-installed) |
| Purpose | Video clipping, audio, subtitle burn-in |
| License | LGPL 2.1+ (standard builds) / GPL (some configurations) |
| Maintenance | Very active, stable API |
| Security | Regularly patched for format-parsing CVEs; must be validated at startup |
| Packaging | System dependency or bundled binary |
| SceneSift equivalent | FFmpeg already a SceneSift dependency since M1 |
| Recommendation | **Already adopted** — continue using; add libass capability detection in M12 |

### FFmpeg with libass (ffmpeg-full)

| Attribute | Value |
|---|---|
| Dependency | FFmpeg built with libass (subtitle rendering) |
| Purpose | Subtitle burn-in via `subtitles` filter |
| License | libass is ISC License (permissive) |
| Maintenance | Active |
| Security | Font parsing attack surface (mitigated by controlled subtitle input) |
| Packaging | Homebrew `ffmpeg-full` on macOS; standard Ubuntu package includes libass |
| SceneSift equivalent | None yet |
| Recommendation | **Detect at startup** — if absent, disable subtitle burn-in UI option with clear message |

### libass

| Attribute | Value |
|---|---|
| Dependency | libass (linked into FFmpeg) |
| Purpose | Advanced SubStation Alpha / subtitle rendering |
| License | ISC License (permissive) |
| Maintenance | Active |
| Security | Font/subtitle parsing attack surface — mitigated by using only SceneSift-generated SRT files |
| Recommendation | Use via FFmpeg; do not link directly |

---

## Dependency Decision Summary

| Dependency | SceneSift action | Reason |
|---|---|---|
| Python 3.8+ | REJECT | Architecture incompatible |
| yt-dlp | DEFER | Out of M6–M14 scope |
| pysrt | REJECT | LGPL + SceneSift has better M2 implementation |
| python-dotenv | REJECT | .env key storage violates security policy |
| FFmpeg | ALREADY ADOPTED | Required since M1 |
| FFmpeg + libass | DETECT AND ENABLE | Required for M12 subtitle burn-in |

**No new dependencies** need to be added to SceneSift's `package.json` as a result of this audit.
