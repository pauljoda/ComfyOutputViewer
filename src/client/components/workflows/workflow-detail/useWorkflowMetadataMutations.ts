import type { Dispatch, SetStateAction } from 'react';
import { useCallback } from 'react';
import { deleteImage, setFavorite, setHidden, setRating, setTags } from '../../../lib/imagesApi';
import type { ImageItem, Job } from '../../../types';

type UseWorkflowMetadataMutationsArgs = {
  selectedOutputImage: ImageItem | null;
  selectedInputImage: ImageItem | null;
  buildFallbackImage: (imagePath: string) => ImageItem;
  loadOutputImage: (imagePath: string, options?: { force?: boolean }) => Promise<void>;
  setOutputCache: Dispatch<SetStateAction<Record<string, ImageItem>>>;
  setJobs: Dispatch<SetStateAction<Job[]>>;
  closeOutputModal: () => void;
  closeInputModal: () => void;
  removeOutputPath: (imagePath: string) => void;
  refreshTags: () => void;
  setError: (message: string | null) => void;
};

export type UseWorkflowMetadataMutationsResult = {
  handleOutputTags: (tags: string[]) => Promise<void>;
  handleOutputFavorite: () => Promise<void>;
  handleOutputHidden: () => Promise<void>;
  handleOutputRating: (rating: number) => Promise<void>;
  handleOutputDelete: () => Promise<void>;
  handleInputTags: (tags: string[]) => Promise<void>;
  handleInputFavorite: () => Promise<void>;
  handleInputHidden: () => Promise<void>;
  handleInputRating: (rating: number) => Promise<void>;
  handleInputDelete: () => Promise<void>;
};

export function useWorkflowMetadataMutations({
  selectedOutputImage,
  selectedInputImage,
  buildFallbackImage,
  loadOutputImage,
  setOutputCache,
  setJobs,
  closeOutputModal,
  closeInputModal,
  removeOutputPath,
  refreshTags,
  setError
}: UseWorkflowMetadataMutationsArgs): UseWorkflowMetadataMutationsResult {
  const refreshOutputImage = useCallback(
    async (imagePath: string) => {
      await loadOutputImage(imagePath, { force: true });
    },
    [loadOutputImage]
  );

  const handleOutputUpdateFailure = useCallback(
    async (imagePath: string, err: unknown, fallback: string) => {
      const message = err instanceof Error ? err.message : fallback;
      await refreshOutputImage(imagePath);
      setError(message);
    },
    [refreshOutputImage, setError]
  );

  const updateOutputCache = useCallback(
    (imagePath: string, updater: (image: ImageItem) => ImageItem) => {
      setOutputCache((prev) => {
        const current = prev[imagePath] ?? buildFallbackImage(imagePath);
        return { ...prev, [imagePath]: updater(current) };
      });
    },
    [buildFallbackImage, setOutputCache]
  );

  const handleOutputFavorite = useCallback(async () => {
    if (!selectedOutputImage) return;
    const nextValue = !selectedOutputImage.favorite;
    updateOutputCache(selectedOutputImage.id, (current) => ({ ...current, favorite: nextValue }));
    try {
      await setFavorite(selectedOutputImage.id, nextValue);
    } catch (err) {
      await handleOutputUpdateFailure(selectedOutputImage.id, err, 'Failed to update favorite');
    }
  }, [handleOutputUpdateFailure, selectedOutputImage, updateOutputCache]);

  const handleOutputHidden = useCallback(async () => {
    if (!selectedOutputImage) return;
    const nextValue = !selectedOutputImage.hidden;
    updateOutputCache(selectedOutputImage.id, (current) => ({ ...current, hidden: nextValue }));
    try {
      await setHidden(selectedOutputImage.id, nextValue);
    } catch (err) {
      await handleOutputUpdateFailure(selectedOutputImage.id, err, 'Failed to update hidden state');
    }
  }, [handleOutputUpdateFailure, selectedOutputImage, updateOutputCache]);

  const handleOutputRating = useCallback(
    async (rating: number) => {
      if (!selectedOutputImage) return;
      updateOutputCache(selectedOutputImage.id, (current) => ({ ...current, rating }));
      try {
        await setRating(selectedOutputImage.id, rating);
      } catch (err) {
        await handleOutputUpdateFailure(selectedOutputImage.id, err, 'Failed to update rating');
      }
    },
    [handleOutputUpdateFailure, selectedOutputImage, updateOutputCache]
  );

  const handleOutputTags = useCallback(
    async (tags: string[]) => {
      if (!selectedOutputImage) return;
      updateOutputCache(selectedOutputImage.id, (current) => ({ ...current, tags }));
      try {
        await setTags(selectedOutputImage.id, tags);
        refreshTags();
      } catch (err) {
        await handleOutputUpdateFailure(selectedOutputImage.id, err, 'Failed to update tags');
      }
    },
    [handleOutputUpdateFailure, refreshTags, selectedOutputImage, updateOutputCache]
  );

  const handleInputFavorite = useCallback(async () => {
    if (!selectedInputImage) return;
    const nextValue = !selectedInputImage.favorite;
    updateOutputCache(selectedInputImage.id, (current) => ({ ...current, favorite: nextValue }));
    try {
      await setFavorite(selectedInputImage.id, nextValue);
    } catch (err) {
      await handleOutputUpdateFailure(selectedInputImage.id, err, 'Failed to update favorite');
    }
  }, [handleOutputUpdateFailure, selectedInputImage, updateOutputCache]);

  const handleInputHidden = useCallback(async () => {
    if (!selectedInputImage) return;
    const nextValue = !selectedInputImage.hidden;
    updateOutputCache(selectedInputImage.id, (current) => ({ ...current, hidden: nextValue }));
    try {
      await setHidden(selectedInputImage.id, nextValue);
    } catch (err) {
      await handleOutputUpdateFailure(selectedInputImage.id, err, 'Failed to update hidden state');
    }
  }, [handleOutputUpdateFailure, selectedInputImage, updateOutputCache]);

  const handleInputRating = useCallback(
    async (rating: number) => {
      if (!selectedInputImage) return;
      updateOutputCache(selectedInputImage.id, (current) => ({ ...current, rating }));
      try {
        await setRating(selectedInputImage.id, rating);
      } catch (err) {
        await handleOutputUpdateFailure(selectedInputImage.id, err, 'Failed to update rating');
      }
    },
    [handleOutputUpdateFailure, selectedInputImage, updateOutputCache]
  );

  const handleInputTags = useCallback(
    async (tags: string[]) => {
      if (!selectedInputImage) return;
      updateOutputCache(selectedInputImage.id, (current) => ({ ...current, tags }));
      try {
        await setTags(selectedInputImage.id, tags);
        refreshTags();
      } catch (err) {
        await handleOutputUpdateFailure(selectedInputImage.id, err, 'Failed to update tags');
      }
    },
    [handleOutputUpdateFailure, refreshTags, selectedInputImage, updateOutputCache]
  );

  const handleInputDelete = useCallback(async () => {
    if (!selectedInputImage) return;
    const confirmed = window.confirm('Remove this image from the library?');
    if (!confirmed) return;
    try {
      await deleteImage(selectedInputImage.id);
      setOutputCache((prev) => {
        const next = { ...prev };
        delete next[selectedInputImage.id];
        return next;
      });
      closeInputModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete image');
    }
  }, [closeInputModal, selectedInputImage, setError, setOutputCache]);

  const handleOutputDelete = useCallback(async () => {
    if (!selectedOutputImage) return;
    const confirmed = window.confirm('Remove this image from the library?');
    if (!confirmed) return;
    try {
      await deleteImage(selectedOutputImage.id);
      setJobs((prev) =>
        prev.map((job) => ({
          ...job,
          outputs: job.outputs?.filter((output) => output.imagePath !== selectedOutputImage.id)
        }))
      );
      setOutputCache((prev) => {
        const next = { ...prev };
        delete next[selectedOutputImage.id];
        return next;
      });
      removeOutputPath(selectedOutputImage.id);
      closeOutputModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete image');
    }
  }, [closeOutputModal, removeOutputPath, selectedOutputImage, setError, setJobs, setOutputCache]);

  return {
    handleOutputTags,
    handleOutputFavorite,
    handleOutputHidden,
    handleOutputRating,
    handleOutputDelete,
    handleInputTags,
    handleInputFavorite,
    handleInputHidden,
    handleInputRating,
    handleInputDelete
  };
}
