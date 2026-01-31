import { useState } from 'react';
import type { SlideshowMode, SlideshowOrder, SlideshowSettings } from '../types';

type SlideshowSettingsModalProps = {
  imageCount: number;
  onStart: (settings: SlideshowSettings) => void;
  onClose: () => void;
};

const DEFAULT_SETTINGS: SlideshowSettings = {
  order: 'none',
  mode: 'fixed',
  fixedInterval: 5,
  minInterval: 3,
  maxInterval: 8,
  showProgress: true
};

export default function SlideshowSettingsModal({
  imageCount,
  onStart,
  onClose
}: SlideshowSettingsModalProps) {
  const [order, setOrder] = useState<SlideshowOrder>(DEFAULT_SETTINGS.order);
  const [mode, setMode] = useState<SlideshowMode>(DEFAULT_SETTINGS.mode);
  const [fixedInterval, setFixedInterval] = useState(DEFAULT_SETTINGS.fixedInterval);
  const [minInterval, setMinInterval] = useState(DEFAULT_SETTINGS.minInterval);
  const [maxInterval, setMaxInterval] = useState(DEFAULT_SETTINGS.maxInterval);
  const [showProgress, setShowProgress] = useState(DEFAULT_SETTINGS.showProgress);

  const handleStart = () => {
    onStart({
      order,
      mode,
      fixedInterval,
      minInterval,
      maxInterval,
      showProgress
    });
  };

  const handleMinIntervalChange = (value: number) => {
    setMinInterval(value);
    if (value > maxInterval) {
      setMaxInterval(value);
    }
  };

  const handleMaxIntervalChange = (value: number) => {
    setMaxInterval(value);
    if (value < minInterval) {
      setMinInterval(value);
    }
  };

  return (
    <div className="slideshow-settings-overlay" onClick={onClose}>
      <div
        className="slideshow-settings-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="slideshow-settings-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="slideshow-settings-header">
          <h2 id="slideshow-settings-title">Slideshow Settings</h2>
          <button
            className="slideshow-close-button"
            type="button"
            onClick={onClose}
            aria-label="Close"
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

        <div className="slideshow-settings-body">
          <div className="slideshow-image-count">
            {imageCount} {imageCount === 1 ? 'image' : 'images'} in slideshow
          </div>

          <div className="slideshow-setting-group">
            <div className="slideshow-setting-header">
              <span className="slideshow-setting-title">Ordering</span>
              <span className="slideshow-setting-subtitle">Play in order or shuffle the deck.</span>
            </div>
            <div className="slideshow-option-grid">
              <label className="slideshow-option-card">
                <input
                  type="radio"
                  name="slideshow-order"
                  value="none"
                  checked={order === 'none'}
                  onChange={() => setOrder('none')}
                />
                <span className="slideshow-option-content">
                  <span className="slideshow-option-icon">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        d="M4 7h10M4 12h16M4 17h12"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                    </svg>
                  </span>
                  <span className="slideshow-option-text">
                    <span className="slideshow-option-title">In order</span>
                    <span className="slideshow-option-desc">Use the gallery ordering</span>
                  </span>
                </span>
              </label>
              <label className="slideshow-option-card">
                <input
                  type="radio"
                  name="slideshow-order"
                  value="shuffle"
                  checked={order === 'shuffle'}
                  onChange={() => setOrder('shuffle')}
                />
                <span className="slideshow-option-content">
                  <span className="slideshow-option-icon">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <polyline
                        points="16 3 21 3 21 8"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <line
                        x1="4"
                        y1="20"
                        x2="21"
                        y2="3"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                      />
                      <polyline
                        points="21 16 21 21 16 21"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <line
                        x1="15"
                        y1="15"
                        x2="21"
                        y2="21"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                      />
                      <line
                        x1="4"
                        y1="4"
                        x2="9"
                        y2="9"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                      />
                    </svg>
                  </span>
                  <span className="slideshow-option-text">
                    <span className="slideshow-option-title">Shuffled</span>
                    <span className="slideshow-option-desc">Randomize the sequence</span>
                  </span>
                </span>
              </label>
            </div>
          </div>

          <div className="slideshow-setting-group">
            <div className="slideshow-setting-header">
              <span className="slideshow-setting-title">Timing</span>
              <span className="slideshow-setting-subtitle">Pick how images advance.</span>
            </div>
            <div className="slideshow-option-grid slideshow-option-grid-tight">
              <label className="slideshow-option-card">
                <input
                  type="radio"
                  name="slideshow-mode"
                  value="manual"
                  checked={mode === 'manual'}
                  onChange={() => setMode('manual')}
                />
                <span className="slideshow-option-content">
                  <span className="slideshow-option-icon">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        d="M4 3l8 18 2.5-7.5L22 11z"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  <span className="slideshow-option-text">
                    <span className="slideshow-option-title">Manual</span>
                    <span className="slideshow-option-desc">Use the controls only</span>
                  </span>
                </span>
              </label>
              <label className="slideshow-option-card">
                <input
                  type="radio"
                  name="slideshow-mode"
                  value="fixed"
                  checked={mode === 'fixed'}
                  onChange={() => setMode('fixed')}
                />
                <span className="slideshow-option-content">
                  <span className="slideshow-option-icon">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <circle
                        cx="12"
                        cy="12"
                        r="8"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                      />
                      <path
                        d="M12 8v5l3 2"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  <span className="slideshow-option-text">
                    <span className="slideshow-option-title">Fixed</span>
                    <span className="slideshow-option-desc">Same duration every time</span>
                  </span>
                </span>
              </label>
              <label className="slideshow-option-card">
                <input
                  type="radio"
                  name="slideshow-mode"
                  value="random"
                  checked={mode === 'random'}
                  onChange={() => setMode('random')}
                />
                <span className="slideshow-option-content">
                  <span className="slideshow-option-icon">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <line
                        x1="4"
                        y1="7"
                        x2="20"
                        y2="7"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                      />
                      <circle cx="9" cy="7" r="2" fill="currentColor" />
                      <line
                        x1="4"
                        y1="17"
                        x2="20"
                        y2="17"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                      />
                      <circle cx="15" cy="17" r="2" fill="currentColor" />
                    </svg>
                  </span>
                  <span className="slideshow-option-text">
                    <span className="slideshow-option-title">Range</span>
                    <span className="slideshow-option-desc">Random within min/max</span>
                  </span>
                </span>
              </label>
            </div>
          </div>

          {mode === 'fixed' && (
            <div className="slideshow-setting-group">
              <label className="slideshow-setting-label" htmlFor="fixed-interval">
                Duration per image
              </label>
              <div className="slideshow-interval-input">
                <input
                  id="fixed-interval"
                  type="number"
                  min={1}
                  max={60}
                  step={1}
                  value={fixedInterval}
                  onChange={(e) => setFixedInterval(Math.max(1, Number(e.target.value)))}
                />
                <span className="slideshow-interval-unit">seconds</span>
              </div>
            </div>
          )}

          {mode === 'random' && (
            <div className="slideshow-setting-group">
              <label className="slideshow-setting-label">Duration range</label>
              <div className="slideshow-range-inputs">
                <div className="slideshow-interval-input">
                  <label htmlFor="min-interval" className="slideshow-range-label">Min</label>
                  <input
                    id="min-interval"
                    type="number"
                    min={1}
                    max={60}
                    step={1}
                    value={minInterval}
                    onChange={(e) => handleMinIntervalChange(Math.max(1, Number(e.target.value)))}
                  />
                  <span className="slideshow-interval-unit">sec</span>
                </div>
                <div className="slideshow-interval-input">
                  <label htmlFor="max-interval" className="slideshow-range-label">Max</label>
                  <input
                    id="max-interval"
                    type="number"
                    min={1}
                    max={60}
                    step={1}
                    value={maxInterval}
                    onChange={(e) => handleMaxIntervalChange(Math.max(1, Number(e.target.value)))}
                  />
                  <span className="slideshow-interval-unit">sec</span>
                </div>
              </div>
            </div>
          )}

          {mode !== 'manual' && (
            <div className="slideshow-setting-group">
              <label className="slideshow-toggle">
                <input
                  type="checkbox"
                  checked={showProgress}
                  onChange={(e) => setShowProgress(e.target.checked)}
                />
                <span className="slideshow-toggle-label">Show progress bar</span>
              </label>
            </div>
          )}
        </div>

        <div className="slideshow-settings-footer">
          <button className="ghost" type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            className="button primary"
            type="button"
            onClick={handleStart}
            disabled={imageCount === 0}
          >
            Start Slideshow
          </button>
        </div>
      </div>
    </div>
  );
}
