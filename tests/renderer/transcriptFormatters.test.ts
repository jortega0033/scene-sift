import { describe, it, expect } from 'vitest';
import {
  formatTimestamp,
  entriesToTxt,
  entriesToJson,
} from '@renderer/features/transcript/transcriptFormatters';

describe('transcriptFormatters', () => {
  describe('formatTimestamp', () => {
    it('formats MM:SS when under one hour', () => {
      expect(formatTimestamp(65_000)).toBe('1:05');
    });

    it('formats H:MM:SS when one hour or more', () => {
      expect(formatTimestamp(3_661_000)).toBe('1:01:01');
    });

    it('formats 0:00 for zero', () => {
      expect(formatTimestamp(0)).toBe('0:00');
    });

    it('pads seconds', () => {
      expect(formatTimestamp(600_000)).toBe('10:00');
    });
  });

  describe('entriesToTxt', () => {
    it('joins entry texts with double newline', () => {
      const entries = [
        { startMs: 0, endMs: 2000, text: 'Hello' },
        { startMs: 3000, endMs: 5000, text: 'world' },
      ];
      expect(entriesToTxt(entries)).toBe('Hello\n\nworld');
    });

    it('returns empty string for empty array', () => {
      expect(entriesToTxt([])).toBe('');
    });
  });

  describe('entriesToJson', () => {
    it('serializes entries to pretty JSON', () => {
      const entries = [{ startMs: 0, endMs: 2000, text: 'Hello' }];
      const parsed = JSON.parse(entriesToJson(entries));
      expect(parsed).toEqual(entries);
    });
  });
});
