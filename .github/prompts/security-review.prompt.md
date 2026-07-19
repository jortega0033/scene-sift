# Security Review Prompt

Review changed files and fail closed.

- Check Electron security flags, preload exposure, and IPC validation.
- Check process execution and FFmpeg argument safety.
- Check filesystem and migration side effects.
- Check secrets/telemetry/privacy boundaries.
- Return explicit reject reasons with file/line evidence.
