import React, { useRef } from 'react';
import { COLUMN_MIN } from '../constants';
import type {
  ActiveTool,
  SortMode,
  ThemeMode,
  TileFit,
  ToolPanel
} from '../types';

type TopBarProps = {
  version: string;
  sourceDir: string;
  currentFolderLabel: string;
  activeTool: ActiveTool;
  effectiveColumns: number;
  maxColumns: number;
  tileFit: TileFit;
  sortMode: SortMode;
  themeMode: ThemeMode;
  favoritesOnly: boolean;
  hideHidden: boolean;
  onOpenDrawer: () => void;
  onToggleTool: (tool: ToolPanel) => void;
  onDismissTool: () => void;
  onColumnsChange: (value: number) => void;
  onTileFitChange: (value: TileFit) => void;
  onSortModeChange: (value: SortMode) => void;
  onThemeModeChange: (value: ThemeMode) => void;
  onFavoritesOnlyChange: (value: boolean) => void;
  onHideHiddenChange: (value: boolean) => void;
};

const TopBar = React.forwardRef<HTMLElement, TopBarProps>(
  (
    {
      version,
      sourceDir,
      currentFolderLabel,
      activeTool,
      effectiveColumns,
      maxColumns,
      tileFit,
      sortMode,
      themeMode,
      favoritesOnly,
      hideHidden,
      onOpenDrawer,
      onToggleTool,
      onDismissTool,
      onColumnsChange,
      onTileFitChange,
      onSortModeChange,
      onThemeModeChange,
      onFavoritesOnlyChange,
      onHideHiddenChange
    },
    ref
  ) => {
    const toolPopoverRef = useRef<HTMLDivElement | null>(null);
    const toolButtonsRef = useRef<HTMLDivElement | null>(null);

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
              aria-label="Open folders"
              title="Folders"
            >
              <span className="hamburger" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
            </button>

            <div className="folder-pill" title={currentFolderLabel}>
              {currentFolderLabel}
            </div>

            <div className="toolbar-actions" ref={toolButtonsRef}>
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

                <div className="tool-hint">More filters coming soon.</div>
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
