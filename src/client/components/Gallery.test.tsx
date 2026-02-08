import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Gallery from './Gallery';
import type { ImageItem } from '../types';

const images: ImageItem[] = [
  {
    id: 'a',
    name: 'A',
    url: '/a.png',
    thumbUrl: '/a-thumb.png',
    favorite: false,
    hidden: false,
    rating: 0,
    tags: [],
    createdMs: 1,
    mtimeMs: 1,
    size: 1
  },
  {
    id: 'b',
    name: 'B',
    url: '/b.png',
    thumbUrl: '/b-thumb.png',
    favorite: true,
    hidden: false,
    rating: 5,
    tags: ['night'],
    createdMs: 2,
    mtimeMs: 2,
    size: 2
  }
];

describe('Gallery', () => {
  it('renders all images and delegates interactions', () => {
    const onSelectImage = vi.fn();
    const onToggleFavorite = vi.fn();
    const onToggleHidden = vi.fn();
    const { container } = render(
      <Gallery
        images={images}
        tileFit="contain"
        tileSize={200}
        columns={4}
        multiSelect={false}
        selectedIds={new Set()}
        onSelectImage={onSelectImage}
        onToggleFavorite={onToggleFavorite}
        onToggleHidden={onToggleHidden}
      />
    );

    expect(container.querySelectorAll('.card')).toHaveLength(2);
    fireEvent.click(container.querySelector('.card') as HTMLElement);
    expect(onSelectImage).toHaveBeenCalledWith('a');
  });

  it('progressively renders large galleries in batches', () => {
    let intersectionCallback: ((entries: Array<{ isIntersecting: boolean }>) => void) | null = null;

    class MockIntersectionObserver {
      constructor(callback: (...args: any[]) => void) {
        intersectionCallback = (entries) => callback(entries);
      }

      observe() {}

      disconnect() {}

      unobserve() {}
    }

    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver as never);
    try {
      const largeImages = Array.from({ length: 500 }, (_, index) => ({
        id: `id-${index}`,
        name: `Image ${index}`,
        url: `/img-${index}.png`,
        thumbUrl: `/img-${index}-thumb.png`,
        favorite: false,
        hidden: false,
        rating: 0,
        tags: [],
        createdMs: index,
        mtimeMs: index,
        size: index + 1
      })) satisfies ImageItem[];

      const { container } = render(
        <Gallery
          images={largeImages}
          tileFit="cover"
          tileSize={180}
          columns={4}
          multiSelect={false}
          selectedIds={new Set()}
          onSelectImage={vi.fn()}
          onToggleFavorite={vi.fn()}
          onToggleHidden={vi.fn()}
        />
      );

      expect(container.querySelectorAll('.card')).toHaveLength(360);

      act(() => {
        intersectionCallback?.([{ isIntersecting: true }]);
      });

      expect(container.querySelectorAll('.card')).toHaveLength(500);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('uses the empty gallery state when no images are available', () => {
    const { container } = render(
      <Gallery
        images={[]}
        tileFit="cover"
        tileSize={180}
        columns={4}
        multiSelect={false}
        selectedIds={new Set()}
        onSelectImage={vi.fn()}
        onToggleFavorite={vi.fn()}
        onToggleHidden={vi.fn()}
      />
    );

    expect(container.querySelector('.gallery.empty')).not.toBeNull();
    expect(screen.getByLabelText('No images to display')).toBeInTheDocument();
  });
});
