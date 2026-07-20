import type { SubtitleCue } from '@shared/schemas/subtitle';
import type { TranscriptEntry } from '@shared/schemas/transcript';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

// Bounded quantifiers + letter/slash first-char requirement — ReDoS safe, avoids stripping bare < > operators
const TAG_PATTERN = /(<[a-zA-Z/][^>]{0,255}>|\{[^}]{0,256}\})/g;

export class TranscriptService {
  stripTags(text: string): string {
    return text.replace(TAG_PATTERN, '').replace(/\s+/g, ' ').trim();
  }

  mergeCues(cues: SubtitleCue[], gapThresholdMs: number): TranscriptEntry[] {
    const [firstCue, ...restCues] = cues;
    if (!firstCue) return [];
    const entries: TranscriptEntry[] = [];
    let current: TranscriptEntry = {
      startMs: firstCue.startMs,
      endMs: firstCue.endMs,
      text: this.stripTags(firstCue.text),
    };
    for (const cue of restCues) {
      const gap = cue.startMs - current.endMs;
      // Negative gap = overlapping cues (common in ASS multi-track files). Merged intentionally.
      if (gap <= gapThresholdMs) {
        current.endMs = Math.max(current.endMs, cue.endMs);
        const stripped = this.stripTags(cue.text);
        if (stripped) current.text = current.text ? `${current.text} ${stripped}` : stripped;
      } else {
        if (current.text) entries.push(current);
        current = {
          startMs: cue.startMs,
          endMs: cue.endMs,
          text: this.stripTags(cue.text),
        };
      }
    }
    if (current.text) entries.push(current);
    return entries;
  }

  generateTranscript(
    cues: SubtitleCue[],
    options: { gapThresholdMs: number },
  ): TranscriptEntry[] {
    return this.mergeCues(cues, options.gapThresholdMs);
  }

  writeExport(entries: TranscriptEntry[], format: 'txt' | 'json', filePath: string): void {
    // Same-directory tmp prevents EXDEV on cross-filesystem rename (e.g. save to external drive).
    const tmpPath = path.join(path.dirname(filePath), `${crypto.randomUUID()}.tmp`);
    const content =
      format === 'json'
        ? JSON.stringify(entries, null, 2)
        : entries.map((e) => e.text).join('\n\n');
    try {
      fs.writeFileSync(tmpPath, content, 'utf-8');
      fs.renameSync(tmpPath, filePath);
    } finally {
      try {
        fs.unlinkSync(tmpPath);
      } catch {
        // Already renamed or write never completed — no action needed.
      }
    }
  }
}

export const transcriptService = new TranscriptService();
