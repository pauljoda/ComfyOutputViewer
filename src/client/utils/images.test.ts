import { describe, expect, it } from 'vitest';
import { buildImageUrl, filterImages, isSortMode, sortImages } from './images';
import type { ImageItem } from '../types';

const images: ImageItem[] = [
  {
    id: 'a',
    name: 'A',
    url: '/a',
    favorite: true,
    hidden: false,
    rating: 5,
    tags: ['portrait'],
    createdMs: 100,
    mtimeMs: 100,
    size: 10
  },
  {
    id: 'b',
    name: 'B',
    url: '/b',
    favorite: false,
    hidden: true,
    rating: 2,
    tags: [],
    createdMs: 200,
    mtimeMs: 200,
    size: 20
  },
  {
    id: 'c',
    name: 'C',
    url: '/c',
    favorite: false,
    hidden: false,
    rating: 1,
    tags: ['portrait', 'night'],
    createdMs: 150,
    mtimeMs: 150,
    size: 5
  }
];

describe('image utils', () => {
  it('validates supported sort modes', () => {
    expect(isSortMode('created-desc')).toBe(true);
    expect(isSortMode('nope')).toBe(false);
  });

  it('sorts images by selected mode', () => {
    const sorted = sortImages(images, 'size-asc');
    expect(sorted.map((image) => image.id)).toEqual(['c', 'a', 'b']);
  });

  it('filters by tags/favorite/rating/hidden rules', () => {
    const filteredByTag = filterImages(images, {
      selectedTags: ['portrait'],
      showUntagged: false,
      favoritesOnly: false,
      hideHidden: false,
      minRating: 0,
      maxRating: 5
    });
    expect(filteredByTag.map((image) => image.id)).toEqual(['a', 'c']);

    const favoritesAndRating = filterImages(images, {
      selectedTags: [],
      showUntagged: false,
      favoritesOnly: true,
      hideHidden: true,
      minRating: 4,
      maxRating: 5
    });
    expect(favoritesAndRating.map((image) => image.id)).toEqual(['a']);

    const untagged = filterImages(images, {
      selectedTags: ['portrait'],
      showUntagged: true,
      favoritesOnly: false,
      hideHidden: false,
      minRating: 0,
      maxRating: 5
    });
    expect(untagged.map((image) => image.id)).toEqual(['b']);
  });

  it('builds image urls safely for reserved path characters', () => {
    expect(buildImageUrl('folder name/a#b?c%.png')).toBe('/images/folder%20name/a%23b%3Fc%25.png');
  });
});
