import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ImageCard from './ImageCard';
import type { ImageItem } from '../types';

const image: ImageItem = {
  id: 'img-1',
  name: 'Sample',
  url: '/images/full.png',
  thumbUrl: '/images/thumb.png',
  favorite: false,
  hidden: false,
  rating: 3,
  tags: ['portrait'],
  createdMs: 1,
  mtimeMs: 1,
  size: 1
};

describe('ImageCard', () => {
  it('selects card and toggles favorite/hidden actions', () => {
    const onSelectImage = vi.fn();
    const onToggleFavorite = vi.fn();
    const onToggleHidden = vi.fn();
    const onImageLoad = vi.fn();
    render(
      <ImageCard
        image={image}
        tileSize={180}
        tileFit="cover"
        selected={false}
        multiSelect={false}
        onSelectImage={onSelectImage}
        onToggleFavorite={onToggleFavorite}
        onToggleHidden={onToggleHidden}
        onImageLoad={onImageLoad}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /favorite/i }));
    fireEvent.click(screen.getByRole('button', { name: /hide/i }));
    fireEvent.click(screen.getByRole('button', { name: /sample/i }));

    expect(onToggleFavorite).toHaveBeenCalledWith(image);
    expect(onToggleHidden).toHaveBeenCalledWith(image);
    expect(onSelectImage).toHaveBeenCalledWith('img-1');
  });

  it('falls back to original image when thumbnail fails', () => {
    const { container } = render(
      <ImageCard
        image={image}
        tileSize={180}
        tileFit="cover"
        selected={false}
        multiSelect={false}
        onSelectImage={vi.fn()}
        onToggleFavorite={vi.fn()}
        onToggleHidden={vi.fn()}
        onImageLoad={vi.fn()}
      />
    );
    const img = container.querySelector('img');
    expect(img?.getAttribute('src')).toContain('/images/thumb.png');

    fireEvent.error(img as HTMLImageElement);

    expect(img?.getAttribute('src')).toContain('/images/full.png');
  });
});
