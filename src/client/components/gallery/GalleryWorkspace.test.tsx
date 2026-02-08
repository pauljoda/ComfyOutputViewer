import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

const { apiMock } = vi.hoisted(() => ({
  apiMock: vi.fn()
}));

vi.mock('../../contexts/TagsContext', () => ({
  useTags: () => ({
    tagCounts: [{ tag: 'portrait', count: 1 }],
    availableTags: ['portrait'],
    updateFromImages: vi.fn()
  })
}));

vi.mock('../../lib/api', () => ({
  api: (...args) => apiMock(...args)
}));

vi.mock('../../lib/imagesApi', () => ({
  setFavorite: vi.fn(async () => ({ ok: true })),
  setHidden: vi.fn(async () => ({ ok: true })),
  setRating: vi.fn(async () => ({ ok: true })),
  setTags: vi.fn(async () => ({ ok: true })),
  deleteImage: vi.fn(async () => ({ ok: true, deleted: 1, blacklisted: 1 })),
  bulkFavorite: vi.fn(async () => ({ ok: true })),
  bulkHidden: vi.fn(async () => ({ ok: true })),
  bulkRating: vi.fn(async () => ({ ok: true })),
  bulkTags: vi.fn(async () => ({ ok: true })),
  bulkDelete: vi.fn(async () => ({ ok: true, deleted: 1, blacklisted: 1 }))
}));

vi.mock('../TopBar', () => ({
  default: ({ onOpenDrawer }) => (
    <button type="button" onClick={onOpenDrawer}>
      open-drawer
    </button>
  )
}));

vi.mock('../TagDrawer', () => ({
  default: ({ open, onSync }) =>
    open ? (
      <button type="button" onClick={onSync}>
        sync-now
      </button>
    ) : null
}));

vi.mock('../StatusBar', () => ({
  default: ({ imageCount }) => <div data-testid="status">count:{imageCount}</div>
}));

vi.mock('../Gallery', () => ({
  default: ({ images, onSelectImage }) => (
    <button type="button" onClick={() => onSelectImage(images[0].id)}>
      open-image
    </button>
  )
}));

vi.mock('../ImageModal', () => ({
  default: () => <div data-testid="modal">image-modal</div>
}));

vi.mock('../SlideshowSettingsModal', () => ({
  default: () => null
}));

vi.mock('../SlideshowView', () => ({
  default: () => null
}));

import GalleryWorkspace from './GalleryWorkspace';

function Layout() {
  return (
    <Outlet
      context={{
        themeMode: 'system',
        setThemeMode: vi.fn(),
        goHomeSignal: 0
      }}
    />
  );
}

describe('GalleryWorkspace', () => {
  it('loads images, syncs, and opens the image modal', async () => {
    apiMock
      .mockResolvedValueOnce({
        images: [
          {
            id: 'img-1',
            name: 'Image 1',
            url: '/images/img-1.png',
            favorite: false,
            hidden: false,
            rating: 0,
            tags: [],
            createdMs: 1,
            mtimeMs: 1,
            size: 1
          }
        ],
        sourceDir: '/source',
        dataDir: '/data'
      })
      .mockResolvedValueOnce({ scanned: 1, copied: 1, thumbnails: 1 })
      .mockResolvedValueOnce({
        images: [
          {
            id: 'img-1',
            name: 'Image 1',
            url: '/images/img-1.png',
            favorite: false,
            hidden: false,
            rating: 0,
            tags: [],
            createdMs: 1,
            mtimeMs: 1,
            size: 1
          }
        ],
        sourceDir: '/source',
        dataDir: '/data'
      });

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<GalleryWorkspace />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('count:1');
    });

    fireEvent.click(screen.getByRole('button', { name: 'open-drawer' }));
    fireEvent.click(screen.getByRole('button', { name: 'sync-now' }));

    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledWith('/api/sync', { method: 'POST' });
    });

    fireEvent.click(screen.getByRole('button', { name: 'open-image' }));
    expect(screen.getByTestId('modal')).toBeInTheDocument();
  });
});
