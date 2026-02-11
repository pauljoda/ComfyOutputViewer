# Changelog

All notable changes to this project will be documented in this file.

## [0.9.29] - 2026-02-11

### Changed
- Continued `ImageModal` decomposition by extracting prompt data lifecycle/derivation concerns from `src/client/components/ImageModal.tsx` into `src/client/components/image-modal/useImagePromptData.ts`.
- Extracted prompt overlay rendering from `src/client/components/ImageModal.tsx` into `src/client/components/image-modal/ImagePromptOverlay.tsx`.
- Reduced `ImageModal` complexity while preserving behavior and existing modal/toolbar contracts.
- Updated frontend architecture/refactor docs to reflect the new image-modal layering and remaining interaction-focused split targets.
- Bumped app version to `0.9.29` and refreshed `flake.nix` `npmDepsHash` after the lockfile version update.

## [0.9.28] - 2026-02-11

### Changed
- Continued `TopBar` decomposition by extracting bulk-action and tool-popover sections from `src/client/components/TopBar.tsx` into `src/client/components/topbar/TopBarBulkActions.tsx` and `src/client/components/topbar/TopBarToolPopover.tsx`.
- Reduced `TopBar` to a slimmer composition shell while preserving behavior and existing prop/handler contracts.
- Updated frontend architecture/refactor docs to reflect the new `TopBar` layering and shift the immediate next target to `ImageModal`.
- Bumped app version to `0.9.28` and refreshed `flake.nix` `npmDepsHash` after the lockfile version update.

## [0.9.27] - 2026-02-11

### Changed
- Continued gallery workspace decomposition by extracting the gallery/action composition surface (Gallery grid + modal stack wiring) from `src/client/components/gallery/GalleryWorkspace.tsx` into `src/client/components/gallery/GalleryActionsController.tsx`.
- Kept gallery behavior and existing handler contracts unchanged while further simplifying `GalleryWorkspace`.
- Updated frontend architecture/refactor docs to reflect completion of the planned `GalleryFiltersController` + `GalleryActionsController` splits.
- Bumped app version to `0.9.27` and refreshed `flake.nix` `npmDepsHash` after the lockfile version update.

## [0.9.26] - 2026-02-11

### Changed
- Continued gallery workspace decomposition by extracting the filter/navigation composition surface (TopBar + active-tool backdrop + TagDrawer wiring) from `src/client/components/gallery/GalleryWorkspace.tsx` into `src/client/components/gallery/GalleryFiltersController.tsx`.
- Kept gallery behavior and existing handler contracts unchanged while further simplifying `GalleryWorkspace`.
- Updated frontend architecture/refactor docs to reflect the new gallery layering and next-step focus (`GalleryActionsController`).
- Bumped app version to `0.9.26` and refreshed `flake.nix` `npmDepsHash` after the lockfile version update.

## [0.9.25] - 2026-02-11

### Changed
- Continued `WorkflowDetail` controller decomposition by extracting prompt-preview derivation from `src/client/components/workflows/workflow-detail/useWorkflowDetailController.ts` into `src/client/components/workflows/workflow-detail/useWorkflowPromptPreview.ts`.
- Reduced `useWorkflowDetailController` complexity further while preserving behavior and its public result contract used by `WorkflowDetail`.
- Updated frontend architecture/refactor docs to reflect the new prompt-preview hook layer and revised next-step focus.
- Bumped app version to `0.9.25` and refreshed `flake.nix` `npmDepsHash` after the lockfile version update.

## [0.9.24] - 2026-02-11

### Changed
- Continued `WorkflowDetail` controller decomposition by extracting workflow input synchronization concerns (detail loading, dirty/default merge behavior, prefill application, and input-change tracking) from `src/client/components/workflows/workflow-detail/useWorkflowDetailController.ts` into `src/client/components/workflows/workflow-detail/useWorkflowInputState.ts`.
- Reduced `useWorkflowDetailController` complexity further while preserving behavior and its public result contract used by `WorkflowDetail`.
- Updated frontend architecture/refactor docs to reflect the new input-state hook layer and remaining orchestration decisions.
- Bumped app version to `0.9.24` and refreshed `flake.nix` `npmDepsHash` after the lockfile version update.

## [0.9.23] - 2026-02-11

### Changed
- Continued `WorkflowDetail` controller decomposition by extracting output image cache/fallback/loading concerns from `src/client/components/workflows/workflow-detail/useWorkflowDetailController.ts` into `src/client/components/workflows/workflow-detail/useWorkflowOutputCache.ts`.
- Reduced `useWorkflowDetailController` complexity further while preserving behavior and its public result contract used by `WorkflowDetail`.
- Updated frontend architecture/refactor docs to reflect the new output-cache hook layer and remaining orchestration decisions.
- Bumped app version to `0.9.23` and refreshed `flake.nix` `npmDepsHash` after the lockfile version update.

## [0.9.22] - 2026-02-11

### Changed
- Continued `WorkflowDetail` controller decomposition by extracting output/input metadata mutation flows from `src/client/components/workflows/workflow-detail/useWorkflowDetailController.ts` into `src/client/components/workflows/workflow-detail/useWorkflowMetadataMutations.ts` (favorite/hidden/rating/tag updates, optimistic cache mutation, and delete handling for selected output/input images).
- Reduced `useWorkflowDetailController` complexity further while preserving behavior and its public result contract used by `WorkflowDetail`.
- Updated frontend architecture/refactor docs to reflect the new metadata-mutation hook layer and remaining orchestration decisions.
- Bumped app version to `0.9.22` and refreshed `flake.nix` `npmDepsHash` after the lockfile version update.

## [0.9.21] - 2026-02-11

### Changed
- Continued `WorkflowDetail` controller decomposition by extracting output-modal orchestration from `src/client/components/workflows/workflow-detail/useWorkflowDetailController.ts` into `src/client/components/workflows/workflow-detail/useWorkflowOutputModalState.ts` (output/input preview selection, open flows, modal navigation, and tool-toggle state).
- Reduced `useWorkflowDetailController` complexity further while preserving existing behavior and `WorkflowDetail` hook contracts.
- Updated frontend architecture/refactor docs to reflect the new output-modal hook layer and remaining metadata-mutation split target.
- Bumped app version to `0.9.21` and refreshed `flake.nix` `npmDepsHash` after the lockfile version update.

## [0.9.20] - 2026-02-11

### Changed
- Continued `WorkflowDetail` controller decomposition by extracting the workflow run pipeline from `src/client/components/workflows/workflow-detail/useWorkflowDetailController.ts` into `src/client/components/workflows/workflow-detail/useWorkflowRunPipeline.ts` (local image-input upload bridge + run submission/job fetch flow).
- Reduced `useWorkflowDetailController` complexity while preserving behavior and public hook contract used by `WorkflowDetail`.
- Updated frontend architecture/refactor docs to reflect the new run-pipeline hook layer and remaining controller split targets.
- Bumped app version to `0.9.20` and refreshed `flake.nix` `npmDepsHash` after the lockfile version update.

## [0.9.19] - 2026-02-11

### Changed
- Continued `WorkflowDetail` controller decomposition by extracting job-stream concerns from `src/client/components/workflows/workflow-detail/useWorkflowDetailController.ts` into `src/client/components/workflows/workflow-detail/useWorkflowJobs.ts` (websocket updates, polling fallback, cancel/recheck flows, and system stats refresh).
- Reduced `useWorkflowDetailController` to focus more narrowly on workflow input/output orchestration while keeping runtime behavior and API contracts stable.
- Updated frontend architecture/refactor docs to reflect the new `useWorkflowJobs` hook layer and remaining decomposition targets.
- Bumped app version to `0.9.19` and refreshed `flake.nix` `npmDepsHash` after the lockfile version update.

## [0.9.18] - 2026-02-11

### Changed
- Continued gallery workspace follow-up cleanup by extracting modal-layer composition from `src/client/components/gallery/GalleryWorkspace.tsx` into `src/client/components/gallery/GalleryModalController.tsx` (image modal, auto-tag modal, slideshow settings/view wiring), keeping behavior stable.
- Reduced `GalleryWorkspace` to a thinner page-composition shell and updated architecture/refactor docs to reflect the new layering.
- Bumped app version to `0.9.18` and refreshed `flake.nix` `npmDepsHash` after the lockfile version update.

## [0.9.17] - 2026-02-11

### Changed
- Continued `WorkflowDetail` controller decomposition by extracting auto-tag state/persistence/handler logic from `src/client/components/workflows/workflow-detail/useWorkflowDetailController.ts` into a dedicated hook module: `src/client/components/workflows/workflow-detail/useWorkflowAutoTagSettings.ts`.
- Reduced `useWorkflowDetailController` surface area while preserving existing `WorkflowDetail` API/behavior.
- Updated frontend architecture/refactor docs to reflect the new hook layering and remaining decomposition targets.
- Bumped app version to `0.9.17` and refreshed `flake.nix` `npmDepsHash` after the lockfile version update.

### Added
- Added `src/client/components/workflows/workflow-detail/useWorkflowAutoTagSettings.test.tsx` coverage for auto-tag settings normalization and fallback-ref persistence behavior.

## [0.9.16] - 2026-02-11

### Fixed
- Hardened `ImageModal` prompt metadata fetching by unifying preload and prompt-open retry through a shared abort/stale-safe request lifecycle in `src/client/components/ImageModal.tsx`, preventing stale responses from prior images and ensuring retry paths use the same cancellation safeguards.

### Added
- Added `src/client/components/ImageModal.test.tsx` coverage for prompt request cancellation across image changes and prompt-open retry behavior after silent preload failure.

### Changed
- Updated frontend cleanup planning notes in `docs/frontend-refactor-plan.md` to mark `ImageModal` prompt-fetch cancellation hardening as completed and keep focus on workflow-controller decomposition + gallery follow-up cleanup.
- Bumped app version to `0.9.16` and refreshed `flake.nix` `npmDepsHash` after the lockfile version update.

## [0.9.15] - 2026-02-11

### Added
- Added workflow controller regression coverage in `src/client/components/workflows/workflow-detail/useWorkflowDetailController.test.tsx` for `workflow.updatedAt` refresh behavior (preserve dirty input edits, apply new defaults when not dirty).

### Fixed
- Fixed `WorkflowDetail` input reset churn by making same-workflow metadata refreshes dirty-aware in `src/client/components/workflows/workflow-detail/useWorkflowDetailController.ts`, so in-progress edits are no longer wiped when `workflow.updatedAt` changes.

### Changed
- Updated frontend refactor planning docs to mark the dirty-reset backlog item as resolved and focus remaining phase-2 work on `ImageModal` fetch cancellation hardening and controller-hook decomposition.
- Bumped app version to `0.9.15` and refreshed `flake.nix` `npmDepsHash` after the lockfile version update.

## [0.9.14] - 2026-02-11

### Changed
- Completed the `WorkflowDetail` phase-1 modularization by extracting controller/state/effects/network logic into `src/client/components/workflows/workflow-detail/useWorkflowDetailController.ts`, leaving `src/client/components/workflows/WorkflowDetail.tsx` as a thin composition shell.
- Updated frontend architecture/refactor planning docs to reflect the new hook-based layering and current remaining backlog focus.
- Bumped app version to `0.9.14` and refreshed `flake.nix` `npmDepsHash` after the lockfile version update.

## [0.9.13] - 2026-02-11

### Changed
- Continued workflow detail modularization by extracting `WorkflowDetail` render sections into dedicated components under `src/client/components/workflows/workflow-detail/` (`WorkflowHeader`, `AutoTagSettingsPanel`, `WorkflowInputsSection`, `WorkflowJobsSection`, `WorkflowOutputModalController`), while keeping behavior and state flow stable.
- Bumped app version to `0.9.13` and refreshed `flake.nix` `npmDepsHash` after the lockfile version update.

### Fixed
- Removed confirmed dead `ui/*` primitives that were not reachable from `src/client/main.tsx` (`card`, `dropdown-menu`, `input`, `label`, `scroll-area`, `select`, `separator`, `sheet`, `slider`, `switch`, `toggle`) to reduce dead surface area and maintenance overhead.

## [0.9.12] - 2026-02-11

### Changed
- Started Gallery phase-1 modularization by extracting state/effects/handlers into `src/client/components/gallery/useGalleryWorkspaceController.ts`, keeping `GalleryWorkspace` focused on page composition/render wiring.
- Bumped app version to `0.9.12` and refreshed `flake.nix` `npmDepsHash` after the lockfile version update.

### Fixed
- Restored standard image-modal dismissal behavior for blank stage clicks: clicking outside the rendered image (but inside the stage) now dismisses while preserving existing close options (`X`, `Esc`, swipe, controls).

## [0.9.11] - 2026-02-11

### Changed
- Updated generated auto-tag normalization to strip leading/trailing non-alphanumeric characters (punctuation/symbols) from parsed tags while preserving interior symbols.
- Kept interior punctuation intact for valid phrases (for example, `dr. person` remains `dr. person`).
- Applied the same edge-trimming behavior to both bulk Auto Tag parsing and generation-time workflow auto-tagging for consistent results.
- Hardened workflow/gallery local image URL generation by adding shared `buildImageUrl` path-segment encoding for reserved characters (`#`, `?`, `%`) while preserving folder separators.
- Workflow list reload now clears stale error state before fetch attempts, preventing old error banners from persisting after successful responses.

### Added
- Added regression coverage for edge punctuation/symbol trimming in prompt-tag parsing and generation-time auto-tag application.
- Added frontend architecture audit documentation in `docs/frontend-architecture-audit.md`, including per-page component relationship trees, shared component mapping, unreachable component inventory, and labeled layout sketches for Gallery and Workflows pages.
- Added a concrete frontend cleanup/refactor prep document in `docs/frontend-refactor-plan.md` with deep-review findings, split contracts for `WorkflowDetail` and `GalleryWorkspace`, hook/data-flow trees, and staged deprecation plan for unused `ui/*` primitives.

### Fixed
- Fixed gallery modal selection state so selected images are cleared when they leave the active filtered image set, preventing unexpected modal reopen on filter restoration.
- Fixed workflow JSON import picker behavior so choosing the same file repeatedly still triggers file parsing.
- Removed dead legacy frontend status bar component/test (`src/client/components/StatusBar.tsx`, `src/client/components/StatusBar.test.tsx`).

## [0.9.10] - 2026-02-11

### Added
- Added a Step 1 auto-tag parsing control for `Max words per tag` (default `2`) in `AutoTagModal`, so users can set a hard limit before generating review tags.
- Added max-word persistence for workflow auto-tag-on-generate settings, exposed via `PUT /api/workflows/:id/auto-tag` (`maxWords`) and returned by workflow payloads as `autoTagMaxWords`.
- Added client tests for prompt-tag word-limit behavior in `src/client/utils/promptTags.test.ts`.

### Changed
- Updated prompt tag parsing to ignore tags exceeding the selected word limit, where words are counted by spaces (so `person talks to person` is 4 words, `person_talking` is 1).
- Updated generation-time auto-tagging to apply the workflow-configured max-word limit while saving output metadata.
- Extended workflow DB schema with `auto_tag_max_words` (default `2`) including migration-safe column creation.

## [0.9.9] - 2026-02-11

### Added
- Added shift-click range selection in gallery multi-select mode: shift-click now selects all images between the current anchor selection and the clicked image (or from the start of the current filtered view when no anchor exists).
- Added a new multi-select toolbar action, `Auto Tag View`, to auto-tag every image in the current filtered view without manually selecting each image.
- Added persistent workflow auto-tag settings with a new endpoint: `PUT /api/workflows/:id/auto-tag` (enable/disable plus selected text-input refs).
- Added workflow-page auto-tag configuration UI with per-input selection and explanatory copy, including a warning that comma-separated prompts are required for reliable tag parsing.
- Added server-side generation auto-tagging on output save, applying workflow-selected text fields to generated images so UI runs, API triggers, and MCP-triggered runs share the same behavior.

### Changed
- Extended workflow API payloads (`GET /api/workflows`, `GET /api/workflows/:id`) to include `autoTagEnabled` and `autoTagInputRefs`.
- Added workflow DB fields (`auto_tag_enabled`, `auto_tag_input_refs`) with migration-safe initialization for existing databases.

### Fixed
- Constrained top-bar tag chip areas in gallery filters and multi-select tools to fixed-height, scrollable containers so large tag lists no longer expand to fill the viewport.

## [0.9.8] - 2026-02-11

### Added
- Cross-platform install scripts for non-Nix setups, including Unix (`scripts/install-unix.sh`), Linux wrapper (`scripts/install-linux.sh`), macOS wrapper (`scripts/install-macos.sh`), and Windows installers (`scripts/install-windows.ps1`, `scripts/install-windows.cmd`).
- New dedicated install documentation in `docs/INSTALL.md` covering Nix, Linux, macOS, and Windows.
- Added `LICENSE` (MIT) file for explicit repository licensing.

### Changed
- Reworked production start command to be cross-platform by replacing shell-only env assignment with `scripts/start-production.mjs`.
- Refreshed `README.md` with a modern GitHub-facing layout (badges, improved structure, install matrix, API/MCP coverage, release workflow, troubleshooting).
- Updated Nix package install phase to call shared helper script `scripts/install-runtime-layout.sh` for runtime layout/wrapper creation.
- Refreshed `flake.nix` `npmDepsHash` after the `package-lock.json` release-version update.

### Fixed
- Removed duplicate `server.allowedHosts` declaration in `vite.config.ts` to clear Vite duplicate-key build warnings.

## [0.9.7] - 2026-02-11

### Added
- Bulk auto-tag from metadata: select images in multi-select mode and click "Auto Tag" to parse comma-separated prompt text into individual tags with a review modal.
- Auto-tag review modal shows each image as a row with a fit-to-content thumbnail and an editable tag list where users can add/remove tags before applying.
- New tags parsed from metadata are highlighted in the review UI to distinguish them from existing tags.
- Batch prompt API endpoint (`POST /api/prompts/bulk`) for efficient bulk metadata fetching.
- Prompt tag parsing utility that splits on commas, trims whitespace, strips bracket characters (`[]`, `()`, `{}`), lowercases, and deduplicates.

## [0.9.6] - 2026-02-10

### Fixed
- Gallery left tag drawer selection now applies a single tag at a time (with tap-again to clear), preventing accidental multi-tag accumulation from drawer clicks.
- Removed redundant theme selection from the gallery filter panel since theme controls are already available in the app header.

### Changed
- Preserved multi-tag filtering behavior in the filter tools so users can still build combined tag filters intentionally outside the side drawer.

## [0.9.5] - 2026-02-10

### Fixed
- Gallery filtered-tag views now use fill/crop card rendering consistent with the full gallery view to avoid letterboxed card presentation while browsing tag-filtered results.
- Image detail modal tag/rating tool panels now float above the image instead of changing modal layout height, preventing the zoom stage from resizing when tools are toggled.
- Workflow output modal navigation now supports stable previous/next behavior across output paths and handles path matching more robustly.
- Workflow sidebar behavior improved: remembers/restores last opened workflow, avoids auto-selecting the first workflow when no valid remembered selection exists, and expands the main content area cleanly when the drawer is collapsed.
- Workflow organization UX improved for reliability and mobile support: strengthened drag/drop reorder handling and added explicit up/down reorder controls for touch/mobile usage.
- Slideshow close control moved into the bottom control bar so it no longer overlays image content.
- Export API modal copy-to-clipboard now has stronger secure/insecure-context fallbacks to improve reliability across environments.

### Changed
- Refined tag discovery/filter UX in both the gallery tag drawer and filter popover with searchable tag input, sort options, and denser tag list presentation for large tag sets.
- Refined rating filter UX in the top toolbar with clearer star-based min/max controls and cleaner presentation.

## [0.9.4] - 2026-02-10

### Added
- Expanded the Export API modal Open WebUI tab into an MCP-focused setup panel with:
  - ready-to-import Open WebUI MCP server JSON (`/mcp`) for Comfy Output Viewer tools,
  - one-click JSON download for import convenience,
  - a copyable system prompt template tailored to the selected workflow ID and input labels, including the `run_workflow` JSON payload format.

### Changed
- Renamed the Export API tab label from `Open WebUI Tool` to `Open WebUI MCP` to reflect the MCP-based integration flow.

## [0.9.3] - 2026-02-10

### Fixed
- Fixed MCP Streamable HTTP session cleanup recursion that could trigger `RangeError: Maximum call stack size exceeded` when transports closed.
- Updated external trigger/MCP input resolution to preserve workflow JSON values for unspecified fields (matching UI run behavior) instead of auto-injecting stored default values that could overwrite prompt values unexpectedly.

## [0.9.2] - 2026-02-10

### Fixed
- Improved external trigger/MCP input resolution to better match real-world AI tool payloads by accepting normalized key variants (e.g. spacing/underscore differences) and prompt aliases (e.g. `prompt` for positive prompt fields).
- Added support for primitive non-string MCP input values (`number`, `boolean`) and normalized them into workflow input values.
- Updated MCP `run_workflow` responses to include `appliedInputs` so callers can verify exactly which values were queued versus defaults.
- Added regression tests for prompt-alias mapping and MCP numeric input handling.

## [0.9.1] - 2026-02-10

### Fixed
- Added a standard MCP Streamable HTTP endpoint at `/mcp` (`POST`/`GET`/`DELETE`) so Open WebUI can connect without relying on the legacy SSE transport.
- Fixed MCP session stability by creating an isolated MCP server per session, preventing reconnect failures after the first `initialize` call.
- Kept existing `/mcp/sse` + `/mcp/messages` routes for backward compatibility while introducing the Streamable HTTP path for current MCP clients.

## [0.9.0] - 2026-02-09

### Added
- External workflow trigger API: `POST /api/workflows/:id/trigger` accepts a flat JSON body with label-based or input-key-based field names, resolves text-based inputs (text, negative, number, seed), and queues the workflow to ComfyUI identically to the in-app Run button.
- Trigger schema endpoint: `GET /api/workflows/:id/trigger-schema` returns the expected input fields, types, defaults, and an example payload for a workflow.
- MCP (Model Context Protocol) server mounted at `/mcp/sse` and `/mcp/messages` with SSE transport, exposing `list_workflows`, `run_workflow`, and `get_job_status` tools for AI integration.
- Export API modal in the workflow UI: an "API" button next to "Run Workflow" opens a dialog with JSON payload, curl command, and auto-generated Open WebUI Python Tool tabs, each with copy-to-clipboard.
- Open WebUI Tool generator: the Export API modal produces a ready-to-paste Python `Tools` class with `Valves` for server URL configuration and automatic job polling.
- Added `@modelcontextprotocol/sdk` dependency for the MCP server.
- New test coverage for trigger/schema endpoints and MCP server tools.

### Changed
- Extracted shared workflow execution helpers (`createJobAndQueue`, `applyTextInputsToPrompt`, `resolveTriggeredInputValues`, `executeWorkflowFromInputMap`) from the `/run` handler in `registerWorkflowRoutes.js` to support both the internal run flow and the external trigger/MCP paths without code duplication.
- `registerWorkflowRoutes` now returns `{ buildJobPayload, resolveTriggeredInputValues, executeWorkflowFromInputMap }` for use by the MCP server.
- Added `/mcp` to the Vite dev proxy configuration.

## [0.8.11] - 2026-02-08

### Fixed
- Reintroduced the iOS/mobile input-focus zoom safeguard in `src/client/globals.css` by forcing `16px` font size for text-entry controls in mobile WebKit, so selecting inputs no longer zooms and shifts the view.

## [0.8.10] - 2026-02-08

### Added
- Extended mock sandbox seeding (`scripts/seed-mock-dev-data.mjs`) to prepopulate workflow jobs across multiple states (`completed`, `running`, `queued`, `pending`, `error`, `cancelled`) with sample inputs and completed-job outputs for richer workflow UI demos.

### Changed
- Added static mock live payload support for seeded generating jobs in `registerWorkflowRoutes` so running/queued/pending cards show meaningful progress/queue/preview data in sandbox mode.
- Updated queue-resume behavior to skip polling seeded mock prompt IDs in mock mode, keeping demo job states stable for screenshots.
- Updated `npm run dev:mock` to set `MOCK_DEV_MODE=1` and bumped version to `0.8.10`.

## [0.8.9] - 2026-02-08

### Added
- Added a dedicated mock sandbox seeding script at `scripts/seed-mock-dev-data.mjs` that downloads sample images into `.mock-dev/source`, mirrors them into `.mock-dev/data`, and seeds example gallery metadata (favorites, hidden, ratings, tags, and prompt summaries).
- Added seeded starter workflows under a `Mock Examples` folder so workflow UI states and run forms are available immediately in sandbox mode.

### Changed
- Added `npm run mock:seed` to refresh sandbox dataset content.
- Added `npm run dev:mock` to seed and run development against dummy source/data directories while keeping `COMFY_API_URL` unchanged for real ComfyUI API calls.
- Documented mock sandbox mode and `MOCK_DEV_ROOT` in `README.md` and `.env.example`.
- Restored swipe-based image navigation in the detail modal and removed left/right half-screen tap navigation.
- Bumped version to 0.8.9 and refreshed `flake.nix` npmDepsHash after the package-lock update.

## [0.8.8] - 2026-02-08

### Fixed
- Replaced gesture/swipe-driven image navigation in the detail modal with direct left/right half tap navigation wired to the same previous/next actions as the toolbar buttons.
- Removed touch/pointer swipe tracking logic that was causing unstable mobile behavior and laggy/odd swipe interactions.
- Kept zoom and pan enabled while adding pan/pinch guards so tap navigation does not fire immediately after gesture interactions.
- Simplified modal image transitions by removing swipe-entry opacity state from image rendering.
- Bumped version to 0.8.8 and refreshed `flake.nix` npmDepsHash after the package-lock update.

## [0.8.7] - 2026-02-08

### Fixed
- Applied a WebKit-focused modal rendering fix to address severe mobile image-movement lag that persisted after restoring pre-regression interaction logic.
- Removed experimental transform/compositor hints (`will-change`, `translateZ`, forced modal touch-action) that regressed iOS interaction smoothness.
- Kept the Safari-specific modal chrome fallback that disables costly `backdrop-filter` on iOS while preserving desktop styling.
- Restricted modal debug overlay activation to explicit `?debug=1` query usage only, avoiding accidental persisted debug overhead from prior sessions.
- Bumped version to 0.8.7 and refreshed `flake.nix` npmDepsHash after the package-lock update.

## [0.8.6] - 2026-02-08

### Fixed
- Restored image detail interaction behavior to the pre-regression model used before recent modal performance experiments, while preserving the redesigned toolbar/visual UI.
- Reverted modal image source handling from progressive thumb/full promotion back to direct full-image rendering to eliminate snap/jump artifacts during open and navigation.
- Reverted swipe gesture thresholds and transition timing to the prior stable settings to restore reliable mobile swipe behavior.
- Reverted fit-scale and transform lifecycle logic to the previously stable flow (`TransformWrapper` remount per image, resize observer gating, transform reset timing) to prevent odd modal movement.
- Removed adjacent-image preload wiring introduced during recent perf tuning after it regressed modal interaction consistency.
- Bumped version to 0.8.6 and refreshed `flake.nix` npmDepsHash after the package-lock update.

## [0.8.5] - 2026-02-08

### Changed
- Performed a deeper detail-view performance pass focused on mobile lag and swipe fluidity.
- Added modal progressive image loading (`thumbUrl` first, full image promoted after decode) to improve perceived open time and image-to-image responsiveness.
- Simplified modal image transitions by removing extra swipe fade state and opacity transition churn between images.
- Reworked modal fit-scale calculations to use natural image dimensions instead of transformed layout reads for lighter per-image setup.
- Tightened mobile gesture behavior by reducing swipe thresholds, applying earlier transform reset via layout effect, and reducing mobile GPU blur work on modal bars.
- Added `touch-action` handling on the modal stage to reduce gesture interference and improve swipe consistency.
- Kept adjacent-image preloading and prompt-metadata caching/deferred loading from v0.8.4 to preserve smooth navigation on large libraries.
- Bumped version to 0.8.5 and refreshed `flake.nix` npmDepsHash after the package-lock update.

## [0.8.4] - 2026-02-08

### Changed
- Improved image detail modal responsiveness by reducing heavy work during initial open and image-to-image navigation.
- Deferred prompt-metadata fetches for newly opened images to a short background prefetch window and only show prompt loading UI when the prompt panel is explicitly opened.
- Added lightweight in-memory prompt metadata caching to avoid repeated prompt API roundtrips when revisiting images.
- Added adjacent-image preloading (previous/next) in the modal flow so navigation feels faster and more fluid.
- Removed `TransformWrapper` remount-on-image behavior to reduce navigation churn and keep modal interactions smoother.
- Tightened modal transition timing and prioritized modal image decode/fetch for faster visible paint.

## [0.8.3] - 2026-02-08

### Changed
- Ran a release-readiness quality pass across the client UI to tighten accessibility, consistency, and interaction semantics.
- Converted gallery cards from nested button markup to a keyboard-accessible card container with explicit button role semantics, removing invalid nested interactive HTML.
- Added stronger icon-button accessibility coverage (`aria-label`) across modal/workflow controls and upgraded multiple modal overlays to explicit backdrop buttons with dialog metadata.
- Improved browser theming consistency by syncing `color-scheme` and `<meta name="theme-color">` with light/dark mode changes.
- Replaced broad `transition-all` usage in key interactive/progress components with explicit property transitions for better rendering performance.
- Added small UX/copy consistency polish (`…` loading labels, live status regions, improved form labeling/autocomplete hints).
- Added minor gallery memory hygiene by clearing stale ratio caches when the image window changes.

### Fixed
- Removed React test warnings caused by nested `<button>` markup in gallery image cards.
- Eliminated `act(...)` warnings in `TagsContext` tests by waiting for initial async tag refresh before assertions.
- Updated slideshow settings modal tests to target the new explicit backdrop close control.

## [0.8.2] - 2026-02-08

### Changed
- Improved gallery first-load performance for large libraries with progressive rendering that starts with a larger initial batch and prefetches additional batches before they enter the viewport.
- Updated progressive gallery loading to use an off-screen intersection sentinel with generous root margin buffering so users do not see new batches pop in while scrolling.
- Added a short, clean card entrance animation for initial gallery appearance and disabled that entry animation for later progressive batches to keep scrolling smooth.
- Smoothed image reveal behavior by fading in loaded thumbnails to reduce visible loading flashes on incoming cards.

## [0.8.1] - 2026-02-08

### Added
- Added animated mesh gradient background with slow-drifting aurora of accent/secondary colors behind the app shell.
- Added floating ambient orbs — two large blurred decorative circles that drift subtly in the background for depth.
- Added animated shimmer sweep on the navigation bottom border.
- Added gradient text fill on the app title (accent to secondary).
- Added card hover lift, glow, and subtle tilt rotation with smooth spring-like transition.
- Added spinning conic-gradient border on selected cards using CSS `@property` for a dynamic "border beam" effect.
- Added heart burst animation on favorite toggle — scale bounce with glow pulse.
- Added rating badge metallic shimmer sweep animation.
- Added tag chip pop-in animation with staggered bounce entrance.
- Added filter pill ambient pulse glow.
- Added tool button scale-up and glow on hover.
- Added dramatic modal entrance with scale-from-0.92 and blur-clearing effect.
- Added status message slide-in from right with spring overshoot and gradient accent border.
- Added accent-to-secondary gradient on custom scrollbar thumbs.
- Added Ken Burns slow-zoom effect on slideshow images.
- Added gallery empty state with pulsing orb and expanding ring animation.
- Added `prefers-reduced-motion` media query that disables all animations and transitions globally.

## [0.8.0] - 2026-02-08

### Changed
- Redesigned the full UI with a modern aesthetic: new orange/violet color palette, glassmorphism toolbar and panels, Inter font stack, and gradient accents throughout.
- Overhauled the gallery grid to fill the full viewport width with consistent 12px tile gap and 16px horizontal padding, replacing the previous narrower centered layout.
- Merged the StatusBar into the TopBar component, showing loading state, status messages, and error alerts inline with an image count badge on the filter pill.
- Modernized all modals and tool popovers with floating glass panels, slide-in animations, increased backdrop blur, and full-viewport scrims.
- Redesigned card overlays with solid dark backgrounds instead of per-element backdrop-filter blur, eliminating GPU-intensive compositing on large galleries.
- Wrapped all `:hover` card effects in `@media (hover: hover)` to fix the mobile double-tap issue where the first tap triggered hover state instead of selection.
- Replaced `content-visibility: auto` with `contain: layout style paint` on gallery cards and added placeholder backgrounds with fade-in animations to reduce image loading flash during scroll.
- Fixed `useElementSize` hook to use consistent content-box measurements (clientWidth minus padding) for both initial mount and ResizeObserver callbacks, resolving grid column calculation errors when gallery padding was present.
- Removed `scrollbar-gutter: stable` from the gallery to reclaim permanent scrollbar space.
- Shrunk mobile toolbar buttons and filter pills to prevent overflow on narrow screens.
- Matched the workflows sidebar glass style to the tag drawer with translucent background and 32px backdrop blur.
- Kept the version subtitle visible at the 768px breakpoint instead of hiding it.
- Tightened nav bar padding and simplified button styles from gradients to flat colors.

## [0.7.7] - 2026-02-08

### Added
- Added a unified Vitest-based testing system across server and client with dedicated configs: `vitest.server.config.ts` (Node) and `vitest.client.config.ts` (jsdom + React).
- Added comprehensive backend coverage for route modules (`registerImageRoutes`, `registerWorkflowRoutes`, `registerComfyRoutes`), service modules (`createImageService`, `createQueueService`, `createComfyRuntimeService`, `createWorkflowExecutionService`), metadata repository behavior, and runtime state.
- Added comprehensive frontend coverage for API/util helpers, storage/tag/image logic, core hooks, app shell/page wrappers, gallery/workflow workspaces, and key UI components (cards, drawers, top bar, status, rating, slideshow).

### Changed
- Added first-class npm scripts for full-suite execution and targeted runs:
  - `npm test` / `npm run test:all`
  - `npm run test:server`, `npm run test:client`
  - watch variants for server/client
  - coverage variants for server/client and combined coverage workflow
- Documented the new testing workflow in `README.md` and codified full-suite expectations in `AGENTS.md` when users request running all tests.

## [0.7.6] - 2026-02-08

### Changed
- Extracted Comfy runtime orchestration from `src/server/index.js` into `src/server/services/createComfyRuntimeService.js`, including API lifecycle/init, websocket readiness, event binding, prompt-to-job mapping, and live progress/preview state updates.
- Extracted queue tracking/recovery orchestration into `src/server/services/createQueueService.js`, including queue metadata parsing, polling loop, queue-state caching, and in-flight job resumption after restart.
- Preserved existing route/runtime function contracts by injecting callbacks/getters (`broadcastJobUpdate`, `finalizeJobFromPrompt`, `startQueuePolling`, `pollJobCompletion`) instead of changing endpoint behavior.

## [0.7.5] - 2026-02-08

### Changed
- Extracted image/file responsibilities from `src/server/index.js` into `src/server/services/createImageService.js`, including path-safe resolution, image listing, thumbnail management, source-to-data sync, and delete/blacklist flows.
- Extracted workflow execution output responsibilities into `src/server/services/createWorkflowExecutionService.js`, including Comfy history lookup, output collection/retry, output download/persistence, completion polling, and prompt finalization.
- Kept existing route/runtime integration contracts intact by wiring refactored services through dependency injection and preserving existing function signatures consumed by `registerImageRoutes` and `registerWorkflowRoutes`.

## [0.7.4] - 2026-02-08

### Fixed
- Restored cross-module workflow live-update wiring by registering a shared `broadcastJobUpdate` callback between `src/server/index.js` and `src/server/routes/registerWorkflowRoutes.js`, preventing runtime `ReferenceError` failures during queue/status refreshes.
- Fixed workflow folder reordering to update only `sort_order` instead of writing `name = NULL`, resolving SQLite `NOT NULL` constraint errors introduced during route modularization.
- Hardened SQLite bootstrap compatibility by only running job-output dedupe when the unique index does not already exist, and made workflow ordering SQL portable across SQLite builds.

## [0.7.3] - 2026-02-08

### Fixed
- Restored missing workflow route runtime dependencies after server modularization by passing `isGeneratingStatus`, `pollJobCompletion`, websocket clients, and filesystem checks into `registerWorkflowRoutes`.
- Fixed workflow run/job payload paths that could throw `ReferenceError: isGeneratingStatus is not defined` during live job updates.

## [0.7.2] - 2026-02-08

### Fixed
- Fixed workflow image-input picker sizing so the selectable image grid can use multiple columns instead of collapsing to a single column when initial element measurements are zero.
- Updated image picker modal layout to let the grid fill available dialog height more reliably.
- Improved `useElementSize` to capture immediate post-mount dimensions (plus a next-frame remeasure) for more stable initial layout calculations.

## [0.7.1] - 2026-02-08

### Changed
- Extracted server SQLite bootstrap/schema/statement wiring into `src/server/db/createDatabase.js`.
- Extracted metadata/tag/rating/blacklist operations and legacy JSON migration into `src/server/db/createMetadataRepository.js`.
- Slimmed `src/server/index.js` by composing DB modules instead of inlining DB concerns.

## [0.7.0] - 2026-02-08

### Changed
- Reorganized the repository to a unified `src/client` and `src/server` layout, updating build/runtime entry points and references.
- Split server API registration into task-focused route modules (`registerImageRoutes`, `registerWorkflowRoutes`, `registerComfyRoutes`) under `src/server/routes/`.
- Extracted Comfy SDK websocket adapter into `src/server/sdk/ComfyWebSocketAdapter.js` and centralized mutable runtime state in `src/server/lib/ComfyRuntimeState.js`.
- Reduced page-level complexity by moving gallery/workflow page orchestration into workspace components and extracting workflow detail into `src/client/components/workflows/WorkflowDetail.tsx`.
- Added focused workflow component modules and shared workflow helper/type modules for cleaner boundaries.

## [0.6.7] - 2026-02-08

### Changed
- Split workflow UI internals into isolated modules under `src/components/workflows/` (`WorkflowEditorPanel`, `ImageInputField`, `ImagePickerModal`, `JobCard`, `SystemStatsPanel`, shared formatters/types).
- Introduced a dedicated backend runtime state class (`server/lib/ComfyRuntimeState.js`) and moved in-memory queue/progress/live-event state ownership into that module.
- Simplified `WorkflowsPage` orchestration by consuming modular workflow components and shared editor/system types.

## [0.6.6] - 2026-02-08

### Changed
- Hardened API client response parsing to safely handle empty and non-JSON success responses.
- Improved the shared element-size hook to reliably re-observe remounted DOM nodes.

### Fixed
- Resolved strict TypeScript errors and tightened workflow progress percent normalization.
- Prevented stale workflow job refetch timers and async editor/image-picker loads from mutating newer workflow state.
- Added server-side guards for workflow numeric input coercion, prompt-to-job cache validation, queue override staleness, and large input upload limits.
- Unified polling/event job finalization behavior and made job output insertion idempotent with a unique job/image index.

## [0.6.4] - 2026-02-08

### Changed
- Consolidated image metadata API calls into a shared client helper.
- Centralized localStorage persistence and media query handling with shared hooks for gallery/workflow settings.

### Fixed
- Stabilized gallery modal navigation handlers to avoid stale closures in key navigation.

## [0.6.5] - 2026-02-08

### Changed
- Optimized gallery card rendering for large libraries via memoization and browser content-visibility hints.

### Fixed
- Refresh image metadata on failed optimistic updates to keep UI state consistent with the server.

## [0.6.3] - 2026-02-08

### Fixed
- Resumed in-progress workflow jobs after server restarts by rehydrating queue state and polling for completion.

## [0.6.2] - 2026-02-08

### Fixed
- Reset workflow detail state and guarded async job loads so switching workflows mid-run shows the new workflow immediately.

## [0.6.1] - 2026-02-08

### Changed
- Hid the live preview panel when ComfyUI has not emitted preview frames yet.

## [0.6.0] - 2026-02-08

### Added
- Added overall job progress indicators in workflow job cards and surfaced live preview hints when ComfyUI previews are disabled.

### Changed
- Switched the job header progress pill to display overall progress.

### Fixed
- De-duplicated workflow job outputs to prevent repeated thumbnails and broken navigation.

## [0.5.20] - 2026-02-08

### Fixed
- Marked jobs completed via ComfyUI execution events so finished jobs stop showing as generating.
- Limited queue badges to active jobs and tightened queue metadata attachment.

## [0.5.19] - 2026-02-08

### Fixed
- Returned live progress/preview/queue metadata from the workflow jobs list API so polling updates the UI.

## [0.5.18] - 2026-02-08

### Fixed
- Parsed progress values from ComfyUI websocket events and expanded websocket debug output for active jobs.

## [0.5.17] - 2026-02-08

### Added
- Added a ComfyUI websocket status debug endpoint and surfaced websocket connectivity warnings on live jobs.

### Fixed
- Hardened queue prompt ID extraction to improve queue metadata accuracy.

## [0.5.16] - 2026-02-08

### Fixed
- Ensured the ComfyUI websocket handshake reconnects using the assigned session id so progress/preview events stream correctly.

## [0.5.15] - 2026-02-08

### Fixed
- Normalized ComfyUI websocket messages so progress and live preview frames update reliably on the server.

## [0.5.14] - 2026-02-08

### Added
- Added ComfyUI websocket preview frames, queue position metadata, and system stats to the workflow jobs view.
- Added real ComfyUI interrupt calls when cancelling running workflow jobs.

### Changed
- Refined workflow job cards with live preview tiles, queue badges, and progress bars optimized for mobile.

## [0.5.13] - 2026-02-08

### Added
- Added ComfyUI websocket progress updates to workflow job cards with a step readout and progress bar.

### Changed
- Refined workflow job card layout to reduce clutter on mobile and highlight status, timing, and progress.

## [0.5.12] - 2026-02-08

### Changed
- Routed ComfyUI prompt queueing, history polling, image fetches, and uploads through the ComfyUI SDK client.

## [0.5.11] - 2026-02-08

### Added
- Added job output recheck support for completed workflows, including auto retries and a manual recheck action.

### Fixed
- Recorded workflow outputs and prompt metadata even when outputs already exist or source writes fail.

## [0.5.10] - 2026-02-07

### Added
- Added default value controls for workflow inputs, seeded from the workflow JSON and persisted for run prefills.

## [0.5.9] - 2026-02-07

### Added
- Added a cancel action for running workflow jobs to stop tracking them.

### Fixed
- Retried workflow job output collection and syncing so completed jobs restore preview thumbnails when history lags.

## [0.5.8] - 2026-02-07

### Fixed
- Kept the tag editor tool open while adding tags in the image detail modal.

## [0.5.7] - 2026-02-07

### Fixed
- Upload workflow input images into a local inputs folder with hash reuse before sending them to ComfyUI.

## [0.5.6] - 2026-02-07

### Fixed
- Rebuilt the workflow image picker virtualization to keep the scroll height in sync with the full image list.
- Sorted workflow image picker results newest-first.
- Opened selected workflow input thumbnails in the image detail modal.

## [0.5.5] - 2026-02-07

### Fixed
- Rendered workflow image picker thumbnails with contain-fit and virtualized the grid for large libraries.
- Streamed image uploads through the ComfyUI proxy to avoid browser network errors.

## [0.5.4] - 2026-02-07

### Fixed
- Prevented workflow image picker thumbnails from overlapping by sizing grid rows and items explicitly.

## [0.5.3] - 2026-02-07

### Fixed
- Sent full image upload metadata (filename/subfolder/type) into workflow prompt inputs for LoadImage nodes.
- Removed the workflow image picker search and 100-image cap so the full gallery list is selectable.

## [0.5.2] - 2026-02-07

### Fixed
- Restored the workflow image picker modal so it renders above the backdrop and is actionable.
- Upload gallery-selected workflow inputs to ComfyUI before running and pass the returned filename into the prompt JSON.
- Improved image input previews to show local gallery selections or fall back to the stored value.

## [0.5.1] - 2026-02-02

### Fixed
- Fixed tag selection UI not showing all existing tags in both gallery and workflow detail views.
- Added global TagsContext to share tag data across the app for consistent tag suggestions.
- Removed stale memoization from tag suggestions to ensure the tag list is always current.
- Eliminated redundant tag normalization in buildTagCounts for consistent tag handling.

## [0.5.0] - 2026-02-01

### Added
- Added workflow folder organization with single-level nesting support.
- Added drag-and-drop reordering for workflows within folders or at root level.
- Added folder management UI to create, rename, and delete folders.
- Added API endpoints for workflow folder CRUD and reordering.

### Fixed
- Fixed race condition where completed jobs showed no outputs by syncing before broadcasting job updates.
- Added frontend retry logic to refetch job outputs if initially empty after completion.
- Increased job polling timeout from 5 minutes to 1 hour to support large models.
- Prevented iOS Safari zoom on input focus by setting minimum 16px font-size on mobile.
- Changed organization mode icon from hamburger to folder-plus for clarity.
- Added save/cancel buttons to folder rename for clearer editing experience.
- Fixed folder header layout to prevent buttons from overflowing on narrow screens.
- Fixed drag handle positioning to appear inline left of workflow name on mobile.

## [0.4.8] - 2026-01-31

### Fixed
- Reworked slideshow transitions to preload the next image off-DOM and fade out/in on a single frame to avoid flashes.

## [0.4.7] - 2026-01-31

### Fixed
- Kept slideshow images offscreen until loaded to avoid flash frames on Safari.

## [0.4.6] - 2026-01-31

### Fixed
- Kept slideshow images clear of the bottom control bar by padding the crossfade frames.

## [0.4.5] - 2026-01-31

### Fixed
- Ensured slideshow images stay transparent until loaded to avoid flash frames.
- Drove the progress bar with a transform transition to reduce mobile Safari stalls.

## [0.4.4] - 2026-01-31

### Fixed
- Smoothed slideshow progress animation with transition-based timing on mobile Safari.
- Added preloaded crossfade transitions between slideshow images to avoid flashes.

## [0.4.3] - 2026-01-31

### Fixed
- Replaced slideshow ordering/timing icons with cleaner SVGs and smoothed progress timing.
- Prevented background scrolling and input while the slideshow overlay is active.

## [0.4.2] - 2026-01-31

### Fixed
- Tuned the slideshow settings modal styling to respect dark mode theming.

## [0.4.1] - 2026-01-31

### Added
- Added slideshow ordering options for in-order vs shuffled playback.

### Changed
- Restyled the slideshow settings modal with icon-based ordering and timing cards.
- Moved slideshow navigation into a bottom bar to maximize image space on mobile.

### Fixed
- Removed the paused overlay indicator so pausing only freezes playback and the progress bar.

## [0.4.0] - 2026-01-30

### Added
- Released the new Workflows page for importing and running ComfyUI workflows.

## [0.3.39] - 2026-01-30

### Fixed
- Resolved merge conflict markers in metadata files to restore valid JSON for Nix builds.

## [0.3.38] - 2026-01-30

### Fixed
- Stored output hashes for workflow job images and hid outputs that match blacklisted hashes.
- Removed deleted outputs from job logs immediately after deletion.

## [0.3.37] - 2026-01-30

### Fixed
- Defaulted the workflows page to open the first workflow when available.
- Hid job output thumbnails when the underlying image file has been removed from the app library.

## [0.3.36] - 2026-01-30

### Fixed
- Added a close button to the prompt metadata overlay.
- Hid deleted workflow output thumbnails in job logs by checking output existence on the server.

## [0.3.35] - 2026-01-30

### Fixed
- Persisted workflow prefill payloads in session storage so gallery navigation fills inputs reliably.

## [0.3.34] - 2026-01-30

### Fixed
- Simplified the prompt metadata overlay to a static centered panel without flip animation.
- Prefilled workflow inputs when navigating from the gallery by matching stored labels and input keys.
- Returned workflow input keys with prompt metadata to improve prefill matching.

## [0.3.33] - 2026-01-30

### Added
- Replaced the prompt metadata popover with a centered flip-card view in the image modal.
- Added a Load Workflow action on prompt metadata to jump to the workflow and prefill saved inputs.
- Stored workflow IDs and input IDs with image prompt metadata for reliable workflow reloads.

## [0.3.32] - 2026-01-30

### Fixed
- Kept workflow job polling active while a run is in-flight and immediately fetched new jobs after starting a run.

## [0.3.31] - 2026-01-30

### Fixed
- Disabled sticky positioning for modal bars and removed earlier Safari-specific safe-area tweaks.

## [0.3.30] - 2026-01-30

### Fixed
- Removed extra modal topbar padding on mobile Safari and hide the prompt info icon when no metadata exists.

## [0.3.29] - 2026-01-30

### Fixed
- Enabled viewport-fit=cover and safe-area padding on the tab bar so the modal top bar aligns on Safari.

## [0.3.28] - 2026-01-30

### Fixed
- Reduced the modal top bar offset so the image detail toolbar aligns to the top on mobile.
- Fallback to saving workflow outputs into the data directory when the source output path is not writable.

## [0.3.27] - 2026-01-30

### Fixed
- Removed the extra top bar offset so the gallery toolbar sits flush under the tab bar on mobile.

## [0.3.26] - 2026-01-30

### Added
- Added clickable workflow job output thumbnails that open the image viewer from the jobs list.
- Added an info (prompt JSON) panel for workflow-generated images in the modal.
- Added a workflow delete action in the workflow detail header.

### Changed
- Displayed custom workflow input labels as primary with system labels as a smaller subtitle.
- Included thumbnail URLs in workflow job output payloads for lighter previews.

### Fixed
- Corrected the mobile gallery top bar positioning under the tab navigation bar.

## [0.3.25] - 2026-01-30

### Changed
- Removed the redundant hamburger toggle inside the workflow drawer header.

## [0.3.24] - 2026-01-30

### Fixed
- Added a websocket connection flag so job refresh polling continues when live updates drop.

## [0.3.23] - 2026-01-30

### Added
- Added debug prompt JSON output (debug=1) in workflow run mode.
- Added a toggleable workflow list drawer with a hamburger control.

### Changed
- Restyled the workflow run button with a sleeker primary treatment.

## [0.3.22] - 2026-01-30

### Fixed
- Added an input legend explaining blue (text inputs) and orange (selected) highlights in the workflow editor.

## [0.3.21] - 2026-01-30

### Fixed
- Simplified queued status to a generating label, added job duration timers, and fall back to polling during active runs.

## [0.3.20] - 2026-01-30

### Fixed
- Ensured workflow runs only overwrite inputs defined as configurable, leaving all other node values untouched.

## [0.3.19] - 2026-01-30

### Added
- Added an in-place workflow edit view with selected inputs sorted to the top and a modern toggle switch.

### Changed
- Swapped the workflow editor back to an in-place layout instead of a side panel.

### Fixed
- Removed the workflow input FK failure by clearing stale job input references during workflow updates.

## [0.3.18] - 2026-01-30

### Added
- Added real-time workflow job status updates over WebSockets with generating indicators.
- Added a right-side workflow editor panel with edit mode toggles for imports and updates.

### Changed
- Moved the gallery home action to the top tab bar title and removed the gallery title header.
- Moved the theme selector into the gallery filters panel.
- Docked the workflow import flow into the right-side editor panel instead of a modal.
- Updated the npm dependency hash script to use an SRI-compatible placeholder hash.

### Fixed
- Updated the Nix npm dependency hash after dependency changes.

## [0.3.17] - 2026-01-29

### Fixed
- Updated the Nix npm dependency hash after dependency changes.

## [0.3.16] - 2026-01-29

### Fixed
- Updated the Nix npm dependency hash after dependency changes.
- Hardened the npm dependency hash update script to handle hashes with slashes.

## [0.3.15] - 2026-01-29

### Added
- Added a helper script to regenerate the Nix npm dependency hash and documented it in the workflow.

## [0.3.14] - 2026-01-29

### Fixed
- Forced the zoom content container to fill the stage so images respect max-height constraints.

## [0.3.13] - 2026-01-29

### Fixed
- Constrained modal images to the stage with inline sizing to avoid oversized initial renders in production.

## [0.3.12] - 2026-01-29

### Fixed
- Forced the modal zoom wrapper to fill the stage so production builds don't lock to image dimensions.

## [0.3.11] - 2026-01-29

### Added
- Expanded modal zoom debug overlay with viewport and device pixel ratio diagnostics.

## [0.3.10] - 2026-01-29

### Fixed
- Attach modal zoom resize observers after the transform wrapper initializes to keep prod builds in sync.

## [0.3.9] - 2026-01-29

### Added
- Expanded the modal zoom debug overlay with viewport sizing, image completion, and render metrics.

## [0.3.8] - 2026-01-29

### Added
- Added an optional modal zoom debug overlay to inspect wrapper/image sizing in production builds.

## [0.3.7] - 2026-01-29

### Fixed
- Refit modal zoom after wrapper/image resizes to keep initial desktop zoom contained.

## [0.3.6] - 2026-01-29

### Fixed
- Recomputed modal zoom fit from natural image sizes and kept zoom content sized to the image for reliable initial fit.

## [0.3.5] - 2026-01-29

### Fixed
- Fit modal images to the viewport and relax minimum zoom on load to prevent cropped tall images.

## [0.3.4] - 2026-01-29

### Changed
- Documented Nix flake usage and detailed runtime configuration in the README.

## [0.3.3] - 2026-01-29

### Added
- Added a Nix flake with a NixOS module and systemd service options for deployment.

## [0.3.2] - 2026-01-29

### Changed
- Restored card overlay actions to corner placement with rating in the bottom-left.

## [0.3.1] - 2026-01-29

### Changed
- Defaulted rating filters to Any/Any and added rating chips on gallery cards.

## [0.3.0] - 2026-01-29

### Added
- Added 5-star ratings with detail-view controls, bulk rating actions, and rating-based filtering/sorting.

### Changed
- Refined the multi-select bulk action layout to accommodate rating controls.
- Swapped favorite icons to a pink heart in the grid and detail toolbar.

## [0.2.12] - 2026-01-29

### Changed
- Added a bottom bar progress indicator for the active image and reset zoom/position more aggressively on mobile.
- Restyled the tag drawer with a sticky bottom action area and improved layout spacing.

## [0.2.11] - 2026-01-29

### Changed
- Added a download button to the modal toolbar and ensured zoom/position reset on image load with a centered pop-in.

## [0.2.10] - 2026-01-29

### Changed
- Removed the modal filename caption and reset zoom on image changes with a pop-in transition.
- Updated the reset zoom icon for clearer intent.

## [0.2.9] - 2026-01-29

### Changed
- Kept modal action bars single-row on mobile and moved the filename into a subtle caption above the bottom bar.
- Wired zoom controls directly to the transform ref for reliable button-based zooming.

## [0.2.8] - 2026-01-29

### Changed
- Split the detail modal controls into dedicated top and bottom bars for actions and navigation/zoom.
- Refined modal styling and spacing for a cleaner, mobile-friendly layout.

## [0.2.7] - 2026-01-28

### Added
- Made the header title area clickable to reset filters back to all images.

## [0.2.6] - 2026-01-28

### Added
- Added a bulk delete action in multi-select that blacklists removed images from sync.

## [0.2.5] - 2026-01-28

### Added
- Switched metadata storage to SQLite with a migration from the legacy JSON DB.
- Added a modal remove action that blacklists deleted images to prevent re-syncing.

### Changed
- Skip importing images whose hashes are blacklisted during sync.

## [0.2.1] - 2026-01-28

### Fixed
- Normalized tag data on load and while building tag counts so tag filters populate consistently.

## [0.2.2] - 2026-01-28

### Fixed
- Exposed available tag suggestions as clickable chips in the filter and modal tag editors.
- Prevented modal drag gestures from closing the detail view and limited swipe handling to touch devices.

## [0.2.3] - 2026-01-28

### Added
- Added multi-select mode with bulk tag, hide, and favorite actions plus selection highlights.

## [0.2.4] - 2026-01-28

### Fixed
- Batched multi-select updates so bulk tag/hide/favorite actions update metadata without overwriting other entries.

## [0.2.0] - 2026-01-28

### Added
- Introduced per-image tags with create-or-select tag editing in the modal.
- Added tag-based filtering with multi-tag combinations and an untagged-only view.
- Listed tags in the drawer sorted by image count, including total and untagged counts.

### Removed
- Removed folder creation/move flows and all folder-based navigation.

## [0.1.12] - 2026-01-28

### Changed
- Adjusted swipe-in animation to avoid unintended motion on new images.
- Updated hidden icon colors to align with default favorite styling and use red when selected.

## [0.1.11] - 2026-01-28

### Changed
- Allowed zoomed images to render beyond the modal viewport while panning.
- Added swipe transition animations so outgoing images slide offscreen and incoming images pop in.

## [0.1.10] - 2026-01-28

### Changed
- Updated image card overlays with icon-based hide/favorite controls, updated alignment, and clearer active states.
- Reworked the modal toolbar layout with a mobile overflow for secondary actions.
- Added swipe navigation (left/right) and dismiss (up/down) gestures for the detail view with safeguards against pan/zoom.

## [0.1.9] - 2026-01-28

### Changed
- Split the single-page App component into reusable components, hooks, and utilities for easier scaling.

## [0.1.8] - 2026-01-28

### Added
- Added sort controls for created date (default), modified date, file name, and file size.

## [0.1.7] - 2026-01-28

### Changed
- Ensured tool popover dismissal uses a scrim + header handler to avoid click-through.

## [0.1.6] - 2026-01-28

### Changed
- Added a dimmed blur scrim for tool popovers and blocked clicks from reaching the gallery.

## [0.1.5] - 2026-01-28

### Changed
- Prevented toolbar popover dismiss clicks from interacting with the gallery underneath.
- Stacked the title/source row above the toolbar for a slimmer header layout.

## [0.1.4] - 2026-01-28

### Changed
- Dismissed toolbar popovers on outside click/tap and realigned the toolbar layout.
- Added the app version next to the title for quick reference.

## [0.1.3] - 2026-01-28

### Changed
- Limited the columns slider maximum based on available width to avoid overly small tiles.
- Moved filenames from the grid into a single-line footer in the modal view.

## [0.1.2] - 2026-01-28

### Changed
- Replaced tile size control with a columns-per-row slider that auto-sizes tiles to fill the viewport.
- Added first-load column defaults based on available gallery width.
- Removed the dense grid toggle while keeping cover/content view modes.

## [0.1.1] - 2026-01-28

### Added
- Introduced living documentation workflow in `AGENTS.md`.
- Added `CHANGELOG.md` to track releases using semantic versioning.
