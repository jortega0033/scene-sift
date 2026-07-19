// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parseSrt } from '@main/services/subtitle/parsers/SrtParser';

describe('parseSrt', () => {
  it('parses minimal valid SRT with one cue', () => {
    const content = '1\n00:00:01,000 --> 00:00:02,000\nHello world\n';
    const result = parseSrt(content);
    expect(result.cues).toHaveLength(1);
    expect(result.cues[0].startMs).toBe(1000);
    expect(result.cues[0].endMs).toBe(2000);
    expect(result.cues[0].text).toBe('Hello world');
    expect(result.warnings).toHaveLength(0);
  });

  it('parses multi-line cue text', () => {
    const content = '1\n00:00:01,000 --> 00:00:02,000\nLine one\nLine two\n';
    const result = parseSrt(content);
    expect(result.cues[0].text).toContain('Line one');
    expect(result.cues[0].text).toContain('Line two');
  });

  it('parses multiple cues', () => {
    const content = [
      '1\n00:00:01,000 --> 00:00:02,000\nFirst',
      '2\n00:00:03,000 --> 00:00:04,000\nSecond',
    ].join('\n\n');
    const result = parseSrt(content);
    expect(result.cues).toHaveLength(2);
    expect(result.cues[1].text).toBe('Second');
  });

  it('strips HTML-like tags from cue text', () => {
    const content = '1\n00:00:01,000 --> 00:00:02,000\n<i>Italic</i> text\n';
    const result = parseSrt(content);
    expect(result.cues[0].text).toBe('Italic text');
  });

  it('does not strip tags longer than 128 chars (ReDoS guard)', () => {
    const longTag = '<' + 'x'.repeat(129) + '>';
    const content = `1\n00:00:01,000 --> 00:00:02,000\n${longTag}safe\n`;
    const result = parseSrt(content);
    expect(result.cues[0].text).toContain('safe');
  });

  it('handles optional index line (no number before timestamp)', () => {
    const content = '00:00:01,000 --> 00:00:02,000\nNo index\n';
    const result = parseSrt(content);
    expect(result.cues).toHaveLength(1);
    expect(result.cues[0].text).toBe('No index');
  });

  it('emits RECOVERABLE_TIMESTAMP_ERROR and skips cue with bad timestamp', () => {
    const content = [
      '1\n00:00:01,000 --> 00:00:02,000\nGood cue',
      '2\nbad-timestamp\nSkipped cue',
      '3\n00:00:05,000 --> 00:00:06,000\nAnother good',
    ].join('\n\n');
    const result = parseSrt(content);
    expect(result.cues).toHaveLength(2);
    expect(result.cues[0].text).toBe('Good cue');
    expect(result.cues[1].text).toBe('Another good');
    expect(result.warnings.some((w) => w.code === 'RECOVERABLE_TIMESTAMP_ERROR')).toBe(true);
  });

  it('emits EMPTY_CUE_TEXT for blank text after tag strip', () => {
    const content = '1\n00:00:01,000 --> 00:00:02,000\n<i></i>\n';
    const result = parseSrt(content);
    expect(result.warnings.some((w) => w.code === 'EMPTY_CUE_TEXT')).toBe(true);
  });

  it('emits CUE_TEXT_TRUNCATED and truncates text exceeding MAX_CUE_TEXT', () => {
    const longText = 'x'.repeat(3000);
    const content = `1\n00:00:01,000 --> 00:00:02,000\n${longText}\n`;
    const result = parseSrt(content);
    expect(result.cues[0].text.length).toBeLessThanOrEqual(2048);
    expect(result.warnings.some((w) => w.code === 'CUE_TEXT_TRUNCATED')).toBe(true);
  });

  it('handles CRLF line endings', () => {
    const content = '1\r\n00:00:01,000 --> 00:00:02,000\r\nHello\r\n';
    const result = parseSrt(content);
    expect(result.cues).toHaveLength(1);
    expect(result.cues[0].text).toBe('Hello');
  });

  it('strips BOM from content', () => {
    const content = '﻿1\n00:00:01,000 --> 00:00:02,000\nHello\n';
    const result = parseSrt(content);
    expect(result.cues).toHaveLength(1);
  });

  it('returns empty cues and no warnings for empty content', () => {
    const result = parseSrt('');
    expect(result.cues).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it('handles hours > 99 in timestamp (extended format)', () => {
    const content = '1\n100:00:01,000 --> 100:00:02,000\nLong video\n';
    const result = parseSrt(content);
    expect(result.cues).toHaveLength(1);
    expect(result.cues[0].startMs).toBe(360_001_000);
  });

  it('emits CUES_TRUNCATED and caps output at 10,000 cues', () => {
    const blocks: string[] = [];
    for (let i = 1; i <= 10_001; i++) {
      blocks.push(`${i}\n00:00:01,000 --> 00:00:02,000\nCue ${i}`);
    }
    const content = blocks.join('\n\n');
    const result = parseSrt(content);
    expect(result.cues).toHaveLength(10_000);
    expect(result.warnings.some((w) => w.code === 'CUES_TRUNCATED')).toBe(true);
  });

  it('parser passes through cue with equal startMs and endMs (zero-duration; normalizer adds warning)', () => {
    const content = '1\n00:00:01,000 --> 00:00:01,000\nZero duration\n';
    const result = parseSrt(content);
    expect(result.cues).toHaveLength(1);
    expect(result.cues[0].startMs).toBe(1000);
    expect(result.cues[0].endMs).toBe(1000);
    expect(result.warnings).toHaveLength(0);
  });
});
