import { useState } from 'react';
import ImagePickerModal from './ImagePickerModal';

type ImageInputFieldProps = {
  value: string;
  onChange: (value: string) => void;
  onPreview?: (imagePath: string) => void;
  onError?: (message: string | null) => void;
};

export default function ImageInputField({ value, onChange, onPreview, onError }: ImageInputFieldProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [uploading, setUploading] = useState(false);
  const isLocal = value.startsWith('local:');
  const displayValue = isLocal ? value.slice('local:'.length) : value;
  const previewSrc =
    isLocal && displayValue
      ? `/images/${encodeURI(displayValue)}`
      : !isLocal &&
          (displayValue.startsWith('http://') ||
            displayValue.startsWith('https://') ||
            displayValue.startsWith('/'))
        ? displayValue
        : '';

  const canPreview = Boolean(onPreview && isLocal && displayValue);

  return (
    <div className="image-input-field">
      <div
        className={`image-input-preview ${canPreview ? 'clickable' : ''}`}
        role={canPreview ? 'button' : undefined}
        tabIndex={canPreview ? 0 : undefined}
        onClick={
          canPreview
            ? () => {
              onPreview?.(displayValue);
            }
            : undefined
        }
        onKeyDown={
          canPreview
            ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onPreview?.(displayValue);
              }
            }
            : undefined
        }
      >
        {previewSrc ? (
          <img src={previewSrc} alt="Selected" />
        ) : displayValue ? (
          <span className="image-selected-label">{displayValue}</span>
        ) : (
          <span className="image-placeholder">No image selected</span>
        )}
      </div>
      <div className="image-input-actions">
        <button type="button" className="ghost" onClick={() => setShowPicker(true)}>
          Select from Gallery
        </button>
        <label className="ghost upload-label">
          {uploading ? 'Uploading...' : 'Upload New'}
          <input
            type="file"
            accept="image/*"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const target = e.currentTarget;
              setUploading(true);
              (async () => {
                try {
                  const response = await fetch('/api/inputs/upload', {
                    method: 'POST',
                    headers: {
                      'Content-Type': file.type || 'application/octet-stream',
                      'X-File-Name': file.name
                    },
                    body: file
                  });
                  if (!response.ok) {
                    const text = await response.text();
                    throw new Error(text || 'Failed to upload input image');
                  }
                  const result = await response.json();
                  const uploadedPath = typeof result?.path === 'string' ? result.path : '';
                  if (!uploadedPath) {
                    throw new Error('Input upload did not return a file path.');
                  }
                  onChange(`local:${uploadedPath}`);
                  onError?.(null);
                } catch (err) {
                  onError?.(err instanceof Error ? err.message : 'Failed to upload input image');
                } finally {
                  setUploading(false);
                  target.value = '';
                }
              })();
            }}
          />
        </label>
      </div>
      {showPicker && (
        <ImagePickerModal
          onSelect={(imagePath) => {
            onChange(`local:${imagePath}`);
            setShowPicker(false);
          }}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}
