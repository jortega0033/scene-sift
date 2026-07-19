---
applyTo: 'src/main/services/ffmpeg/**/*.ts'
---

- Treat subtitle and media metadata as untrusted input.
- Use FFmpeg/FFprobe argument arrays only.
- Probe media before making codec/container assumptions.
- Surface cancellation and failures explicitly.
