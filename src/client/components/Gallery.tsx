import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ImageOff } from 'lucide-react';
import ImageCard from './ImageCard';
import type { ImageItem, TileFit } from '../types';

const INITIAL_RENDER_BATCH = 360;
const RENDER_BATCH_SIZE = 180;

type GalleryProps = {
  images: ImageItem[];
  tileFit: TileFit;
  tileSize: number;
  columns: number;
  multiSelect: boolean;
  selectedIds: Set<string>;
  onSelectImage: (id: string, options?: { shiftKey?: boolean }) => void;
  onToggleFavorite: (image: ImageItem) => void;
  onToggleHidden: (image: ImageItem) => void;
};

const Gallery = React.memo(
  React.forwardRef<HTMLElement, GalleryProps>(
  (
    {
      images,
      tileFit,
      tileSize,
      columns,
      multiSelect,
      selectedIds,
      onSelectImage,
      onToggleFavorite,
      onToggleHidden
    },
    ref
  ) => {
    const mainRef = useRef<HTMLElement | null>(null);
    const sentinelRef = useRef<HTMLDivElement | null>(null);
    const [ratios, setRatios] = useState<Record<string, number>>({});
    const [visibleCount, setVisibleCount] = useState(() =>
      Math.min(images.length, INITIAL_RENDER_BATCH)
    );

    const imageWindowKey = useMemo(() => {
      const firstId = images[0]?.id ?? '';
      const lastId = images[images.length - 1]?.id ?? '';
      return `${images.length}:${firstId}:${lastId}`;
    }, [images]);

    useEffect(() => {
      setVisibleCount(Math.min(images.length, INITIAL_RENDER_BATCH));
      setRatios({});
    }, [imageWindowKey, images.length]);

    useEffect(() => {
      if (visibleCount >= images.length) return undefined;
      const root = mainRef.current;
      const sentinel = sentinelRef.current;
      if (!root || !sentinel || typeof IntersectionObserver === 'undefined') return undefined;
      const prefetchMargin = Math.max(tileSize * 4, 900);
      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            setVisibleCount((current) =>
              current >= images.length
                ? current
                : Math.min(images.length, current + RENDER_BATCH_SIZE)
            );
            break;
          }
        },
        {
          root,
          rootMargin: `${prefetchMargin}px 0px`,
          threshold: 0
        }
      );
      observer.observe(sentinel);
      return () => observer.disconnect();
    }, [images.length, tileSize, visibleCount]);

    const visibleImages = useMemo(
      () => images.slice(0, visibleCount),
      [images, visibleCount]
    );
    const animateCards = visibleCount <= INITIAL_RENDER_BATCH;

    const setMainRef = useCallback(
      (element: HTMLElement | null) => {
        mainRef.current = element;
        if (!ref) return;
        if (typeof ref === 'function') {
          ref(element);
          return;
        }
        ref.current = element;
      },
      [ref]
    );

    const handleImageLoad = useCallback((id: string, element: HTMLImageElement) => {
      if (!element.naturalWidth || !element.naturalHeight) return;
      const nextRatio = Number((element.naturalWidth / element.naturalHeight).toFixed(3));
      setRatios((prev) => {
        if (prev[id] === nextRatio) return prev;
        return { ...prev, [id]: nextRatio };
      });
    }, []);

    return (
      <main
        ref={setMainRef}
        className="flex-1 px-3"
        style={
          {
            '--tile-size': `${tileSize}px`,
            '--tile-columns': columns
          } as React.CSSProperties
        }
      >
        {images.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground" aria-label="No images to display">
            <ImageOff className="h-12 w-12 opacity-40" />
            <p className="text-sm">No images to show</p>
          </div>
        )}
        {images.length > 0 && (
          <div className={tileFit === 'contain' ? 'gallery-grid content-fit' : 'gallery-grid'}>
            {visibleImages.map((image, index) => (
              <ImageCard
                key={image.id}
                image={image}
                renderIndex={index}
                animateIn={animateCards}
                ratio={ratios[image.id]}
                tileSize={tileSize}
                tileFit={tileFit}
                selected={selectedIds.has(image.id)}
                multiSelect={multiSelect}
                onSelectImage={onSelectImage}
                onToggleFavorite={onToggleFavorite}
                onToggleHidden={onToggleHidden}
                onImageLoad={handleImageLoad}
              />
            ))}
            {visibleCount < images.length && (
              <div ref={sentinelRef} aria-hidden="true" />
            )}
          </div>
        )}
      </main>
    );
  }
  )
);

Gallery.displayName = 'Gallery';

export default Gallery;
