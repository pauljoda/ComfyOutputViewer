import type { SyntheticEvent, TouchEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch';
import type { ReactZoomPanPinchRef } from 'react-zoom-pan-pinch';
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
const FIT_WIDTH_RATIO = 0.92;
const FIT_HEIGHT_RATIO = 0.78;
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

  const handleTogglePrompt = () => {
    onTogglePrompt();
  };

  const handlePromptOverlayClick = () => {
    onTogglePrompt();
  };

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
      state: {
        prefill: prefillPayload
      }
    });
    onClose();
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
      const modalBody = document.querySelector('.modal-body') as HTMLElement | null;
      const modalStage = document.querySelector('.modal-stage') as HTMLElement | null;
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
        doc: `${format(document.documentElement.clientWidth)} x ${format(
          document.documentElement.clientHeight
        )}`,
        visual: visualViewport
          ? `${format(visualViewport.width)} x ${format(visualViewport.height)}`
          : 'n/a',
        body: modalBody
          ? `${format(modalBody.getBoundingClientRect().width)} x ${format(
              modalBody.getBoundingClientRect().height
            )}`
          : 'n/a',
        stage: modalStage
          ? `${format(modalStage.getBoundingClientRect().width)} x ${format(
              modalStage.getBoundingClientRect().height
            )}`
          : 'n/a',
        wrapper: wrapperRect
          ? `${format(wrapperRect.width)} x ${format(wrapperRect.height)}`
          : 'n/a',
        content: contentRect
          ? `${format(contentRect.width)} x ${format(contentRect.height)}`
          : 'n/a',
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
  const suggestions = useMemo(
    () =>
      availableTags.filter(
        (tag) => !image.tags.includes(tag) && (!tagQuery || tag.includes(tagQuery))
      ),
    [availableTags, image.tags, tagQuery]
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
      jobInputs
        .filter((input) => input.label)
        .map((input) => [String(input.label), input])
    );
    const jobInputByKey = new Map(
      jobInputs
        .filter((input) => input.inputKey)
        .map((input) => [String(input.inputKey), input])
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
        entries.push({
          inputId,
          label: input.label,
          systemLabel: input.systemLabel,
          value
        });
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
    fitScaleRef.current = 1;
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

  return (
    <div className="modal" role="dialog" aria-modal="true">
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
          lastStateRef.current = state;
          scheduleDebugUpdate('transform', state);
        }}
        onInit={() => {
          setTransformReady(true);
          scheduleDebugUpdate('init');
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
                {promptAvailable && (
                  <button
                    className={modalTool === 'prompt' ? 'tool-button active' : 'tool-button'}
                    type="button"
                    onClick={handleTogglePrompt}
                    title="View prompt"
                    aria-label="View prompt data"
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <circle
                        cx="12"
                        cy="12"
                        r="9"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                      />
                      <path
                        d="M12 10v6"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                      />
                      <circle cx="12" cy="7" r="1.2" fill="currentColor" />
                    </svg>
                  </button>
                )}
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

            {modalTool && modalTool !== 'prompt' && (
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

          {modalTool === 'prompt' && promptAvailable && (
            <div className="prompt-overlay" onClick={handlePromptOverlayClick}>
              <div
                className="prompt-card"
                role="dialog"
                aria-label="Prompt metadata"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="prompt-card-header">
                  <div className="prompt-card-heading">
                    <span className="prompt-panel-title">Generation prompt</span>
                    {promptData && (
                      <span className="prompt-card-subtitle">
                        Generated {new Date(promptData.createdAt).toLocaleString()}
                      </span>
                    )}
                  </div>
                  {promptWorkflowId ? (
                    <button
                      className="button prompt-card-action"
                      type="button"
                      onClick={handleLoadWorkflow}
                    >
                      Load Workflow
                    </button>
                  ) : (
                    <span className="prompt-card-missing">Workflow not saved</span>
                  )}
                </div>
                <div className="prompt-card-body prompt-panel">
                  {promptLoading && <p className="prompt-loading">Loading...</p>}
                  {promptError && <p className="prompt-error">{promptError}</p>}
                  {promptJson && (
                    <pre className="prompt-json">{JSON.stringify(promptJson, null, 2)}</pre>
                  )}
                  {!promptJson && promptData && (
                    <p className="prompt-empty">No input data recorded.</p>
                  )}
                </div>
              </div>
            </div>
          )}

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
                <TransformComponent
                  wrapperClass="zoom-wrapper"
                  contentClass="zoom-content"
                  wrapperStyle={{ width: '100%', height: '100%' }}
                  contentStyle={{ width: '100%', height: '100%' }}
                >
                  <img
                    className={`modal-image${swipeIncoming ? ' swipe-in' : ''}`}
                    src={image.url}
                    alt={image.name}
                    style={{ maxWidth: '100%', maxHeight: '100%', height: 'auto', width: 'auto' }}
                    onLoad={handleImageLoad}
                    ref={handleImageRef}
                  />
                </TransformComponent>
              </div>
              {debugEnabled && debugInfo && (
                <div className="modal-debug">
                  <div>Zoom debug</div>
                  <div>reason: {debugInfo.reason}</div>
                  <div>image: {debugInfo.image}</div>
                  <div>viewport: {debugInfo.viewport}</div>
                  <div>doc: {debugInfo.doc}</div>
                  <div>visual: {debugInfo.visual}</div>
                  <div>body: {debugInfo.body}</div>
                  <div>stage: {debugInfo.stage}</div>
                  <div>wrapper: {debugInfo.wrapper}</div>
                  <div>content: {debugInfo.content}</div>
                  <div>imgRect: {debugInfo.imgRect}</div>
                  <div>natural: {debugInfo.natural}</div>
                  <div>rendered: {debugInfo.rendered}</div>
                  <div>client: {debugInfo.client}</div>
                  <div>complete: {debugInfo.complete}</div>
                  <div>base: {debugInfo.base}</div>
                  <div>dpr: {debugInfo.dpr}</div>
                  <div>scale: {debugInfo.scale}</div>
                  <div>fitScale: {debugInfo.fitScale}</div>
                  <div>minScale: {debugInfo.minScale}</div>
                  <div>refScale: {debugInfo.transformScale}</div>
                </div>
              )}
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
