import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch';

type ImageItem = {
  id: string;
  name: string;
  folder: string;
  url: string;
  thumbUrl?: string;
  favorite: boolean;
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
  const [settingsOpen, setSettingsOpen] = useState(false);
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
    return stored === 'contain' ? 'contain' : 'cover';
  });
  const [showLabels, setShowLabels] = useState<boolean>(() => {
    const stored = window.localStorage.getItem('cov_show_labels');
    return stored ? stored === 'true' : false;
  });
  const [denseGrid, setDenseGrid] = useState<boolean>(() => {
    const stored = window.localStorage.getItem('cov_dense_grid');
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
    return result;
  }, [data.images, favoritesOnly, selectedFolder]);

  const selectedIndex = selectedId
    ? filteredImages.findIndex((image) => image.id === selectedId)
    : -1;
  const selectedImage = selectedIndex >= 0 ? filteredImages[selectedIndex] : null;

  useEffect(() => {
    if (selectedImage) {
      setMoveTarget(selectedImage.folder || '');
    }
  }, [selectedImage]);

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

  return (
    <div className="app">
      <header className="top-bar">
        <div className="brand">
          <div className="title">Comfy Output Viewer</div>
          <div className="subtitle">{data.sourceDir || 'No source configured'}</div>
        </div>

        <div className="controls">
          <label className="control">
            <span>Folder</span>
            <select
              value={selectedFolder}
              onChange={(event) => setSelectedFolder(event.target.value)}
            >
              <option value="">All</option>
              {folders.map((folder) => (
                <option key={folder} value={folder}>
                  {folder}
                </option>
              ))}
            </select>
          </label>

          <button className="button" type="button" onClick={handleCreateFolder}>
            New Folder
          </button>

          <button className="button" type="button" onClick={handleSync}>
            Sync
          </button>

          <label className="toggle">
            <input
              type="checkbox"
              checked={favoritesOnly}
              onChange={(event) => setFavoritesOnly(event.target.checked)}
            />
            <span>Favorites only</span>
          </label>

          <button
            className="ghost"
            type="button"
            onClick={() => setSettingsOpen((open) => !open)}
          >
            Settings
          </button>
        </div>
      </header>

      {settingsOpen && (
        <section className="settings-panel">
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
            <span>Image fit</span>
            <select
              value={tileFit}
              onChange={(event) => setTileFit(event.target.value as 'cover' | 'contain')}
            >
              <option value="cover">Cover</option>
              <option value="contain">Contain</option>
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
        </section>
      )}

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
        className={`gallery ${denseGrid ? 'dense' : 'spacious'}`}
        style={{ '--tile-size': `${tileSize}px` } as React.CSSProperties}
      >
        {filteredImages.map((image) => (
          <button
            key={image.id}
            className={`card ${tileFit}`}
            type="button"
            onClick={() => setSelectedId(image.id)}
          >
            <img
              src={image.thumbUrl || image.url}
              alt={image.name}
              loading="lazy"
              decoding="async"
              fetchPriority="low"
              onError={(event) => {
                if (!image.thumbUrl) return;
                const target = event.currentTarget;
                target.onerror = null;
                target.src = image.url;
              }}
            />
            <div className="card-overlay">
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
                    <button className="ghost" type="button" onClick={movePrev}>
                      Prev
                    </button>
                    <button className="ghost" type="button" onClick={moveNext}>
                      Next
                    </button>
                    <button className="ghost" type="button" onClick={zoomOut}>
                      −
                    </button>
                    <button className="ghost" type="button" onClick={zoomIn}>
                      +
                    </button>
                    <button className="ghost" type="button" onClick={resetTransform}>
                      Reset
                    </button>
                    <button
                      className={selectedImage.favorite ? 'ghost fav active' : 'ghost fav'}
                      type="button"
                      onClick={() => handleToggleFavorite(selectedImage)}
                    >
                      ★
                    </button>
                    <button
                      className="ghost"
                      type="button"
                      onClick={() => setSelectedId(null)}
                    >
                      Close
                    </button>
                  </div>
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

                <div className="modal-footer" onClick={(event) => event.stopPropagation()}>
                  <label className="control">
                    <span>Move to</span>
                    <select
                      value={moveTarget}
                      onChange={(event) => setMoveTarget(event.target.value)}
                    >
                      <option value="">(root)</option>
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
              </>
            )}
          </TransformWrapper>
        </div>
      )}
    </div>
  );
}
