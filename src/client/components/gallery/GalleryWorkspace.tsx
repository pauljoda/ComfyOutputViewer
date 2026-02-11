import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import TagDrawer from '../TagDrawer';
import Gallery from '../Gallery';
import ImageModal from '../ImageModal';
import TopBar from '../TopBar';
import AutoTagModal from '../AutoTagModal';
import SlideshowSettingsModal from '../SlideshowSettingsModal';
import SlideshowView from '../SlideshowView';
import {
  COLUMN_MAX,
  COLUMN_MIN,
  MIN_TILE_SIZE,
  STORAGE_KEYS,
  TARGET_TILE_SIZE,
  TILE_GAP
} from '../../constants';
import { useTags } from '../../contexts/TagsContext';
import { useElementSize } from '../../hooks/useElementSize';
import { useLocalStorageState } from '../../hooks/useLocalStorageState';
import { api } from '../../lib/api';
import {
  bulkDelete,
  bulkFavorite,
  bulkHidden,
  bulkRating,
  bulkTags,
  deleteImage,
  setFavorite,
  setHidden,
  setRating,
  setTags
} from '../../lib/imagesApi';
import { clamp, filterImages, sortImages } from '../../utils/images';
import { toggleSelectionWithRange } from '../../utils/selection';
import { normalizeTagInput, normalizeTags } from '../../utils/tags';
import {
  booleanSerializer,
  enumSerializer,
  numberSerializer,
  type StorageSerializer
} from '../../utils/storage';
import {
  DEFAULT_SORT,
  SORT_MODES,
  type ActiveTool,
  type ApiResponse,
  type ImageItem,
  type ModalTool,
  type SlideshowSettings,
  type SortMode,
  type SyncResponse,
  type TileFit,
  type ToolPanel
} from '../../types';

const emptyData: ApiResponse = {
  images: [],
  sourceDir: '',
  dataDir: ''
};

const columnsSerializer: StorageSerializer<number> = {
  parse: (value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 0;
    const rounded = Math.round(parsed);
    if (rounded < COLUMN_MIN) return 0;
    return clamp(rounded, COLUMN_MIN, COLUMN_MAX);
  },
  serialize: (value) => String(value)
};

const tileFitSerializer: StorageSerializer<TileFit> = {
  parse: (value) => {
    if (value === 'contain' || value === 'content') return 'contain';
    return 'cover';
  },
  serialize: (value) => value
};

const sortSerializer = enumSerializer<SortMode>(DEFAULT_SORT, SORT_MODES);

export default function GalleryWorkspace() {
  const { goHomeSignal } = useOutletContext<{
    goHomeSignal: number;
  }>();
  const { tagCounts, availableTags, updateFromImages } = useTags();
  const [data, setData] = useState<ApiResponse>(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showUntagged, setShowUntagged] = useState(false);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [minRating, setMinRating] = useLocalStorageState(
    STORAGE_KEYS.ratingMin,
    0,
    numberSerializer(0, { min: 0, max: 5, round: true })
  );
  const [maxRating, setMaxRating] = useLocalStorageState(
    STORAGE_KEYS.ratingMax,
    5,
    numberSerializer(5, { min: 0, max: 5, round: true })
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [multiSelect, setMultiSelect] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectionAnchorId, setSelectionAnchorId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTool, setActiveTool] = useState<ActiveTool>(null);
  const [modalTool, setModalTool] = useState<ModalTool>(null);
  const { ref: topBarRef, height: topBarHeight } = useElementSize<HTMLElement>();
  const { ref: galleryRef, width: galleryWidth } = useElementSize<HTMLElement>();
  const [columns, setColumns] = useLocalStorageState(
    STORAGE_KEYS.columns,
    0,
    columnsSerializer
  );
  const [tileFit, setTileFit] = useLocalStorageState(
    STORAGE_KEYS.tileFit,
    'cover',
    tileFitSerializer
  );
  const [hideHidden, setHideHidden] = useLocalStorageState(
    STORAGE_KEYS.hideHidden,
    true,
    booleanSerializer(true)
  );
  const [sortMode, setSortMode] = useLocalStorageState(
    STORAGE_KEYS.sort,
    DEFAULT_SORT,
    sortSerializer
  );

  // Auto-tag state
  const [autoTagScope, setAutoTagScope] = useState<'selected' | 'view' | null>(null);

  // Slideshow state
  const [showSlideshowSettings, setShowSlideshowSettings] = useState(false);
  const [slideshowActive, setSlideshowActive] = useState(false);
  const [slideshowSettings, setSlideshowSettings] = useState<SlideshowSettings | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api<ApiResponse>('/api/images');
      setData({
        ...response,
        images: response.images.map((image) => ({
          ...image,
          tags: normalizeTags(image.tags),
          rating: Number.isFinite(image.rating) ? clamp(Math.round(image.rating), 0, 5) : 0
        }))
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load images');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleApiFailure = useCallback(
    async (err: unknown, fallback: string) => {
      const message = err instanceof Error ? err.message : fallback;
      await refresh();
      setError(message);
    },
    [refresh]
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (minRating > maxRating) {
      setMaxRating(minRating);
    }
  }, [minRating, maxRating]);

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


  // Update global tags context whenever images change
  useEffect(() => {
    updateFromImages(data.images);
  }, [data.images, updateFromImages]);

  const untaggedCount = useMemo(
    () => data.images.filter((image) => image.tags.length === 0).length,
    [data.images]
  );

  const filteredImages = useMemo(() => {
    const filtered = filterImages(data.images, {
      selectedTags,
      showUntagged,
      favoritesOnly,
      hideHidden,
      minRating,
      maxRating
    });
    return sortImages(filtered, sortMode);
  }, [data.images, favoritesOnly, hideHidden, maxRating, minRating, selectedTags, showUntagged, sortMode]);

  const selectedIndex = selectedId
    ? filteredImages.findIndex((image) => image.id === selectedId)
    : -1;
  const selectedImage = selectedIndex >= 0 ? filteredImages[selectedIndex] : null;

  useEffect(() => {
    if (selectedId) {
      setModalTool(null);
    }
  }, [selectedId]);

  useEffect(() => {
    if (!multiSelect) {
      setSelectedIds([]);
      setSelectionAnchorId(null);
    }
  }, [multiSelect]);

  useEffect(() => {
    if (!selectionAnchorId) return;
    if (!filteredImages.some((image) => image.id === selectionAnchorId)) {
      setSelectionAnchorId(null);
    }
  }, [filteredImages, selectionAnchorId]);

  const handleToggleFavorite = useCallback(async (image: ImageItem) => {
    const nextValue = !image.favorite;
    setData((prev) => ({
      ...prev,
      images: prev.images.map((item) =>
        item.id === image.id ? { ...item, favorite: nextValue } : item
      )
    }));
    try {
      await setFavorite(image.id, nextValue);
    } catch (err) {
      await handleApiFailure(err, 'Failed to update favorite');
    }
  }, [handleApiFailure]);

  const handleToggleHidden = useCallback(async (image: ImageItem) => {
    const nextValue = !image.hidden;
    setData((prev) => ({
      ...prev,
      images: prev.images.map((item) =>
        item.id === image.id ? { ...item, hidden: nextValue } : item
      )
    }));
    try {
      await setHidden(image.id, nextValue);
    } catch (err) {
      await handleApiFailure(err, 'Failed to update hidden state');
    }
  }, [handleApiFailure]);

  const handleUpdateRating = useCallback(async (image: ImageItem, rating: number) => {
    const nextRating = clamp(Math.round(rating), 0, 5);
    setData((prev) => ({
      ...prev,
      images: prev.images.map((item) =>
        item.id === image.id ? { ...item, rating: nextRating } : item
      )
    }));
    try {
      await setRating(image.id, nextRating);
    } catch (err) {
      await handleApiFailure(err, 'Failed to update rating');
    }
  }, [handleApiFailure]);

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

  const handleMinRatingChange = (value: number) => {
    const nextValue = clamp(Math.round(value), 0, 5);
    setMinRating(nextValue);
    setMaxRating((prev) => (prev < nextValue ? nextValue : prev));
  };

  const handleMaxRatingChange = (value: number) => {
    const nextValue = clamp(Math.round(value), 0, 5);
    setMaxRating(nextValue);
    setMinRating((prev) => (prev > nextValue ? nextValue : prev));
  };

  const handleToggleDrawerTag = (tag: string) => {
    setShowUntagged(false);
    setSelectedTags((prev) => (prev.length === 1 && prev[0] === tag ? [] : [tag]));
  };

  const handleSelectAllImages = () => {
    setSelectedTags([]);
    setShowUntagged(false);
  };

  const handleSelectUntagged = () => {
    setSelectedTags([]);
    setShowUntagged(true);
  };

  const handleGoHome = useCallback(() => {
    setSelectedTags([]);
    setShowUntagged(false);
    setFavoritesOnly(false);
    setMinRating(0);
    setMaxRating(5);
    setActiveTool(null);
    setDrawerOpen(false);
  }, []);

  useEffect(() => {
    if (goHomeSignal > 0) {
      handleGoHome();
    }
  }, [goHomeSignal, handleGoHome]);

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

  const handleToggleSelectedId = useCallback(
    (imageId: string, options?: { shiftKey?: boolean }) => {
      const orderedIds = filteredImages.map((image) => image.id);
      setSelectedIds((prev) => {
        const next = toggleSelectionWithRange({
          orderedIds,
          selectedIds: prev,
          clickedId: imageId,
          anchorId: selectionAnchorId,
          shiftKey: options?.shiftKey
        });
        setSelectionAnchorId(next.anchorId);
        return next.selectedIds;
      });
    },
    [filteredImages, selectionAnchorId]
  );

  const handleClearSelection = useCallback(() => {
    setSelectedIds([]);
    setSelectionAnchorId(null);
  }, []);

  const handleUpdateTags = useCallback(async (imageId: string, nextTags: string[]) => {
    const normalized = normalizeTags(nextTags);
    setData((prev) => ({
      ...prev,
      images: prev.images.map((item) =>
        item.id === imageId ? { ...item, tags: normalized } : item
      )
    }));
    try {
      await setTags(imageId, normalized);
    } catch (err) {
      await handleApiFailure(err, 'Failed to update tags');
    }
  }, [handleApiFailure]);

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
      const response = await deleteImage(image.id);
      const suffix = response.blacklisted > 0 ? ' and blacklisted it from sync.' : '.';
      setStatus(`Removed "${image.name}"${suffix}`);
    } catch (err) {
      await handleApiFailure(err, 'Failed to delete image');
    }
  };

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedCount = selectedIds.length;

  const handleBulkFavorite = useCallback(async () => {
    if (!selectedCount) return;
    setData((prev) => ({
      ...prev,
      images: prev.images.map((item) =>
        selectedIdSet.has(item.id) ? { ...item, favorite: true } : item
      )
    }));
    try {
      await bulkFavorite(selectedIds, true);
    } catch (err) {
      await handleApiFailure(err, 'Failed to update favorites');
    }
  }, [handleApiFailure, selectedCount, selectedIdSet, selectedIds]);

  const handleBulkHidden = useCallback(async () => {
    if (!selectedCount) return;
    setData((prev) => ({
      ...prev,
      images: prev.images.map((item) =>
        selectedIdSet.has(item.id) ? { ...item, hidden: true } : item
      )
    }));
    try {
      await bulkHidden(selectedIds, true);
    } catch (err) {
      await handleApiFailure(err, 'Failed to update hidden state');
    }
  }, [handleApiFailure, selectedCount, selectedIdSet, selectedIds]);

  const handleBulkRating = useCallback(async (rating: number) => {
    if (!selectedCount) return;
    const nextRating = clamp(Math.round(rating), 0, 5);
    setData((prev) => ({
      ...prev,
      images: prev.images.map((item) =>
        selectedIdSet.has(item.id) ? { ...item, rating: nextRating } : item
      )
    }));
    try {
      await bulkRating(selectedIds, nextRating);
    } catch (err) {
      await handleApiFailure(err, 'Failed to update ratings');
    }
  }, [handleApiFailure, selectedCount, selectedIdSet, selectedIds]);

  const handleBulkDelete = async () => {
    if (!selectedCount) return;
    const confirmed = window.confirm(
      `Remove ${selectedCount} images? They will be blacklisted from future syncs.`
    );
    if (!confirmed) return;
    const paths = [...selectedIds];
    const selection = new Set(paths);
    setSelectedIds([]);
    setSelectionAnchorId(null);
    setData((prev) => ({
      ...prev,
      images: prev.images.filter((item) => !selection.has(item.id))
    }));
    try {
      const response = await bulkDelete(paths);
      const suffix =
        response.blacklisted > 0 ? `; blacklisted ${response.blacklisted}.` : '.';
      setStatus(`Removed ${response.deleted} images${suffix}`);
    } catch (err) {
      await handleApiFailure(err, 'Failed to delete images');
    }
  };

  const handleBulkTag = useCallback(async (value: string) => {
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
      await bulkTags(updates);
    } catch (err) {
      await handleApiFailure(err, 'Failed to update tags');
    }
  }, [data.images, handleApiFailure, selectedCount, selectedIdSet]);

  const handleOpenAutoTag = useCallback(() => {
    if (!selectedCount) return;
    setAutoTagScope('selected');
  }, [selectedCount]);

  const handleOpenAutoTagView = useCallback(() => {
    if (!filteredImages.length) return;
    setAutoTagScope('view');
  }, [filteredImages.length]);

  const handleAutoTagApply = useCallback(async (updates: Array<{ path: string; tags: string[] }>) => {
    setAutoTagScope(null);
    if (updates.length === 0) return;
    const normalized = updates.map((u) => ({ path: u.path, tags: normalizeTags(u.tags) }));
    const updateMap = new Map(normalized.map((entry) => [entry.path, entry.tags]));
    setData((prev) => ({
      ...prev,
      images: prev.images.map((item) => {
        const nextTags = updateMap.get(item.id);
        if (!nextTags) return item;
        return { ...item, tags: nextTags };
      })
    }));
    try {
      await bulkTags(normalized);
      setStatus(`Auto-tagged ${normalized.length} image${normalized.length !== 1 ? 's' : ''}.`);
    } catch (err) {
      await handleApiFailure(err, 'Failed to apply auto-tags');
    }
  }, [handleApiFailure]);

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

  const movePrev = useCallback(() => {
    if (!filteredImages.length || selectedIndex < 0) return;
    const nextIndex = (selectedIndex - 1 + filteredImages.length) % filteredImages.length;
    setSelectedId(filteredImages[nextIndex].id);
  }, [filteredImages, selectedIndex]);

  const moveNext = useCallback(() => {
    if (!filteredImages.length || selectedIndex < 0) return;
    const nextIndex = (selectedIndex + 1) % filteredImages.length;
    setSelectedId(filteredImages[nextIndex].id);
  }, [filteredImages, selectedIndex]);

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
  }, [selectedImage, moveNext, movePrev]);

  const toggleTool = useCallback((tool: ToolPanel) => {
    setActiveTool((current) => (current === tool ? null : tool));
  }, []);

  const handleOpenSlideshow = useCallback(() => {
    if (filteredImages.length === 0) return;
    setShowSlideshowSettings(true);
  }, [filteredImages.length]);

  const handleStartSlideshow = useCallback((settings: SlideshowSettings) => {
    setShowSlideshowSettings(false);
    setSlideshowSettings(settings);
    setSlideshowActive(true);
  }, []);

  const handleCloseSlideshow = useCallback(() => {
    setSlideshowActive(false);
    setSlideshowSettings(null);
  }, []);

  const currentFilterLabel = useMemo(() => {
    if (showUntagged) return 'Untagged';
    const extras: string[] = [];
    if (favoritesOnly) {
      extras.push('Favorites');
    }
    const hasMin = minRating > 0;
    const hasMax = maxRating < 5;
    if (hasMin || hasMax) {
      if (hasMin && hasMax && minRating === maxRating) {
        extras.push(`Rating ${minRating}`);
      } else if (hasMin && !hasMax) {
        extras.push(`Rating ${minRating}+`);
      } else if (!hasMin && hasMax) {
        extras.push(`Rating <=${maxRating}`);
      } else {
        extras.push(`Rating ${minRating}-${maxRating}`);
      }
    }
    let base = 'All images';
    if (selectedTags.length > 0) {
      const visible = selectedTags.slice(0, 2).join(' + ');
      const overflow = selectedTags.length - 2;
      base = overflow > 0 ? `Tags: ${visible} +${overflow}` : `Tags: ${visible}`;
    }
    return extras.length > 0 ? `${base} / ${extras.join(' / ')}` : base;
  }, [favoritesOnly, maxRating, minRating, selectedTags, showUntagged]);
  const effectiveColumns = columns > 0 ? columns : COLUMN_MIN;
  const tileSize = useMemo(() => {
    if (!galleryWidth) return TARGET_TILE_SIZE;
    const totalGap = TILE_GAP * (effectiveColumns - 1);
    const available = Math.max(0, galleryWidth - totalGap);
    return Math.max(MIN_TILE_SIZE, Math.floor(available / effectiveColumns));
  }, [galleryWidth, effectiveColumns]);
  const galleryTileFit: TileFit =
    selectedTags.length > 0 || showUntagged ? 'cover' : tileFit;

  const handleSelectImageWithOptions = useCallback(
    (imageId: string, options?: { shiftKey?: boolean }) => {
      if (multiSelect) {
        handleToggleSelectedId(imageId, options);
      } else {
        setSelectedId(imageId);
      }
    },
    [handleToggleSelectedId, multiSelect]
  );

  return (
    <div
      className="flex flex-col"
      style={{ '--top-bar-height': `${topBarHeight}px` } as React.CSSProperties}
    >
      <TopBar
        ref={topBarRef}
        currentFilterLabel={currentFilterLabel}
        activeTool={activeTool}
        multiSelect={multiSelect}
        selectedCount={selectedCount}
        effectiveColumns={effectiveColumns}
        maxColumns={maxColumns}
        tileFit={tileFit}
        sortMode={sortMode}
        favoritesOnly={favoritesOnly}
        hideHidden={hideHidden}
        minRating={minRating}
        maxRating={maxRating}
        selectedTags={selectedTags}
        availableTags={availableTags}
        showUntagged={showUntagged}
        imageCount={filteredImages.length}
        loading={loading}
        status={status}
        error={error}
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
        onBulkRating={handleBulkRating}
        onBulkDelete={handleBulkDelete}
        onBulkTag={handleBulkTag}
        onAutoTag={handleOpenAutoTag}
        onAutoTagView={handleOpenAutoTagView}
        onColumnsChange={setColumns}
        onTileFitChange={setTileFit}
        onSortModeChange={setSortMode}
        onFavoritesOnlyChange={setFavoritesOnly}
        onHideHiddenChange={setHideHidden}
        onMinRatingChange={handleMinRatingChange}
        onMaxRatingChange={handleMaxRatingChange}
        onAddFilterTag={handleAddSelectedTag}
        onRemoveFilterTag={handleRemoveSelectedTag}
        onClearFilterTags={handleClearSelectedTags}
        onExitUntagged={handleSelectAllImages}
        onOpenSlideshow={handleOpenSlideshow}
      />

      {activeTool && (
        <div className="fixed inset-0 z-30 bg-black/20" aria-hidden="true" onClick={() => setActiveTool(null)} />
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

      <Gallery
        ref={galleryRef}
        images={filteredImages}
        tileFit={galleryTileFit}
        tileSize={tileSize}
        columns={effectiveColumns}
        multiSelect={multiSelect}
        selectedIds={selectedIdSet}
        onSelectImage={handleSelectImageWithOptions}
        onToggleFavorite={handleToggleFavorite}
        onToggleHidden={handleToggleHidden}
      />

      {selectedImage && (
        <ImageModal
          image={selectedImage}
          index={selectedIndex}
          total={filteredImages.length}
          modalTool={modalTool}
          availableTags={availableTags}
          onUpdateTags={(tags) => handleUpdateTags(selectedImage.id, tags)}
          onToggleTags={() =>
            setModalTool((current) => (current === 'tags' ? null : 'tags'))
          }
          onToggleRating={() =>
            setModalTool((current) => (current === 'rating' ? null : 'rating'))
          }
          onTogglePrompt={() =>
            setModalTool((current) => (current === 'prompt' ? null : 'prompt'))
          }
          onToggleFavorite={() => handleToggleFavorite(selectedImage)}
          onToggleHidden={() => handleToggleHidden(selectedImage)}
          onRate={(rating) => handleUpdateRating(selectedImage, rating)}
          onDelete={() => handleDeleteImage(selectedImage)}
          onClose={() => setSelectedId(null)}
          onPrev={movePrev}
          onNext={moveNext}
        />
      )}

      {autoTagScope && (
        <AutoTagModal
          images={
            autoTagScope === 'selected'
              ? data.images.filter((img) => selectedIdSet.has(img.id))
              : filteredImages
          }
          availableTags={availableTags}
          onApply={handleAutoTagApply}
          onClose={() => setAutoTagScope(null)}
        />
      )}

      {showSlideshowSettings && (
        <SlideshowSettingsModal
          imageCount={filteredImages.length}
          onStart={handleStartSlideshow}
          onClose={() => setShowSlideshowSettings(false)}
        />
      )}

      {slideshowActive && slideshowSettings && (
        <SlideshowView
          images={filteredImages}
          settings={slideshowSettings}
          onClose={handleCloseSlideshow}
        />
      )}
    </div>
  );
}
