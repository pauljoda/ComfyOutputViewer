import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
import { api } from '../../../lib/api';
import { buildImageUrl } from '../../../utils/images';
import type { ImageItem } from '../../../types';

export type UseWorkflowOutputCacheResult = {
  outputCache: Record<string, ImageItem>;
  setOutputCache: Dispatch<SetStateAction<Record<string, ImageItem>>>;
  buildFallbackImage: (imagePath: string) => ImageItem;
  loadOutputImage: (imagePath: string, options?: { force?: boolean }) => Promise<void>;
  loadOutputImages: (paths: string[]) => Promise<void>;
};

export function useWorkflowOutputCache(): UseWorkflowOutputCacheResult {
  const [outputCache, setOutputCache] = useState<Record<string, ImageItem>>({});

  const buildFallbackImage = useCallback((imagePath: string): ImageItem => {
    const name = imagePath.split('/').pop() || imagePath;
    return {
      id: imagePath,
      name,
      url: buildImageUrl(imagePath),
      favorite: false,
      hidden: false,
      rating: 0,
      tags: [],
      createdMs: 0,
      mtimeMs: 0,
      size: 0
    };
  }, []);

  const loadOutputImage = useCallback(
    async (imagePath: string, options: { force?: boolean } = {}) => {
      if (!options.force && outputCache[imagePath]) return;
      try {
        const image = await api<ImageItem>(`/api/images/${encodeURIComponent(imagePath)}`);
        const normalizedImage = {
          ...image,
          tags: Array.isArray(image.tags) ? image.tags : []
        };
        setOutputCache((prev) => ({ ...prev, [imagePath]: normalizedImage }));
      } catch (err) {
        setOutputCache((prev) => {
          if (prev[imagePath]) return prev;
          return { ...prev, [imagePath]: buildFallbackImage(imagePath) };
        });
      }
    },
    [buildFallbackImage, outputCache]
  );

  const loadOutputImages = useCallback(
    async (paths: string[]) => {
      await Promise.all(paths.map((path) => loadOutputImage(path)));
    },
    [loadOutputImage]
  );

  return {
    outputCache,
    setOutputCache,
    buildFallbackImage,
    loadOutputImage,
    loadOutputImages
  };
}
