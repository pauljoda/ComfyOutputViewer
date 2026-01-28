import type { TouchEvent } from 'react';
import { useRef, useState } from 'react';
import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch';
import type { ImageItem, ModalTool } from '../types';

type ImageModalProps = {
  image: ImageItem;
  folders: string[];
  moveTarget: string;
  modalTool: ModalTool;
  onMoveTargetChange: (value: string) => void;
  onMoveSelected: () => void;
  onToggleDetails: () => void;
  onToggleFavorite: () => void;
  onToggleHidden: () => void;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
};

export default function ImageModal({
  image,
  folders,
  moveTarget,
  modalTool,
  onMoveTargetChange,
  onMoveSelected,
  onToggleDetails,
  onToggleFavorite,
  onToggleHidden,
  onClose,
  onPrev,
  onNext
}: ImageModalProps) {
  const [overflowOpen, setOverflowOpen] = useState(false);
  const swipeStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const swipeLastRef = useRef<{ x: number; y: number } | null>(null);
  const lastSwipeAtRef = useRef(0);
  const isPanningRef = useRef(false);
  const isPinchingRef = useRef(false);
  const scaleRef = useRef(1);

  const handlePrev = () => {
    setOverflowOpen(false);
    onPrev();
  };

  const handleNext = () => {
    setOverflowOpen(false);
    onNext();
  };

  const handleClose = () => {
    setOverflowOpen(false);
    onClose();
  };

  const handleToggleDetails = () => {
    setOverflowOpen(false);
    onToggleDetails();
  };

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

  return (
    <div className="modal" role="dialog" aria-modal="true">
      <TransformWrapper
        initialScale={1}
        minScale={0.5}
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
        {({ zoomIn, zoomOut, resetTransform }) => (
          <>
            <div className="modal-toolbar" onClick={(event) => event.stopPropagation()}>
              <div className="modal-toolbar-row">
                <div className="modal-title">{image.name}</div>
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
                  <button
                    className="tool-button modal-overflow-toggle"
                    type="button"
                    onClick={() => setOverflowOpen((open) => !open)}
                    title="More actions"
                    aria-expanded={overflowOpen}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <circle cx="6" cy="12" r="1.6" fill="currentColor" />
                      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
                      <circle cx="18" cy="12" r="1.6" fill="currentColor" />
                    </svg>
                  </button>
                  <button className="tool-button" type="button" onClick={handleClose} title="Close">
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
              </div>
              <div className="modal-actions modal-actions-secondary">
                <button className="tool-button" type="button" onClick={zoomOut} title="Zoom out">
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
                <button className="tool-button" type="button" onClick={zoomIn} title="Zoom in">
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
                <button className="tool-button" type="button" onClick={resetTransform} title="Reset">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M8 6h4V2M8 6a8 8 0 1 0 2-2"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                <button
                  className={image.favorite ? 'tool-button active' : 'tool-button'}
                  type="button"
                  onClick={onToggleFavorite}
                  title="Favorite"
                >
                  ★
                </button>
                <button
                  className={image.hidden ? 'tool-button active' : 'tool-button'}
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
                <button
                  className={modalTool === 'details' ? 'tool-button active' : 'tool-button'}
                  type="button"
                  onClick={handleToggleDetails}
                  title="Details"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="6" cy="12" r="1.6" fill="currentColor" />
                    <circle cx="12" cy="12" r="1.6" fill="currentColor" />
                    <circle cx="18" cy="12" r="1.6" fill="currentColor" />
                  </svg>
                </button>
              </div>

              {overflowOpen && (
                <div className="modal-overflow">
                  <div className="modal-overflow-panel">
                    <button className="tool-button" type="button" onClick={zoomOut} title="Zoom out">
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
                    <button className="tool-button" type="button" onClick={zoomIn} title="Zoom in">
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
                    <button className="tool-button" type="button" onClick={resetTransform} title="Reset">
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          d="M8 6h4V2M8 6a8 8 0 1 0 2-2"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                    <button
                      className={image.favorite ? 'tool-button active' : 'tool-button'}
                      type="button"
                      onClick={onToggleFavorite}
                      title="Favorite"
                    >
                      ★
                    </button>
                    <button
                      className={image.hidden ? 'tool-button active' : 'tool-button'}
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
                    <button
                      className={modalTool === 'details' ? 'tool-button active' : 'tool-button'}
                      type="button"
                      onClick={handleToggleDetails}
                      title="Details"
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <circle cx="6" cy="12" r="1.6" fill="currentColor" />
                        <circle cx="12" cy="12" r="1.6" fill="currentColor" />
                        <circle cx="18" cy="12" r="1.6" fill="currentColor" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}

              {modalTool === 'details' && (
                <div className="modal-tool-popover">
                  <div className="tool-panel">
                    <label className="control">
                      <span>Move to</span>
                      <select
                        value={moveTarget}
                        onChange={(event) => onMoveTargetChange(event.target.value)}
                      >
                        <option value="">Home</option>
                        {folders.map((folder) => (
                          <option key={folder} value={folder}>
                            {folder}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button className="button" type="button" onClick={onMoveSelected}>
                      Move
                    </button>
                    <div className="hint">Pinch to zoom, drag to pan.</div>
                  </div>
                </div>
              )}
            </div>

            <div
              className="modal-body"
              onTouchStart={handleSwipeStart}
              onTouchMove={handleSwipeMove}
              onTouchEnd={handleSwipeEnd}
              onClick={(event) => {
                if (Date.now() - lastSwipeAtRef.current < 350) {
                  return;
                }
                const target = event.target as HTMLElement;
                if (target.tagName !== 'IMG') {
                  handleClose();
                }
              }}
            >
              <TransformComponent wrapperClass="zoom-wrapper" contentClass="zoom-content">
                <img className="modal-image" src={image.url} alt={image.name} />
              </TransformComponent>
            </div>
            <div className="modal-footer">
              <div className="modal-filename" title={image.name}>
                {image.name}
              </div>
            </div>
          </>
        )}
      </TransformWrapper>
    </div>
  );
}
