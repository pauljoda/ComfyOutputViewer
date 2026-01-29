export type ImageItem = {
  id: string;
  name: string;
  url: string;
  thumbUrl?: string;
  favorite: boolean;
  hidden: boolean;
  rating: number;
  tags: string[];
  createdMs: number;
  mtimeMs: number;
  size: number;
};

export type ApiResponse = {
  images: ImageItem[];
  sourceDir: string;
  dataDir: string;
};

export type SyncResponse = {
  copied: number;
  scanned: number;
  thumbnails?: number;
};

export type DeleteResponse = {
  ok: boolean;
  deleted: number;
  blacklisted: number;
};

export type SortMode =
  | 'created-desc'
  | 'created-asc'
  | 'modified-desc'
  | 'modified-asc'
  | 'name-asc'
  | 'name-desc'
  | 'size-desc'
  | 'size-asc'
  | 'rating-desc'
  | 'rating-asc';

export type ToolPanel = 'view' | 'filters' | 'search';

export type ActiveTool = ToolPanel | null;

export type ModalTool = 'tags' | 'rating' | null;

export type ThemeMode = 'system' | 'light' | 'dark';

export type TileFit = 'cover' | 'contain';

export const SORT_MODES: SortMode[] = [
  'created-desc',
  'created-asc',
  'modified-desc',
  'modified-asc',
  'name-asc',
  'name-desc',
  'size-desc',
  'size-asc',
  'rating-desc',
  'rating-asc'
];

export const DEFAULT_SORT: SortMode = 'created-desc';
