import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ImageItem, SlideshowSettings } from '../types';

type SlideshowViewProps = {
  images: ImageItem[];
  settings: SlideshowSettings;
  onClose: () => void;
};

export default function SlideshowView({ images, settings, onClose }: SlideshowViewProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentDuration, setCurrentDuration] = useState(0);
  const timerRef = useRef<number | null>(null);
  const progressIntervalRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  const orderedImages = useMemo(() => {
    if (settings.order !== 'shuffle') {
      return images;
    }

    const shuffled = [...images];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }, [images, settings.order]);

  const currentImage = orderedImages[currentIndex];

  const getRandomDuration = useCallback(() => {
    const min = settings.minInterval * 1000;
    const max = settings.maxInterval * 1000;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }, [settings.minInterval, settings.maxInterval]);

  const getDuration = useCallback(() => {
    if (settings.mode === 'fixed') {
      return settings.fixedInterval * 1000;
    }
    if (settings.mode === 'random') {
      return getRandomDuration();
    }
    return 0;
  }, [settings.mode, settings.fixedInterval, getRandomDuration]);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => {
      if (orderedImages.length === 0) return 0;
      return (prev + 1) % orderedImages.length;
    });
  }, [orderedImages.length]);

  const goToPrev = useCallback(() => {
    setCurrentIndex((prev) => {
      if (orderedImages.length === 0) return 0;
      return (prev - 1 + orderedImages.length) % orderedImages.length;
    });
  }, [orderedImages.length]);

  const clearTimers = useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (progressIntervalRef.current) {
      window.clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    if (settings.mode === 'manual' || isPaused) return;

    clearTimers();

    const duration = getDuration();
    setCurrentDuration(duration);
    setProgress(0);
    startTimeRef.current = Date.now();

    if (settings.showProgress) {
      progressIntervalRef.current = window.setInterval(() => {
        const elapsed = Date.now() - startTimeRef.current;
        const newProgress = Math.min((elapsed / duration) * 100, 100);
        setProgress(newProgress);
      }, 16); // ~60fps
    }

    timerRef.current = window.setTimeout(() => {
      goToNext();
    }, duration);
  }, [settings.mode, settings.showProgress, isPaused, getDuration, clearTimers, goToNext]);

  // Start timer when index changes or when unpaused
  useEffect(() => {
    if (settings.mode !== 'manual' && !isPaused) {
      startTimer();
    }
    return clearTimers;
  }, [currentIndex, isPaused, settings.mode, startTimer, clearTimers]);

  useEffect(() => {
    setCurrentIndex(0);
  }, [settings.order]);

  useEffect(() => {
    if (currentIndex >= orderedImages.length) {
      setCurrentIndex(0);
    }
  }, [currentIndex, orderedImages.length]);

  // Handle pause/resume
  const togglePause = useCallback(() => {
    if (settings.mode === 'manual') return;

    setIsPaused((prev) => {
      if (prev) {
        // Resuming - restart timer
        return false;
      } else {
        // Pausing - clear timers
        clearTimers();
        return true;
      }
    });
  }, [settings.mode, clearTimers]);

  // Handle manual navigation (resets timer)
  const handlePrev = useCallback(() => {
    clearTimers();
    setProgress(0);
    goToPrev();
  }, [clearTimers, goToPrev]);

  const handleNext = useCallback(() => {
    clearTimers();
    setProgress(0);
    goToNext();
  }, [clearTimers, goToNext]);

  // Click on image area to pause
  const handleImageClick = useCallback((e: React.MouseEvent) => {
    // Don't toggle pause if clicking navigation arrows or close button
    const target = e.target as HTMLElement;
    if (target.closest('.slideshow-control') || target.closest('.slideshow-close')) return;

    togglePause();
  }, [togglePause]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft':
          handlePrev();
          break;
        case 'ArrowRight':
          handleNext();
          break;
        case 'Escape':
          onClose();
          break;
        case ' ':
          e.preventDefault();
          togglePause();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePrev, handleNext, onClose, togglePause]);

  // Cleanup on unmount
  useEffect(() => {
    return clearTimers;
  }, [clearTimers]);

  const showProgressBar = settings.mode !== 'manual' && settings.showProgress;

  return (
    <div className="slideshow-view" onClick={handleImageClick}>
      {/* Close button */}
      <button
        className="slideshow-close"
        type="button"
        onClick={onClose}
        aria-label="Exit slideshow"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M6 6l12 12M18 6l-12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {/* Image */}
      <div className="slideshow-image-container">
        {currentImage && (
          <img
            key={currentImage.id}
            className="slideshow-image"
            src={currentImage.url}
            alt={currentImage.name}
          />
        )}
      </div>

      <div
        className="slideshow-bottom-bar"
        onClick={(e) => e.stopPropagation()}
        role="presentation"
      >
        {showProgressBar && (
          <div className="slideshow-progress-container">
            <div
              className="slideshow-progress-bar"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
        <div className="slideshow-bottom-row">
          <button
            className="slideshow-control slideshow-nav-button"
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handlePrev();
            }}
            aria-label="Previous image"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M15 6l-6 6 6 6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <div className="slideshow-counter">
            {currentIndex + 1} / {orderedImages.length}
          </div>
          <button
            className="slideshow-control slideshow-nav-button"
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleNext();
            }}
            aria-label="Next image"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M9 6l6 6-6 6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
