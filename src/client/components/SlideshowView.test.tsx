import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SlideshowView from './SlideshowView';
import type { ImageItem, SlideshowSettings } from '../types';

const images: ImageItem[] = [
  {
    id: 'a',
    name: 'A',
    url: '/a.png',
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
    favorite: false,
    hidden: false,
    rating: 0,
    tags: [],
    createdMs: 1,
    mtimeMs: 1,
    size: 1
  }
];

const manualSettings: SlideshowSettings = {
  order: 'none',
  mode: 'manual',
  fixedInterval: 5,
  minInterval: 3,
  maxInterval: 8,
  showProgress: true
};

class InstantImage {
  onload = null;

  onerror = null;

  set src(_value: string) {
    this.onload?.();
  }
}

describe('SlideshowView', () => {
  beforeEach(() => {
    vi.stubGlobal('Image', InstantImage);
  });

  afterEach(() => {
    document.body.classList.remove('slideshow-open');
  });

  it('adds body class while open and closes on escape', () => {
    const onClose = vi.fn();
    render(<SlideshowView images={images} settings={manualSettings} onClose={onClose} />);

    expect(document.body.classList.contains('slideshow-open')).toBe(true);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('navigates between images using controls', () => {
    render(<SlideshowView images={images} settings={manualSettings} onClose={vi.fn()} />);

    expect(screen.getByText('1 / 2')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /next image/i }));
    expect(screen.getByText('2 / 2')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /previous image/i }));
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
  });
});
