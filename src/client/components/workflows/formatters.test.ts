import { describe, expect, it } from 'vitest';
import { formatBytes, formatDuration } from './formatters';

describe('workflow formatters', () => {
  it('formats durations as mm:ss', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(65_000)).toBe('1:05');
  });

  it('formats bytes with readable units', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1024)).toBe('1.00 KB');
    expect(formatBytes(1024 * 1024 * 3)).toBe('3.00 MB');
  });
});
