import ExportApiModal from './ExportApiModal';
import WorkflowEditorPanel from './WorkflowEditorPanel';
import AutoTagSettingsPanel from './workflow-detail/AutoTagSettingsPanel';
import WorkflowHeader from './workflow-detail/WorkflowHeader';
import WorkflowInputsSection from './workflow-detail/WorkflowInputsSection';
import WorkflowJobsSection from './workflow-detail/WorkflowJobsSection';
import WorkflowOutputModalController from './workflow-detail/WorkflowOutputModalController';
import { useWorkflowDetailController } from './workflow-detail/useWorkflowDetailController';
import { useTags } from '../../contexts/TagsContext';
import type { Workflow } from '../../types';
import type { WorkflowEditorSaveResult, WorkflowPrefill } from './types';

export type WorkflowDetailProps = {
  workflow: Workflow;
  onBack: () => void;
  editMode: boolean;
  onEditModeChange: (value: boolean) => void;
  onSaved: (result: WorkflowEditorSaveResult) => void;
  onDelete: (workflow: Workflow) => void;
  showDebug: boolean;
  prefill?: WorkflowPrefill | null;
  onPrefillApplied?: () => void;
};

export default function WorkflowDetail({
  workflow,
  onBack: _onBack,
  editMode,
  onEditModeChange,
  onSaved,
  onDelete,
  showDebug,
  prefill,
  onPrefillApplied
}: WorkflowDetailProps) {
  const { availableTags, refreshTags } = useTags();
  const controller = useWorkflowDetailController({
    workflow,
    prefill,
    onPrefillApplied,
    refreshTags
  });

  return (
    <div className="space-y-6">
      <WorkflowHeader
        workflow={workflow}
        editMode={editMode}
        onEditModeChange={onEditModeChange}
        onDelete={onDelete}
      />

      {editMode ? (
        <section>
          <WorkflowEditorPanel
            mode="edit"
            workflow={workflow}
            onClose={() => onEditModeChange(false)}
            onSaved={onSaved}
          />
        </section>
      ) : (
        <>
          <AutoTagSettingsPanel
            autoTagEnabled={controller.autoTagEnabled}
            autoTagInputRefs={controller.autoTagInputRefs}
            autoTagMaxWords={controller.autoTagMaxWords}
            autoTagSaving={controller.autoTagSaving}
            autoTagEligibleInputs={controller.autoTagEligibleInputs}
            normalizeAutoTagMaxWords={controller.normalizeAutoTagMaxWords}
            onToggleAutoTagEnabled={controller.handleToggleAutoTagEnabled}
            onToggleAutoTagInput={controller.handleToggleAutoTagInput}
            onAutoTagMaxWordsChange={controller.setAutoTagMaxWords}
            onAutoTagMaxWordsBlur={controller.handleAutoTagMaxWordsBlur}
          />

          <WorkflowInputsSection
            inputs={controller.inputs}
            inputValues={controller.inputValues}
            showDebug={showDebug}
            promptPreview={controller.promptPreview}
            running={controller.running}
            error={controller.error}
            onInputChange={controller.handleInputChange}
            onOpenInputPreview={controller.handleOpenInputPreview}
            onSetError={controller.setError}
            onRun={controller.handleRun}
            onOpenExportApi={() => controller.setExportApiOpen(true)}
          />
        </>
      )}

      <WorkflowJobsSection
        jobs={controller.jobs}
        jobClock={controller.jobClock}
        systemStats={controller.systemStats}
        systemStatsError={controller.systemStatsError}
        systemStatsUpdatedAt={controller.systemStatsUpdatedAt}
        onOpenOutput={controller.handleOpenOutput}
        onCancelJob={controller.handleCancelJob}
        onRecheckJobOutputs={controller.handleRecheckJobOutputs}
      />

      <WorkflowOutputModalController
        availableTags={availableTags}
        selectedOutputImage={controller.selectedOutputImage}
        selectedInputImage={controller.selectedInputImage}
        selectedOutputIndex={controller.selectedOutputIndex}
        outputPaths={controller.outputPaths}
        outputTool={controller.outputTool}
        inputTool={controller.inputTool}
        onOutputTags={controller.handleOutputTags}
        onOutputFavorite={controller.handleOutputFavorite}
        onOutputHidden={controller.handleOutputHidden}
        onOutputRating={controller.handleOutputRating}
        onOutputDelete={controller.handleOutputDelete}
        onInputTags={controller.handleInputTags}
        onInputFavorite={controller.handleInputFavorite}
        onInputHidden={controller.handleInputHidden}
        onInputRating={controller.handleInputRating}
        onInputDelete={controller.handleInputDelete}
        onOutputClose={controller.closeOutputModal}
        onOutputPrev={controller.goToPrevOutput}
        onOutputNext={controller.goToNextOutput}
        onInputClose={controller.closeInputModal}
        onToggleOutputTags={controller.toggleOutputTagsTool}
        onToggleOutputRating={controller.toggleOutputRatingTool}
        onToggleOutputPrompt={controller.toggleOutputPromptTool}
        onToggleInputTags={controller.toggleInputTagsTool}
        onToggleInputRating={controller.toggleInputRatingTool}
        onToggleInputPrompt={controller.toggleInputPromptTool}
      />

      <ExportApiModal
        workflowId={workflow.id}
        open={controller.exportApiOpen}
        onOpenChange={controller.setExportApiOpen}
      />
    </div>
  );
}
