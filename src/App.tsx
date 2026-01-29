import React, { useCallback, useEffect, useMemo, useState } from 'react';
import packageJson from '../package.json';
import TagDrawer from './components/TagDrawer';
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
import { clamp, filterImages, isSortMode, sortImages } from './utils/images';
import { buildTagCounts, normalizeTagInput, normalizeTags } from './utils/tags';
import {
  DEFAULT_SORT,
  type ActiveTool,
  type ApiResponse,
  type DeleteResponse,
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
  sourceDir: '',
  dataDir: ''
};

export default function App() {
  const [data, setData] = useState<ApiResponse>(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showUntagged, setShowUntagged] = useState(false);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [multiSelect, setMultiSelect] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
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
      setData({
        ...response,
        images: response.images.map((image) => ({
          ...image,
          tags: normalizeTags(image.tags)
        }))
      });
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

  const tagCounts = useMemo(() => buildTagCounts(data.images), [data.images]);
  const availableTags = useMemo(() => tagCounts.map((entry) => entry.tag), [tagCounts]);
  const untaggedCount = useMemo(
    () => data.images.filter((image) => image.tags.length === 0).length,
    [data.images]
  );

  const filteredImages = useMemo(() => {
    const filtered = filterImages(data.images, {
      selectedTags,
      showUntagged,
      favoritesOnly,
      hideHidden
    });
    return sortImages(filtered, sortMode);
  }, [data.images, favoritesOnly, hideHidden, selectedTags, showUntagged, sortMode]);

  const selectedIndex = selectedId
    ? filteredImages.findIndex((image) => image.id === selectedId)
    : -1;
  const selectedImage = selectedIndex >= 0 ? filteredImages[selectedIndex] : null;

  useEffect(() => {
    if (selectedImage) {
      setModalTool(null);
    }
  }, [selectedImage]);

  useEffect(() => {
    if (!multiSelect) {
      setSelectedIds([]);
    }
  }, [multiSelect]);

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

  const handleAddSelectedTag = (value: string) => {
    const normalized = normalizeTagInput(value);
    if (!normalized) return;
    setShowUntagged(false);
    setSelectedTags((prev) =>
      prev.includes(normalized) ? prev : [...prev, normalized]
    );
  };

  const handleRemoveSelectedTag = (tag: string) => {
    setSelectedTags((prev) => prev.filter((entry) => entry !== tag));
  };

  const handleClearSelectedTags = () => {
    setSelectedTags([]);
  };

  const handleToggleDrawerTag = (tag: string) => {
    setShowUntagged(false);
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((entry) => entry !== tag) : [...prev, tag]
    );
  };

  const handleSelectAllImages = () => {
    setSelectedTags([]);
    setShowUntagged(false);
  };

  const handleSelectUntagged = () => {
    setSelectedTags([]);
    setShowUntagged(true);
  };

  const handleGoHome = () => {
    setSelectedTags([]);
    setShowUntagged(false);
    setFavoritesOnly(false);
    setActiveTool(null);
    setDrawerOpen(false);
  };

  const handleToggleMultiSelect = () => {
    setMultiSelect((prev) => {
      const next = !prev;
      if (next) {
        setSelectedId(null);
        setActiveTool(null);
      }
      return next;
    });
  };

  const handleToggleSelectedId = (imageId: string) => {
    setSelectedIds((prev) =>
      prev.includes(imageId) ? prev.filter((id) => id !== imageId) : [...prev, imageId]
    );
  };

  const handleClearSelection = () => {
    setSelectedIds([]);
  };

  const handleUpdateTags = async (imageId: string, nextTags: string[]) => {
    const normalized = normalizeTags(nextTags);
    setData((prev) => ({
      ...prev,
      images: prev.images.map((item) =>
        item.id === imageId ? { ...item, tags: normalized } : item
      )
    }));
    try {
      await api('/api/tags', {
        method: 'POST',
        body: JSON.stringify({ path: imageId, tags: normalized })
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update tags');
    }
  };

  const handleDeleteImage = async (image: ImageItem) => {
    const confirmed = window.confirm(
      `Remove "${image.name}"? It will be blacklisted from future syncs.`
    );
    if (!confirmed) return;
    setSelectedId(null);
    setModalTool(null);
    setSelectedIds((prev) => prev.filter((id) => id !== image.id));
    setData((prev) => ({
      ...prev,
      images: prev.images.filter((item) => item.id !== image.id)
    }));
    try {
      const response = await api<DeleteResponse>('/api/delete', {
        method: 'POST',
        body: JSON.stringify({ path: image.id })
      });
      const suffix = response.blacklisted > 0 ? ' and blacklisted it from sync.' : '.';
      setStatus(`Removed "${image.name}"${suffix}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete image');
      await refresh();
    }
  };

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedCount = selectedIds.length;

  const handleBulkFavorite = async () => {
    if (!selectedCount) return;
    setData((prev) => ({
      ...prev,
      images: prev.images.map((item) =>
        selectedIdSet.has(item.id) ? { ...item, favorite: true } : item
      )
    }));
    try {
      await api('/api/favorite/bulk', {
        method: 'POST',
        body: JSON.stringify({ paths: selectedIds, value: true })
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update favorites');
    }
  };

  const handleBulkHidden = async () => {
    if (!selectedCount) return;
    setData((prev) => ({
      ...prev,
      images: prev.images.map((item) =>
        selectedIdSet.has(item.id) ? { ...item, hidden: true } : item
      )
    }));
    try {
      await api('/api/hidden/bulk', {
        method: 'POST',
        body: JSON.stringify({ paths: selectedIds, value: true })
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update hidden state');
    }
  };

  const handleBulkDelete = async () => {
    if (!selectedCount) return;
    const confirmed = window.confirm(
      `Remove ${selectedCount} images? They will be blacklisted from future syncs.`
    );
    if (!confirmed) return;
    const paths = [...selectedIds];
    const selection = new Set(paths);
    setSelectedIds([]);
    setData((prev) => ({
      ...prev,
      images: prev.images.filter((item) => !selection.has(item.id))
    }));
    try {
      const response = await api<DeleteResponse>('/api/delete/bulk', {
        method: 'POST',
        body: JSON.stringify({ paths })
      });
      const suffix =
        response.blacklisted > 0 ? `; blacklisted ${response.blacklisted}.` : '.';
      setStatus(`Removed ${response.deleted} images${suffix}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete images');
      await refresh();
    }
  };

  const handleBulkTag = async (value: string) => {
    const normalized = normalizeTagInput(value);
    if (!normalized || !selectedCount) return;
    const updates = data.images
      .filter((item) => selectedIdSet.has(item.id))
      .map((item) => ({ path: item.id, tags: normalizeTags([...item.tags, normalized]) }));
    const updateMap = new Map(updates.map((entry) => [entry.path, entry.tags]));
    setData((prev) => ({
      ...prev,
      images: prev.images.map((item) => {
        const nextTags = updateMap.get(item.id);
        if (!nextTags) return item;
        return { ...item, tags: nextTags };
      })
    }));
    if (updates.length === 0) return;
    try {
      await api('/api/tags/bulk', {
        method: 'POST',
        body: JSON.stringify({ updates })
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update tags');
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

  const currentFilterLabel = useMemo(() => {
    if (showUntagged) return 'Untagged';
    if (selectedTags.length === 0) return 'All images';
    const visible = selectedTags.slice(0, 2).join(' + ');
    const overflow = selectedTags.length - 2;
    if (overflow > 0) {
      return `Tags: ${visible} +${overflow}`;
    }
    return `Tags: ${visible}`;
  }, [selectedTags, showUntagged]);
  const effectiveColumns = columns > 0 ? columns : COLUMN_MIN;
  const tileSize = useMemo(() => {
    if (!galleryWidth) return TARGET_TILE_SIZE;
    const totalGap = TILE_GAP * (effectiveColumns - 1);
    const available = Math.max(0, galleryWidth - totalGap);
    return Math.max(MIN_TILE_SIZE, Math.floor(available / effectiveColumns));
  }, [galleryWidth, effectiveColumns]);

  const handleSelectImage = (imageId: string) => {
    if (multiSelect) {
      handleToggleSelectedId(imageId);
    } else {
      setSelectedId(imageId);
    }
  };

  return (
    <div
      className="app"
      style={{ '--top-bar-height': `${topBarHeight}px` } as React.CSSProperties}
    >
      <TopBar
        ref={topBarRef}
        version={packageJson.version}
        sourceDir={data.sourceDir}
        currentFilterLabel={currentFilterLabel}
        activeTool={activeTool}
        multiSelect={multiSelect}
        selectedCount={selectedCount}
        effectiveColumns={effectiveColumns}
        maxColumns={maxColumns}
        tileFit={tileFit}
        sortMode={sortMode}
        themeMode={themeMode}
        favoritesOnly={favoritesOnly}
        hideHidden={hideHidden}
        selectedTags={selectedTags}
        availableTags={availableTags}
        showUntagged={showUntagged}
        onOpenDrawer={() => {
          setDrawerOpen(true);
          setActiveTool(null);
        }}
        onToggleTool={toggleTool}
        onDismissTool={() => setActiveTool(null)}
        onToggleMultiSelect={handleToggleMultiSelect}
        onClearSelection={handleClearSelection}
        onBulkFavorite={handleBulkFavorite}
        onBulkHidden={handleBulkHidden}
        onBulkDelete={handleBulkDelete}
        onBulkTag={handleBulkTag}
        onColumnsChange={setColumns}
        onTileFitChange={setTileFit}
        onSortModeChange={setSortMode}
        onThemeModeChange={setThemeMode}
        onFavoritesOnlyChange={setFavoritesOnly}
        onHideHiddenChange={setHideHidden}
        onAddFilterTag={handleAddSelectedTag}
        onRemoveFilterTag={handleRemoveSelectedTag}
        onClearFilterTags={handleClearSelectedTags}
        onExitUntagged={handleSelectAllImages}
        onGoHome={handleGoHome}
      />

      {activeTool && (
        <div className="tool-scrim" aria-hidden="true" onClick={() => setActiveTool(null)} />
      )}

      <TagDrawer
        open={drawerOpen}
        tags={tagCounts}
        selectedTags={selectedTags}
        showUntagged={showUntagged}
        totalCount={data.images.length}
        untaggedCount={untaggedCount}
        onToggleTag={(tag) => {
          handleToggleDrawerTag(tag);
          setDrawerOpen(false);
        }}
        onSelectAll={() => {
          handleSelectAllImages();
          setDrawerOpen(false);
        }}
        onSelectUntagged={() => {
          handleSelectUntagged();
          setDrawerOpen(false);
        }}
        onClose={() => setDrawerOpen(false)}
        onSync={handleSync}
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
        multiSelect={multiSelect}
        selectedIds={selectedIdSet}
        onSelectImage={handleSelectImage}
        onToggleFavorite={handleToggleFavorite}
        onToggleHidden={handleToggleHidden}
      />

      {selectedImage && (
        <ImageModal
          image={selectedImage}
          modalTool={modalTool}
          availableTags={availableTags}
          onUpdateTags={(tags) => handleUpdateTags(selectedImage.id, tags)}
          onToggleTags={() =>
            setModalTool((current) => (current === 'tags' ? null : 'tags'))
          }
          onToggleFavorite={() => handleToggleFavorite(selectedImage)}
          onToggleHidden={() => handleToggleHidden(selectedImage)}
          onDelete={() => handleDeleteImage(selectedImage)}
          onClose={() => setSelectedId(null)}
          onPrev={movePrev}
          onNext={moveNext}
        />
      )}
    </div>
  );
}
