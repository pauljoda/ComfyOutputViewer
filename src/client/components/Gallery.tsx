import React, { useCallback, useState } from 'react';
import ImageCard from './ImageCard';
import type { ImageItem, TileFit } from '../types';

type GalleryProps = {
  images: ImageItem[];
  tileFit: TileFit;
  tileSize: number;
  columns: number;
  multiSelect: boolean;
  selectedIds: Set<string>;
  onSelectImage: (id: string) => void;
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
    const [ratios, setRatios] = useState<Record<string, number>>({});

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
        ref={ref}
        className={`gallery ${tileFit === 'contain' ? 'content-fit' : ''}`}
        style={
          {
            '--tile-size': `${tileSize}px`,
            '--tile-columns': columns
          } as React.CSSProperties
        }
      >
        {images.length === 0 && (
          <div className="gallery-empty-state" aria-label="No images to display">
            <div className="gallery-empty-orb" />
            <p className="gallery-empty-text">No images to show</p>
          </div>
        )}
        {images.map((image, index) => (
          <ImageCard
            key={image.id}
            image={image}
            ratio={ratios[image.id]}
            tileSize={tileSize}
            tileFit={tileFit}
            selected={selectedIds.has(image.id)}
            multiSelect={multiSelect}
            cardIndex={index}
            onSelectImage={onSelectImage}
            onToggleFavorite={onToggleFavorite}
            onToggleHidden={onToggleHidden}
            onImageLoad={handleImageLoad}
          />
        ))}
      </main>
    );
  }
  )
);

Gallery.displayName = 'Gallery';

export default Gallery;
