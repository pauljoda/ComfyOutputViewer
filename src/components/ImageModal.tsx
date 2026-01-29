import type { SyntheticEvent, TouchEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch';
import type { ReactZoomPanPinchRef } from 'react-zoom-pan-pinch';
import type { ImageItem, ModalTool } from '../types';
import RatingStars from './RatingStars';
import { normalizeTagInput } from '../utils/tags';

const DEFAULT_MIN_SCALE = 0.5;
const FIT_WIDTH_RATIO = 0.92;
const FIT_HEIGHT_RATIO = 0.78;

type ImageModalProps = {
  image: ImageItem;
  index: number;
  total: number;
  modalTool: ModalTool;
  availableTags: string[];
  onUpdateTags: (tags: string[]) => void;
  onToggleTags: () => void;
  onToggleRating: () => void;
  onToggleFavorite: () => void;
  onToggleHidden: () => void;
  onRate: (rating: number) => void;
  onDelete: () => void;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
};

export default function ImageModal({
  image,
  index,
  total,
  modalTool,
  availableTags,
  onUpdateTags,
  onToggleTags,
  onToggleRating,
  onToggleFavorite,
  onToggleHidden,
  onRate,
  onDelete,
  onClose,
  onPrev,
  onNext
}: ImageModalProps) {
  const [tagInput, setTagInput] = useState('');
  const swipeStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const swipeLastRef = useRef<{ x: number; y: number } | null>(null);
  const lastSwipeAtRef = useRef(0);
  const isPanningRef = useRef(false);
  const isPinchingRef = useRef(false);
  const scaleRef = useRef(1);
  const transformRef = useRef<ReactZoomPanPinchRef | null>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const dragMovedRef = useRef(false);
  const [swipeIncoming, setSwipeIncoming] = useState(false);
  const [minScale, setMinScale] = useState(DEFAULT_MIN_SCALE);

  const handlePrev = () => {
    onPrev();
  };

  const handleNext = () => {
    onNext();
  };

  const handleClose = () => {
    onClose();
  };

  const handleToggleTags = () => {
    onToggleTags();
  };

  const handleToggleRating = () => {
    onToggleRating();
  };

  const handleDelete = () => {
    onDelete();
  };

  const handleZoomIn = () => {
    transformRef.current?.zoomIn(0.35);
  };

  const handleZoomOut = () => {
    transformRef.current?.zoomOut(0.35);
  };

  const handleResetZoom = () => {
    transformRef.current?.resetTransform();
  };

  const applyFitScale = (img: HTMLImageElement) => {
    const wrapper = transformRef.current?.instance.wrapperComponent;
    const currentScale = transformRef.current?.state.scale ?? 1;
    if (!wrapper) return;
    const wrapperRect = wrapper.getBoundingClientRect();
    const nodeRect = img.getBoundingClientRect();
    const nodeWidth = nodeRect.width / currentScale;
    const nodeHeight = nodeRect.height / currentScale;
    if (!wrapperRect.width || !wrapperRect.height || !nodeWidth || !nodeHeight) return;
    const fitScale = Math.min(
      (wrapperRect.width * FIT_WIDTH_RATIO) / nodeWidth,
      (wrapperRect.height * FIT_HEIGHT_RATIO) / nodeHeight,
      1
    );
    const nextMinScale = Math.min(DEFAULT_MIN_SCALE, fitScale);
    setMinScale(nextMinScale);
    window.setTimeout(() => {
      transformRef.current?.zoomToElement(img, fitScale, 0);
      scaleRef.current = fitScale;
    }, 0);
  };

  const handleImageLoad = (event: SyntheticEvent<HTMLImageElement>) => {
    const img = event.currentTarget;
    window.requestAnimationFrame(() => {
      applyFitScale(img);
    });
  };

  const tagQuery = normalizeTagInput(tagInput);
  const suggestions = useMemo(
    () =>
      availableTags.filter(
        (tag) => !image.tags.includes(tag) && (!tagQuery || tag.includes(tagQuery))
      ),
    [availableTags, image.tags, tagQuery]
  );

  useEffect(() => {
    setTagInput('');
  }, [image.id]);

  const handleAddTagValue = (value: string) => {
    const normalized = normalizeTagInput(value);
    if (!normalized) return;
    if (image.tags.includes(normalized)) {
      setTagInput('');
      return;
    }
    onUpdateTags([...image.tags, normalized]);
    setTagInput('');
  };

  const handleAddTag = () => {
    handleAddTagValue(tagInput);
  };

  const handleRemoveTag = (tag: string) => {
    onUpdateTags(image.tags.filter((entry) => entry !== tag));
  };

  const suggestionId = 'tag-suggestions-modal';
  const swipeEnabled = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  }, []);

  const handleSwipeStart = (event: TouchEvent<HTMLDivElement>) => {
    if (event.touches.length !== 1) return;
    const touch = event.touches[0];
    swipeStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
    swipeLastRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleSwipeMove = (event: TouchEvent<HTMLDivElement>) => {
    if (!swipeStartRef.current || event.touches.length !== 1) return;
    const touch = event.touches[0];
    swipeLastRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleSwipeEnd = (event: TouchEvent<HTMLDivElement>) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!start) return;

    if (isPanningRef.current || isPinchingRef.current || scaleRef.current > 1.02) {
      swipeLastRef.current = null;
      return;
    }

    const touch = event.changedTouches[0];
    const endX = touch?.clientX ?? swipeLastRef.current?.x ?? start.x;
    const endY = touch?.clientY ?? swipeLastRef.current?.y ?? start.y;
    swipeLastRef.current = null;

    const dx = endX - start.x;
    const dy = endY - start.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    const elapsed = Date.now() - start.time;
    const minDistance = 84;
    const axisRatio = 1.4;

    if (elapsed > 800 || Math.max(absX, absY) < minDistance) return;

    if (absX > absY * axisRatio) {
      lastSwipeAtRef.current = Date.now();
      if (dx < 0) {
        handleNext();
      } else {
        handlePrev();
      }
      return;
    }

    if (absY > absX * axisRatio) {
      lastSwipeAtRef.current = Date.now();
      handleClose();
    }
  };

  useEffect(() => {
    scaleRef.current = 1;
    isPanningRef.current = false;
    isPinchingRef.current = false;
    setMinScale(DEFAULT_MIN_SCALE);
    transformRef.current?.resetTransform(0);
    setSwipeIncoming(true);
    const timer = window.setTimeout(() => {
      setSwipeIncoming(false);
    }, 200);
    return () => window.clearTimeout(timer);
  }, [image.id]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    dragStartRef.current = { x: event.clientX, y: event.clientY };
    dragMovedRef.current = false;
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = dragStartRef.current;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.hypot(dx, dy) > 6) {
      dragMovedRef.current = true;
    }
  };

  const handlePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    if (Date.now() - lastSwipeAtRef.current < 350) {
      dragStartRef.current = null;
      dragMovedRef.current = false;
      return;
    }
    const moved = dragMovedRef.current;
    dragStartRef.current = null;
    dragMovedRef.current = false;
    if (moved) return;
    const target = event.target as HTMLElement;
    if (target.closest('.zoom-wrapper')) return;
    handleClose();
  };

  return (
    <div className="modal" role="dialog" aria-modal="true">
      <TransformWrapper
        key={image.id}
        ref={transformRef}
        initialScale={1}
        minScale={minScale}
        maxScale={6}
        centerOnInit
        centerZoomedOut
        limitToBounds={false}
        panning={{ velocityDisabled: true }}
        wheel={{ step: 0.2 }}
        pinch={{ step: 8 }}
        doubleClick={{ mode: 'zoomIn', step: 1 }}
        onPanningStart={() => {
          isPanningRef.current = true;
        }}
        onPanningStop={() => {
          isPanningRef.current = false;
        }}
        onPinchingStart={() => {
          isPinchingRef.current = true;
        }}
        onPinchingStop={() => {
          isPinchingRef.current = false;
        }}
        onTransformed={(_, state) => {
          scaleRef.current = state.scale;
        }}
      >
        <>
          <div className="modal-topbar" onClick={(event) => event.stopPropagation()}>
            <div className="modal-topbar-row">
              <div className="modal-title-group">
                <button
                  className="tool-button modal-close"
                  type="button"
                  onClick={handleClose}
                  title="Close"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M6 6l12 12M18 6l-12 12"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>
              <div className="modal-actions modal-actions-primary">
                <button
                  className={modalTool === 'tags' ? 'tool-button active' : 'tool-button'}
                  type="button"
                  onClick={handleToggleTags}
                  title="Tags"
                >
                  #
                </button>
                <button
                  className={image.favorite ? 'tool-button favorite active' : 'tool-button favorite'}
                  type="button"
                  onClick={onToggleFavorite}
                  title="Favorite"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M12 20.5l-1.1-1C6 15 3 12.2 3 8.7 3 6 5 4 7.6 4c1.6 0 3.1.8 4 2.1C12.5 4.8 14 4 15.6 4 18.2 4 20 6 20 8.7c0 3.5-3 6.3-7.9 10.8L12 20.5z"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                <button
                  className={
                    modalTool === 'rating'
                      ? 'tool-button rating-button active'
                      : image.rating > 0
                        ? 'tool-button rating-button rated'
                        : 'tool-button rating-button'
                  }
                  type="button"
                  onClick={handleToggleRating}
                  title={image.rating > 0 ? `Rating ${image.rating}/5` : 'Rate'}
                  aria-label={image.rating > 0 ? `Rating ${image.rating} of 5` : 'Rate'}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 3.8l2.5 5 5.5.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.5-.8z" />
                  </svg>
                </button>
                <button
                  className={image.hidden ? 'tool-button modal-hide active' : 'tool-button modal-hide'}
                  type="button"
                  onClick={onToggleHidden}
                  title="Hide"
                >
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
                </button>
                <a
                  className="tool-button"
                  href={image.url}
                  download={image.name}
                  title="Download"
                  aria-label="Download"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M12 5v9"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                    />
                    <path
                      d="M8 10l4 4 4-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M5 19h14"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                    />
                  </svg>
                </a>
                <button
                  className="tool-button danger"
                  type="button"
                  onClick={handleDelete}
                  title="Remove"
                  aria-label="Remove"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M4 7h16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                    <path
                      d="M9 7V5h6v2M9 10v7M12 10v7M15 10v7M6 7l1 12h10l1-12"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
            </div>

            {modalTool && (
              <div className="modal-tool-popover">
                {modalTool === 'tags' && (
                  <div className="tool-panel tag-editor">
                    <div className="tag-chip-list">
                      {image.tags.length === 0 && (
                        <span className="tag-empty">No tags yet.</span>
                      )}
                      {image.tags.map((tag) => (
                        <button
                          key={tag}
                          className="tag-chip"
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          title="Remove tag"
                        >
                          {tag}
                          <span aria-hidden="true">×</span>
                        </button>
                      ))}
                    </div>
                    <label className="control">
                      <span>Add tag</span>
                      <div className="tag-input-row">
                        <input
                          list={suggestionId}
                          value={tagInput}
                          onChange={(event) => setTagInput(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault();
                              handleAddTag();
                            }
                          }}
                          placeholder="Type a tag…"
                        />
                        <button
                          className="button"
                          type="button"
                          onClick={handleAddTag}
                          disabled={!tagInput.trim()}
                        >
                          Add
                        </button>
                      </div>
                    </label>
                    {suggestions.length > 0 && (
                      <div className="tag-chip-list tag-suggestions">
                        {suggestions.map((tag) => (
                          <button
                            key={tag}
                            className="tag-chip"
                            type="button"
                            onClick={() => handleAddTagValue(tag)}
                            title="Add tag"
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    )}
                    <datalist id={suggestionId}>
                      {suggestions.map((tag) => (
                        <option key={tag} value={tag} />
                      ))}
                    </datalist>
                    <div className="hint">Pinch to zoom, drag to pan.</div>
                  </div>
                )}
                {modalTool === 'rating' && (
                  <div className="tool-panel rating-panel">
                    <span className="rating-panel-title">Rate this image</span>
                    <RatingStars
                      value={image.rating}
                      onChange={onRate}
                      allowClear
                      label="Image rating"
                    />
                    <span className="hint">
                      Click a star to rate. Click the same star to clear.
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

            <div
              className="modal-body"
              onTouchStart={swipeEnabled ? handleSwipeStart : undefined}
              onTouchMove={swipeEnabled ? handleSwipeMove : undefined}
              onTouchEnd={swipeEnabled ? handleSwipeEnd : undefined}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerEnd}
              onPointerCancel={handlePointerEnd}
            >
              <div className="modal-stage">
                <TransformComponent wrapperClass="zoom-wrapper" contentClass="zoom-content">
                  <img
                    className={`modal-image${swipeIncoming ? ' swipe-in' : ''}`}
                    src={image.url}
                    alt={image.name}
                    onLoad={handleImageLoad}
                  />
                </TransformComponent>
              </div>
            </div>

          <div className="modal-bottombar" onClick={(event) => event.stopPropagation()}>
            <div className="modal-bottombar-row">
              <div className="modal-actions modal-actions-primary">
                <button className="tool-button" type="button" onClick={handlePrev} title="Previous">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M15 6l-6 6 6 6"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                <button className="tool-button" type="button" onClick={handleNext} title="Next">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M9 6l6 6-6 6"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
              <div className="modal-progress" aria-live="polite">
                {total > 0 ? `${index + 1}/${total}` : ''}
              </div>
              <div className="modal-actions modal-actions-secondary">
                <button className="tool-button" type="button" onClick={handleZoomOut} title="Zoom out">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M5 12h14"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
                <button className="tool-button" type="button" onClick={handleZoomIn} title="Zoom in">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M12 5v14M5 12h14"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
                <button
                  className="tool-button"
                  type="button"
                  onClick={handleResetZoom}
                  title="Reset"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M12 5a7 7 0 1 1-6.4 9.8"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                    />
                    <path
                      d="M5 5v4h4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </>
      </TransformWrapper>
    </div>
  );
}
