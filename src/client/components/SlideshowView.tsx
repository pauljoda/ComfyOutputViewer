import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import type { ImageItem, SlideshowSettings } from '../types';

type SlideshowViewProps = {
  images: ImageItem[];
  settings: SlideshowSettings;
  onClose: () => void;
};

type FadePhase = 'idle' | 'out' | 'in';

const FADE_DURATION_MS = 450;

export default function SlideshowView({ images, settings, onClose }: SlideshowViewProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [pendingIndex, setPendingIndex] = useState<number | null>(null);
  const [fadePhase, setFadePhase] = useState<FadePhase>('idle');
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressDuration, setProgressDuration] = useState(0);
  const [loadedIds, setLoadedIds] = useState<Set<string>>(() => new Set());
  const fadeTimeoutRef = useRef<number | null>(null);
  const progressKickRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const elapsedRef = useRef<number>(0);
  const durationRef = useRef<number>(0);

  const orderedImages = useMemo(() => {
    if (settings.order !== 'shuffle') return images;
    const shuffled = [...images];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }, [images, settings.order]);

  const currentImage = orderedImages[currentIndex];
  const currentLoaded = currentImage ? loadedIds.has(currentImage.id) : false;

  const getRandomDuration = useCallback(() => {
    const min = settings.minInterval * 1000;
    const max = settings.maxInterval * 1000;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }, [settings.minInterval, settings.maxInterval]);

  const getDuration = useCallback(() => {
    if (settings.mode === 'fixed') return settings.fixedInterval * 1000;
    if (settings.mode === 'random') return getRandomDuration();
    return 0;
  }, [settings.mode, settings.fixedInterval, getRandomDuration]);

  const clearTimers = useCallback(() => {
    if (fadeTimeoutRef.current) {
      window.clearTimeout(fadeTimeoutRef.current);
      fadeTimeoutRef.current = null;
    }
    if (progressKickRef.current) {
      window.cancelAnimationFrame(progressKickRef.current);
      progressKickRef.current = null;
    }
  }, []);

  const handleImageLoad = useCallback((id: string) => {
    setLoadedIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const preloadIndex = useCallback((index: number) => {
    const target = orderedImages[index];
    if (!target || loadedIds.has(target.id)) return;
    const img = new Image();
    img.src = target.url;
    img.onload = () => handleImageLoad(target.id);
    img.onerror = () => handleImageLoad(target.id);
  }, [orderedImages, loadedIds, handleImageLoad]);

  const beginTransition = useCallback((targetIndex: number) => {
    if (orderedImages.length === 0) return;
    if (targetIndex === currentIndex) return;
    setPendingIndex(targetIndex);
    preloadIndex(targetIndex);
    if (!currentLoaded) {
      setCurrentIndex(targetIndex);
      setPendingIndex(null);
      setFadePhase('idle');
      return;
    }
    const target = orderedImages[targetIndex];
    if (target && loadedIds.has(target.id)) {
      setFadePhase('out');
    }
  }, [orderedImages.length, currentIndex, preloadIndex, currentLoaded, orderedImages, loadedIds]);

  const scheduleAutoAdvance = useCallback((resume = false) => {
    if (settings.mode === 'manual' || isPaused) return;
    if (orderedImages.length === 0) return;
    clearTimers();
    const duration = getDuration();
    durationRef.current = duration;
    const elapsed = resume ? elapsedRef.current : 0;
    const remaining = Math.max(0, duration - elapsed);
    if (!resume) elapsedRef.current = 0;
    startTimeRef.current = Date.now() - elapsed;
    setProgressDuration(0);
    setProgress(duration > 0 ? (elapsed / duration) * 100 : 0);
    if (settings.showProgress && remaining > 0) {
      progressKickRef.current = window.requestAnimationFrame(() => {
        setProgressDuration(remaining);
        setProgress(100);
      });
    }
    if (orderedImages.length > 1) {
      const fadeDelay = Math.max(0, remaining - FADE_DURATION_MS);
      fadeTimeoutRef.current = window.setTimeout(() => {
        beginTransition((currentIndex + 1) % orderedImages.length);
      }, fadeDelay);
    }
  }, [settings.mode, settings.showProgress, isPaused, orderedImages.length, clearTimers, getDuration, beginTransition, currentIndex]);

  useEffect(() => {
    if (settings.mode !== 'manual' && !isPaused) {
      const resume = elapsedRef.current > 0;
      scheduleAutoAdvance(resume);
    }
    return clearTimers;
  }, [currentIndex, isPaused, settings.mode, scheduleAutoAdvance, clearTimers]);

  useEffect(() => {
    setCurrentIndex(0);
    setPendingIndex(null);
    setFadePhase('idle');
    elapsedRef.current = 0;
    setProgress(0);
    setProgressDuration(0);
  }, [settings.order]);

  useEffect(() => {
    if (currentIndex >= orderedImages.length) setCurrentIndex(0);
  }, [currentIndex, orderedImages.length]);

  useEffect(() => {
    if (orderedImages.length < 2) return;
    preloadIndex((currentIndex + 1) % orderedImages.length);
  }, [currentIndex, orderedImages.length, preloadIndex]);

  useEffect(() => {
    if (pendingIndex === null || fadePhase !== 'idle') return;
    const target = orderedImages[pendingIndex];
    if (target && loadedIds.has(target.id)) setFadePhase('out');
  }, [pendingIndex, fadePhase, orderedImages, loadedIds]);

  useEffect(() => {
    document.body.classList.add('slideshow-open');
    return () => document.body.classList.remove('slideshow-open');
  }, []);

  const handleFadeTransitionEnd = useCallback((event: React.TransitionEvent<HTMLDivElement>) => {
    if (event.propertyName !== 'opacity') return;
    if (fadePhase === 'out') {
      if (pendingIndex === null) { setFadePhase('idle'); return; }
      setCurrentIndex(pendingIndex);
      setFadePhase('in');
      return;
    }
    if (fadePhase === 'in') {
      setFadePhase('idle');
      setPendingIndex(null);
    }
  }, [fadePhase, pendingIndex]);

  const togglePause = useCallback(() => {
    if (settings.mode === 'manual') return;
    setIsPaused((prev) => {
      if (prev) return false;
      clearTimers();
      if (durationRef.current > 0) {
        elapsedRef.current = Math.min(Date.now() - startTimeRef.current, durationRef.current);
        setProgressDuration(0);
        setProgress((elapsedRef.current / durationRef.current) * 100);
      }
      return true;
    });
  }, [settings.mode, clearTimers]);

  const handlePrev = useCallback(() => {
    if (orderedImages.length === 0) return;
    clearTimers();
    setProgress(0);
    setProgressDuration(0);
    elapsedRef.current = 0;
    beginTransition((currentIndex - 1 + orderedImages.length) % orderedImages.length);
  }, [orderedImages.length, clearTimers, currentIndex, beginTransition]);

  const handleNext = useCallback(() => {
    if (orderedImages.length === 0) return;
    clearTimers();
    setProgress(0);
    setProgressDuration(0);
    elapsedRef.current = 0;
    beginTransition((currentIndex + 1) % orderedImages.length);
  }, [orderedImages.length, clearTimers, currentIndex, beginTransition]);

  const handleImageClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-slideshow-control]')) return;
    togglePause();
  }, [togglePause]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft': handlePrev(); break;
        case 'ArrowRight': handleNext(); break;
        case 'Escape': onClose(); break;
        case ' ': e.preventDefault(); togglePause(); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePrev, handleNext, onClose, togglePause]);

  useEffect(() => clearTimers, [clearTimers]);

  const showProgressBar = settings.mode !== 'manual' && settings.showProgress;
  const fadeClass = fadePhase === 'out' ? 'slideshow-fade-out' : 'slideshow-fade-in';
  const frameClass = currentLoaded ? fadeClass : 'slideshow-fade-hidden';

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black" onClick={handleImageClick}>
      <button
        data-slideshow-control
        className="absolute right-3 top-3 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white/80 hover:bg-black/60 hover:text-white"
        type="button"
        onClick={onClose}
        aria-label="Exit slideshow"
      >
        <X className="h-5 w-5" />
      </button>

      <div className="flex flex-1 items-center justify-center overflow-hidden">
        {currentImage && (
          <div
            className={`flex h-full w-full items-center justify-center ${frameClass}`}
            onTransitionEnd={handleFadeTransitionEnd}
          >
            <img
              key={currentImage.id}
              className="max-h-full max-w-full object-contain"
              src={currentImage.url}
              alt={currentImage.name}
              onLoad={() => handleImageLoad(currentImage.id)}
            />
          </div>
        )}
      </div>

      <div
        className="relative bg-black/60"
        onClick={(e) => e.stopPropagation()}
        role="presentation"
      >
        {showProgressBar && (
          <div className="h-0.5 w-full bg-white/20">
            <div
              className="slideshow-progress-bar-fill h-full bg-primary"
              style={{
                transform: `scaleX(${progress / 100})`,
                transitionDuration: `${progressDuration}ms`
              }}
            />
          </div>
        )}
        <div className="flex items-center justify-center gap-4 py-2">
          <button
            data-slideshow-control
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-white/80 hover:text-white"
            type="button"
            onClick={(e) => { e.stopPropagation(); handlePrev(); }}
            aria-label="Previous image"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="text-sm text-white/70">
            {currentIndex + 1} / {orderedImages.length}
          </div>
          <button
            data-slideshow-control
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-white/80 hover:text-white"
            type="button"
            onClick={(e) => { e.stopPropagation(); handleNext(); }}
            aria-label="Next image"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
