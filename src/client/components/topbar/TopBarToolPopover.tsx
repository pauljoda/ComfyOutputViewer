import { EyeOff, Heart } from 'lucide-react';
import { COLUMN_MIN } from '../../constants';
import type { ActiveTool, SortMode, TileFit } from '../../types';
import { Button } from '../ui/button';
import RatingStars from '../RatingStars';

type TopBarToolPopoverProps = {
  activeTool: Exclude<ActiveTool, null>;
  effectiveColumns: number;
  maxColumns: number;
  tileFit: TileFit;
  sortMode: SortMode;
  onColumnsChange: (value: number) => void;
  onTileFitChange: (value: TileFit) => void;
  onSortModeChange: (value: SortMode) => void;
  favoritesOnly: boolean;
  hideHidden: boolean;
  onFavoritesOnlyChange: (value: boolean) => void;
  onHideHiddenChange: (value: boolean) => void;
  minRating: number;
  maxRating: number;
  onMinRatingChange: (value: number) => void;
  onMaxRatingChange: (value: number) => void;
  formatMinLabel: (value: number) => string;
  formatMaxLabel: (value: number) => string;
  selectedTags: string[];
  showUntagged: boolean;
  onClearFilterTags: () => void;
  onExitUntagged: () => void;
  onRemoveFilterTag: (tag: string) => void;
  tagInput: string;
  onTagInputChange: (value: string) => void;
  onAddFilterTag: (tag: string) => void;
  filterSuggestions: string[];
};

export default function TopBarToolPopover({
  activeTool,
  effectiveColumns,
  maxColumns,
  tileFit,
  sortMode,
  onColumnsChange,
  onTileFitChange,
  onSortModeChange,
  favoritesOnly,
  hideHidden,
  onFavoritesOnlyChange,
  onHideHiddenChange,
  minRating,
  maxRating,
  onMinRatingChange,
  onMaxRatingChange,
  formatMinLabel,
  formatMaxLabel,
  selectedTags,
  showUntagged,
  onClearFilterTags,
  onExitUntagged,
  onRemoveFilterTag,
  tagInput,
  onTagInputChange,
  onAddFilterTag,
  filterSuggestions
}: TopBarToolPopoverProps) {
  return (
    <>
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
                onChange={(event) => onTagInputChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    if (!tagInput.trim()) return;
                    onAddFilterTag(tagInput);
                    onTagInputChange('');
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
                  onTagInputChange('');
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
                        onTagInputChange('');
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
    </>
  );
}
