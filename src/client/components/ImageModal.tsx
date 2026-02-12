import type { SyntheticEvent, TouchEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch';
import type { ReactZoomPanPinchRef } from 'react-zoom-pan-pinch';
import {
  X, Heart, Star, EyeOff, Download, Trash2, ChevronLeft, ChevronRight,
  ZoomIn, ZoomOut, RotateCcw, Hash, Info
} from 'lucide-react';
import { Button } from './ui/button';
import type { ImageItem, ModalTool } from '../types';
import RatingStars from './RatingStars';
import { normalizeTagInput } from '../utils/tags';
import ImagePromptOverlay from './image-modal/ImagePromptOverlay';
import { useImagePromptData } from './image-modal/useImagePromptData';

const DEFAULT_MIN_SCALE = 0.1;
const FIT_WIDTH_RATIO = 0.96;
const FIT_HEIGHT_RATIO = 0.94;
const MAX_FIT_ATTEMPTS = 12;
const FIT_EPSILON = 0.01;

type ImageModalProps = {
  image: ImageItem;
  index: number;
  total: number;
  modalTool: ModalTool;
  availableTags: string[];
  onUpdateTags: (tags: string[]) => void;
  onToggleTags: () => void;
  onToggleRating: () => void;
  onTogglePrompt: () => void;
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
  onTogglePrompt,
  onToggleFavorite,
  onToggleHidden,
  onRate,
  onDelete,
  onClose,
  onPrev,
  onNext
}: ImageModalProps) {
  const navigate = useNavigate();
  const [tagInput, setTagInput] = useState('');
  const {
    promptData,
    promptLoading,
    promptError,
    promptAvailable,
    promptJson,
    promptWorkflowId,
    promptPrefillEntries
  } = useImagePromptData({
    imageId: image.id,
    modalTool
  });

  const tagInputRef = useRef<HTMLInputElement | null>(null);
  const [shouldFocusTag, setShouldFocusTag] = useState(false);
  const isDesktop = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(pointer: fine)').matches;
  }, []);

  const swipeStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const swipeLastRef = useRef<{ x: number; y: number } | null>(null);
  const lastSwipeAtRef = useRef(0);
  const isPanningRef = useRef(false);
  const isPinchingRef = useRef(false);
  const scaleRef = useRef(1);
  const fitScaleRef = useRef(1);
  const transformRef = useRef<ReactZoomPanPinchRef | null>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const dragMovedRef = useRef(false);
  const [swipeIncoming, setSwipeIncoming] = useState(false);
  const [minScale, setMinScale] = useState(DEFAULT_MIN_SCALE);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const debugRafRef = useRef(0);
  const [debugInfo, setDebugInfo] = useState<null | Record<string, string>>(null);
  const lastStateRef = useRef<{ scale: number; positionX: number; positionY: number } | null>(null);
  const [transformReady, setTransformReady] = useState(false);
  const debugEnabled = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return params.get('debug') === '1';
  }, []);

  const handlePrev = () => onPrev();
  const handleNext = () => onNext();
  const handleClose = () => onClose();
  const handleToggleTags = () => onToggleTags();
  const handleToggleRating = () => onToggleRating();
  const handleTogglePrompt = () => onTogglePrompt();

  const handleLoadWorkflow = () => {
    if (!promptWorkflowId) return;
    const prefillPayload = {
      workflowId: promptWorkflowId,
      entries: promptPrefillEntries,
      sourceImagePath: image.id,
      createdAt: promptData?.createdAt
    };
    try {
      window.sessionStorage.setItem('comfy_prefill', JSON.stringify(prefillPayload));
    } catch (err) {
      console.warn('Failed to store workflow prefill payload:', err);
    }
    navigate(`/workflows/${promptWorkflowId}`, {
      state: { prefill: prefillPayload }
    });
    onClose();
  };

  const handleDelete = () => onDelete();
  const handleZoomIn = () => transformRef.current?.zoomIn(0.35);
  const handleZoomOut = () => transformRef.current?.zoomOut(0.35);
  const handleResetZoom = () => {
    const img = imageRef.current;
    if (img) {
      transformRef.current?.zoomToElement(img, fitScaleRef.current, 0);
      return;
    }
    transformRef.current?.resetTransform(0);
  };

  const scheduleDebugUpdate = (
    reason: string,
    stateOverride?: { scale: number; positionX: number; positionY: number }
  ) => {
    if (!debugEnabled) return;
    if (debugRafRef.current) return;
    debugRafRef.current = window.requestAnimationFrame(() => {
      debugRafRef.current = 0;
      const wrapper = transformRef.current?.instance.wrapperComponent;
      const content = transformRef.current?.instance.contentComponent;
      const img = imageRef.current;
      const modalBody = document.querySelector('[data-modal-body]') as HTMLElement | null;
      const modalStage = document.querySelector('[data-modal-stage]') as HTMLElement | null;
      const wrapperRect = wrapper?.getBoundingClientRect();
      const contentRect = content?.getBoundingClientRect();
      const imgRect = img?.getBoundingClientRect();
      const visualViewport = window.visualViewport;
      const state = stateOverride || lastStateRef.current || transformRef.current?.state;
      const format = (value?: number) =>
        Number.isFinite(value) ? Number(value).toFixed(2) : 'n/a';
      const baseWidth =
        imgRect && state?.scale ? imgRect.width / state.scale : img?.naturalWidth;
      const baseHeight =
        imgRect && state?.scale ? imgRect.height / state.scale : img?.naturalHeight;
      setDebugInfo({
        reason,
        image: image.name,
        viewport: `${format(window.innerWidth)} x ${format(window.innerHeight)}`,
        doc: `${format(document.documentElement.clientWidth)} x ${format(document.documentElement.clientHeight)}`,
        visual: visualViewport ? `${format(visualViewport.width)} x ${format(visualViewport.height)}` : 'n/a',
        body: modalBody ? `${format(modalBody.getBoundingClientRect().width)} x ${format(modalBody.getBoundingClientRect().height)}` : 'n/a',
        stage: modalStage ? `${format(modalStage.getBoundingClientRect().width)} x ${format(modalStage.getBoundingClientRect().height)}` : 'n/a',
        wrapper: wrapperRect ? `${format(wrapperRect.width)} x ${format(wrapperRect.height)}` : 'n/a',
        content: contentRect ? `${format(contentRect.width)} x ${format(contentRect.height)}` : 'n/a',
        imgRect: imgRect ? `${format(imgRect.width)} x ${format(imgRect.height)}` : 'n/a',
        natural: img ? `${img.naturalWidth} x ${img.naturalHeight}` : 'n/a',
        rendered: img ? `${img.width} x ${img.height}` : 'n/a',
        client: img ? `${img.clientWidth} x ${img.clientHeight}` : 'n/a',
        complete: img ? String(img.complete) : 'n/a',
        base: baseWidth && baseHeight ? `${format(baseWidth)} x ${format(baseHeight)}` : 'n/a',
        dpr: format(window.devicePixelRatio),
        scale: format(state?.scale),
        fitScale: format(fitScaleRef.current),
        minScale: format(minScale),
        transformScale: format(scaleRef.current)
      });
    });
  };

  const applyFitScale = (img: HTMLImageElement, attempt = 0) => {
    const wrapper = transformRef.current?.instance.wrapperComponent;
    const currentScale = transformRef.current?.state.scale ?? 1;
    if (!wrapper || !img) {
      if (attempt < MAX_FIT_ATTEMPTS) {
        window.requestAnimationFrame(() => applyFitScale(img, attempt + 1));
      }
      return;
    }
    const wrapperRect = wrapper.getBoundingClientRect();
    const nodeRect = img.getBoundingClientRect();
    const baseWidth = nodeRect.width / currentScale || img.naturalWidth || img.width;
    const baseHeight = nodeRect.height / currentScale || img.naturalHeight || img.height;
    if (!wrapperRect.width || !wrapperRect.height || !baseWidth || !baseHeight) {
      if (attempt < MAX_FIT_ATTEMPTS) {
        window.requestAnimationFrame(() => applyFitScale(img, attempt + 1));
      }
      return;
    }
    const fitScale = Math.min(
      (wrapperRect.width * FIT_WIDTH_RATIO) / baseWidth,
      (wrapperRect.height * FIT_HEIGHT_RATIO) / baseHeight,
      1
    );
    if (Math.abs(fitScale - fitScaleRef.current) < FIT_EPSILON) return;
    const nextMinScale = Math.min(DEFAULT_MIN_SCALE, fitScale);
    setMinScale(nextMinScale);
    fitScaleRef.current = fitScale;
    window.requestAnimationFrame(() => {
      transformRef.current?.zoomToElement(img, fitScale, 0);
      scaleRef.current = fitScale;
      scheduleDebugUpdate('fit');
    });
  };

  const handleImageLoad = (event: SyntheticEvent<HTMLImageElement>) => {
    const img = event.currentTarget;
    imageRef.current = img;
    window.requestAnimationFrame(() => {
      applyFitScale(img);
      scheduleDebugUpdate('load');
    });
  };

  const handleImageRef = (node: HTMLImageElement | null) => {
    if (!node) return;
    imageRef.current = node;
    if (node.complete) {
      window.requestAnimationFrame(() => {
        applyFitScale(node);
        scheduleDebugUpdate('ref-complete');
      });
    }
  };

  const tagQuery = normalizeTagInput(tagInput);
  const imageTags = Array.isArray(image.tags) ? image.tags : [];
  const safeAvailableTags = Array.isArray(availableTags) ? availableTags : [];
  const suggestions = useMemo(
    () =>
      safeAvailableTags
        .filter((tag) => !imageTags.includes(tag) && (!tagQuery || tag.includes(tagQuery)))
        .sort((a, b) => a.localeCompare(b)),
    [imageTags, safeAvailableTags, tagQuery]
  );

  useEffect(() => {
    setTagInput('');
  }, [image.id]);

  // Focus the tag input after the tags panel opens
  useEffect(() => {
    if (!shouldFocusTag || modalTool !== 'tags') return;
    setShouldFocusTag(false);
    const timer = window.setTimeout(() => tagInputRef.current?.focus(), 50);
    return () => window.clearTimeout(timer);
  }, [shouldFocusTag, modalTool]);

  // Desktop keyboard shortcuts
  useEffect(() => {
    if (!isDesktop) return;
    const PAN_STEP = 80;
    const handleKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const isTyping =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        !!target.isContentEditable;

      // Always handle Escape (even when typing in an input)
      if (event.key === 'Escape') {
        event.preventDefault();
        if (modalTool) {
          if (modalTool === 'tags') onToggleTags();
          else if (modalTool === 'rating') onToggleRating();
          else onTogglePrompt();
        } else {
          onClose();
        }
        return;
      }

      if (isTyping) return;

      const { key, shiftKey } = event;

      // Zoom shortcuts — checked before shift block because + requires Shift on US keyboards
      if (key === '+' || key === '=') {
        event.preventDefault();
        transformRef.current?.zoomIn(0.35);
        return;
      }
      if (key === '-') {
        event.preventDefault();
        transformRef.current?.zoomOut(0.35);
        return;
      }

      // Shift held: pan the image
      if (shiftKey) {
        const state = lastStateRef.current ?? transformRef.current?.state;
        if (!state) return;
        const { positionX, positionY, scale } = state;
        if (key === 'ArrowLeft' || key === 'h' || key === 'H') {
          event.preventDefault();
          transformRef.current?.setTransform(positionX + PAN_STEP, positionY, scale, 0);
        } else if (key === 'ArrowRight' || key === 'l' || key === 'L') {
          event.preventDefault();
          transformRef.current?.setTransform(positionX - PAN_STEP, positionY, scale, 0);
        } else if (key === 'ArrowUp' || key === 'k' || key === 'K') {
          event.preventDefault();
          transformRef.current?.setTransform(positionX, positionY + PAN_STEP, scale, 0);
        } else if (key === 'ArrowDown' || key === 'j' || key === 'J') {
          event.preventDefault();
          transformRef.current?.setTransform(positionX, positionY - PAN_STEP, scale, 0);
        }
        return;
      }

      // Navigate
      if (key === 'ArrowLeft' || key === 'h' || key === 'H') {
        onPrev();
      } else if (key === 'ArrowRight' || key === 'l' || key === 'L') {
        onNext();
      // Favorite
      } else if (key === 'f' || key === 'F') {
        onToggleFavorite();
      // Tags panel
      } else if (key === 't' || key === 'T') {
        if (modalTool !== 'tags') {
          onToggleTags();
          setShouldFocusTag(true);
        } else {
          tagInputRef.current?.focus();
        }
      // Rating (pressing same star again clears)
      } else if (key >= '1' && key <= '5') {
        const rating = parseInt(key, 10);
        onRate(image.rating === rating ? 0 : rating);
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isDesktop, modalTool, image.rating, onPrev, onNext, onToggleFavorite, onToggleTags, onToggleRating, onTogglePrompt, onClose, onRate]);

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

  const handleAddTag = () => handleAddTagValue(tagInput);

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
      if (dx < 0) handleNext();
      else handlePrev();
      return;
    }
    if (absY > absX * axisRatio) {
      lastSwipeAtRef.current = Date.now();
      handleClose();
    }
  };

  useEffect(() => {
    scaleRef.current = 1;
    fitScaleRef.current = 1;
    isPanningRef.current = false;
    isPinchingRef.current = false;
    setMinScale(DEFAULT_MIN_SCALE);
    transformRef.current?.resetTransform(0);
    setSwipeIncoming(true);
    const timer = window.setTimeout(() => setSwipeIncoming(false), 200);
    return () => window.clearTimeout(timer);
  }, [image.id]);

  useEffect(() => {
    if (!transformReady || typeof ResizeObserver === 'undefined') return;
    let raf = 0;
    let observer: ResizeObserver | null = null;
    let cancelled = false;

    const attachObserver = (attempt = 0) => {
      if (cancelled) return;
      const wrapper = transformRef.current?.instance.wrapperComponent;
      const img = imageRef.current;
      if (!wrapper || !img) {
        if (attempt < MAX_FIT_ATTEMPTS * 4) {
          raf = window.requestAnimationFrame(() => attachObserver(attempt + 1));
        }
        return;
      }
      observer = new ResizeObserver(() => {
        if (raf) window.cancelAnimationFrame(raf);
        raf = window.requestAnimationFrame(() => applyFitScale(img));
      });
      observer.observe(wrapper);
      observer.observe(img);
      scheduleDebugUpdate('observer-attached');
    };

    attachObserver();
    return () => {
      cancelled = true;
      if (raf) window.cancelAnimationFrame(raf);
      observer?.disconnect();
    };
  }, [image.id, transformReady]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    dragStartRef.current = { x: event.clientX, y: event.clientY };
    dragMovedRef.current = false;
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = dragStartRef.current;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.hypot(dx, dy) > 6) dragMovedRef.current = true;
  };

  const handlePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    if (Date.now() - lastSwipeAtRef.current < 350) {
      dragStartRef.current = null;
      dragMovedRef.current = false;
      return;
    }
    if (modalTool === 'prompt') {
      dragStartRef.current = null;
      dragMovedRef.current = false;
      return;
    }
    const moved = dragMovedRef.current;
    dragStartRef.current = null;
    dragMovedRef.current = false;
    if (moved) return;
    if (event.pointerType !== 'mouse') return;
    const target = event.target as HTMLElement;
    if (target.closest('.image-modal-image')) return;
    handleClose();
  };

  const toolBtnClass = (active: boolean) =>
    `inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
      active ? 'bg-white/20 text-white' : 'text-white/80 hover:bg-white/10 hover:text-white'
    }`;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/90"
      role="dialog"
      aria-modal="true"
      data-image-modal="true"
    >
      <TransformWrapper
        key={image.id}
        ref={transformRef}
        initialScale={1}
        minScale={minScale}
        maxScale={6}
        centerOnInit={false}
        centerZoomedOut={false}
        limitToBounds={false}
        panning={{ velocityDisabled: true }}
        wheel={{ step: 0.2 }}
        pinch={{ step: 8 }}
        doubleClick={{ mode: 'zoomIn', step: 1 }}
        onPanningStart={() => { isPanningRef.current = true; }}
        onPanningStop={() => { isPanningRef.current = false; }}
        onPinchingStart={() => { isPinchingRef.current = true; }}
        onPinchingStop={() => { isPinchingRef.current = false; }}
        onTransformed={(_, state) => {
          scaleRef.current = state.scale;
          lastStateRef.current = state;
          scheduleDebugUpdate('transform', state);
        }}
        onInit={() => {
          setTransformReady(true);
          scheduleDebugUpdate('init');
        }}
      >
        <>
          {/* Top bar */}
          <div
            className="image-modal-chrome relative z-10 flex flex-col bg-background/80 backdrop-blur-sm"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center gap-1 px-2 py-1.5">
              <button className={toolBtnClass(false)} type="button" onClick={handleClose} title="Close" aria-label="Close image viewer">
                <X className="h-4 w-4" />
              </button>
              <div className="ml-auto flex items-center gap-1">
                <button
                  className={toolBtnClass(modalTool === 'tags')}
                  type="button"
                  onClick={handleToggleTags}
                  title="Tags"
                  aria-label="Edit tags"
                >
                  <Hash className="h-4 w-4" />
                </button>
                <button
                  className={`${toolBtnClass(false)} ${image.favorite ? 'text-favorite' : ''}`}
                  type="button"
                  onClick={onToggleFavorite}
                  title="Favorite"
                  aria-label={image.favorite ? 'Unfavorite image' : 'Favorite image'}
                >
                  <Heart className={`h-4 w-4 ${image.favorite ? 'fill-current' : ''}`} />
                </button>
                <button
                  className={`${toolBtnClass(modalTool === 'rating')} ${image.rating > 0 && modalTool !== 'rating' ? 'text-rating' : ''}`}
                  type="button"
                  onClick={handleToggleRating}
                  title={image.rating > 0 ? `Rating ${image.rating}/5` : 'Rate'}
                  aria-label={image.rating > 0 ? `Rating ${image.rating} of 5` : 'Rate'}
                >
                  <Star className={`h-4 w-4 ${image.rating > 0 ? 'fill-current' : ''}`} />
                </button>
                {promptAvailable && (
                  <button
                    className={toolBtnClass(modalTool === 'prompt')}
                    type="button"
                    onClick={handleTogglePrompt}
                    title="View prompt"
                    aria-label="View prompt data"
                  >
                    <Info className="h-4 w-4" />
                  </button>
                )}
                <button
                  className={`${toolBtnClass(false)} ${image.hidden ? 'text-destructive' : ''}`}
                  type="button"
                  onClick={onToggleHidden}
                  title="Hide"
                  aria-label={image.hidden ? 'Unhide image' : 'Hide image'}
                >
                  <EyeOff className="h-4 w-4" />
                </button>
                <a
                  className={toolBtnClass(false)}
                  href={image.url}
                  download={image.name}
                  title="Download"
                  aria-label="Download"
                >
                  <Download className="h-4 w-4" />
                </a>
                <button
                  className={`${toolBtnClass(false)} hover:text-destructive`}
                  type="button"
                  onClick={handleDelete}
                  title="Remove"
                  aria-label="Remove"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Floating tool panels (tags, rating) */}
          {modalTool && modalTool !== 'prompt' && (
            <div className="pointer-events-none absolute inset-x-0 top-12 z-20 px-3">
              <div
                className="pointer-events-auto mx-auto w-full max-w-3xl rounded-lg border border-white/10 bg-background/92 p-3 shadow-xl backdrop-blur-sm"
                onClick={(event) => event.stopPropagation()}
              >
                {modalTool === 'tags' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-foreground">Tags</p>
                      <span className="text-[11px] text-muted-foreground">
                        {image.tags.length} selected
                      </span>
                    </div>
                    <div className="max-h-24 overflow-y-auto rounded-md border border-white/10 bg-background/70 p-2">
                      <div className="flex flex-wrap gap-1">
                        {image.tags.length === 0 && (
                          <span className="text-xs text-muted-foreground">No tags yet.</span>
                        )}
                        {image.tags.map((tag) => (
                          <button
                            key={tag}
                            className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground hover:opacity-80"
                            type="button"
                            onClick={() => handleRemoveTag(tag)}
                            title="Remove tag"
                          >
                            {tag}
                            <span aria-hidden="true">&times;</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        ref={tagInputRef}
                        list={suggestionId}
                        name="modalTag"
                        autoComplete="off"
                        value={tagInput}
                        onChange={(event) => setTagInput(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            handleAddTag();
                          }
                        }}
                        placeholder="Search or add tag…"
                        className="h-8 flex-1 rounded-md border border-input bg-background px-2 text-sm"
                      />
                      <Button size="sm" onClick={handleAddTag} disabled={!tagInput.trim()}>
                        Add
                      </Button>
                    </div>
                    {suggestions.length > 0 && (
                      <div className="max-h-28 overflow-y-auto rounded-md border border-white/10 bg-background/70 p-2">
                        <div className="flex flex-wrap gap-1">
                          {suggestions.slice(0, 120).map((tag) => (
                            <button
                              key={tag}
                              className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground hover:bg-secondary/80"
                              type="button"
                              onClick={() => handleAddTagValue(tag)}
                              title="Add tag"
                            >
                              {tag}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <datalist id={suggestionId}>
                      {suggestions.map((tag) => (
                        <option key={tag} value={tag} />
                      ))}
                    </datalist>
                    <div className="text-xs text-muted-foreground">Pinch to zoom, drag to pan.</div>
                  </div>
                )}
                {modalTool === 'rating' && (
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-sm text-foreground">Rate this image</span>
                    <RatingStars
                      value={image.rating}
                      onChange={onRate}
                      allowClear
                      size="lg"
                      label="Image rating"
                    />
                    <span className="text-xs text-muted-foreground">
                      Click a star to rate. Click the same star to clear.
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {modalTool === 'prompt' && promptAvailable && (
            <ImagePromptOverlay
              promptData={promptData}
              promptLoading={promptLoading}
              promptError={promptError}
              promptJson={promptJson}
              promptWorkflowId={promptWorkflowId}
              onLoadWorkflow={handleLoadWorkflow}
              onClosePrompt={handleTogglePrompt}
            />
          )}

          {/* Image body */}
          <div
            data-modal-body
            className="image-modal-body relative flex-1 overflow-hidden px-3"
            onTouchStart={swipeEnabled ? handleSwipeStart : undefined}
            onTouchMove={swipeEnabled ? handleSwipeMove : undefined}
            onTouchEnd={swipeEnabled ? handleSwipeEnd : undefined}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
          >
            <div data-modal-stage className="flex h-full w-full items-center justify-center">
              <TransformComponent
                wrapperClass="zoom-wrapper"
                contentClass="zoom-content"
                wrapperStyle={{ width: '100%', height: '100%' }}
                contentStyle={{ width: '100%', height: '100%' }}
              >
                <img
                  className={`image-modal-image max-h-full max-w-full transition-opacity ${swipeIncoming ? 'opacity-0' : 'opacity-100'}`}
                  src={image.url}
                  alt={image.name}
                  style={{ maxWidth: '100%', maxHeight: '100%', height: 'auto', width: 'auto' }}
                  onLoad={handleImageLoad}
                  ref={handleImageRef}
                />
              </TransformComponent>
            </div>
            {debugEnabled && debugInfo && (
              <div className="absolute bottom-0 left-0 z-30 max-w-xs bg-black/80 p-2 text-[10px] text-white/80">
                <div>Zoom debug</div>
                {Object.entries(debugInfo).map(([key, val]) => (
                  <div key={key}>{key}: {val}</div>
                ))}
              </div>
            )}
            {isDesktop && (
              <div className="absolute bottom-2 left-2 z-10 pointer-events-none select-none">
                <div
                  className="text-[10px] leading-[1.5] text-white/30"
                  style={{ display: 'grid', gridTemplateColumns: 'max-content auto', columnGap: '0.375rem' }}
                >
                  <span className="text-right text-white/40">← → / H L</span><span>navigate</span>
                  <span className="text-right text-white/40">F</span><span>favorite</span>
                  <span className="text-right text-white/40">1 – 5</span><span>rating</span>
                  <span className="text-right text-white/40">T</span><span>tags</span>
                  <span className="text-right text-white/40">+ / −</span><span>zoom</span>
                  <span className="text-right text-white/40">⇧ + ←→↑↓ / HJKL</span><span>pan</span>
                  <span className="text-right text-white/40">Esc</span><span>close</span>
                </div>
              </div>
            )}
          </div>

          {/* Bottom bar */}
          <div
            className="image-modal-chrome relative z-10 flex items-center justify-between bg-background/80 px-2 py-1.5 backdrop-blur-sm"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center gap-1">
              <button className={toolBtnClass(false)} type="button" onClick={handlePrev} title="Previous" aria-label="Previous image">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button className={toolBtnClass(false)} type="button" onClick={handleNext} title="Next" aria-label="Next image">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <div className="text-xs text-white/70" aria-live="polite">
              {total > 0 ? `${index + 1}/${total}` : ''}
            </div>
            <div className="flex items-center gap-1">
              <button className={toolBtnClass(false)} type="button" onClick={handleZoomOut} title="Zoom out" aria-label="Zoom out">
                <ZoomOut className="h-4 w-4" />
              </button>
              <button className={toolBtnClass(false)} type="button" onClick={handleZoomIn} title="Zoom in" aria-label="Zoom in">
                <ZoomIn className="h-4 w-4" />
              </button>
              <button className={toolBtnClass(false)} type="button" onClick={handleResetZoom} title="Reset" aria-label="Reset zoom">
                <RotateCcw className="h-4 w-4" />
              </button>
            </div>
          </div>
        </>
      </TransformWrapper>
    </div>
  );
}
