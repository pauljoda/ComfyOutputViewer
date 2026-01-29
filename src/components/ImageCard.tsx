import type { CSSProperties } from 'react';
import type { ImageItem, TileFit } from '../types';

type ImageCardProps = {
  image: ImageItem;
  tileFit: TileFit;
  selected: boolean;
  multiSelect: boolean;
  style?: CSSProperties;
  onSelect: () => void;
  onToggleFavorite: () => void;
  onToggleHidden: () => void;
  onImageLoad: (element: HTMLImageElement) => void;
};

export default function ImageCard({
  image,
  tileFit,
  selected,
  multiSelect,
  style,
  onSelect,
  onToggleFavorite,
  onToggleHidden,
  onImageLoad
}: ImageCardProps) {
  return (
    <button
      className={`card ${tileFit} ${image.hidden ? 'hidden' : ''} ${
        selected ? 'selected' : ''
      } ${multiSelect ? 'multi-select' : ''}`}
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
        {multiSelect && (
          <div className={selected ? 'card-select active' : 'card-select'} aria-hidden="true">
            {selected && (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M6 12.5l3.2 3.2 8.2-8.4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </div>
        )}
        <div className="card-actions">
          {image.rating > 0 && (
            <div className="card-rating" aria-label={`Rated ${image.rating} out of 5`}>
              <span>{image.rating}</span>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 3.8l2.5 5 5.5.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.5-.8z" />
              </svg>
            </div>
          )}
          <div className="card-actions-right">
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
                <path d="M12 20.5l-1.1-1C6 15 3 12.2 3 8.7 3 6 5 4 7.6 4c1.6 0 3.1.8 4 2.1C12.5 4.8 14 4 15.6 4 18.2 4 20 6 20 8.7c0 3.5-3 6.3-7.9 10.8L12 20.5z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </button>
  );
}
