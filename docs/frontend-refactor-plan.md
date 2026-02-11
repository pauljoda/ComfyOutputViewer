# Frontend Refactor + Cleanup Prep Plan

Date: 2026-02-11  
Scope: Deep review findings + concrete split plan for `WorkflowDetail` and `GalleryWorkspace`.

Progress snapshot:
- Completed: extracted `useGalleryWorkspaceController` and reduced `GalleryWorkspace` to composition/render wiring.
- Completed: extracted gallery modal composition surface into `src/client/components/gallery/GalleryModalController.tsx`.
- Completed: extracted `WorkflowDetail` render sections into `workflows/workflow-detail/*` components.
- Completed: extracted remaining `WorkflowDetail` controller/state concerns into `workflows/workflow-detail/useWorkflowDetailController.ts`.
- Completed: started phase-2 `useWorkflowDetailController` decomposition by extracting auto-tag state/persistence/handlers into `workflows/workflow-detail/useWorkflowAutoTagSettings.ts`.
- Completed: extracted workflow jobs stream/polling/cancel/recheck/system-stats concerns into `workflows/workflow-detail/useWorkflowJobs.ts`.
- Completed: removed previously unused `ui/*` primitives after reachability verification.

## 1) Deep Review Findings

### Critical/High
- No critical/high correctness issues were found in this pass.

### Medium
1. Stale workflow error state could persist after a successful reload in `WorkflowsWorkspace`.
- File: `src/client/components/workflows/WorkflowsWorkspace.tsx:52`
- Status: Fixed (clear `error` at the start of successful reload attempts).

2. Gallery modal could re-open unexpectedly after filter restoration because `selectedId` stayed set even after selection left the filtered set.
- File: `src/client/components/gallery/GalleryWorkspace.tsx:224`
- Status: Fixed (clear `selectedId` and `modalTool` when selected image leaves `filteredImages`).

### Low
1. Local image path URL building used unsafe encoding for reserved characters (`#`, `?`, `%`) in some workflows-related paths.
- Files: `src/client/components/workflows/WorkflowDetail.tsx`, `src/client/components/workflows/ImageInputField.tsx`, `src/client/components/workflows/JobCard.tsx`
- Status: Fixed by centralizing image URL building in `buildImageUrl`.

2. Workflow JSON import could fail to re-fire when selecting the same file repeatedly.
- File: `src/client/components/workflows/WorkflowEditorPanel.tsx:145`
- Status: Fixed (`event.target.value = ''` reset after capture).

### Remaining review backlog (pending)
1. `useWorkflowDetailController` is now the primary complexity hotspot and should be split into focused hooks/modules.
- File: `src/client/components/workflows/workflow-detail/useWorkflowDetailController.ts`
- Plan: continue splitting remaining concerns (output modal state + run pipeline) into dedicated hooks in phase 2.

### Recently closed backlog items
1. `WorkflowDetail` dirty input-reset issue on `workflow.updatedAt` refresh.
- File: `src/client/components/workflows/workflow-detail/useWorkflowDetailController.ts`
- Status: Fixed with dirty-aware input preservation across same-workflow metadata refreshes.

2. Stage-click dismiss behavior decision for `ImageModal`.
- File: `src/client/components/ImageModal.tsx`
- Status: Fixed; blank stage clicks now dismiss while preserving existing close paths.

3. `ImageModal` prompt fetch cancellation in secondary prompt-open path.
- File: `src/client/components/ImageModal.tsx`
- Status: Fixed by unifying prompt request lifecycle (shared abort/stale-guard path for preload and prompt-open retry).

## 2) Cleanup Started In This Pass

- Added shared image path URL helper:
  - `src/client/utils/images.ts` (`encodeImagePath`, `buildImageUrl`)
  - `src/client/utils/images.test.ts` coverage for reserved-character paths.
- Removed dead legacy component surface:
  - Deleted `src/client/components/StatusBar.tsx`
  - Deleted `src/client/components/StatusBar.test.tsx`

## 3) Concrete Split Plan: `WorkflowDetail` (Completed)

Current size:
- `src/client/components/workflows/WorkflowDetail.tsx`: ~141 LOC (orchestrator/composition shell)
- `src/client/components/workflows/workflow-detail/useWorkflowDetailController.ts`: ~700 LOC (controller/state/effects, reduced after auto-tag + jobs extraction)
- `src/client/components/workflows/workflow-detail/useWorkflowAutoTagSettings.ts`: ~168 LOC (auto-tag state/persistence/handlers)
- `src/client/components/workflows/workflow-detail/useWorkflowJobs.ts`: ~260 LOC (jobs stream/polling/cancel/recheck/system stats)

### Target file split
- `src/client/components/workflows/WorkflowDetail.tsx`
  - Orchestrator only: route-level wiring + shared state handoff.
- `src/client/components/workflows/workflow-detail/WorkflowHeader.tsx`
- `src/client/components/workflows/workflow-detail/AutoTagSettingsPanel.tsx`
- `src/client/components/workflows/workflow-detail/WorkflowInputsSection.tsx`
- `src/client/components/workflows/workflow-detail/WorkflowJobsSection.tsx`
- `src/client/components/workflows/workflow-detail/WorkflowOutputModalController.tsx`
- `src/client/components/workflows/workflow-detail/useWorkflowDetailController.ts`
- `src/client/components/workflows/workflow-detail/useWorkflowAutoTagSettings.ts`
- `src/client/components/workflows/workflow-detail/useWorkflowJobs.ts`

### Proposed prop contracts (phase 1)

```ts
// WorkflowHeader.tsx
export type WorkflowHeaderProps = {
  name: string;
  description?: string | null;
  editMode: boolean;
  onEditModeChange: (next: boolean) => void;
  onDelete: () => void;
};
```

```ts
// AutoTagSettingsPanel.tsx
export type AutoTagSettingsPanelProps = {
  eligibleInputs: WorkflowInput[];
  enabled: boolean;
  selectedRefs: Set<string>;
  maxWords: number;
  saving: boolean;
  onToggleEnabled: () => void;
  onToggleInput: (input: WorkflowInput) => void;
  onMaxWordsChange: (value: number) => void;
  onMaxWordsCommit: () => void;
};
```

```ts
// WorkflowInputsSection.tsx
export type WorkflowInputsSectionProps = {
  inputs: WorkflowInput[];
  values: Record<number, string>;
  running: boolean;
  showDebug: boolean;
  debugPromptJson: string;
  error: string | null;
  onInputChange: (inputId: number, value: string) => void;
  onRun: () => void;
  onOpenExportApi: () => void;
  onPreviewInputImage: (path: string) => void;
};
```

```ts
// WorkflowJobsSection.tsx
export type WorkflowJobsSectionProps = {
  jobs: Job[];
  now: number;
  stats: SystemStatsResponse | null;
  statsError: string | null;
  statsUpdatedAt: number | null;
  onOpenOutput: (job: Job, output: JobOutput) => void;
  onCancel: (jobId: number) => void;
  onRecheck: (jobId: number) => void;
};
```

```ts
// WorkflowOutputModalController.tsx
export type WorkflowOutputModalControllerProps = {
  availableTags: string[];
  selectedOutputImage: ImageItem | null;
  selectedInputImage: ImageItem | null;
  selectedOutputIndex: number;
  outputPaths: string[];
  outputTool: ModalTool;
  inputTool: ModalTool;
  onCloseOutput: () => void;
  onCloseInput: () => void;
  onPrevOutput: () => void;
  onNextOutput: () => void;
  onOutputFavorite: () => void;
  onOutputHidden: () => void;
  onOutputRating: (rating: number) => void;
  onOutputTags: (tags: string[]) => void;
  onOutputDelete: () => void;
  onInputFavorite: () => void;
  onInputHidden: () => void;
  onInputRating: (rating: number) => void;
  onInputTags: (tags: string[]) => void;
  onInputDelete: () => void;
  onToggleOutputTool: (tool: ModalTool) => void;
  onToggleInputTool: (tool: ModalTool) => void;
};
```

### Acceptance criteria
- Completed: no behavior changes in this extraction pass.
- Completed: `WorkflowDetail` reduced to <300 LOC orchestrator.
- Completed: `test:client` remains green after split.

## 4) Concrete Split Plan: `GalleryWorkspace`

Current size: ~813 LOC (`src/client/components/gallery/GalleryWorkspace.tsx`).

### Target file split
- `src/client/components/gallery/GalleryWorkspace.tsx`
  - Route/workspace composer only.
- `src/client/components/gallery/useGalleryController.ts`
- `src/client/components/gallery/GalleryFiltersController.tsx`
- `src/client/components/gallery/GalleryActionsController.tsx`
- `src/client/components/gallery/GalleryModalController.tsx`
- `src/client/components/gallery/types.ts`

### Proposed prop contracts (phase 1)

```ts
// useGalleryController.ts
export type UseGalleryControllerResult = {
  data: ApiResponse;
  loading: boolean;
  error: string | null;
  status: string;
  filteredImages: ImageItem[];
  selectedImage: ImageItem | null;
  selectedIndex: number;
  selectedIds: string[];
  selectedIdSet: Set<string>;
  selectedTags: string[];
  showUntagged: boolean;
  favoritesOnly: boolean;
  hideHidden: boolean;
  tileFit: TileFit;
  columns: number;
  maxColumns: number;
  minRating: number;
  maxRating: number;
  sortMode: SortMode;
  currentFilterLabel: string;
  handlers: Record<string, (...args: unknown[]) => void>;
};
```

```ts
// GalleryModalController.tsx
export type GalleryModalControllerProps = {
  selectedImage: ImageItem | null;
  selectedIndex: number;
  total: number;
  modalTool: ModalTool;
  availableTags: string[];
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onToggleFavorite: (image: ImageItem) => void;
  onToggleHidden: (image: ImageItem) => void;
  onUpdateTags: (path: string, tags: string[]) => void;
  onRate: (image: ImageItem, rating: number) => void;
  onDelete: (image: ImageItem) => void;
  onToggleTool: (tool: ModalTool) => void;
};
```

### Acceptance criteria
- No rendering regressions in gallery toolbar, drawer, multi-select, and modal flows.
- `GalleryWorkspace` reduced to <250 LOC composition layer.
- Existing tests continue to pass.

## 5) Hook/Util Data-Flow Trees (Current)

### 5.1 Gallery flow

```text
GalleryWorkspace
├─ API state
│  ├─ api('/api/images')
│  └─ api('/api/sync')
├─ Metadata mutation API
│  └─ lib/imagesApi (favorite, hidden, rating, tags, bulk ops, delete)
├─ Derived collections
│  ├─ utils/filterImages
│  ├─ utils/sortImages
│  └─ utils/toggleSelectionWithRange
├─ Cross-cutting context
│  └─ TagsContext.updateFromImages -> availableTags/tagCounts
└─ UI composition
   ├─ TopBar + TagDrawer + Gallery
   └─ Modal stack (ImageModal, AutoTagModal, slideshow modals)
```

### 5.2 Workflow flow

```text
WorkflowsWorkspace
├─ list state
│  ├─ api('/api/workflows')
│  └─ api('/api/workflow-folders')
├─ navigation state
│  ├─ router params
│  ├─ localStorage(last workflow)
│  └─ sessionStorage(prefill)
└─ detail surface
   └─ WorkflowDetail
      └─ useWorkflowDetailController
         ├─ api('/api/workflows/:id') + '/jobs' + '/comfy/stats'
         ├─ WebSocket '/ws' job updates + polling fallback
         ├─ image metadata mutations via lib/imagesApi
         ├─ run pipeline + optional image upload bridge
         └─ modal projections (ImageModal, ExportApiModal)
```

## 6) Unused UI Component Cleanup

Completed:
1. Verified static reachability from `src/client/main.tsx` and confirmed the unused primitive set.
2. Removed the unused files in a single cleanup pass:
`card`, `dropdown-menu`, `input`, `label`, `scroll-area`, `select`, `separator`, `sheet`, `slider`, `switch`, `toggle`.
3. Kept actively used primitives (`button`, `badge`, `popover`, `dialog`).

## 7) Execution Order (Recommended)

1. Continue splitting `useWorkflowDetailController` into smaller hooks/modules (output modal state, run pipeline) after completing auto-tag + jobs extraction.
2. Continue `GalleryWorkspace` follow-up cleanup around filter/action composition surfaces (modal composition extraction completed via `GalleryModalController`).
3. Evaluate next high-impact split target (`ImageModal` or `TopBar`) for phase-2 complexity reduction.
