import React, { useCallback, useState } from 'react';
import ImageCard from './ImageCard';
import type { ImageItem, TileFit } from '../types';

type GalleryProps = {
  images: ImageItem[];
  tileFit: TileFit;
  tileSize: number;
  columns: number;
  onSelectImage: (id: string) => void;
  onToggleFavorite: (image: ImageItem) => void;
  onToggleHidden: (image: ImageItem) => void;
};

const Gallery = React.forwardRef<HTMLElement, GalleryProps>(
  ({ images, tileFit, tileSize, columns, onSelectImage, onToggleFavorite, onToggleHidden }, ref) => {
    const [ratios, setRatios] = useState<Record<string, number>>({});

    const handleImageLoad = useCallback((id: string, element: HTMLImageElement) => {
      if (!element.naturalWidth || !element.naturalHeight) return;
      const nextRatio = Number((element.naturalWidth / element.naturalHeight).toFixed(3));
      setRatios((prev) => {
        if (prev[id] === nextRatio) return prev;
        return { ...prev, [id]: nextRatio };
      });
    }, []);

    const getContentStyle = (image: ImageItem): React.CSSProperties | undefined => {
      if (tileFit !== 'contain') return undefined;
      const ratio = ratios[image.id];
      if (!ratio) {
        return { width: tileSize, height: tileSize };
      }
      const width = ratio >= 1 ? tileSize * ratio : tileSize;
      const height = ratio >= 1 ? tileSize : tileSize / ratio;
      return { width: Math.round(width), height: Math.round(height) };
    };

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
        {images.map((image) => (
          <ImageCard
            key={image.id}
            image={image}
            tileFit={tileFit}
            style={getContentStyle(image)}
            onSelect={() => onSelectImage(image.id)}
            onToggleFavorite={() => onToggleFavorite(image)}
            onToggleHidden={() => onToggleHidden(image)}
            onImageLoad={(element) => handleImageLoad(image.id, element)}
          />
        ))}
      </main>
    );
  }
);

Gallery.displayName = 'Gallery';

export default Gallery;
