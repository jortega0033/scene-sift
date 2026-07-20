import { describe, it, expect } from 'vitest';
import { formatCueTime, formatPlayerTime } from '@renderer/features/preview/videoFormatters';

describe('formatCueTime', () => {
  it('formats zero ms', () => {
    expect(formatCueTime(0)).toBe('00:00:00.000');
  });

  it('formats milliseconds only', () => {
    expect(formatCueTime(432)).toBe('00:00:00.432');
  });

  it('formats seconds and ms', () => {
    expect(formatCueTime(65_432)).toBe('00:01:05.432');
  });

  it('formats hours, minutes, seconds, ms', () => {
    expect(formatCueTime(3_661_000)).toBe('01:01:01.000');
  });

  it('pads all components to correct width', () => {
    expect(formatCueTime(1_000)).toBe('00:00:01.000');
    expect(formatCueTime(60_000)).toBe('00:01:00.000');
    expect(formatCueTime(3_600_000)).toBe('01:00:00.000');
  });
});

describe('formatPlayerTime', () => {
  it('formats zero seconds as M:SS', () => {
    expect(formatPlayerTime(0)).toBe('0:00');
  });

  it('formats seconds under one minute', () => {
    expect(formatPlayerTime(45)).toBe('0:45');
  });

  it('formats MM:SS for values under one hour', () => {
    expect(formatPlayerTime(65)).toBe('1:05');
    expect(formatPlayerTime(125)).toBe('2:05');
  });

  it('formats H:MM:SS for values one hour or more', () => {
    expect(formatPlayerTime(3_661)).toBe('1:01:01');
    expect(formatPlayerTime(7_200)).toBe('2:00:00');
  });

  it('floors fractional seconds', () => {
    expect(formatPlayerTime(65.9)).toBe('1:05');
  });
});
