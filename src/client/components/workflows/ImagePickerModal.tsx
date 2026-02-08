import { useEffect, useState } from 'react';
import { useElementSize } from '../../hooks/useElementSize';
import { api } from '../../lib/api';

type ImagePickerItem = {
  id: string;
  url: string;
  thumbUrl?: string;
  name: string;
  createdMs?: number;
  mtimeMs?: number;
};

type ImagePickerModalProps = {
  onSelect: (imagePath: string) => void;
  onClose: () => void;
};

export default function ImagePickerModal({ onSelect, onClose }: ImagePickerModalProps) {
  const [images, setImages] = useState<ImagePickerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { ref: gridRef, width: gridWidth, height: gridHeight } = useElementSize<HTMLDivElement>();
  const [scrollTop, setScrollTop] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const response = await api<{ images: ImagePickerItem[] }>('/api/images');
        if (cancelled) return;
        const sorted = response.images.slice().sort((a, b) => {
          const aTime = Number.isFinite(a.createdMs) && a.createdMs ? a.createdMs : a.mtimeMs || 0;
          const bTime = Number.isFinite(b.createdMs) && b.createdMs ? b.createdMs : b.mtimeMs || 0;
          return bTime - aTime;
        });
        setImages(sorted);
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load images:', err);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setScrollTop(0);
  }, [images.length]);

  const minTileSize = 100;
  const tileGap = 8;
  const gridPaddingX = 20;
  const gridPaddingY = 16;
  const fallbackWindowWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const fallbackDialogWidth = Math.min(900, Math.max(320, Math.floor(fallbackWindowWidth * 0.9)));
  const effectiveGridWidth = gridWidth > 0 ? gridWidth : fallbackDialogWidth;
  const usableWidth = Math.max(0, effectiveGridWidth - gridPaddingX * 2);
  const safeWidth = usableWidth > 0 ? usableWidth : minTileSize;
  const columns = Math.max(1, Math.floor((safeWidth + tileGap) / (minTileSize + tileGap)));
  const columnWidth = Math.max(
    minTileSize,
    Math.floor((safeWidth - tileGap * (columns - 1)) / columns)
  );
  const rowHeight = columnWidth;
  const rowStride = rowHeight + tileGap;
  const totalRows = Math.ceil(images.length / columns);
  const viewportHeight = gridHeight || 400;
  const overscan = 3;
  const startRow = Math.max(0, Math.floor(scrollTop / rowStride) - overscan);
  const endRow =
    totalRows > 0
      ? Math.min(totalRows - 1, Math.ceil((scrollTop + viewportHeight) / rowStride) + overscan)
      : -1;
  const startIndex = startRow * columns;
  const endIndex = totalRows > 0 ? Math.min(images.length, (endRow + 1) * columns) : 0;
  const visibleImages = totalRows > 0 ? images.slice(startIndex, endIndex) : [];
  const totalHeight =
    totalRows > 0 ? gridPaddingY * 2 + totalRows * rowHeight + (totalRows - 1) * tileGap : 0;

  return (
    <div className="modal image-picker-modal">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-dialog picker-dialog">
        <div className="modal-header">
          <h2>Select Image</h2>
          <button className="tool-button" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div
          className="picker-grid"
          ref={gridRef}
          onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
        >
          {loading && <p className="picker-loading">Loading images...</p>}
          {!loading && images.length === 0 && (
            <p className="picker-empty">No images found</p>
          )}
          {visibleImages.map((img, index) => {
            const imageIndex = startIndex + index;
            const row = Math.floor(imageIndex / columns);
            const col = imageIndex % columns;
            const top = gridPaddingY + row * rowStride;
            const left = gridPaddingX + col * (columnWidth + tileGap);
            return (
              <button
                key={img.id}
                className="picker-item"
                onClick={() => onSelect(img.id)}
                style={{
                  position: 'absolute',
                  top: `${top}px`,
                  left: `${left}px`,
                  width: `${columnWidth}px`,
                  height: `${rowHeight}px`
                }}
              >
                <img src={img.thumbUrl || img.url} alt={img.id} />
              </button>
            );
          })}
          <div className="picker-spacer" style={{ height: `${totalHeight}px` }} />
        </div>
      </div>
    </div>
  );
}
