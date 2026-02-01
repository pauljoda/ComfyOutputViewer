import type { ImageItem } from '../types';
import { compareStrings } from './images';

export type TagCount = {
  tag: string;
  count: number;
};

export const normalizeTagInput = (value: string) =>
  value.trim().replace(/\s+/g, ' ').toLowerCase();

export const normalizeTags = (tags: unknown) => {
  if (!Array.isArray(tags)) return [];
  const unique = new Set<string>();
  for (const entry of tags) {
    if (typeof entry !== 'string') continue;
    const normalized = normalizeTagInput(entry);
    if (!normalized) continue;
    unique.add(normalized);
  }
  return Array.from(unique).sort(compareStrings);
};

export const buildTagCounts = (images: ImageItem[]) => {
  const counts = new Map<string, number>();
  for (const image of images) {
    // Tags are already normalized when loaded from the API, so we iterate
    // directly without re-normalizing. This ensures consistency across
    // all tag-related interfaces (TagDrawer, TopBar, ImageModal).
    const tags = Array.isArray(image.tags) ? image.tags : [];
    for (const tag of tags) {
      if (typeof tag === 'string' && tag.length > 0) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
  }
  return Array.from(counts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || compareStrings(a.tag, b.tag));
};
