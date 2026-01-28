import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch';
import packageJson from '../package.json';

type ImageItem = {
  id: string;
  name: string;
  folder: string;
  url: string;
  thumbUrl?: string;
  favorite: boolean;
  hidden: boolean;
  createdMs: number;
  mtimeMs: number;
  size: number;
};

type ApiResponse = {
  images: ImageItem[];
  folders: string[];
  sourceDir: string;
  dataDir: string;
};

type SyncResponse = {
  copied: number;
  scanned: number;
  thumbnails?: number;
};

type SortMode =
  | 'created-desc'
  | 'created-asc'
  | 'modified-desc'
  | 'modified-asc'
  | 'name-asc'
  | 'name-desc'
  | 'size-desc'
  | 'size-asc';

const SORT_MODES: SortMode[] = [
  'created-desc',
  'created-asc',
  'modified-desc',
  'modified-asc',
  'name-asc',
  'name-desc',
  'size-desc',
  'size-asc'
];
const DEFAULT_SORT: SortMode = 'created-desc';

const emptyData: ApiResponse = {
  images: [],
  folders: [],
  sourceDir: '',
  dataDir: ''
};

const COLUMN_MIN = 1;
const COLUMN_MAX = 12;
const TILE_GAP = 12;
const TARGET_TILE_SIZE = 200;
const MIN_TILE_SIZE = 80;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const isSortMode = (value: string | null): value is SortMode =>
  value !== null && SORT_MODES.includes(value as SortMode);

const compareStrings = (a: string, b: string) =>
  a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

const getCreatedMs = (image: ImageItem) =>
  Number.isFinite(image.createdMs) && image.createdMs > 0 ? image.createdMs : image.mtimeMs;

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: {
      'Content-Type': 'application/json'
    },
    ...options
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export default function App() {
  const [data, setData] = useState<ApiResponse>(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [moveTarget, setMoveTarget] = useState<string>('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTool, setActiveTool] = useState<'view' | 'filters' | 'search' | null>(
    null
  );
  const [modalTool, setModalTool] = useState<'details' | null>(null);
  const [ratios, setRatios] = useState<Record<string, number>>({});
  const topBarRef = useRef<HTMLDivElement | null>(null);
  const galleryRef = useRef<HTMLDivElement | null>(null);
  const toolPopoverRef = useRef<HTMLDivElement | null>(null);
  const toolButtonsRef = useRef<HTMLDivElement | null>(null);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const [topBarHeight, setTopBarHeight] = useState(0);
  const [galleryWidth, setGalleryWidth] = useState(0);
  const [themeMode, setThemeMode] = useState<'system' | 'light' | 'dark'>(() => {
    const stored = window.localStorage.getItem('cov_theme');
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored;
    }
    return 'system';
  });
  const [columns, setColumns] = useState<number>(() => {
    const stored = Number(window.localStorage.getItem('cov_columns'));
    return Number.isFinite(stored) && stored >= COLUMN_MIN ? stored : 0;
  });
  const [tileFit, setTileFit] = useState<'cover' | 'contain'>(() => {
    const stored = window.localStorage.getItem('cov_tile_fit');
    return stored === 'contain' || stored === 'content' ? 'contain' : 'cover';
  });
  const [hideHidden, setHideHidden] = useState<boolean>(() => {
    const stored = window.localStorage.getItem('cov_hide_hidden');
    return stored ? stored === 'true' : true;
  });
  const [sortMode, setSortMode] = useState<SortMode>(() => {
    const stored = window.localStorage.getItem('cov_sort');
    return isSortMode(stored) ? stored : DEFAULT_SORT;
  });

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api<ApiResponse>('/api/images');
      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load images');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const element = topBarRef.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setTopBarHeight(Math.round(entry.contentRect.height));
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const element = galleryRef.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setGalleryWidth(Math.round(entry.contentRect.width));
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    window.localStorage.setItem('cov_theme', themeMode);
    const root = document.documentElement;
    const applyTheme = (mode: 'light' | 'dark') => {
      root.dataset.theme = mode;
    };

    if (themeMode === 'system') {
      const media = window.matchMedia('(prefers-color-scheme: dark)');
      applyTheme(media.matches ? 'dark' : 'light');
      const listener = (event: MediaQueryListEvent) => {
        applyTheme(event.matches ? 'dark' : 'light');
      };
      media.addEventListener('change', listener);
      return () => media.removeEventListener('change', listener);
    }

    applyTheme(themeMode);
  }, [themeMode]);

  useEffect(() => {
    window.localStorage.setItem('cov_tile_fit', tileFit);
  }, [tileFit]);

  useEffect(() => {
    window.localStorage.setItem('cov_hide_hidden', String(hideHidden));
  }, [hideHidden]);

  useEffect(() => {
    window.localStorage.setItem('cov_sort', sortMode);
  }, [sortMode]);

  const maxColumns = useMemo(() => {
    if (!galleryWidth) return COLUMN_MAX;
    const rawColumns = Math.floor((galleryWidth + TILE_GAP) / (MIN_TILE_SIZE + TILE_GAP));
    return clamp(rawColumns || COLUMN_MIN, COLUMN_MIN, COLUMN_MAX);
  }, [galleryWidth]);

  useEffect(() => {
    if (!galleryWidth || columns > 0) return;
    const rawColumns = Math.floor((galleryWidth + TILE_GAP) / (TARGET_TILE_SIZE + TILE_GAP));
    setColumns(clamp(rawColumns || COLUMN_MIN, COLUMN_MIN, COLUMN_MAX));
  }, [galleryWidth, columns]);

  useEffect(() => {
    if (columns > maxColumns) {
      setColumns(maxColumns);
    }
  }, [columns, maxColumns]);

  useEffect(() => {
    if (columns > 0) {
      window.localStorage.setItem('cov_columns', String(columns));
    }
  }, [columns]);

  const handleTopBarPointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (!activeTool) return;
    const target = event.target as Node;
    if (toolPopoverRef.current?.contains(target)) return;
    if (toolButtonsRef.current?.contains(target)) return;
    setActiveTool(null);
  };

  const folders = useMemo(() => {
    const base = data.folders.filter((folder) => folder.length > 0).sort();
    return base;
  }, [data.folders]);

  const filteredImages = useMemo(() => {
    let result = data.images.slice();
    if (selectedFolder) {
      result = result.filter((image) => image.folder === selectedFolder);
    }
    if (favoritesOnly) {
      result = result.filter((image) => image.favorite);
    }
    if (!selectedFolder && hideHidden) {
      result = result.filter((image) => !image.hidden);
    }
    const compareByName = (a: ImageItem, b: ImageItem) =>
      compareStrings(a.name, b.name) ||
      compareStrings(a.folder, b.folder) ||
      compareStrings(a.id, b.id);
    const sorters: Record<SortMode, (a: ImageItem, b: ImageItem) => number> = {
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
    result.sort(sorters[sortMode] ?? sorters[DEFAULT_SORT]);
    return result;
  }, [data.images, favoritesOnly, selectedFolder, hideHidden, sortMode]);

  const selectedIndex = selectedId
    ? filteredImages.findIndex((image) => image.id === selectedId)
    : -1;
  const selectedImage = selectedIndex >= 0 ? filteredImages[selectedIndex] : null;

  useEffect(() => {
    if (selectedImage) {
      setMoveTarget(selectedImage.folder || '');
      setModalTool(null);
    }
  }, [selectedImage]);

  const handleImageLoad = (id: string, element: HTMLImageElement) => {
    if (!element.naturalWidth || !element.naturalHeight) return;
    const nextRatio = Number((element.naturalWidth / element.naturalHeight).toFixed(3));
    setRatios((prev) => {
      if (prev[id] === nextRatio) return prev;
      return { ...prev, [id]: nextRatio };
    });
  };

  const handleToggleFavorite = async (image: ImageItem) => {
    const nextValue = !image.favorite;
    setData((prev) => ({
      ...prev,
      images: prev.images.map((item) =>
        item.id === image.id ? { ...item, favorite: nextValue } : item
      )
    }));
    try {
      await api('/api/favorite', {
        method: 'POST',
        body: JSON.stringify({ path: image.id, value: nextValue })
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update favorite');
    }
  };

  const handleToggleHidden = async (image: ImageItem) => {
    const nextValue = !image.hidden;
    setData((prev) => ({
      ...prev,
      images: prev.images.map((item) =>
        item.id === image.id ? { ...item, hidden: nextValue } : item
      )
    }));
    try {
      await api('/api/hidden', {
        method: 'POST',
        body: JSON.stringify({ path: image.id, value: nextValue })
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update hidden state');
    }
  };

  const handleCreateFolder = async () => {
    const name = window.prompt('New folder name (relative to current folder):');
    if (!name) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    const path = selectedFolder ? `${selectedFolder}/${trimmed}` : trimmed;
    try {
      await api('/api/folders', {
        method: 'POST',
        body: JSON.stringify({ path })
      });
      setStatus(`Created folder: ${path}`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create folder');
    }
  };

  const handleMoveSelected = async () => {
    if (!selectedImage) return;
    try {
      await api('/api/move', {
        method: 'POST',
        body: JSON.stringify({ path: selectedImage.id, targetFolder: moveTarget })
      });
      setStatus('Moved image');
      setSelectedId(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to move image');
    }
  };

  const handleSync = async () => {
    try {
      setStatus('Syncing from source...');
      const result = await api<SyncResponse>('/api/sync', { method: 'POST' });
      const thumbText =
        typeof result.thumbnails === 'number' ? `, ${result.thumbnails} thumbs` : '';
      setStatus(`Synced ${result.copied} files (scanned ${result.scanned}${thumbText}).`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync');
    }
  };

  useEffect(() => {
    if (!selectedImage) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedId(null);
      }
      if (event.key === 'ArrowLeft') {
        movePrev();
      }
      if (event.key === 'ArrowRight') {
        moveNext();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [selectedImage, selectedIndex, filteredImages]);

  const movePrev = () => {
    if (!filteredImages.length || selectedIndex < 0) return;
    const nextIndex = (selectedIndex - 1 + filteredImages.length) % filteredImages.length;
    setSelectedId(filteredImages[nextIndex].id);
  };

  const moveNext = () => {
    if (!filteredImages.length || selectedIndex < 0) return;
    const nextIndex = (selectedIndex + 1) % filteredImages.length;
    setSelectedId(filteredImages[nextIndex].id);
  };

  const currentFolderLabel = selectedFolder ? selectedFolder : 'Home';
  const toggleTool = (tool: 'view' | 'filters' | 'search') => {
    setActiveTool((current) => (current === tool ? null : tool));
  };
  const effectiveColumns = columns > 0 ? columns : COLUMN_MIN;
  const tileSize = useMemo(() => {
    if (!galleryWidth) return TARGET_TILE_SIZE;
    const totalGap = TILE_GAP * (effectiveColumns - 1);
    const available = Math.max(0, galleryWidth - totalGap);
    return Math.max(MIN_TILE_SIZE, Math.floor(available / effectiveColumns));
  }, [galleryWidth, effectiveColumns]);
  const getContentStyle = (image: ImageItem): React.CSSProperties | undefined => {
    if (tileFit !== 'contain') return undefined;
    const ratio = ratios[image.id];
    if (!ratio) {
      return { width: tileSize, height: tileSize };
    }
    const width = ratio >= 1 ? tileSize * ratio : tileSize;
    const height = ratio >= 1 ? tileSize : tileSize / ratio;
    return { width: Math.round(width), height: Math.round(height) };
  };

  return (
    <div
      className="app"
      style={{ '--top-bar-height': `${topBarHeight}px` } as React.CSSProperties}
    >
      <header className="top-bar" ref={topBarRef} onPointerDown={handleTopBarPointerDown}>
        <div className="top-row">
          <div className="brand">
            <div className="title">
              Comfy Output Viewer <span className="version">v{packageJson.version}</span>
            </div>
            <div className="subtitle">{data.sourceDir || 'No source configured'}</div>
          </div>
        </div>

        <div className="toolbar-row">
          <div className="toolbar" ref={toolbarRef}>
            <button
              className="tool-button"
              type="button"
              onClick={() => {
                setDrawerOpen(true);
                setActiveTool(null);
              }}
              aria-label="Open folders"
              title="Folders"
            >
              <span className="hamburger" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
            </button>

            <div className="folder-pill" title={currentFolderLabel}>
              {currentFolderLabel}
            </div>

            <div className="toolbar-actions" ref={toolButtonsRef}>
              <button
                className={activeTool === 'view' ? 'tool-button active' : 'tool-button'}
                type="button"
                onClick={() => toggleTool('view')}
                aria-label="View options"
                title="View"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M4 6h10m2 0h4M4 12h4m2 0h10M4 18h8m2 0h6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                  <circle cx="14" cy="6" r="2" fill="currentColor" />
                  <circle cx="8" cy="12" r="2" fill="currentColor" />
                  <circle cx="12" cy="18" r="2" fill="currentColor" />
                </svg>
              </button>

              <button
                className={activeTool === 'filters' ? 'tool-button active' : 'tool-button'}
                type="button"
                onClick={() => toggleTool('filters')}
                aria-label="Filters"
                title="Filters"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M4 5h16l-6.2 7.1v5.3l-3.6 1.6v-6.9z"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>

              <button
                className={activeTool === 'search' ? 'tool-button active' : 'tool-button'}
                type="button"
                onClick={() => toggleTool('search')}
                aria-label="Search"
                title="Search"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle
                    cx="10"
                    cy="10"
                    r="5.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                  />
                  <path
                    d="M14.5 14.5L20 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {activeTool && (
          <div
            className="tool-popover"
            role="dialog"
            aria-label="Tool options"
            ref={toolPopoverRef}
          >
            {activeTool === 'view' && (
              <div className="tool-panel">
                <label className="control">
                  <span>Columns ({effectiveColumns})</span>
                  <input
                    type="range"
                    min={COLUMN_MIN}
                    max={maxColumns}
                    value={effectiveColumns}
                    onChange={(event) => setColumns(Number(event.target.value))}
                  />
                </label>

                <label className="control">
                  <span>Display</span>
                  <select
                    value={tileFit}
                    onChange={(event) =>
                      setTileFit(event.target.value as 'cover' | 'contain')
                    }
                  >
                    <option value="cover">Cover</option>
                    <option value="contain">Content</option>
                  </select>
                </label>

                <label className="control">
                  <span>Sort</span>
                  <select
                    value={sortMode}
                    onChange={(event) => setSortMode(event.target.value as SortMode)}
                  >
                    <option value="created-desc">Created (newest)</option>
                    <option value="created-asc">Created (oldest)</option>
                    <option value="modified-desc">Modified (newest)</option>
                    <option value="modified-asc">Modified (oldest)</option>
                    <option value="name-asc">Name (A-Z)</option>
                    <option value="name-desc">Name (Z-A)</option>
                    <option value="size-desc">File size (largest)</option>
                    <option value="size-asc">File size (smallest)</option>
                  </select>
                </label>

                <label className="control">
                  <span>Theme</span>
                  <select
                    value={themeMode}
                    onChange={(event) =>
                      setThemeMode(event.target.value as 'system' | 'light' | 'dark')
                    }
                  >
                    <option value="system">System</option>
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                  </select>
                </label>
              </div>
            )}

            {activeTool === 'filters' && (
              <div className="tool-panel">
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={favoritesOnly}
                    onChange={(event) => setFavoritesOnly(event.target.checked)}
                  />
                  <span>Favorites only</span>
                </label>

                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={hideHidden}
                    onChange={(event) => setHideHidden(event.target.checked)}
                  />
                  <span>Hide hidden</span>
                </label>

                <div className="tool-hint">More filters coming soon.</div>
              </div>
            )}

            {activeTool === 'search' && (
              <div className="tool-panel">
                <div className="tool-hint">Search tools coming soon.</div>
              </div>
            )}
          </div>
        )}
      </header>

      {activeTool && (
        <div className="tool-scrim" aria-hidden="true" onClick={() => setActiveTool(null)} />
      )}

      <div className={drawerOpen ? 'drawer-scrim open' : 'drawer-scrim'} onClick={() => setDrawerOpen(false)} />
      <aside className={drawerOpen ? 'drawer open' : 'drawer'} role="navigation">
        <div className="drawer-header">
          <div>Folders</div>
          <button className="ghost" type="button" onClick={() => setDrawerOpen(false)}>
            Close
          </button>
        </div>
        <div className="drawer-actions">
          <button className="button" type="button" onClick={handleSync}>
            Sync
          </button>
          <button className="ghost" type="button" onClick={handleCreateFolder}>
            New Folder
          </button>
        </div>
        <div className="drawer-content">
          <button
            type="button"
            className={selectedFolder ? 'drawer-item' : 'drawer-item active'}
            onClick={() => {
              setSelectedFolder('');
              setDrawerOpen(false);
            }}
          >
            Home
          </button>
          {folders.map((folder) => (
            <button
              key={folder}
              type="button"
              className={selectedFolder === folder ? 'drawer-item active' : 'drawer-item'}
              onClick={() => {
                setSelectedFolder(folder);
                setDrawerOpen(false);
              }}
            >
              {folder}
            </button>
          ))}
        </div>
      </aside>

      <div className="status-bar">
        <div>
          {loading ? 'Loading images…' : `${filteredImages.length} images`}
        </div>
        <div className="status">
          {status}
          {error && <span className="error">{error}</span>}
        </div>
      </div>

      <main
        ref={galleryRef}
        className={`gallery ${tileFit === 'contain' ? 'content-fit' : ''}`}
        style={
          {
            '--tile-size': `${tileSize}px`,
            '--tile-columns': effectiveColumns
          } as React.CSSProperties
        }
      >
        {filteredImages.map((image) => (
          <button
            key={image.id}
            className={`card ${tileFit} ${image.hidden ? 'hidden' : ''}`}
            type="button"
            onClick={() => setSelectedId(image.id)}
            style={getContentStyle(image)}
          >
            <img
              src={image.thumbUrl || image.url}
              alt={image.name}
              loading="lazy"
              decoding="async"
              fetchPriority="low"
              onLoad={(event) => handleImageLoad(image.id, event.currentTarget)}
              onError={(event) => {
                if (!image.thumbUrl) return;
                const target = event.currentTarget;
                target.onerror = null;
                target.src = image.url;
              }}
            />
            <div className="card-overlay">
              <div className="card-actions">
                <button
                  className={image.favorite ? 'fav active' : 'fav'}
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleToggleFavorite(image);
                  }}
                  aria-label={image.favorite ? 'Unfavorite' : 'Favorite'}
                >
                  ★
                </button>
                <button
                  className={image.hidden ? 'hide active' : 'hide'}
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleToggleHidden(image);
                  }}
                  aria-label={image.hidden ? 'Unhide' : 'Hide'}
                >
                  {image.hidden ? 'Hidden' : 'Hide'}
                </button>
              </div>
            </div>
          </button>
        ))}
      </main>

      {selectedImage && (
        <div className="modal" role="dialog" aria-modal="true">
          <TransformWrapper
            initialScale={1}
            minScale={0.5}
            maxScale={6}
            centerOnInit
            centerZoomedOut
            limitToBounds={false}
            panning={{ velocityDisabled: true }}
            wheel={{ step: 0.2 }}
            pinch={{ step: 8 }}
            doubleClick={{ mode: 'zoomIn', step: 1 }}
          >
            {({ zoomIn, zoomOut, resetTransform }) => (
              <>
                <div className="modal-toolbar" onClick={(event) => event.stopPropagation()}>
                  <div className="modal-title">{selectedImage.name}</div>
                  <div className="modal-actions">
                    <button className="tool-button" type="button" onClick={movePrev} title="Previous">
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          d="M15 6l-6 6 6 6"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                    <button className="tool-button" type="button" onClick={moveNext} title="Next">
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          d="M9 6l6 6-6 6"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                    <button className="tool-button" type="button" onClick={zoomOut} title="Zoom out">
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          d="M5 12h14"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                        />
                      </svg>
                    </button>
                    <button className="tool-button" type="button" onClick={zoomIn} title="Zoom in">
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          d="M12 5v14M5 12h14"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                        />
                      </svg>
                    </button>
                    <button className="tool-button" type="button" onClick={resetTransform} title="Reset">
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          d="M8 6h4V2M8 6a8 8 0 1 0 2-2"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                    <button
                      className={selectedImage.favorite ? 'tool-button active' : 'tool-button'}
                      type="button"
                      onClick={() => handleToggleFavorite(selectedImage)}
                      title="Favorite"
                    >
                      ★
                    </button>
                    <button
                      className={selectedImage.hidden ? 'tool-button active' : 'tool-button'}
                      type="button"
                      onClick={() => handleToggleHidden(selectedImage)}
                      title="Hide"
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                        />
                        <path
                          d="M4 4l16 16"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                        />
                      </svg>
                    </button>
                    <button
                      className={modalTool === 'details' ? 'tool-button active' : 'tool-button'}
                      type="button"
                      onClick={() =>
                        setModalTool((current) => (current === 'details' ? null : 'details'))
                      }
                      title="Details"
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <circle cx="6" cy="12" r="1.6" fill="currentColor" />
                        <circle cx="12" cy="12" r="1.6" fill="currentColor" />
                        <circle cx="18" cy="12" r="1.6" fill="currentColor" />
                      </svg>
                    </button>
                    <button
                      className="tool-button"
                      type="button"
                      onClick={() => setSelectedId(null)}
                      title="Close"
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          d="M6 6l12 12M18 6l-12 12"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                        />
                      </svg>
                    </button>
                  </div>

                  {modalTool === 'details' && (
                    <div className="modal-tool-popover">
                      <div className="tool-panel">
                        <label className="control">
                          <span>Move to</span>
                          <select
                            value={moveTarget}
                            onChange={(event) => setMoveTarget(event.target.value)}
                          >
                            <option value="">Home</option>
                            {folders.map((folder) => (
                              <option key={folder} value={folder}>
                                {folder}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button className="button" type="button" onClick={handleMoveSelected}>
                          Move
                        </button>
                        <div className="hint">Pinch to zoom, drag to pan.</div>
                      </div>
                    </div>
                  )}
                </div>

                <div
                  className="modal-body"
                  onClick={(event) => {
                    const target = event.target as HTMLElement;
                    if (target.tagName !== 'IMG') {
                      setSelectedId(null);
                    }
                  }}
                >
                  <TransformComponent wrapperClass="zoom-wrapper" contentClass="zoom-content">
                    <img
                      className="modal-image"
                      src={selectedImage.url}
                      alt={selectedImage.name}
                    />
                  </TransformComponent>
                </div>
                <div className="modal-footer">
                  <div className="modal-filename" title={selectedImage.name}>
                    {selectedImage.name}
                  </div>
                </div>
              </>
            )}
          </TransformWrapper>
        </div>
      )}
    </div>
  );
}
