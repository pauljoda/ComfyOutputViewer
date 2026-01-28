import type { CSSProperties } from 'react';
import type { ImageItem, TileFit } from '../types';

type ImageCardProps = {
  image: ImageItem;
  tileFit: TileFit;
  style?: CSSProperties;
  onSelect: () => void;
  onToggleFavorite: () => void;
  onToggleHidden: () => void;
  onImageLoad: (element: HTMLImageElement) => void;
};

export default function ImageCard({
  image,
  tileFit,
  style,
  onSelect,
  onToggleFavorite,
  onToggleHidden,
  onImageLoad
}: ImageCardProps) {
  return (
    <button
      className={`card ${tileFit} ${image.hidden ? 'hidden' : ''}`}
      type="button"
      onClick={onSelect}
      style={style}
    >
      <img
        src={image.thumbUrl || image.url}
        alt={image.name}
        loading="lazy"
        decoding="async"
        fetchPriority="low"
        onLoad={(event) => onImageLoad(event.currentTarget)}
        onError={(event) => {
          if (!image.thumbUrl) return;
          const target = event.currentTarget;
          target.onerror = null;
          target.src = image.url;
        }}
      />
      <div className="card-overlay">
        <div className="card-actions">
          <button
            className={image.favorite ? 'fav active' : 'fav'}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onToggleFavorite();
            }}
            aria-label={image.favorite ? 'Unfavorite' : 'Favorite'}
          >
            ★
          </button>
          <button
            className={image.hidden ? 'hide active' : 'hide'}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onToggleHidden();
            }}
            aria-label={image.hidden ? 'Unhide' : 'Hide'}
          >
            {image.hidden ? 'Hidden' : 'Hide'}
          </button>
        </div>
      </div>
    </button>
  );
}
