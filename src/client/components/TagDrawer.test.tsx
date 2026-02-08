import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TagDrawer from './TagDrawer';

describe('TagDrawer', () => {
  it('renders tag counts and forwards actions', () => {
    const onToggleTag = vi.fn();
    const onSelectAll = vi.fn();
    const onSelectUntagged = vi.fn();
    const onClose = vi.fn();
    const onSync = vi.fn();
    render(
      <TagDrawer
        open
        tags={[
          { tag: 'portrait', count: 4 },
          { tag: 'night', count: 2 }
        ]}
        selectedTags={['portrait']}
        showUntagged={false}
        totalCount={10}
        untaggedCount={3}
        onToggleTag={onToggleTag}
        onSelectAll={onSelectAll}
        onSelectUntagged={onSelectUntagged}
        onClose={onClose}
        onSync={onSync}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /all images/i }));
    fireEvent.click(screen.getByRole('button', { name: /untagged/i }));
    fireEvent.click(screen.getByRole('button', { name: /^portrait/i }));
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    fireEvent.click(screen.getByRole('button', { name: /sync/i }));

    expect(onSelectAll).toHaveBeenCalled();
    expect(onSelectUntagged).toHaveBeenCalled();
    expect(onToggleTag).toHaveBeenCalledWith('portrait');
    expect(onClose).toHaveBeenCalled();
    expect(onSync).toHaveBeenCalled();
  });
});
