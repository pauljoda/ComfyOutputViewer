import React from 'react';
import { useOutletContext } from 'react-router-dom';
import Gallery from '../Gallery';
import TagDrawer from '../TagDrawer';
import TopBar from '../TopBar';
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
