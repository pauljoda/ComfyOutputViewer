import React, { useRef } from 'react';
import { Filter, Grid3X3, Menu, Play, Search, SlidersHorizontal } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import type { ActiveTool, SortMode, TileFit, ToolPanel } from '../types';
import { normalizeTagInput } from '../utils/tags';
import TopBarBulkActions from './topbar/TopBarBulkActions';
import TopBarToolPopover from './topbar/TopBarToolPopover';

type TopBarProps = {
  currentFilterLabel: string;
  activeTool: ActiveTool;
  multiSelect: boolean;
  selectedCount: number;
  effectiveColumns: number;
  maxColumns: number;
  tileFit: TileFit;
  sortMode: SortMode;
  favoritesOnly: boolean;
  hideHidden: boolean;
  minRating: number;
  maxRating: number;
  selectedTags: string[];
  availableTags: string[];
  showUntagged: boolean;
  imageCount: number;
  loading: boolean;
  status: string;
  error: string | null;
  onOpenDrawer: () => void;
  onToggleTool: (tool: ToolPanel) => void;
  onDismissTool: () => void;
  onToggleMultiSelect: () => void;
  onClearSelection: () => void;
  onBulkFavorite: () => void;
  onBulkHidden: () => void;
  onBulkRating: (rating: number) => void;
  onBulkDelete: () => void;
  onBulkTag: (tag: string) => void;
  onAutoTag: () => void;
  onAutoTagView: () => void;
  onColumnsChange: (value: number) => void;
  onTileFitChange: (value: TileFit) => void;
  onSortModeChange: (value: SortMode) => void;
  onFavoritesOnlyChange: (value: boolean) => void;
  onHideHiddenChange: (value: boolean) => void;
  onMinRatingChange: (value: number) => void;
  onMaxRatingChange: (value: number) => void;
  onAddFilterTag: (tag: string) => void;
  onRemoveFilterTag: (tag: string) => void;
  onClearFilterTags: () => void;
  onExitUntagged: () => void;
  onOpenSlideshow: () => void;
};

const TopBar = React.forwardRef<HTMLElement, TopBarProps>(
  (
    {
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
      imageCount,
      loading,
      status,
      error,
      onOpenDrawer,
      onToggleTool,
      onDismissTool,
      onToggleMultiSelect,
      onClearSelection,
      onBulkFavorite,
      onBulkHidden,
      onBulkRating,
      onBulkDelete,
      onBulkTag,
      onAutoTag,
      onAutoTagView,
      onColumnsChange,
      onTileFitChange,
      onSortModeChange,
      onFavoritesOnlyChange,
      onHideHiddenChange,
      onMinRatingChange,
      onMaxRatingChange,
      onAddFilterTag,
      onRemoveFilterTag,
      onClearFilterTags,
      onExitUntagged,
      onOpenSlideshow
    },
    ref
  ) => {
    const toolPopoverRef = useRef<HTMLDivElement | null>(null);
    const toolButtonsRef = useRef<HTMLDivElement | null>(null);
    const [tagInput, setTagInput] = React.useState('');
    const [bulkTagInput, setBulkTagInput] = React.useState('');
    const [bulkRatingValue, setBulkRatingValue] = React.useState(0);

    const tagQuery = normalizeTagInput(tagInput);
    const filterSuggestions = availableTags.filter(
      (tag) => !selectedTags.includes(tag) && (!tagQuery || tag.includes(tagQuery))
    );
    const bulkTagQuery = normalizeTagInput(bulkTagInput);
    const bulkTagSuggestions = availableTags.filter(
      (tag) => !bulkTagQuery || tag.includes(bulkTagQuery)
    );
    const formatMinLabel = (value: number) => (value === 0 ? 'Any' : `${value}+`);
    const formatMaxLabel = (value: number) => (value === 5 ? 'Any' : `${value}`);

    React.useEffect(() => {
      if (!multiSelect || selectedCount === 0) {
        setBulkRatingValue(0);
      }
    }, [multiSelect, selectedCount]);

    const handleBulkRating = (rating: number) => {
      setBulkRatingValue(rating);
      onBulkRating(rating);
    };

    const handlePointerDown = (event: React.PointerEvent<HTMLElement>) => {
      if (!activeTool) return;
      const target = event.target as Node;
      if (toolPopoverRef.current?.contains(target)) return;
      if (toolButtonsRef.current?.contains(target)) return;
      onDismissTool();
    };

    return (
      <header
        ref={ref}
        className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur-sm"
        onPointerDown={handlePointerDown}
      >
        <div className="flex items-center gap-2 px-3 py-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={onOpenDrawer}
            aria-label="Open tags"
            title="Tags"
          >
            <Menu className="h-4 w-4" />
          </Button>

          <Badge variant="default" className="max-w-[200px] truncate" title={currentFilterLabel}>
            <span className="truncate">{currentFilterLabel}</span>
            <span className="ml-1 font-mono text-xs">{loading ? '…' : imageCount}</span>
          </Badge>

          <div className="ml-auto flex items-center gap-1" ref={toolButtonsRef}>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onOpenSlideshow}
              aria-label="Slideshow"
              title="Slideshow"
              disabled={imageCount === 0}
            >
              <Play className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={`h-8 w-8 ${multiSelect ? 'bg-primary/10 text-primary' : ''}`}
              onClick={onToggleMultiSelect}
              aria-label="Multi-select"
              title="Multi-select"
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={`h-8 w-8 ${activeTool === 'view' ? 'bg-primary/10 text-primary' : ''}`}
              onClick={() => onToggleTool('view')}
              aria-label="View options"
              title="View"
            >
              <SlidersHorizontal className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={`h-8 w-8 ${activeTool === 'filters' ? 'bg-primary/10 text-primary' : ''}`}
              onClick={() => onToggleTool('filters')}
              aria-label="Filters"
              title="Filters"
            >
              <Filter className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={`h-8 w-8 ${activeTool === 'search' ? 'bg-primary/10 text-primary' : ''}`}
              onClick={() => onToggleTool('search')}
              aria-label="Search"
              title="Search"
            >
              <Search className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {multiSelect && (
          <TopBarBulkActions
            selectedCount={selectedCount}
            imageCount={imageCount}
            bulkRatingValue={bulkRatingValue}
            onBulkRatingChange={handleBulkRating}
            bulkTagInput={bulkTagInput}
            onBulkTagInputChange={setBulkTagInput}
            bulkTagSuggestions={bulkTagSuggestions}
            onClearSelection={onClearSelection}
            onBulkFavorite={onBulkFavorite}
            onBulkHidden={onBulkHidden}
            onBulkDelete={onBulkDelete}
            onAutoTag={onAutoTag}
            onAutoTagView={onAutoTagView}
            onBulkTag={onBulkTag}
          />
        )}

        {activeTool && (
          <div
            ref={toolPopoverRef}
            role="dialog"
            aria-label="Tool options"
            className="border-t bg-background p-3 space-y-3"
          >
            <TopBarToolPopover
              activeTool={activeTool}
              effectiveColumns={effectiveColumns}
              maxColumns={maxColumns}
              tileFit={tileFit}
              sortMode={sortMode}
              onColumnsChange={onColumnsChange}
              onTileFitChange={onTileFitChange}
              onSortModeChange={onSortModeChange}
              favoritesOnly={favoritesOnly}
              hideHidden={hideHidden}
              onFavoritesOnlyChange={onFavoritesOnlyChange}
              onHideHiddenChange={onHideHiddenChange}
              minRating={minRating}
              maxRating={maxRating}
              onMinRatingChange={onMinRatingChange}
              onMaxRatingChange={onMaxRatingChange}
              formatMinLabel={formatMinLabel}
              formatMaxLabel={formatMaxLabel}
              selectedTags={selectedTags}
              showUntagged={showUntagged}
              onClearFilterTags={onClearFilterTags}
              onExitUntagged={onExitUntagged}
              onRemoveFilterTag={onRemoveFilterTag}
              tagInput={tagInput}
              onTagInputChange={setTagInput}
              onAddFilterTag={onAddFilterTag}
              filterSuggestions={filterSuggestions}
            />
          </div>
        )}

        {(error || status) && (
          <div className="border-t px-3 py-1.5 text-xs" aria-live="polite">
            {error && (
              <div className="text-destructive" role="alert">
                {error}
              </div>
            )}
            {status && !error && <div className="text-muted-foreground">{status}</div>}
          </div>
        )}
      </header>
    );
  }
);

TopBar.displayName = 'TopBar';

export default TopBar;
