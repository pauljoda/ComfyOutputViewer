import { useState } from 'react';
import type { SlideshowMode, SlideshowSettings } from '../types';

type SlideshowSettingsModalProps = {
  imageCount: number;
  onStart: (settings: SlideshowSettings) => void;
  onClose: () => void;
};

const DEFAULT_SETTINGS: SlideshowSettings = {
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
  const [mode, setMode] = useState<SlideshowMode>(DEFAULT_SETTINGS.mode);
  const [fixedInterval, setFixedInterval] = useState(DEFAULT_SETTINGS.fixedInterval);
  const [minInterval, setMinInterval] = useState(DEFAULT_SETTINGS.minInterval);
  const [maxInterval, setMaxInterval] = useState(DEFAULT_SETTINGS.maxInterval);
  const [showProgress, setShowProgress] = useState(DEFAULT_SETTINGS.showProgress);

  const handleStart = () => {
    onStart({
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
            <label className="slideshow-setting-label">Mode</label>
            <div className="slideshow-mode-options">
              <label className="slideshow-radio">
                <input
                  type="radio"
                  name="slideshow-mode"
                  value="manual"
                  checked={mode === 'manual'}
                  onChange={() => setMode('manual')}
                />
                <span className="slideshow-radio-label">
                  <span className="slideshow-radio-title">Manual</span>
                  <span className="slideshow-radio-desc">Navigate with arrows only</span>
                </span>
              </label>
              <label className="slideshow-radio">
                <input
                  type="radio"
                  name="slideshow-mode"
                  value="fixed"
                  checked={mode === 'fixed'}
                  onChange={() => setMode('fixed')}
                />
                <span className="slideshow-radio-label">
                  <span className="slideshow-radio-title">Auto (Fixed)</span>
                  <span className="slideshow-radio-desc">Same duration for each image</span>
                </span>
              </label>
              <label className="slideshow-radio">
                <input
                  type="radio"
                  name="slideshow-mode"
                  value="random"
                  checked={mode === 'random'}
                  onChange={() => setMode('random')}
                />
                <span className="slideshow-radio-label">
                  <span className="slideshow-radio-title">Auto (Random)</span>
                  <span className="slideshow-radio-desc">Random duration within range</span>
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
