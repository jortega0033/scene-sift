import { describe, expect, it } from 'vitest';
import {
  formatCueCount,
  formatSubtitleDuration,
  formatSubtitleError,
  SUBTITLE_ERROR_MESSAGES,
} from '@renderer/features/projects/subtitleFormatters';

describe('formatCueCount', () => {
  it('returns — for null', () => {
    expect(formatCueCount(null)).toBe('—');
  });

  it('uses singular for 1 cue', () => {
    expect(formatCueCount(1)).toBe('1 cue');
  });

  it('uses plural for 0 cues', () => {
    expect(formatCueCount(0)).toBe('0 cues');
  });

  it('uses plural for many cues', () => {
    expect(formatCueCount(842)).toBe('842 cues');
  });
});

describe('formatSubtitleDuration', () => {
  it('returns — for null', () => {
    expect(formatSubtitleDuration(null)).toBe('—');
  });

  it('formats M:SS when under one hour', () => {
    expect(formatSubtitleDuration(65_000)).toBe('1:05');
  });

  it('formats H:MM:SS when one hour or more', () => {
    expect(formatSubtitleDuration(3_661_000)).toBe('1:01:01');
  });

  it('formats 0:00 for zero ms', () => {
    expect(formatSubtitleDuration(0)).toBe('0:00');
  });

  it('pads seconds with leading zero', () => {
    expect(formatSubtitleDuration(9_000)).toBe('0:09');
  });

  it('handles exactly one hour', () => {
    expect(formatSubtitleDuration(3_600_000)).toBe('1:00:00');
  });
});

describe('formatSubtitleError', () => {
  it('returns "Unknown subtitle error." for null', () => {
    expect(formatSubtitleError(null)).toBe('Unknown subtitle error.');
  });

  it('maps SUBTITLE_FILE_NOT_FOUND', () => {
    expect(formatSubtitleError('SUBTITLE_FILE_NOT_FOUND')).toBe(
      SUBTITLE_ERROR_MESSAGES['SUBTITLE_FILE_NOT_FOUND'],
    );
  });

  it('maps SUBTITLE_FILE_TOO_LARGE', () => {
    expect(formatSubtitleError('SUBTITLE_FILE_TOO_LARGE')).toBe(
      SUBTITLE_ERROR_MESSAGES['SUBTITLE_FILE_TOO_LARGE'],
    );
  });

  it('maps SUBTITLE_UNSUPPORTED_FORMAT', () => {
    expect(formatSubtitleError('SUBTITLE_UNSUPPORTED_FORMAT')).toBe(
      SUBTITLE_ERROR_MESSAGES['SUBTITLE_UNSUPPORTED_FORMAT'],
    );
  });

  it('maps SUBTITLE_PARSE_ERROR', () => {
    expect(formatSubtitleError('SUBTITLE_PARSE_ERROR')).toBe(
      SUBTITLE_ERROR_MESSAGES['SUBTITLE_PARSE_ERROR'],
    );
  });

  it('returns fallback for unknown code', () => {
    expect(formatSubtitleError('UNKNOWN_CODE')).toBe('Subtitle error (UNKNOWN_CODE).');
  });

  it('does not expose raw error codes to caller', () => {
    const msg = formatSubtitleError('SUBTITLE_PARSE_ERROR');
    expect(msg).not.toBe('SUBTITLE_PARSE_ERROR');
    expect(msg.length).toBeGreaterThan(10);
  });
});
