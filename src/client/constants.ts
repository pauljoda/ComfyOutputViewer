export const COLUMN_MIN = 1;
export const COLUMN_MAX = 12;
export const TILE_GAP = 12;
export const TARGET_TILE_SIZE = 200;
export const MIN_TILE_SIZE = 80;

export const STORAGE_KEYS = {
  theme: 'cov_theme',
  columns: 'cov_columns',
  tileFit: 'cov_tile_fit',
  hideHidden: 'cov_hide_hidden',
  sort: 'cov_sort',
  ratingMin: 'cov_rating_min',
  ratingMax: 'cov_rating_max'
} as const;
