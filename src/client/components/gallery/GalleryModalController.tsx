import AutoTagModal from '../AutoTagModal';
import ImageModal from '../ImageModal';
import SlideshowSettingsModal from '../SlideshowSettingsModal';
import SlideshowView from '../SlideshowView';
import type { ImageItem, ModalTool, SlideshowSettings } from '../../types';

export type GalleryModalControllerProps = {
  selectedImage: ImageItem | null;
  selectedIndex: number;
  filteredImages: ImageItem[];
  dataImages: ImageItem[];
  selectedIdSet: Set<string>;
  availableTags: string[];
  autoTagScope: 'selected' | 'view' | null;
  showSlideshowSettings: boolean;
  slideshowActive: boolean;
  slideshowSettings: SlideshowSettings | null;
  modalTool: ModalTool;
  onUpdateTags: (path: string, tags: string[]) => void;
  onToggleTags: () => void;
  onToggleRating: () => void;
  onTogglePrompt: () => void;
  onToggleFavorite: (image: ImageItem) => void;
  onToggleHidden: (image: ImageItem) => void;
  onRate: (image: ImageItem, rating: number) => void;
  onDelete: (image: ImageItem) => void;
  onCloseImage: () => void;
  onPrevImage: () => void;
  onNextImage: () => void;
  onApplyAutoTag: (imageTags: Record<string, string[]>) => Promise<void>;
  onCloseAutoTag: () => void;
  onStartSlideshow: (settings: SlideshowSettings) => void;
  onCloseSlideshowSettings: () => void;
  onCloseSlideshow: () => void;
};

export default function GalleryModalController({
  selectedImage,
  selectedIndex,
  filteredImages,
  dataImages,
  selectedIdSet,
  availableTags,
  autoTagScope,
  showSlideshowSettings,
  slideshowActive,
  slideshowSettings,
  modalTool,
  onUpdateTags,
  onToggleTags,
  onToggleRating,
  onTogglePrompt,
  onToggleFavorite,
  onToggleHidden,
  onRate,
  onDelete,
  onCloseImage,
  onPrevImage,
  onNextImage,
  onApplyAutoTag,
  onCloseAutoTag,
  onStartSlideshow,
  onCloseSlideshowSettings,
  onCloseSlideshow
}: GalleryModalControllerProps) {
  return (
    <>
      {selectedImage && (
        <ImageModal
          image={selectedImage}
          index={selectedIndex}
          total={filteredImages.length}
          modalTool={modalTool}
          availableTags={availableTags}
          onUpdateTags={(tags) => onUpdateTags(selectedImage.id, tags)}
          onToggleTags={onToggleTags}
          onToggleRating={onToggleRating}
          onTogglePrompt={onTogglePrompt}
          onToggleFavorite={() => onToggleFavorite(selectedImage)}
          onToggleHidden={() => onToggleHidden(selectedImage)}
          onRate={(rating) => onRate(selectedImage, rating)}
          onDelete={() => onDelete(selectedImage)}
          onClose={onCloseImage}
          onPrev={onPrevImage}
          onNext={onNextImage}
        />
      )}

      {autoTagScope && (
        <AutoTagModal
          images={
            autoTagScope === 'selected'
              ? dataImages.filter((img) => selectedIdSet.has(img.id))
              : filteredImages
          }
          availableTags={availableTags}
          onApply={onApplyAutoTag}
          onClose={onCloseAutoTag}
        />
      )}

      {showSlideshowSettings && (
        <SlideshowSettingsModal
          imageCount={filteredImages.length}
          onStart={onStartSlideshow}
          onClose={onCloseSlideshowSettings}
        />
      )}

      {slideshowActive && slideshowSettings && (
        <SlideshowView
          images={filteredImages}
          settings={slideshowSettings}
          onClose={onCloseSlideshow}
        />
      )}
    </>
  );
}
