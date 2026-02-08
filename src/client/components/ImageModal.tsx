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
import { api } from '../lib/api';

type PromptInput = {
  inputId?: number;
  label: string;
  systemLabel?: string;
  inputType?: string;
  value: unknown;
};

type PromptPayload = {
  workflowId?: number;
  workflowInputs?: PromptInput[];
  inputs?: PromptInput[];
  inputJson?: Record<string, unknown>;
};

type PromptJobInput = {
  inputId: number;
  value: string;
  label?: string;
  inputType?: string;
  inputKey?: string;
};

type PromptData = {
  imagePath: string;
  jobId: number | null;
  workflowId?: number | null;
  promptData: PromptPayload;
  jobInputs?: PromptJobInput[];
  createdAt: number;
};

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
  const [promptData, setPromptData] = useState<PromptData | null>(null);
  const [promptLoading, setPromptLoading] = useState(false);
  const [promptError, setPromptError] = useState<string | null>(null);
  const [promptAvailable, setPromptAvailable] = useState(false);

  const loadPromptData = async (signal?: AbortSignal) => {
    try {
      setPromptLoading(true);
      setPromptError(null);
      const data = await api<PromptData>(`/api/images/${encodeURIComponent(image.id)}/prompt`, {
        signal
      });
      setPromptData(data);
      setPromptAvailable(true);
    } catch (err) {
      if (signal?.aborted) return;
      setPromptAvailable(false);
      setPromptData(null);
      if (modalTool === 'prompt') {
        setPromptError(err instanceof Error ? err.message : 'No prompt data found');
      }
    } finally {
      if (!signal?.aborted) {
        setPromptLoading(false);
      }
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    setPromptAvailable(false);
    setPromptData(null);
    setPromptError(null);
    loadPromptData(controller.signal);
    return () => controller.abort();
  }, [image.id]);

  useEffect(() => {
    if (modalTool === 'prompt' && promptAvailable && !promptData && !promptLoading) {
      loadPromptData();
    }
  }, [modalTool, promptAvailable, promptData, promptLoading]);

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
    return params.get('debug') === '1' || window.localStorage.getItem('comfy_debug') === '1';
  }, []);

  const handlePrev = () => onPrev();
  const handleNext = () => onNext();
  const handleClose = () => onClose();
  const handleToggleTags = () => onToggleTags();
  const handleToggleRating = () => onToggleRating();
  const handleTogglePrompt = () => onTogglePrompt();
  const handlePromptOverlayClick = () => onTogglePrompt();

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
  const suggestions = safeAvailableTags.filter(
    (tag) => !imageTags.includes(tag) && (!tagQuery || tag.includes(tagQuery))
  );

  const promptInputs = useMemo<PromptInput[]>(() => {
    if (!promptData) return [];
    if (Array.isArray(promptData.promptData?.inputs)) {
      return promptData.promptData.inputs;
    }
    if (Array.isArray(promptData.promptData?.workflowInputs)) {
      return promptData.promptData.workflowInputs;
    }
    if (Array.isArray(promptData.jobInputs) && promptData.jobInputs.length > 0) {
      return promptData.jobInputs.map((input) => ({
        inputId: input.inputId,
        label: input.label || `Input ${input.inputId}`,
        systemLabel: input.inputKey,
        inputType: input.inputType,
        value: input.value
      }));
    }
    return [];
  }, [promptData]);

  const promptJson = useMemo(() => {
    if (!promptData?.promptData) return null;
    if (promptData.promptData.inputJson) {
      return promptData.promptData.inputJson;
    }
    if (promptInputs.length === 0) return null;
    const next = {} as Record<string, unknown>;
    promptInputs.forEach((input) => {
      const key = input.label || input.systemLabel || 'input';
      next[key] = input.value;
    });
    return next;
  }, [promptData, promptInputs]);

  const promptWorkflowId =
    promptData?.promptData?.workflowId ?? promptData?.workflowId ?? null;

  const promptPrefillEntries = useMemo(() => {
    if (!promptData) return [];
    const entries: Array<{
      inputId?: number;
      label?: string;
      systemLabel?: string;
      value: string;
    }> = [];
    const jobInputs = promptData.jobInputs ?? [];
    const jobInputByLabel = new Map(
      jobInputs.filter((input) => input.label).map((input) => [String(input.label), input])
    );
    const jobInputByKey = new Map(
      jobInputs.filter((input) => input.inputKey).map((input) => [String(input.inputKey), input])
    );
    const promptSource =
      promptData.promptData?.inputs && promptData.promptData.inputs.length > 0
        ? promptData.promptData.inputs
        : promptData.promptData?.workflowInputs || [];
    if (promptSource.length > 0) {
      promptSource.forEach((input) => {
        const byLabel = input.label ? jobInputByLabel.get(String(input.label)) : undefined;
        const byKey = input.systemLabel ? jobInputByKey.get(String(input.systemLabel)) : undefined;
        const inputId = input.inputId ?? byLabel?.inputId ?? byKey?.inputId;
        const value = input.value === null || input.value === undefined ? '' : String(input.value);
        entries.push({ inputId, label: input.label, systemLabel: input.systemLabel, value });
      });
    } else if (jobInputs.length > 0) {
      jobInputs.forEach((input) => {
        entries.push({
          inputId: input.inputId,
          label: input.label,
          systemLabel: input.inputKey,
          value: input.value === null || input.value === undefined ? '' : String(input.value)
        });
      });
    }
    return entries;
  }, [promptData]);

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
    const target = event.target as HTMLElement;
    if (target.closest('.zoom-wrapper')) return;
    handleClose();
  };

  const toolBtnClass = (active: boolean) =>
    `inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
      active ? 'bg-white/20 text-white' : 'text-white/80 hover:bg-white/10 hover:text-white'
    }`;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90" role="dialog" aria-modal="true">
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
            className="relative z-10 flex flex-col bg-background/80 backdrop-blur-sm"
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

            {/* Tool panels (tags, rating) */}
            {modalTool && modalTool !== 'prompt' && (
              <div className="border-t border-white/10 bg-background/90 p-3">
                {modalTool === 'tags' && (
                  <div className="space-y-2">
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
                    <div className="flex items-center gap-2">
                      <input
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
                        placeholder="Type a tag…"
                        className="h-8 flex-1 rounded-md border border-input bg-background px-2 text-sm"
                      />
                      <Button size="sm" onClick={handleAddTag} disabled={!tagInput.trim()}>
                        Add
                      </Button>
                    </div>
                    {suggestions.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {suggestions.map((tag) => (
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
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-foreground">Rate this image</span>
                    <RatingStars
                      value={image.rating}
                      onChange={onRate}
                      allowClear
                      label="Image rating"
                    />
                    <span className="text-xs text-muted-foreground">
                      Click a star to rate. Click the same star to clear.
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Prompt overlay */}
          {modalTool === 'prompt' && promptAvailable && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 p-4" onClick={handlePromptOverlayClick}>
              <div
                className="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-lg border bg-background text-foreground"
                role="dialog"
                aria-label="Prompt metadata"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b p-4">
                  <div>
                    <div className="text-sm font-semibold">Generation prompt</div>
                    {promptData && (
                      <div className="text-xs text-muted-foreground">
                        Generated {new Date(promptData.createdAt).toLocaleString()}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {promptWorkflowId ? (
                      <Button size="sm" onClick={handleLoadWorkflow}>
                        Load Workflow
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">Workflow not saved</span>
                    )}
                    <button
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent"
                      type="button"
                      onClick={handleTogglePrompt}
                      aria-label="Close prompt"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  {promptLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
                  {promptError && <p className="text-sm text-destructive">{promptError}</p>}
                  {promptJson && (
                    <pre className="whitespace-pre-wrap break-all rounded-md bg-muted p-3 text-xs">
                      {JSON.stringify(promptJson, null, 2)}
                    </pre>
                  )}
                  {!promptJson && promptData && (
                    <p className="text-sm text-muted-foreground">No input data recorded.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Image body */}
          <div
            data-modal-body
            className="relative flex-1 overflow-hidden px-3"
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
                  className={`max-h-full max-w-full transition-opacity ${swipeIncoming ? 'opacity-0' : 'opacity-100'}`}
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
          </div>

          {/* Bottom bar */}
          <div
            className="relative z-10 flex items-center justify-between bg-background/80 px-2 py-1.5 backdrop-blur-sm"
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
