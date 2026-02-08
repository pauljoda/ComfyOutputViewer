import { describe, expect, it } from 'vitest';
import { buildTagCounts, normalizeTagInput, normalizeTags } from './tags';

describe('tag utils', () => {
  it('normalizes a single tag value', () => {
    expect(normalizeTagInput('  Night   Sky ')).toBe('night sky');
  });

  it('normalizes, deduplicates, and sorts tag arrays', () => {
    const result = normalizeTags([' Portrait ', 'portrait', 'night', '', 2]);
    expect(result).toEqual(['night', 'portrait']);
  });

  it('builds tag counts sorted by usage', () => {
    const counts = buildTagCounts([
      { id: '1', name: 'a', url: '/a', favorite: false, hidden: false, rating: 0, tags: ['night', 'portrait'], createdMs: 1, mtimeMs: 1, size: 1 },
      { id: '2', name: 'b', url: '/b', favorite: false, hidden: false, rating: 0, tags: ['portrait'], createdMs: 1, mtimeMs: 1, size: 1 },
      { id: '3', name: 'c', url: '/c', favorite: false, hidden: false, rating: 0, tags: [], createdMs: 1, mtimeMs: 1, size: 1 }
    ]);

    expect(counts).toEqual([
      { tag: 'portrait', count: 2 },
      { tag: 'night', count: 1 }
    ]);
  });
});
