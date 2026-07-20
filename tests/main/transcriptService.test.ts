// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { TranscriptService } from '@main/services/transcript/transcriptService';
import type { SubtitleCue } from '@shared/schemas/subtitle';

function makeCue(
  index: number,
  startMs: number,
  endMs: number,
  text: string,
): SubtitleCue {
  return { index, startMs, endMs, text };
}

describe('TranscriptService', () => {
  let service: TranscriptService;

  beforeEach(() => {
    service = new TranscriptService();
  });

  describe('stripTags', () => {
    it('removes HTML-style tags', () => {
      expect(service.stripTags('<i>Hello</i>')).toBe('Hello');
    });

    it('removes ASS-style curly-brace tags', () => {
      expect(service.stripTags('{\\an8}Hello')).toBe('Hello');
    });

    it('removes multiple tags in one string', () => {
      expect(service.stripTags('<b>Hello</b> <i>world</i>')).toBe('Hello world');
    });

    it('preserves bare inequality operators', () => {
      expect(service.stripTags('a < b and b > a')).toBe('a < b and b > a');
    });

    it('collapses internal whitespace', () => {
      expect(service.stripTags('Hello   <i>  </i>  world')).toBe('Hello world');
    });

    it('returns empty string for tag-only input', () => {
      expect(service.stripTags('<i></i>')).toBe('');
    });

    it('handles empty string', () => {
      expect(service.stripTags('')).toBe('');
    });

    it('removes HTML underline tags', () => {
      expect(service.stripTags('<u>hello</u>')).toBe('hello');
    });

    it('removes font color tags', () => {
      expect(service.stripTags('<font color="red">hello</font>')).toBe('hello');
    });

    it('removes WebVTT voice tags', () => {
      expect(service.stripTags('<v John>hello</v>')).toBe('hello');
    });

    it('removes WebVTT class tags', () => {
      expect(service.stripTags('<c.loud>hello</c>')).toBe('hello');
    });

    it('handles malformed tag without closing bracket — does not crash', () => {
      // regex requires closing > — unclosed tag preserved as-is, no crash, no hang
      expect(service.stripTags('<b hello')).toBe('<b hello');
    });
  });

  describe('mergeCues', () => {
    it('returns empty array for empty input', () => {
      expect(service.mergeCues([], 500)).toEqual([]);
    });

    it('returns single entry for single cue', () => {
      const result = service.mergeCues([makeCue(0, 0, 2000, 'Hello')], 500);
      expect(result).toHaveLength(1);
      expect(result[0]?.text).toBe('Hello');
    });

    it('merges consecutive cues within gap threshold', () => {
      const cues = [
        makeCue(0, 0, 1000, 'Hello'),
        makeCue(1, 1200, 2200, 'world'),
      ];
      const result = service.mergeCues(cues, 500);
      expect(result).toHaveLength(1);
      expect(result[0]?.text).toBe('Hello world');
      expect(result[0]?.startMs).toBe(0);
      expect(result[0]?.endMs).toBe(2200);
    });

    it('splits cues with gap exceeding threshold', () => {
      const cues = [
        makeCue(0, 0, 1000, 'Hello'),
        makeCue(1, 2500, 3500, 'world'),
      ];
      const result = service.mergeCues(cues, 500);
      expect(result).toHaveLength(2);
      expect(result[0]?.text).toBe('Hello');
      expect(result[1]?.text).toBe('world');
    });

    it('merges exactly at gap threshold boundary', () => {
      const cues = [
        makeCue(0, 0, 1000, 'Hello'),
        makeCue(1, 1500, 2500, 'world'),
      ];
      const result = service.mergeCues(cues, 500);
      expect(result).toHaveLength(1);
    });

    it('splits one past threshold boundary', () => {
      const cues = [
        makeCue(0, 0, 1000, 'Hello'),
        makeCue(1, 1501, 2501, 'world'),
      ];
      const result = service.mergeCues(cues, 500);
      expect(result).toHaveLength(2);
    });

    it('handles overlapping cues (negative gap) by merging', () => {
      const cues = [
        makeCue(0, 0, 2000, 'Hello'),
        makeCue(1, 1000, 3000, 'world'),
      ];
      const result = service.mergeCues(cues, 500);
      expect(result).toHaveLength(1);
      expect(result[0]?.endMs).toBe(3000);
      expect(result[0]?.text).toBe('Hello world');
    });

    it('extends endMs to max when merging overlapping cues', () => {
      const cues = [
        makeCue(0, 0, 5000, 'Hello'),
        makeCue(1, 1000, 2000, 'world'),
      ];
      const result = service.mergeCues(cues, 500);
      expect(result[0]?.endMs).toBe(5000);
    });

    it('skips empty-text cues after tag stripping', () => {
      const cues = [
        makeCue(0, 0, 1000, '<i></i>'),
        makeCue(1, 100, 2000, 'Hello'),
      ];
      const result = service.mergeCues(cues, 500);
      expect(result).toHaveLength(1);
      expect(result[0]?.text).toBe('Hello');
    });

    it('strips tags from all cue text', () => {
      const cues = [
        makeCue(0, 0, 2000, '<b>Hello</b>'),
        makeCue(1, 2200, 4000, '{\\an8}world'),
      ];
      const result = service.mergeCues(cues, 500);
      expect(result[0]?.text).toBe('Hello world');
    });

    it('handles gapThresholdMs=0 (only merges overlapping)', () => {
      const cues = [
        makeCue(0, 0, 1000, 'A'),
        makeCue(1, 1000, 2000, 'B'),
        makeCue(2, 3000, 4000, 'C'),
      ];
      const result = service.mergeCues(cues, 0);
      expect(result).toHaveLength(2);
    });

    it('merges many cues into one when gap small', () => {
      const cues = Array.from({ length: 10 }, (_, i) =>
        makeCue(i, i * 500, i * 500 + 400, `word${i}`),
      );
      const result = service.mergeCues(cues, 500);
      expect(result).toHaveLength(1);
    });
  });

  describe('generateTranscript', () => {
    it('delegates to mergeCues', () => {
      const cues = [makeCue(0, 0, 2000, 'Hello'), makeCue(1, 3000, 5000, 'world')];
      const result = service.generateTranscript(cues, { gapThresholdMs: 500 });
      expect(result).toHaveLength(2);
    });
  });

  describe('writeExport', () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'transcript-test-'));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('writes txt format — entries joined by double newline', () => {
      const entries = [
        { startMs: 0, endMs: 2000, text: 'Hello' },
        { startMs: 3000, endMs: 5000, text: 'world' },
      ];
      const outPath = path.join(tmpDir, 'transcript.txt');
      service.writeExport(entries, 'txt', outPath);
      const content = fs.readFileSync(outPath, 'utf-8');
      expect(content).toBe('Hello\n\nworld');
    });

    it('writes json format — valid JSON array', () => {
      const entries = [{ startMs: 0, endMs: 2000, text: 'Hello' }];
      const outPath = path.join(tmpDir, 'transcript.json');
      service.writeExport(entries, 'json', outPath);
      const parsed = JSON.parse(fs.readFileSync(outPath, 'utf-8'));
      expect(parsed).toEqual(entries);
    });

    it('writes atomically — no tmp file left after success', () => {
      const entries = [{ startMs: 0, endMs: 2000, text: 'Hello' }];
      const outPath = path.join(tmpDir, 'out.txt');
      service.writeExport(entries, 'txt', outPath);
      const files = fs.readdirSync(tmpDir);
      expect(files).toEqual(['out.txt']);
    });

    it('uses same directory as output for tmp — no EXDEV risk', () => {
      const subDir = path.join(tmpDir, 'subdir');
      fs.mkdirSync(subDir);
      const outPath = path.join(subDir, 'transcript.txt');
      service.writeExport([], 'txt', outPath);
      expect(fs.existsSync(outPath)).toBe(true);
    });
  });
});
