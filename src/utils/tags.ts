import type { ImageItem } from '../types';
import { compareStrings } from './images';

export type TagCount = {
  tag: string;
  count: number;
};

export const normalizeTagInput = (value: string) =>
  value.trim().replace(/\s+/g, ' ').toLowerCase();

export const normalizeTags = (tags: string[]) => {
  const unique = new Set<string>();
  for (const tag of tags) {
    const normalized = normalizeTagInput(tag);
    if (!normalized) continue;
    unique.add(normalized);
  }
  return Array.from(unique).sort(compareStrings);
};

export const buildTagCounts = (images: ImageItem[]) => {
  const counts = new Map<string, number>();
  for (const image of images) {
    for (const tag of image.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || compareStrings(a.tag, b.tag));
};
