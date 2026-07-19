import { describe, expect, it } from 'vitest';
import {
  formatBitRate,
  formatDuration,
  formatFileSize,
  formatInspectionError,
} from '@renderer/features/projects/mediaFormatters';

describe('formatDuration', () => {
  it('returns — for null', () => {
    expect(formatDuration(null)).toBe('—');
  });

  it('formats 0 seconds', () => {
    expect(formatDuration(0)).toBe('0:00');
  });

  it('formats seconds under one minute', () => {
    expect(formatDuration(45)).toBe('0:45');
  });

  it('formats MM:SS for values under one hour', () => {
    expect(formatDuration(65)).toBe('1:05');
    expect(formatDuration(125)).toBe('2:05');
  });

  it('formats HH:MM:SS for values one hour or more', () => {
    expect(formatDuration(3661)).toBe('1:01:01');
    expect(formatDuration(7200)).toBe('2:00:00');
  });

  it('floors fractional seconds', () => {
    expect(formatDuration(2847.6)).toBe('47:27');
  });
});

describe('formatFileSize', () => {
  it('returns — for null', () => {
    expect(formatFileSize(null)).toBe('—');
  });

  it('formats bytes', () => {
    expect(formatFileSize(500)).toBe('500 B');
  });

  it('formats kilobytes', () => {
    expect(formatFileSize(2048)).toBe('2.0 KB');
  });

  it('formats megabytes', () => {
    expect(formatFileSize(2_097_152)).toBe('2.0 MB');
  });

  it('formats gigabytes', () => {
    expect(formatFileSize(1_073_741_824)).toBe('1.0 GB');
  });

  it('formats terabytes', () => {
    expect(formatFileSize(1_099_511_627_776)).toBe('1.0 TB');
  });

  it('uses 1024 thresholds', () => {
    expect(formatFileSize(1_048_575)).toBe('1024.0 KB');
    expect(formatFileSize(1_048_576)).toBe('1.0 MB');
  });
});

describe('formatBitRate', () => {
  it('returns — for null', () => {
    expect(formatBitRate(null)).toBe('—');
  });

  it('formats bps', () => {
    expect(formatBitRate(500)).toBe('500 bps');
  });

  it('formats Kbps', () => {
    expect(formatBitRate(5_000)).toBe('5 Kbps');
  });

  it('formats Mbps', () => {
    expect(formatBitRate(8_500_000)).toBe('8.5 Mbps');
  });

  it('uses 1000 thresholds', () => {
    expect(formatBitRate(999)).toBe('999 bps');
    expect(formatBitRate(1_000)).toBe('1 Kbps');
    expect(formatBitRate(999_999)).toBe('1000 Kbps');
    expect(formatBitRate(1_000_000)).toBe('1.0 Mbps');
  });
});

describe('formatInspectionError', () => {
  it('translates FILE_NOT_FOUND', () => {
    expect(formatInspectionError('FILE_NOT_FOUND')).toBe(
      'Video file not found at the specified path.',
    );
  });

  it('translates FFPROBE_ERROR', () => {
    expect(formatInspectionError('FFPROBE_ERROR')).toBe(
      'Media analysis failed. Check that the video file is valid.',
    );
  });

  it('translates PARSE_ERROR', () => {
    expect(formatInspectionError('PARSE_ERROR')).toBe(
      'Could not read media information from the file.',
    );
  });

  it('translates NO_VIDEO_STREAM', () => {
    expect(formatInspectionError('NO_VIDEO_STREAM')).toBe('No video stream found in the file.');
  });

  it('falls back for unknown code', () => {
    expect(formatInspectionError('UNKNOWN_CODE')).toBe('Inspection failed (UNKNOWN_CODE).');
  });
});
