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
            className={image.hidden ? 'card-action hide active' : 'card-action hide'}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onToggleHidden();
            }}
            aria-label={image.hidden ? 'Unhide' : 'Hide'}
            title={image.hidden ? 'Hidden' : 'Hide'}
          >
            {image.hidden ? (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                />
                <path
                  d="M4 4l16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                />
                <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.6" />
              </svg>
            )}
          </button>
          <button
            className={image.favorite ? 'card-action fav active' : 'card-action fav'}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onToggleFavorite();
            }}
            aria-label={image.favorite ? 'Unfavorite' : 'Favorite'}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 3.8l2.5 5 5.5.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.5-.8z" />
            </svg>
          </button>
        </div>
      </div>
    </button>
  );
}
