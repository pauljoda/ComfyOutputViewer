import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch';

type ImageItem = {
  id: string;
  name: string;
  folder: string;
  url: string;
  thumbUrl?: string;
  favorite: boolean;
  hidden: boolean;
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

const emptyData: ApiResponse = {
  images: [],
  folders: [],
  sourceDir: '',
  dataDir: ''
};

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
  const [themeMode, setThemeMode] = useState<'system' | 'light' | 'dark'>(() => {
    const stored = window.localStorage.getItem('cov_theme');
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored;
    }
    return 'system';
  });
  const [tileSize, setTileSize] = useState<number>(() => {
    const stored = Number(window.localStorage.getItem('cov_tile_size'));
    return Number.isFinite(stored) && stored > 80 ? stored : 180;
  });
  const [tileFit, setTileFit] = useState<'cover' | 'contain'>(() => {
    const stored = window.localStorage.getItem('cov_tile_fit');
    return stored === 'contain' || stored === 'content' ? 'contain' : 'cover';
  });
  const [showLabels, setShowLabels] = useState<boolean>(() => {
    const stored = window.localStorage.getItem('cov_show_labels');
    return stored ? stored === 'true' : false;
  });
  const [denseGrid, setDenseGrid] = useState<boolean>(() => {
    const stored = window.localStorage.getItem('cov_dense_grid');
    return stored ? stored === 'true' : true;
  });
  const [hideHidden, setHideHidden] = useState<boolean>(() => {
    const stored = window.localStorage.getItem('cov_hide_hidden');
    return stored ? stored === 'true' : true;
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
    window.localStorage.setItem('cov_tile_size', String(tileSize));
  }, [tileSize]);

  useEffect(() => {
    window.localStorage.setItem('cov_tile_fit', tileFit);
  }, [tileFit]);

  useEffect(() => {
    window.localStorage.setItem('cov_show_labels', String(showLabels));
  }, [showLabels]);

  useEffect(() => {
    window.localStorage.setItem('cov_dense_grid', String(denseGrid));
  }, [denseGrid]);

  useEffect(() => {
    window.localStorage.setItem('cov_hide_hidden', String(hideHidden));
  }, [hideHidden]);

  const folders = useMemo(() => {
    const base = data.folders.filter((folder) => folder.length > 0).sort();
    return base;
  }, [data.folders]);

  const filteredImages = useMemo(() => {
    let result = data.images.slice().sort((a, b) => b.mtimeMs - a.mtimeMs);
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
  }, [data.images, favoritesOnly, selectedFolder, hideHidden]);

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
    <div className="app">
      <header className="top-bar">
        <div className="top-row">
          <div className="brand">
            <div className="title">Comfy Output Viewer</div>
            <div className="subtitle">{data.sourceDir || 'No source configured'}</div>
          </div>

          <div className="toolbar">
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

            <div className="folder-pill" title={currentFolderLabel}>
              {currentFolderLabel}
            </div>
          </div>
        </div>

        {activeTool && (
          <div className="tool-popover" role="dialog" aria-label="Tool options">
            {activeTool === 'view' && (
              <div className="tool-panel">
                <label className="control">
                  <span>Tile size ({tileSize}px)</span>
                  <input
                    type="range"
                    min={110}
                    max={280}
                    value={tileSize}
                    onChange={(event) => setTileSize(Number(event.target.value))}
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

                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={denseGrid}
                    onChange={(event) => setDenseGrid(event.target.checked)}
                  />
                  <span>Dense grid</span>
                </label>

                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={showLabels}
                    onChange={(event) => setShowLabels(event.target.checked)}
                  />
                  <span>Show labels</span>
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
        className={`gallery ${denseGrid ? 'dense' : 'spacious'} ${
          tileFit === 'contain' ? 'content-fit' : ''
        }`}
        style={{ '--tile-size': `${tileSize}px` } as React.CSSProperties}
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
              {showLabels && (
                <div className="name" title={image.name}>
                  {image.name}
                </div>
              )}
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

              </>
            )}
          </TransformWrapper>
        </div>
      )}
    </div>
  );
}
