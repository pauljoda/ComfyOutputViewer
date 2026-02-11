import { useState } from 'react';
import { Button } from '../ui/button';
import ImagePickerModal from './ImagePickerModal';
import { buildImageUrl } from '../../utils/images';

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
      ? buildImageUrl(displayValue)
      : !isLocal &&
          (displayValue.startsWith('http://') ||
            displayValue.startsWith('https://') ||
            displayValue.startsWith('/'))
        ? displayValue
        : '';

  const canPreview = Boolean(onPreview && isLocal && displayValue);

  return (
    <div className="space-y-2">
      <div
        className={`flex h-32 items-center justify-center overflow-hidden rounded-md border bg-muted ${canPreview ? 'cursor-pointer hover:border-primary' : ''}`}
        role={canPreview ? 'button' : undefined}
        tabIndex={canPreview ? 0 : undefined}
        aria-label={canPreview ? 'Preview selected image' : undefined}
        onClick={canPreview ? () => onPreview?.(displayValue) : undefined}
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
          <img src={previewSrc} alt="Selected" className="h-full w-full object-contain" loading="lazy" width={512} height={512} />
        ) : displayValue ? (
          <span className="px-2 text-xs text-muted-foreground">{displayValue}</span>
        ) : (
          <span className="text-xs text-muted-foreground">No image selected</span>
        )}
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setShowPicker(true)}>
          Select from Gallery
        </Button>
        <Button variant="outline" size="sm" asChild>
          <label className="cursor-pointer">
            {uploading ? 'Uploading…' : 'Upload New'}
            <input
              type="file"
              accept="image/*"
              disabled={uploading}
              className="hidden"
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
        </Button>
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
