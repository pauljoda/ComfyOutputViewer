import { memo, useCallback, useMemo } from 'react';
import { Heart, EyeOff, Eye, Star, Check } from 'lucide-react';
import type { CSSProperties, KeyboardEvent, MouseEvent, SyntheticEvent } from 'react';
import type { ImageItem, TileFit } from '../types';

type ImageCardProps = {
  image: ImageItem;
  renderIndex?: number;
  animateIn?: boolean;
  ratio?: number;
  tileSize: number;
  tileFit: TileFit;
  selected: boolean;
  multiSelect: boolean;
  onSelectImage: (id: string, options?: { shiftKey?: boolean }) => void;
  onToggleFavorite: (image: ImageItem) => void;
  onToggleHidden: (image: ImageItem) => void;
  onImageLoad: (id: string, element: HTMLImageElement) => void;
};

function ImageCard({
  image,
  renderIndex = 0,
  animateIn = true,
  ratio,
  tileSize,
  tileFit,
  selected,
  multiSelect,
  onSelectImage,
  onToggleFavorite,
  onToggleHidden,
  onImageLoad
}: ImageCardProps) {
  const style = useMemo(() => {
    const delay = `${Math.min(renderIndex, 18) * 12}ms`;
    if (tileFit !== 'contain') {
      return { animationDelay: delay } as CSSProperties;
    }
    if (!ratio) {
      return { animationDelay: delay, width: tileSize, height: tileSize } as CSSProperties;
    }
    const width = ratio >= 1 ? tileSize * ratio : tileSize;
    const height = ratio >= 1 ? tileSize : tileSize / ratio;
    return {
      animationDelay: delay,
      width: Math.round(width),
      height: Math.round(height)
    } as CSSProperties;
  }, [ratio, renderIndex, tileFit, tileSize]);

  const handleSelect = useCallback(
    (shiftKey = false) => {
      onSelectImage(image.id, { shiftKey });
    },
    [image.id, onSelectImage]
  );

  const handleCardKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      handleSelect(event.shiftKey);
    },
    [handleSelect]
  );

  const handleToggleHidden = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      onToggleHidden(image);
    },
    [image, onToggleHidden]
  );

  const handleToggleFavorite = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      onToggleFavorite(image);
    },
    [image, onToggleFavorite]
  );

  const handleImageLoad = useCallback(
    (event: SyntheticEvent<HTMLImageElement>) => {
      onImageLoad(image.id, event.currentTarget);
    },
    [image.id, onImageLoad]
  );

  return (
    <article
      className={`group relative overflow-hidden rounded-lg border bg-card transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring ${
        selected ? 'ring-2 ring-primary' : ''
      } ${image.hidden ? 'opacity-60' : ''} ${animateIn ? 'animate-card-enter' : ''}`}
      data-image-card="true"
      role="button"
      tabIndex={0}
      aria-label={image.name}
      onClick={(event) => handleSelect(event.shiftKey)}
      onKeyDown={handleCardKeyDown}
      style={style}
    >
      <img
        src={image.thumbUrl || image.url}
        alt={image.name}
        data-loaded="false"
        loading="lazy"
        decoding="async"
        className={`h-full w-full ${tileFit === 'contain' ? 'object-contain' : 'object-cover'}`}
        onLoad={(event) => {
          event.currentTarget.dataset.loaded = 'true';
          handleImageLoad(event);
        }}
        onError={(event) => {
          if (!image.thumbUrl) return;
          const target = event.currentTarget;
          target.dataset.loaded = 'true';
          target.onerror = null;
          target.src = image.url;
        }}
      />

      {/* Overlay - appears on hover */}
      <div className="absolute inset-0 flex flex-col justify-between bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100">
        <div className="flex justify-between p-1.5">
          {multiSelect && (
            <div
              className={`flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors ${
                selected
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-white/70 bg-black/30'
              }`}
              aria-hidden="true"
            >
              {selected && <Check className="h-3 w-3" />}
            </div>
          )}
          <div className="ml-auto flex gap-1">
            <button
              className={`rounded-full p-1 transition-colors ${
                image.hidden
                  ? 'bg-destructive/80 text-white'
                  : 'bg-black/30 text-white/80 hover:bg-black/50'
              }`}
              type="button"
              onClick={handleToggleHidden}
              aria-label={image.hidden ? 'Unhide' : 'Hide'}
              title={image.hidden ? 'Hidden' : 'Hide'}
            >
              {image.hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
            <button
              className={`rounded-full p-1 transition-colors ${
                image.favorite
                  ? 'bg-favorite/80 text-white'
                  : 'bg-black/30 text-white/80 hover:bg-black/50'
              }`}
              type="button"
              onClick={handleToggleFavorite}
              aria-label={image.favorite ? 'Unfavorite' : 'Favorite'}
            >
              <Heart className={`h-3.5 w-3.5 ${image.favorite ? 'fill-current' : ''}`} />
            </button>
          </div>
        </div>
        {image.rating > 0 && (
          <div className="flex items-center gap-0.5 p-1.5 text-xs text-white" aria-label={`Rated ${image.rating} out of 5`}>
            <span>{image.rating}</span>
            <Star className="h-3 w-3 fill-rating text-rating" />
          </div>
        )}
      </div>

      {/* Always-visible selected indicator when not hovered */}
      {selected && !multiSelect && (
        <div className="absolute right-1.5 top-1.5 rounded-full bg-primary p-0.5 text-primary-foreground group-hover:hidden">
          <Check className="h-3 w-3" />
        </div>
      )}
    </article>
  );
}

export default memo(ImageCard);
