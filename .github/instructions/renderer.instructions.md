---
applyTo: 'src/renderer/**/*.{ts,tsx}'
---

- Renderer is untrusted; privileged operations must remain in main process.
- Do not access secret environment variables in renderer code.
- Show explicit status and failure states for AI/FFmpeg workflows.
- Do not present fake confidence, fake processing, or misleading progress.
