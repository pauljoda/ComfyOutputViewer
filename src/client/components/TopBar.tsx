import React, { useRef } from 'react';
import {
  Menu,
  Play,
  Grid3X3,
  SlidersHorizontal,
  Filter,
  Search,
  Heart,
  EyeOff,
  Star,
  Trash2,
  Tag,
  Wand2
} from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { COLUMN_MIN } from '../constants';
import type {
  ActiveTool,
  SortMode,
  TileFit,
  ToolPanel
} from '../types';
import RatingStars from './RatingStars';
import { normalizeTagInput } from '../utils/tags';

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
        {/* Toolbar row */}
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
            <span className="ml-1 font-mono text-xs">
              {loading ? '…' : imageCount}
            </span>
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

        {/* Multi-select bulk actions */}
        {multiSelect && (
          <div className="border-t bg-muted/50 px-3 py-2 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium">Multi-select</span>
              <Badge variant="outline">{selectedCount} selected</Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearSelection}
                disabled={selectedCount === 0}
              >
                Clear
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onBulkFavorite}
                disabled={selectedCount === 0}
              >
                <Heart className="mr-1 h-3.5 w-3.5" />
                Favorite
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onBulkHidden}
                disabled={selectedCount === 0}
              >
                <EyeOff className="mr-1 h-3.5 w-3.5" />
                Hide
              </Button>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Rate</span>
                <RatingStars
                  value={bulkRatingValue}
                  onChange={handleBulkRating}
                  size="sm"
                  disabled={selectedCount === 0}
                  allowClear
                  label="Rate selected images"
                />
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={onBulkDelete}
                disabled={selectedCount === 0}
              >
                <Trash2 className="mr-1 h-3.5 w-3.5" />
                Remove
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onAutoTag}
                disabled={selectedCount === 0}
              >
                <Wand2 className="mr-1 h-3.5 w-3.5" />
                Auto Tag
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onAutoTagView}
                disabled={imageCount === 0}
              >
                <Wand2 className="mr-1 h-3.5 w-3.5" />
                Auto Tag View
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <input
                list="bulk-tag-suggestions"
                name="bulkTag"
                autoComplete="off"
                value={bulkTagInput}
                onChange={(event) => setBulkTagInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    if (bulkTagInput.trim() && selectedCount > 0) {
                      onBulkTag(bulkTagInput);
                      setBulkTagInput('');
                    }
                  }
                }}
                placeholder="Tag selected…"
                aria-label="Tag selected"
                disabled={selectedCount === 0}
                className="h-8 flex-1 rounded-md border border-input bg-background px-2 text-sm"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onBulkTag(bulkTagInput);
                  setBulkTagInput('');
                }}
                disabled={!bulkTagInput.trim() || selectedCount === 0}
              >
                <Tag className="mr-1 h-3.5 w-3.5" />
                Tag all
              </Button>
            </div>
            {bulkTagSuggestions.length > 0 && selectedCount > 0 && (
              <div className="max-h-28 overflow-y-auto rounded-md border border-border/70 bg-muted/20 p-1.5">
                <div className="flex flex-wrap gap-1">
                  {bulkTagSuggestions.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => {
                        onBulkTag(tag);
                        setBulkTagInput('');
                      }}
                      title="Tag selected"
                      className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground hover:bg-secondary/80"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <datalist id="bulk-tag-suggestions">
              {bulkTagSuggestions.map((tag) => (
                <option key={tag} value={tag} />
              ))}
            </datalist>
          </div>
        )}

        {/* Tool popovers */}
        {activeTool && (
          <div
            ref={toolPopoverRef}
            role="dialog"
            aria-label="Tool options"
            className="border-t bg-background p-3 space-y-3"
          >
            {activeTool === 'view' && (
              <div className="space-y-3">
                <label className="flex items-center justify-between text-sm">
                  <span>Columns ({effectiveColumns})</span>
                  <input
                    type="range"
                    min={COLUMN_MIN}
                    max={maxColumns}
                    value={effectiveColumns}
                    onChange={(event) => onColumnsChange(Number(event.target.value))}
                    className="w-32 accent-primary"
                  />
                </label>
                <label className="flex items-center justify-between text-sm">
                  <span>Display</span>
                  <select
                    value={tileFit}
                    onChange={(event) => onTileFitChange(event.target.value as TileFit)}
                    className="rounded-md border border-input bg-background px-2 py-1 text-sm"
                  >
                    <option value="cover">Cover</option>
                    <option value="contain">Content</option>
                  </select>
                </label>
                <label className="flex items-center justify-between text-sm">
                  <span>Sort</span>
                  <select
                    value={sortMode}
                    onChange={(event) => onSortModeChange(event.target.value as SortMode)}
                    className="rounded-md border border-input bg-background px-2 py-1 text-sm"
                  >
                    <option value="created-desc">Created (newest)</option>
                    <option value="created-asc">Created (oldest)</option>
                    <option value="modified-desc">Modified (newest)</option>
                    <option value="modified-asc">Modified (oldest)</option>
                    <option value="name-asc">Name (A-Z)</option>
                    <option value="name-desc">Name (Z-A)</option>
                    <option value="size-desc">File size (largest)</option>
                    <option value="size-asc">File size (smallest)</option>
                    <option value="rating-desc">Rating (high to low)</option>
                    <option value="rating-asc">Rating (low to high)</option>
                  </select>
                </label>
              </div>
            )}

            {activeTool === 'filters' && (
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={favoritesOnly}
                    onChange={(event) => onFavoritesOnlyChange(event.target.checked)}
                    className="accent-primary"
                  />
                  <Heart className="h-3.5 w-3.5" />
                  Favorites only
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={hideHidden}
                    onChange={(event) => onHideHiddenChange(event.target.checked)}
                    className="accent-primary"
                  />
                  <EyeOff className="h-3.5 w-3.5" />
                  Hide hidden
                </label>
                <div className="space-y-2 rounded-md border border-border/70 bg-muted/20 p-2">
                  <div className="text-sm font-medium">Rating range</div>
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="shrink-0 text-xs text-muted-foreground">Min</span>
                    <RatingStars
                      value={minRating}
                      onChange={(value) => onMinRatingChange(value)}
                      allowClear
                      size="sm"
                      label="Minimum rating"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => onMinRatingChange(0)}
                    >
                      {formatMinLabel(minRating)}
                    </Button>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="shrink-0 text-xs text-muted-foreground">Max</span>
                    <RatingStars
                      value={maxRating}
                      onChange={(value) => onMaxRatingChange(value === 0 ? 5 : value)}
                      allowClear
                      size="sm"
                      label="Maximum rating"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => onMaxRatingChange(5)}
                    >
                      {formatMaxLabel(maxRating)}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Tags (match all)</span>
                    {selectedTags.length > 0 && (
                      <Button variant="ghost" size="sm" onClick={onClearFilterTags}>
                        Clear
                      </Button>
                    )}
                  </div>
                  {showUntagged && (
                    <div className="rounded-md bg-muted p-2 text-xs">
                      Viewing untagged images.
                      <Button variant="ghost" size="sm" className="ml-1" onClick={onExitUntagged}>
                        Back to all
                      </Button>
                    </div>
                  )}
                  <div className="max-h-24 overflow-y-auto rounded-md border border-border/70 bg-muted/20 p-1.5">
                    <div className="flex flex-wrap gap-1">
                      {selectedTags.length === 0 && (
                        <span className="text-xs text-muted-foreground">No tags selected.</span>
                      )}
                      {selectedTags.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => onRemoveFilterTag(tag)}
                          title="Remove tag"
                          className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground hover:opacity-80"
                        >
                          {tag}
                          <span aria-hidden="true">x</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      list="tag-filter-suggestions"
                      name="filterTag"
                      autoComplete="off"
                      value={tagInput}
                      onChange={(event) => setTagInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          if (!tagInput.trim()) return;
                          onAddFilterTag(tagInput);
                          setTagInput('');
                        }
                      }}
                      placeholder="Add tag filter…"
                      aria-label="Add tag filter"
                      className="h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8"
                      onClick={() => {
                        if (!tagInput.trim()) return;
                        onAddFilterTag(tagInput);
                        setTagInput('');
                      }}
                      disabled={!tagInput.trim()}
                    >
                      Add
                    </Button>
                  </div>
                  {filterSuggestions.length > 0 && (
                    <div className="max-h-28 overflow-y-auto rounded-md border border-border/70 bg-muted/20 p-1.5">
                      <div className="flex flex-wrap gap-1">
                        {filterSuggestions.map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => {
                              onAddFilterTag(tag);
                              setTagInput('');
                            }}
                            title="Add tag"
                            className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground hover:bg-secondary/80"
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <datalist id="tag-filter-suggestions">
                    {filterSuggestions.map((tag) => (
                      <option key={tag} value={tag} />
                    ))}
                  </datalist>
                </div>
              </div>
            )}

            {activeTool === 'search' && (
              <div className="text-sm text-muted-foreground">
                Search tools coming soon.
              </div>
            )}
          </div>
        )}

        {/* Status row */}
        {(error || status) && (
          <div className="border-t px-3 py-1.5 text-xs" aria-live="polite">
            {error && (
              <div className="text-destructive" role="alert">
                {error}
              </div>
            )}
            {status && !error && (
              <div className="text-muted-foreground">{status}</div>
            )}
          </div>
        )}
      </header>
    );
  }
);

TopBar.displayName = 'TopBar';

export default TopBar;
