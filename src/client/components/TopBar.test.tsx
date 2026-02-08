import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TopBar from './TopBar';

function createProps(overrides = {}) {
  return {
    currentFilterLabel: 'All images',
    activeTool: null,
    multiSelect: false,
    selectedCount: 0,
    effectiveColumns: 4,
    maxColumns: 10,
    tileFit: 'cover' as const,
    sortMode: 'created-desc' as const,
    themeMode: 'system' as const,
    favoritesOnly: false,
    hideHidden: true,
    minRating: 0,
    maxRating: 5,
    selectedTags: [],
    availableTags: ['portrait', 'night'],
    showUntagged: false,
    imageCount: 3,
    onOpenDrawer: vi.fn(),
    onToggleTool: vi.fn(),
    onDismissTool: vi.fn(),
    onToggleMultiSelect: vi.fn(),
    onClearSelection: vi.fn(),
    onBulkFavorite: vi.fn(),
    onBulkHidden: vi.fn(),
    onBulkRating: vi.fn(),
    onBulkDelete: vi.fn(),
    onBulkTag: vi.fn(),
    onColumnsChange: vi.fn(),
    onTileFitChange: vi.fn(),
    onSortModeChange: vi.fn(),
    onThemeModeChange: vi.fn(),
    onFavoritesOnlyChange: vi.fn(),
    onHideHiddenChange: vi.fn(),
    onMinRatingChange: vi.fn(),
    onMaxRatingChange: vi.fn(),
    onAddFilterTag: vi.fn(),
    onRemoveFilterTag: vi.fn(),
    onClearFilterTags: vi.fn(),
    onExitUntagged: vi.fn(),
    onOpenSlideshow: vi.fn(),
    ...overrides
  };
}

describe('TopBar', () => {
  it('fires toolbar actions', () => {
    const props = createProps();
    render(<TopBar {...props} />);

    fireEvent.click(screen.getByRole('button', { name: /open tags/i }));
    fireEvent.click(screen.getByRole('button', { name: /view options/i }));
    fireEvent.click(screen.getByRole('button', { name: /filters/i }));
    fireEvent.click(screen.getByRole('button', { name: /search/i }));
    fireEvent.click(screen.getByRole('button', { name: /multi-select/i }));

    expect(props.onOpenDrawer).toHaveBeenCalled();
    expect(props.onToggleTool).toHaveBeenCalledWith('view');
    expect(props.onToggleTool).toHaveBeenCalledWith('filters');
    expect(props.onToggleTool).toHaveBeenCalledWith('search');
    expect(props.onToggleMultiSelect).toHaveBeenCalled();
  });

  it('handles bulk actions in multi-select mode', () => {
    const props = createProps({ multiSelect: true, selectedCount: 2 });
    render(<TopBar {...props} />);

    fireEvent.click(screen.getByRole('button', { name: /^favorite$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^hide$/i }));
    fireEvent.click(screen.getByRole('button', { name: /remove/i }));
    fireEvent.click(screen.getByRole('button', { name: /tag all/i }));

    expect(props.onBulkFavorite).toHaveBeenCalled();
    expect(props.onBulkHidden).toHaveBeenCalled();
    expect(props.onBulkDelete).toHaveBeenCalled();
  });

  it('shows filter suggestions and dismisses popover on outside pointer', () => {
    const props = createProps({ activeTool: 'filters', selectedTags: ['night'] });
    const { container } = render(<TopBar {...props} />);

    fireEvent.click(screen.getByRole('button', { name: 'portrait' }));
    expect(props.onAddFilterTag).toHaveBeenCalledWith('portrait');

    fireEvent.pointerDown(container.querySelector('.filter-pill') as HTMLElement);
    expect(props.onDismissTool).toHaveBeenCalled();
  });
});
