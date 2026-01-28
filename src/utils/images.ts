import { DEFAULT_SORT, SortMode, type ImageItem } from '../types';

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const compareStrings = (a: string, b: string) =>
  a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

export const getCreatedMs = (image: ImageItem) =>
  Number.isFinite(image.createdMs) && image.createdMs > 0 ? image.createdMs : image.mtimeMs;

export const isSortMode = (value: string | null): value is SortMode =>
  value !== null && Object.prototype.hasOwnProperty.call(SORTERS, value);

const compareByName = (a: ImageItem, b: ImageItem) =>
  compareStrings(a.name, b.name) ||
  compareStrings(a.folder, b.folder) ||
  compareStrings(a.id, b.id);

const SORTERS: Record<SortMode, (a: ImageItem, b: ImageItem) => number> = {
  'created-desc': (a, b) => getCreatedMs(b) - getCreatedMs(a) || compareByName(a, b),
  'created-asc': (a, b) => getCreatedMs(a) - getCreatedMs(b) || compareByName(a, b),
  'modified-desc': (a, b) => b.mtimeMs - a.mtimeMs || compareByName(a, b),
  'modified-asc': (a, b) => a.mtimeMs - b.mtimeMs || compareByName(a, b),
  'name-asc': (a, b) => compareByName(a, b),
  'name-desc': (a, b) => {
    const nameCompare = compareByName(a, b);
    return nameCompare === 0 ? 0 : -nameCompare;
  },
  'size-desc': (a, b) => b.size - a.size || compareByName(a, b),
  'size-asc': (a, b) => a.size - b.size || compareByName(a, b)
};

export const sortImages = (images: ImageItem[], sortMode: SortMode) => {
  const sorted = images.slice();
  sorted.sort(SORTERS[sortMode] ?? SORTERS[DEFAULT_SORT]);
  return sorted;
};

export type ImageFilterOptions = {
  selectedFolder: string;
  favoritesOnly: boolean;
  hideHidden: boolean;
};

export const filterImages = (images: ImageItem[], options: ImageFilterOptions) => {
  const { selectedFolder, favoritesOnly, hideHidden } = options;
  let result = images.slice();
  if (selectedFolder) {
    result = result.filter((image) => image.folder === selectedFolder);
  }
  if (favoritesOnly) {
    result = result.filter((image) => image.favorite);
  }
  if (!selectedFolder && hideHidden) {
    result = result.filter((image) => !image.hidden);
  }
  return result;
};
