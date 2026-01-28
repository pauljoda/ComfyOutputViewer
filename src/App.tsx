import React, { useCallback, useEffect, useMemo, useState } from 'react';
import packageJson from '../package.json';
import FolderDrawer from './components/FolderDrawer';
import Gallery from './components/Gallery';
import ImageModal from './components/ImageModal';
import StatusBar from './components/StatusBar';
import TopBar from './components/TopBar';
import {
  COLUMN_MAX,
  COLUMN_MIN,
  MIN_TILE_SIZE,
  STORAGE_KEYS,
  TARGET_TILE_SIZE,
  TILE_GAP
} from './constants';
import { useElementSize } from './hooks/useElementSize';
import { api } from './lib/api';
import { sortFolders } from './utils/folders';
import { clamp, filterImages, isSortMode, sortImages } from './utils/images';
import {
  DEFAULT_SORT,
  type ActiveTool,
  type ApiResponse,
  type ImageItem,
  type ModalTool,
  type SortMode,
  type SyncResponse,
  type ThemeMode,
  type TileFit,
  type ToolPanel
} from './types';

const emptyData: ApiResponse = {
  images: [],
  folders: [],
  sourceDir: '',
  dataDir: ''
};

export default function App() {
  const [data, setData] = useState<ApiResponse>(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [selectedFolder, setSelectedFolder] = useState('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [moveTarget, setMoveTarget] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTool, setActiveTool] = useState<ActiveTool>(null);
  const [modalTool, setModalTool] = useState<ModalTool>(null);
  const { ref: topBarRef, height: topBarHeight } = useElementSize<HTMLElement>();
  const { ref: galleryRef, width: galleryWidth } = useElementSize<HTMLElement>();
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    const stored = window.localStorage.getItem(STORAGE_KEYS.theme);
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored;
    }
    return 'system';
  });
  const [columns, setColumns] = useState<number>(() => {
    const stored = Number(window.localStorage.getItem(STORAGE_KEYS.columns));
    return Number.isFinite(stored) && stored >= COLUMN_MIN ? stored : 0;
  });
  const [tileFit, setTileFit] = useState<TileFit>(() => {
    const stored = window.localStorage.getItem(STORAGE_KEYS.tileFit);
    return stored === 'contain' || stored === 'content' ? 'contain' : 'cover';
  });
  const [hideHidden, setHideHidden] = useState<boolean>(() => {
    const stored = window.localStorage.getItem(STORAGE_KEYS.hideHidden);
    return stored ? stored === 'true' : true;
  });
  const [sortMode, setSortMode] = useState<SortMode>(() => {
    const stored = window.localStorage.getItem(STORAGE_KEYS.sort);
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
    window.localStorage.setItem(STORAGE_KEYS.theme, themeMode);
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
    window.localStorage.setItem(STORAGE_KEYS.tileFit, tileFit);
  }, [tileFit]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.hideHidden, String(hideHidden));
  }, [hideHidden]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.sort, sortMode);
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
      window.localStorage.setItem(STORAGE_KEYS.columns, String(columns));
    }
  }, [columns]);

  const folders = useMemo(() => sortFolders(data.folders), [data.folders]);

  const filteredImages = useMemo(() => {
    const filtered = filterImages(data.images, {
      selectedFolder,
      favoritesOnly,
      hideHidden
    });
    return sortImages(filtered, sortMode);
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

  const toggleTool = useCallback((tool: ToolPanel) => {
    setActiveTool((current) => (current === tool ? null : tool));
  }, []);

  const currentFolderLabel = selectedFolder ? selectedFolder : 'Home';
  const effectiveColumns = columns > 0 ? columns : COLUMN_MIN;
  const tileSize = useMemo(() => {
    if (!galleryWidth) return TARGET_TILE_SIZE;
    const totalGap = TILE_GAP * (effectiveColumns - 1);
    const available = Math.max(0, galleryWidth - totalGap);
    return Math.max(MIN_TILE_SIZE, Math.floor(available / effectiveColumns));
  }, [galleryWidth, effectiveColumns]);

  return (
    <div
      className="app"
      style={{ '--top-bar-height': `${topBarHeight}px` } as React.CSSProperties}
    >
      <TopBar
        ref={topBarRef}
        version={packageJson.version}
        sourceDir={data.sourceDir}
        currentFolderLabel={currentFolderLabel}
        activeTool={activeTool}
        effectiveColumns={effectiveColumns}
        maxColumns={maxColumns}
        tileFit={tileFit}
        sortMode={sortMode}
        themeMode={themeMode}
        favoritesOnly={favoritesOnly}
        hideHidden={hideHidden}
        onOpenDrawer={() => {
          setDrawerOpen(true);
          setActiveTool(null);
        }}
        onToggleTool={toggleTool}
        onDismissTool={() => setActiveTool(null)}
        onColumnsChange={setColumns}
        onTileFitChange={setTileFit}
        onSortModeChange={setSortMode}
        onThemeModeChange={setThemeMode}
        onFavoritesOnlyChange={setFavoritesOnly}
        onHideHiddenChange={setHideHidden}
      />

      {activeTool && (
        <div className="tool-scrim" aria-hidden="true" onClick={() => setActiveTool(null)} />
      )}

      <FolderDrawer
        open={drawerOpen}
        folders={folders}
        selectedFolder={selectedFolder}
        onSelectFolder={(folder) => {
          setSelectedFolder(folder);
          setDrawerOpen(false);
        }}
        onClose={() => setDrawerOpen(false)}
        onSync={handleSync}
        onCreateFolder={handleCreateFolder}
      />

      <StatusBar
        loading={loading}
        imageCount={filteredImages.length}
        status={status}
        error={error}
      />

      <Gallery
        ref={galleryRef}
        images={filteredImages}
        tileFit={tileFit}
        tileSize={tileSize}
        columns={effectiveColumns}
        onSelectImage={setSelectedId}
        onToggleFavorite={handleToggleFavorite}
        onToggleHidden={handleToggleHidden}
      />

      {selectedImage && (
        <ImageModal
          image={selectedImage}
          folders={folders}
          moveTarget={moveTarget}
          modalTool={modalTool}
          onMoveTargetChange={setMoveTarget}
          onMoveSelected={handleMoveSelected}
          onToggleDetails={() =>
            setModalTool((current) => (current === 'details' ? null : 'details'))
          }
          onToggleFavorite={() => handleToggleFavorite(selectedImage)}
          onToggleHidden={() => handleToggleHidden(selectedImage)}
          onClose={() => setSelectedId(null)}
          onPrev={movePrev}
          onNext={moveNext}
        />
      )}
    </div>
  );
}
