import React from 'react';
import { useOutletContext } from 'react-router-dom';
import Gallery from '../Gallery';
import GalleryFiltersController from './GalleryFiltersController';
import GalleryModalController from './GalleryModalController';
import { useGalleryWorkspaceController } from './useGalleryWorkspaceController';

export default function GalleryWorkspace() {
  const { goHomeSignal } = useOutletContext<{ goHomeSignal: number }>();

  const {
    tagCounts,
    availableTags,
    data,
    loading,
    error,
    status,
    selectedTags,
    showUntagged,
    favoritesOnly,
    minRating,
    maxRating,
    multiSelect,
    drawerOpen,
    activeTool,
    modalTool,
    topBarRef,
    topBarHeight,
    galleryRef,
    tileFit,
    hideHidden,
    sortMode,
    autoTagScope,
    showSlideshowSettings,
    slideshowActive,
    slideshowSettings,
    maxColumns,
    untaggedCount,
    filteredImages,
    selectedIndex,
    selectedImage,
    selectedIdSet,
    selectedCount,
    currentFilterLabel,
    effectiveColumns,
    tileSize,
    galleryTileFit,
    setDrawerOpen,
    setActiveTool,
    setModalTool,
    setColumns,
    setTileFit,
    setSortMode,
    setFavoritesOnly,
    setHideHidden,
    setSelectedId,
    setAutoTagScope,
    setShowSlideshowSettings,
    handleToggleFavorite,
    handleToggleHidden,
    handleUpdateRating,
    handleAddSelectedTag,
    handleRemoveSelectedTag,
    handleClearSelectedTags,
    handleMinRatingChange,
    handleMaxRatingChange,
    handleToggleDrawerTag,
    handleSelectAllImages,
    handleSelectUntagged,
    handleToggleMultiSelect,
    handleClearSelection,
    handleBulkFavorite,
    handleBulkHidden,
    handleBulkRating,
    handleBulkDelete,
    handleBulkTag,
    handleOpenAutoTag,
    handleOpenAutoTagView,
    handleAutoTagApply,
    handleSync,
    movePrev,
    moveNext,
    toggleTool,
    handleOpenSlideshow,
    handleStartSlideshow,
    handleCloseSlideshow,
    handleSelectImageWithOptions,
    handleUpdateTags,
    handleDeleteImage
  } = useGalleryWorkspaceController({ goHomeSignal });

  return (
    <div
      className="flex flex-col"
      style={{ '--top-bar-height': `${topBarHeight}px` } as React.CSSProperties}
    >
      <GalleryFiltersController
        topBarRef={topBarRef}
        topBarProps={{
          currentFilterLabel,
          activeTool,
          multiSelect,
          selectedCount,
          effectiveColumns,
          maxColumns,
          tileFit,
          sortMode,
          favoritesOnly,
          hideHidden,
          minRating,
          maxRating,
          selectedTags,
          availableTags,
          showUntagged,
          imageCount: filteredImages.length,
          loading,
          status,
          error,
          onOpenDrawer: () => {
            setDrawerOpen(true);
            setActiveTool(null);
          },
          onToggleTool: toggleTool,
          onDismissTool: () => setActiveTool(null),
          onToggleMultiSelect: handleToggleMultiSelect,
          onClearSelection: handleClearSelection,
          onBulkFavorite: handleBulkFavorite,
          onBulkHidden: handleBulkHidden,
          onBulkRating: handleBulkRating,
          onBulkDelete: handleBulkDelete,
          onBulkTag: handleBulkTag,
          onAutoTag: handleOpenAutoTag,
          onAutoTagView: handleOpenAutoTagView,
          onColumnsChange: setColumns,
          onTileFitChange: setTileFit,
          onSortModeChange: setSortMode,
          onFavoritesOnlyChange: setFavoritesOnly,
          onHideHiddenChange: setHideHidden,
          onMinRatingChange: handleMinRatingChange,
          onMaxRatingChange: handleMaxRatingChange,
          onAddFilterTag: handleAddSelectedTag,
          onRemoveFilterTag: handleRemoveSelectedTag,
          onClearFilterTags: handleClearSelectedTags,
          onExitUntagged: handleSelectAllImages,
          onOpenSlideshow: handleOpenSlideshow
        }}
        activeTool={activeTool}
        setActiveTool={setActiveTool}
        drawerOpen={drawerOpen}
        setDrawerOpen={setDrawerOpen}
        tagDrawerProps={{
          tags: tagCounts,
          selectedTags,
          showUntagged,
          totalCount: data.images.length,
          untaggedCount,
          onToggleTag: (tag) => {
            handleToggleDrawerTag(tag);
            setDrawerOpen(false);
          },
          onSelectAll: () => {
            handleSelectAllImages();
            setDrawerOpen(false);
          },
          onSelectUntagged: () => {
            handleSelectUntagged();
            setDrawerOpen(false);
          },
          onSync: handleSync
        }}
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

      <GalleryModalController
        selectedImage={selectedImage}
        selectedIndex={selectedIndex}
        filteredImages={filteredImages}
        dataImages={data.images}
        selectedIdSet={selectedIdSet}
        availableTags={availableTags}
        autoTagScope={autoTagScope}
        showSlideshowSettings={showSlideshowSettings}
        slideshowActive={slideshowActive}
        slideshowSettings={slideshowSettings}
        modalTool={modalTool}
        onUpdateTags={handleUpdateTags}
        onToggleTags={() => setModalTool((current) => (current === 'tags' ? null : 'tags'))}
        onToggleRating={() => setModalTool((current) => (current === 'rating' ? null : 'rating'))}
        onTogglePrompt={() => setModalTool((current) => (current === 'prompt' ? null : 'prompt'))}
        onToggleFavorite={handleToggleFavorite}
        onToggleHidden={handleToggleHidden}
        onRate={handleUpdateRating}
        onDelete={handleDeleteImage}
        onCloseImage={() => setSelectedId(null)}
        onPrevImage={movePrev}
        onNextImage={moveNext}
        onApplyAutoTag={handleAutoTagApply}
        onCloseAutoTag={() => setAutoTagScope(null)}
        onStartSlideshow={handleStartSlideshow}
        onCloseSlideshowSettings={() => setShowSlideshowSettings(false)}
        onCloseSlideshow={handleCloseSlideshow}
      />
    </div>
  );
}
