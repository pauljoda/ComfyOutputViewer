import { useState } from 'react';
import { X, List, Shuffle, MousePointer, Clock, SlidersHorizontal } from 'lucide-react';
import { Button } from './ui/button';
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
    onStart({ order, mode, fixedInterval, minInterval, maxInterval, showProgress });
  };

  const handleMinIntervalChange = (value: number) => {
    setMinInterval(value);
    if (value > maxInterval) setMaxInterval(value);
  };

  const handleMaxIntervalChange = (value: number) => {
    setMaxInterval(value);
    if (value < minInterval) setMinInterval(value);
  };

  const optionCard = (selected: boolean) =>
    `flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
      selected ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label="Close slideshow settings"
        onClick={onClose}
      />
      <div
        className="relative z-10 mx-4 w-full max-w-lg rounded-lg border bg-background shadow-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="slideshow-settings-title"
      >
        <div className="flex items-center justify-between border-b p-4">
          <h2 id="slideshow-settings-title" className="text-base font-semibold">
            Slideshow Settings
          </h2>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-5 p-4">
          <div className="text-sm text-muted-foreground">
            {imageCount} {imageCount === 1 ? 'image' : 'images'} in slideshow
          </div>

          {/* Ordering */}
          <div className="space-y-2">
            <div className="text-sm font-medium">Ordering</div>
            <div className="grid grid-cols-2 gap-2">
              <label className={optionCard(order === 'none')}>
                <input type="radio" name="slideshow-order" value="none" checked={order === 'none'} onChange={() => setOrder('none')} className="hidden" />
                <List className="h-5 w-5 shrink-0 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium">In order</div>
                  <div className="text-xs text-muted-foreground">Gallery ordering</div>
                </div>
              </label>
              <label className={optionCard(order === 'shuffle')}>
                <input type="radio" name="slideshow-order" value="shuffle" checked={order === 'shuffle'} onChange={() => setOrder('shuffle')} className="hidden" />
                <Shuffle className="h-5 w-5 shrink-0 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium">Shuffled</div>
                  <div className="text-xs text-muted-foreground">Random sequence</div>
                </div>
              </label>
            </div>
          </div>

          {/* Timing */}
          <div className="space-y-2">
            <div className="text-sm font-medium">Timing</div>
            <div className="grid grid-cols-3 gap-2">
              <label className={optionCard(mode === 'manual')}>
                <input type="radio" name="slideshow-mode" value="manual" checked={mode === 'manual'} onChange={() => setMode('manual')} className="hidden" />
                <div className="text-center">
                  <MousePointer className="mx-auto h-5 w-5 text-muted-foreground" />
                  <div className="mt-1 text-xs font-medium">Manual</div>
                </div>
              </label>
              <label className={optionCard(mode === 'fixed')}>
                <input type="radio" name="slideshow-mode" value="fixed" checked={mode === 'fixed'} onChange={() => setMode('fixed')} className="hidden" />
                <div className="text-center">
                  <Clock className="mx-auto h-5 w-5 text-muted-foreground" />
                  <div className="mt-1 text-xs font-medium">Fixed</div>
                </div>
              </label>
              <label className={optionCard(mode === 'random')}>
                <input type="radio" name="slideshow-mode" value="random" checked={mode === 'random'} onChange={() => setMode('random')} className="hidden" />
                <div className="text-center">
                  <SlidersHorizontal className="mx-auto h-5 w-5 text-muted-foreground" />
                  <div className="mt-1 text-xs font-medium">Range</div>
                </div>
              </label>
            </div>
          </div>

          {mode === 'fixed' && (
            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="fixed-interval">Duration per image</label>
              <div className="flex items-center gap-2">
                <input
                  id="fixed-interval"
                  type="number"
                  min={1}
                  max={60}
                  step={1}
                  value={fixedInterval}
                  onChange={(e) => setFixedInterval(Math.max(1, Number(e.target.value)))}
                  className="h-9 w-20 rounded-md border border-input bg-background px-2 text-sm"
                />
                <span className="text-sm text-muted-foreground">seconds</span>
              </div>
            </div>
          )}

          {mode === 'random' && (
            <div className="space-y-1">
              <div className="text-sm font-medium">Duration range</div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <label htmlFor="min-interval" className="text-xs text-muted-foreground">Min</label>
                  <input
                    id="min-interval"
                    type="number"
                    min={1}
                    max={60}
                    step={1}
                    value={minInterval}
                    onChange={(e) => handleMinIntervalChange(Math.max(1, Number(e.target.value)))}
                    className="h-9 w-16 rounded-md border border-input bg-background px-2 text-sm"
                  />
                  <span className="text-xs text-muted-foreground">sec</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <label htmlFor="max-interval" className="text-xs text-muted-foreground">Max</label>
                  <input
                    id="max-interval"
                    type="number"
                    min={1}
                    max={60}
                    step={1}
                    value={maxInterval}
                    onChange={(e) => handleMaxIntervalChange(Math.max(1, Number(e.target.value)))}
                    className="h-9 w-16 rounded-md border border-input bg-background px-2 text-sm"
                  />
                  <span className="text-xs text-muted-foreground">sec</span>
                </div>
              </div>
            </div>
          )}

          {mode !== 'manual' && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showProgress}
                onChange={(e) => setShowProgress(e.target.checked)}
                className="accent-primary"
              />
              Show progress bar
            </label>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t p-4">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleStart} disabled={imageCount === 0}>Start Slideshow</Button>
        </div>
      </div>
    </div>
  );
}
