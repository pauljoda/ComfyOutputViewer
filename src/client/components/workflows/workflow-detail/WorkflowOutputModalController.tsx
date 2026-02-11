import ImageModal from '../../ImageModal';
import type { ImageItem, ModalTool } from '../../../types';

type WorkflowOutputModalControllerProps = {
  availableTags: string[];
  selectedOutputImage: ImageItem | null;
  selectedInputImage: ImageItem | null;
  selectedOutputIndex: number;
  outputPaths: string[];
  outputTool: ModalTool;
  inputTool: ModalTool;
  onOutputTags: (tags: string[]) => void;
  onOutputFavorite: () => void;
  onOutputHidden: () => void;
  onOutputRating: (rating: number) => void;
  onOutputDelete: () => void;
  onInputTags: (tags: string[]) => void;
  onInputFavorite: () => void;
  onInputHidden: () => void;
  onInputRating: (rating: number) => void;
  onInputDelete: () => void;
  onOutputClose: () => void;
  onOutputPrev: () => void;
  onOutputNext: () => void;
  onInputClose: () => void;
  onToggleOutputTags: () => void;
  onToggleOutputRating: () => void;
  onToggleOutputPrompt: () => void;
  onToggleInputTags: () => void;
  onToggleInputRating: () => void;
  onToggleInputPrompt: () => void;
};

export default function WorkflowOutputModalController({
  availableTags,
  selectedOutputImage,
  selectedInputImage,
  selectedOutputIndex,
  outputPaths,
  outputTool,
  inputTool,
  onOutputTags,
  onOutputFavorite,
  onOutputHidden,
  onOutputRating,
  onOutputDelete,
  onInputTags,
  onInputFavorite,
  onInputHidden,
  onInputRating,
  onInputDelete,
  onOutputClose,
  onOutputPrev,
  onOutputNext,
  onInputClose,
  onToggleOutputTags,
  onToggleOutputRating,
  onToggleOutputPrompt,
  onToggleInputTags,
  onToggleInputRating,
  onToggleInputPrompt
}: WorkflowOutputModalControllerProps) {
  return (
    <>
      {selectedOutputImage && (
        <ImageModal
          image={selectedOutputImage}
          index={Math.max(0, selectedOutputIndex)}
          total={outputPaths.length || 1}
          modalTool={outputTool}
          availableTags={availableTags}
          onUpdateTags={onOutputTags}
          onToggleTags={onToggleOutputTags}
          onToggleRating={onToggleOutputRating}
          onTogglePrompt={onToggleOutputPrompt}
          onToggleFavorite={onOutputFavorite}
          onToggleHidden={onOutputHidden}
          onRate={onOutputRating}
          onDelete={onOutputDelete}
          onClose={onOutputClose}
          onPrev={onOutputPrev}
          onNext={onOutputNext}
        />
      )}

      {selectedInputImage && (
        <ImageModal
          image={selectedInputImage}
          index={0}
          total={1}
          modalTool={inputTool}
          availableTags={availableTags}
          onUpdateTags={onInputTags}
          onToggleTags={onToggleInputTags}
          onToggleRating={onToggleInputRating}
          onTogglePrompt={onToggleInputPrompt}
          onToggleFavorite={onInputFavorite}
          onToggleHidden={onInputHidden}
          onRate={onInputRating}
          onDelete={onInputDelete}
          onClose={onInputClose}
          onPrev={() => {}}
          onNext={() => {}}
        />
      )}
    </>
  );
}
