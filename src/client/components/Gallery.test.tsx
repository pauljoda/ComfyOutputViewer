import { fireEvent, render, screen } from '@testing-library/react';
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
});
