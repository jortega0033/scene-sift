// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parseVtt } from '@main/services/subtitle/parsers/VttParser';

describe('parseVtt', () => {
  it('parses minimal valid VTT with one cue', () => {
    const content = 'WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHello world\n';
    const result = parseVtt(content);
    expect(result.cues).toHaveLength(1);
    expect(result.cues[0].startMs).toBe(1000);
    expect(result.cues[0].endMs).toBe(2000);
    expect(result.cues[0].text).toBe('Hello world');
    expect(result.warnings).toHaveLength(0);
  });

  it('throws SUBTITLE_INVALID_FORMAT if no WEBVTT header', () => {
    expect(() => parseVtt('00:00:01.000 --> 00:00:02.000\nText')).toThrow('SUBTITLE_INVALID_FORMAT');
  });

  it('parses short timestamp format MM:SS.mmm', () => {
    const content = 'WEBVTT\n\n01:30.000 --> 02:00.000\nShort\n';
    const result = parseVtt(content);
    expect(result.cues[0].startMs).toBe(90_000);
    expect(result.cues[0].endMs).toBe(120_000);
  });

  it('strips HTML-like tags from cue text', () => {
    const content = 'WEBVTT\n\n00:00:01.000 --> 00:00:02.000\n<b>Bold</b>\n';
    const result = parseVtt(content);
    expect(result.cues[0].text).toBe('Bold');
  });

  it('strips VTT timestamp tags from cue text', () => {
    const content = 'WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nWord<00:00:01.500>two\n';
    const result = parseVtt(content);
    expect(result.cues[0].text).not.toContain('<');
  });

  it('skips NOTE blocks', () => {
    const content = 'WEBVTT\n\nNOTE This is a comment\n\n00:00:01.000 --> 00:00:02.000\nReal cue\n';
    const result = parseVtt(content);
    expect(result.cues).toHaveLength(1);
    expect(result.cues[0].text).toBe('Real cue');
  });

  it('emits UNSUPPORTED_VTT_FEATURE once for STYLE blocks', () => {
    const content =
      'WEBVTT\n\nSTYLE\n::cue { color: red }\n\n00:00:01.000 --> 00:00:02.000\nCue\n';
    const result = parseVtt(content);
    const styleWarnings = result.warnings.filter((w) => w.code === 'UNSUPPORTED_VTT_FEATURE');
    expect(styleWarnings).toHaveLength(1);
    expect(result.cues).toHaveLength(1);
  });

  it('emits UNSUPPORTED_VTT_FEATURE once for REGION blocks', () => {
    const content =
      'WEBVTT\n\nREGION\nid:foo\n\n00:00:01.000 --> 00:00:02.000\nCue\n';
    const result = parseVtt(content);
    const regionWarnings = result.warnings.filter((w) => w.code === 'UNSUPPORTED_VTT_FEATURE');
    expect(regionWarnings).toHaveLength(1);
  });

  it('emits UNSUPPORTED_VTT_FEATURE at most once for multiple STYLE blocks', () => {
    const content = [
      'WEBVTT',
      '',
      'STYLE\n::cue { color: red }',
      '',
      'STYLE\n::cue(b) { color: blue }',
      '',
      '00:00:01.000 --> 00:00:02.000\nCue',
    ].join('\n');
    const result = parseVtt(content);
    expect(result.warnings.filter((w) => w.code === 'UNSUPPORTED_VTT_FEATURE')).toHaveLength(1);
  });

  it('parses multiple cues', () => {
    const content = [
      'WEBVTT',
      '',
      '00:00:01.000 --> 00:00:02.000\nFirst',
      '',
      '00:00:03.000 --> 00:00:04.000\nSecond',
    ].join('\n');
    const result = parseVtt(content);
    expect(result.cues).toHaveLength(2);
  });

  it('emits EMPTY_CUE_TEXT warning for blank cues', () => {
    const content = 'WEBVTT\n\n00:00:01.000 --> 00:00:02.000\n<b></b>\n';
    const result = parseVtt(content);
    expect(result.warnings.some((w) => w.code === 'EMPTY_CUE_TEXT')).toBe(true);
  });

  it('emits CUE_TEXT_TRUNCATED for text exceeding MAX_CUE_TEXT', () => {
    const longText = 'x'.repeat(3000);
    const content = `WEBVTT\n\n00:00:01.000 --> 00:00:02.000\n${longText}\n`;
    const result = parseVtt(content);
    expect(result.cues[0].text.length).toBeLessThanOrEqual(2048);
    expect(result.warnings.some((w) => w.code === 'CUE_TEXT_TRUNCATED')).toBe(true);
  });

  it('emits RECOVERABLE_TIMESTAMP_ERROR for malformed timestamp', () => {
    const content =
      'WEBVTT\n\nbad --> also-bad\nSkipped\n\n00:00:01.000 --> 00:00:02.000\nGood\n';
    const result = parseVtt(content);
    expect(result.cues).toHaveLength(1);
    expect(result.warnings.some((w) => w.code === 'RECOVERABLE_TIMESTAMP_ERROR')).toBe(true);
  });

  it('handles WEBVTT header with description on same line', () => {
    const content = 'WEBVTT - optional description\n\n00:00:01.000 --> 00:00:02.000\nHello\n';
    const result = parseVtt(content);
    expect(result.cues).toHaveLength(1);
  });

  it('handles cue identifiers before timestamp line', () => {
    const content = 'WEBVTT\n\ncue-1\n00:00:01.000 --> 00:00:02.000\nHello\n';
    const result = parseVtt(content);
    expect(result.cues).toHaveLength(1);
    expect(result.cues[0].text).toBe('Hello');
  });

  it('emits CUES_TRUNCATED and caps output at 10,000 cues', () => {
    const lines = ['WEBVTT', ''];
    for (let i = 1; i <= 10_001; i++) {
      lines.push(`00:00:01.000 --> 00:00:02.000\nCue ${i}`, '');
    }
    const content = lines.join('\n');
    const result = parseVtt(content);
    expect(result.cues).toHaveLength(10_000);
    expect(result.warnings.some((w) => w.code === 'CUES_TRUNCATED')).toBe(true);
  });

  it('throws SUBTITLE_INVALID_FORMAT for invalid char immediately after WEBVTT magic bytes', () => {
    expect(() => parseVtt('WEBVTTx\n\n00:00:01.000 --> 00:00:02.000\nText')).toThrow(
      'SUBTITLE_INVALID_FORMAT',
    );
  });
});
