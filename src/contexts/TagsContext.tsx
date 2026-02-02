import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { buildTagCounts, normalizeTags, type TagCount } from '../utils/tags';
import type { ApiResponse, ImageItem } from '../types';

type TagsContextValue = {
  /** All unique tags across all images, sorted by frequency */
  tagCounts: TagCount[];
  /** All unique tag names for suggestions */
  availableTags: string[];
  /** Update the global tag list from a set of images */
  updateFromImages: (images: ImageItem[]) => void;
  /** Refresh the global tag list from the API */
  refreshTags: () => Promise<void>;
};

const TagsContext = createContext<TagsContextValue | null>(null);

export function TagsProvider({ children }: { children: React.ReactNode }) {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [initialized, setInitialized] = useState(false);

  const tagCounts = useMemo(() => buildTagCounts(images), [images]);
  const availableTags = useMemo(() => tagCounts.map((entry) => entry.tag), [tagCounts]);

  const refreshTags = useCallback(async () => {
    try {
      const response = await api<ApiResponse>('/api/images');
      const normalizedImages = response.images.map((image) => ({
        ...image,
        tags: normalizeTags(image.tags)
      }));
      setImages(normalizedImages);
      setInitialized(true);
    } catch {
      // Silently fail - tags will be populated when GalleryPage loads
    }
  }, []);

  const updateFromImages = useCallback((newImages: ImageItem[]) => {
    setImages(newImages);
    setInitialized(true);
  }, []);

  // Fetch tags on initial mount if not already populated by a page
  useEffect(() => {
    if (!initialized && images.length === 0) {
      refreshTags();
    }
  }, [initialized, images.length, refreshTags]);

  const value = useMemo(
    () => ({ tagCounts, availableTags, updateFromImages, refreshTags }),
    [tagCounts, availableTags, updateFromImages, refreshTags]
  );

  return <TagsContext.Provider value={value}>{children}</TagsContext.Provider>;
}

export function useTags() {
  const context = useContext(TagsContext);
  if (!context) {
    throw new Error('useTags must be used within a TagsProvider');
  }
  return context;
}
