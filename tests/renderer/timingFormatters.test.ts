import { describe, it, expect } from 'vitest';
import { msToTimingString } from '@renderer/features/projects/timingFormatters';

describe('msToTimingString', () => {
  it('formats hours when present', () => {
    expect(msToTimingString(5_025_678)).toBe('1:23:45.678');
  });

  it('formats minutes without hours', () => {
    expect(msToTimingString(1_425_678)).toBe('23:45.678');
  });

  it('formats sub-minute value', () => {
    expect(msToTimingString(45_678)).toBe('0:45.678');
  });

  it('formats zero', () => {
    expect(msToTimingString(0)).toBe('0:00.000');
  });

  it('floors fractional ms input', () => {
    expect(msToTimingString(1000.9)).toBe('0:01.000');
  });

  it('clamps negative input to zero', () => {
    expect(msToTimingString(-500)).toBe('0:00.000');
  });

  it('pads milliseconds to 3 digits', () => {
    expect(msToTimingString(1_001)).toBe('0:01.001');
  });

  it('pads seconds to 2 digits', () => {
    expect(msToTimingString(60_001)).toBe('1:00.001');
  });

  it('formats exactly 1 hour', () => {
    expect(msToTimingString(3_600_000)).toBe('1:00:00.000');
  });
});
