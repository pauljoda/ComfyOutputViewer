import React, { useRef } from 'react';
import { COLUMN_MIN } from '../constants';
import type {
  ActiveTool,
  SortMode,
  ThemeMode,
  TileFit,
  ToolPanel
} from '../types';
import { normalizeTagInput } from '../utils/tags';

type TopBarProps = {
  version: string;
  sourceDir: string;
  currentFilterLabel: string;
  activeTool: ActiveTool;
  multiSelect: boolean;
  selectedCount: number;
  effectiveColumns: number;
  maxColumns: number;
  tileFit: TileFit;
  sortMode: SortMode;
  themeMode: ThemeMode;
  favoritesOnly: boolean;
  hideHidden: boolean;
  selectedTags: string[];
  availableTags: string[];
  showUntagged: boolean;
  onOpenDrawer: () => void;
  onToggleTool: (tool: ToolPanel) => void;
  onDismissTool: () => void;
  onToggleMultiSelect: () => void;
  onClearSelection: () => void;
  onBulkFavorite: () => void;
  onBulkHidden: () => void;
  onBulkDelete: () => void;
  onBulkTag: (tag: string) => void;
  onColumnsChange: (value: number) => void;
  onTileFitChange: (value: TileFit) => void;
  onSortModeChange: (value: SortMode) => void;
  onThemeModeChange: (value: ThemeMode) => void;
  onFavoritesOnlyChange: (value: boolean) => void;
  onHideHiddenChange: (value: boolean) => void;
  onAddFilterTag: (tag: string) => void;
  onRemoveFilterTag: (tag: string) => void;
  onClearFilterTags: () => void;
  onExitUntagged: () => void;
};

const TopBar = React.forwardRef<HTMLElement, TopBarProps>(
  (
    {
      version,
      sourceDir,
      currentFilterLabel,
      activeTool,
      multiSelect,
      selectedCount,
      effectiveColumns,
      maxColumns,
      tileFit,
      sortMode,
      themeMode,
      favoritesOnly,
      hideHidden,
      selectedTags,
      availableTags,
      showUntagged,
      onOpenDrawer,
      onToggleTool,
      onDismissTool,
      onToggleMultiSelect,
      onClearSelection,
      onBulkFavorite,
      onBulkHidden,
      onBulkDelete,
      onBulkTag,
      onColumnsChange,
      onTileFitChange,
      onSortModeChange,
      onThemeModeChange,
      onFavoritesOnlyChange,
      onHideHiddenChange,
      onAddFilterTag,
      onRemoveFilterTag,
      onClearFilterTags,
      onExitUntagged
    },
    ref
  ) => {
    const toolPopoverRef = useRef<HTMLDivElement | null>(null);
    const toolButtonsRef = useRef<HTMLDivElement | null>(null);
    const [tagInput, setTagInput] = React.useState('');
    const [bulkTagInput, setBulkTagInput] = React.useState('');
    const tagQuery = normalizeTagInput(tagInput);
    const filterSuggestions = availableTags.filter(
      (tag) => !selectedTags.includes(tag) && (!tagQuery || tag.includes(tagQuery))
    );
    const bulkTagQuery = normalizeTagInput(bulkTagInput);
    const bulkTagSuggestions = availableTags.filter(
      (tag) => !bulkTagQuery || tag.includes(bulkTagQuery)
    );

    const handlePointerDown = (event: React.PointerEvent<HTMLElement>) => {
      if (!activeTool) return;
      const target = event.target as Node;
      if (toolPopoverRef.current?.contains(target)) return;
      if (toolButtonsRef.current?.contains(target)) return;
      onDismissTool();
    };

    return (
      <header className="top-bar" ref={ref} onPointerDown={handlePointerDown}>
        <div className="top-row">
          <div className="brand">
            <div className="title">
              Comfy Output Viewer <span className="version">v{version}</span>
            </div>
            <div className="subtitle">{sourceDir || 'No source configured'}</div>
          </div>
        </div>

        <div className="toolbar-row">
          <div className="toolbar">
            <button
              className="tool-button"
              type="button"
              onClick={onOpenDrawer}
              aria-label="Open tags"
              title="Tags"
            >
              <span className="hamburger" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
            </button>

            <div className="filter-pill" title={currentFilterLabel}>
              {currentFilterLabel}
            </div>

            <div className="toolbar-actions" ref={toolButtonsRef}>
              <button
                className={multiSelect ? 'tool-button active' : 'tool-button'}
                type="button"
                onClick={onToggleMultiSelect}
                aria-label="Multi-select"
                title="Multi-select"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <rect
                    x="4"
                    y="4"
                    width="7"
                    height="7"
                    rx="1.4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                  />
                  <rect
                    x="13"
                    y="4"
                    width="7"
                    height="7"
                    rx="1.4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                  />
                  <rect
                    x="4"
                    y="13"
                    width="7"
                    height="7"
                    rx="1.4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                  />
                </svg>
              </button>
              <button
                className={activeTool === 'view' ? 'tool-button active' : 'tool-button'}
                type="button"
                onClick={() => onToggleTool('view')}
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
                onClick={() => onToggleTool('filters')}
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
                onClick={() => onToggleTool('search')}
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
            </div>
          </div>
        </div>

        {multiSelect && (
          <div className="bulk-row">
            <div className="bulk-summary">
              <span className="bulk-label">Multi-select</span>
              <span className="bulk-count">{selectedCount} selected</span>
              <button
                className="ghost"
                type="button"
                onClick={onClearSelection}
                disabled={selectedCount === 0}
              >
                Clear
              </button>
            </div>
            <div className="bulk-actions">
              <button
                className="button"
                type="button"
                onClick={onBulkFavorite}
                disabled={selectedCount === 0}
              >
                Favorite all
              </button>
              <button
                className="button"
                type="button"
                onClick={onBulkHidden}
                disabled={selectedCount === 0}
              >
                Hide all
              </button>
              <button
                className="button danger"
                type="button"
                onClick={onBulkDelete}
                disabled={selectedCount === 0}
              >
                Remove selected
              </button>
              <div className="tag-input-row bulk-tag-input">
                <input
                  list="bulk-tag-suggestions"
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
                />
                <button
                  className="button"
                  type="button"
                  onClick={() => {
                    onBulkTag(bulkTagInput);
                    setBulkTagInput('');
                  }}
                  disabled={!bulkTagInput.trim() || selectedCount === 0}
                >
                  Tag all
                </button>
              </div>
            </div>
            {bulkTagSuggestions.length > 0 && selectedCount > 0 && (
              <div className="tag-chip-list tag-suggestions">
                {bulkTagSuggestions.map((tag) => (
                  <button
                    key={tag}
                    className="tag-chip"
                    type="button"
                    onClick={() => {
                      onBulkTag(tag);
                      setBulkTagInput('');
                    }}
                    title="Tag selected"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}
            <datalist id="bulk-tag-suggestions">
              {bulkTagSuggestions.map((tag) => (
                <option key={tag} value={tag} />
              ))}
            </datalist>
          </div>
        )}

        {activeTool && (
          <div
            className="tool-popover"
            role="dialog"
            aria-label="Tool options"
            ref={toolPopoverRef}
          >
            {activeTool === 'view' && (
              <div className="tool-panel">
                <label className="control">
                  <span>Columns ({effectiveColumns})</span>
                  <input
                    type="range"
                    min={COLUMN_MIN}
                    max={maxColumns}
                    value={effectiveColumns}
                    onChange={(event) => onColumnsChange(Number(event.target.value))}
                  />
                </label>

                <label className="control">
                  <span>Display</span>
                  <select
                    value={tileFit}
                    onChange={(event) => onTileFitChange(event.target.value as TileFit)}
                  >
                    <option value="cover">Cover</option>
                    <option value="contain">Content</option>
                  </select>
                </label>

                <label className="control">
                  <span>Sort</span>
                  <select
                    value={sortMode}
                    onChange={(event) => onSortModeChange(event.target.value as SortMode)}
                  >
                    <option value="created-desc">Created (newest)</option>
                    <option value="created-asc">Created (oldest)</option>
                    <option value="modified-desc">Modified (newest)</option>
                    <option value="modified-asc">Modified (oldest)</option>
                    <option value="name-asc">Name (A-Z)</option>
                    <option value="name-desc">Name (Z-A)</option>
                    <option value="size-desc">File size (largest)</option>
                    <option value="size-asc">File size (smallest)</option>
                  </select>
                </label>

                <label className="control">
                  <span>Theme</span>
                  <select
                    value={themeMode}
                    onChange={(event) => onThemeModeChange(event.target.value as ThemeMode)}
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
                    onChange={(event) => onFavoritesOnlyChange(event.target.checked)}
                  />
                  <span>Favorites only</span>
                </label>

                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={hideHidden}
                    onChange={(event) => onHideHiddenChange(event.target.checked)}
                  />
                  <span>Hide hidden</span>
                </label>

                <div className="tag-filter">
                  <div className="tag-filter-header">
                    <span>Tags (match all)</span>
                    {selectedTags.length > 0 && (
                      <button className="ghost" type="button" onClick={onClearFilterTags}>
                        Clear
                      </button>
                    )}
                  </div>
                  {showUntagged && (
                    <div className="tag-filter-note">
                      Viewing untagged images.
                      <button className="ghost" type="button" onClick={onExitUntagged}>
                        Back to all
                      </button>
                    </div>
                  )}
                  <div className="tag-chip-list">
                    {selectedTags.length === 0 && (
                      <span className="tag-empty">No tags selected.</span>
                    )}
                    {selectedTags.map((tag) => (
                      <button
                        key={tag}
                        className="tag-chip"
                        type="button"
                        onClick={() => onRemoveFilterTag(tag)}
                        title="Remove tag"
                      >
                        {tag}
                        <span aria-hidden="true">×</span>
                      </button>
                    ))}
                  </div>
                  <div className="tag-input-row">
                    <input
                      list="tag-filter-suggestions"
                      value={tagInput}
                      onChange={(event) => setTagInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          if (tagInput.trim()) {
                            onAddFilterTag(tagInput);
                            setTagInput('');
                          }
                        }
                      }}
                      placeholder="Add tag…"
                      aria-label="Add tag filter"
                    />
                    <button
                      className="button"
                      type="button"
                      onClick={() => {
                        onAddFilterTag(tagInput);
                        setTagInput('');
                      }}
                      disabled={!tagInput.trim()}
                    >
                      Add
                    </button>
                  </div>
                  {filterSuggestions.length > 0 && (
                    <div className="tag-chip-list tag-suggestions">
                      {filterSuggestions.map((tag) => (
                        <button
                          key={tag}
                          className="tag-chip"
                          type="button"
                          onClick={() => {
                            onAddFilterTag(tag);
                            setTagInput('');
                          }}
                          title="Add tag"
                        >
                          {tag}
                        </button>
                      ))}
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
              <div className="tool-panel">
                <div className="tool-hint">Search tools coming soon.</div>
              </div>
            )}
          </div>
        )}
      </header>
    );
  }
);

TopBar.displayName = 'TopBar';

export default TopBar;
