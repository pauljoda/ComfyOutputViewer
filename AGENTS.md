# Codex Agent Guide: Comfy Output Viewer

This file describes the application, architecture, and expected workflow for Codex
while working in this repository.

## App Overview

Comfy Output Viewer is a local-first image browser for ComfyUI outputs with tag-based organization.
It mirrors images from a configured source directory into a data directory,
generates thumbnails, and provides a modern web UI for browsing, filtering,
and managing images.

### Key User Flows
- Browse images in a grid, newest-first.
- Filter by tags via a left drawer and multi-tag combinations.
- Jump to an "Untagged" view from the drawer.
- Toggle favorites and hidden states.
- Hide hidden items on the All Images feed only.
- Open a modal viewer with zoom/pan controls and toolbar actions.
- Tag images with existing or newly created tags.
- Remove images with a delete action that blacklists them from future syncs.
- Bulk-delete images in multi-select with the same blacklist behavior.
- Click the header title area to return to the All Images view.

## Architecture

### Server (Node/Express)
Entry: `src/server/index.js`

Responsibilities:
- Serve the SPA in production.
- Serve image files from the data directory at `/images`.
- Provide API endpoints for listing images, syncing, favorites, hidden state,
  and per-image tags.
- Maintain a SQLite DB for metadata (favorites/hidden/tags) and hash blacklisting,
  with DB bootstrap/statements in `src/server/db/createDatabase.js` and metadata
  operations in `src/server/db/createMetadataRepository.js`.
- Keep image/filesystem sync concerns in `src/server/services/createImageService.js`
  and workflow execution/output concerns in
  `src/server/services/createWorkflowExecutionService.js`.
- Keep Comfy runtime lifecycle/event handling in
  `src/server/services/createComfyRuntimeService.js` and queue/resume orchestration
  in `src/server/services/createQueueService.js`.
- Uses Node's built-in `node:sqlite` module (experimental) for storage.
- Generate thumbnails (if `sharp` is available).

Important paths/config:
- `COMFY_OUTPUT_DIR` or `OUTPUT_DIR`: source folder to sync from.
- `DATA_DIR`: local data folder for images, thumbnails, and DB.
- `COMFY_API_URL`: ComfyUI server URL (default: http://127.0.0.1:8188).
- Thumbnails are stored in `.thumbs` under the data dir.
- DB stored at `.comfy_viewer.sqlite` (legacy `.comfy_viewer.json` migrates on boot).

API endpoints:
- `GET /api/images` -> `{ images, sourceDir, dataDir }`
- `POST /api/favorite` -> `{ path, value }`
- `POST /api/hidden` -> `{ path, value }`
- `POST /api/tags` -> `{ path, tags }`
- `POST /api/delete` -> `{ path }`
- `POST /api/delete/bulk` -> `{ paths }`
- `POST /api/sync` -> `{ scanned, copied, thumbnails? }`
- `GET /api/workflows` -> list all workflows
- `POST /api/workflows` -> create workflow with inputs
- `GET /api/workflows/:id` -> get workflow with inputs and jobs
- `PUT /api/workflows/:id` -> update workflow
- `DELETE /api/workflows/:id` -> delete workflow
- `POST /api/workflows/:id/run` -> execute workflow against ComfyUI
- `GET /api/workflows/:id/trigger-schema` -> get external API schema for a workflow
- `POST /api/workflows/:id/trigger` -> external trigger with label-based inputs
- `GET /api/jobs/:id` -> get job status and outputs
- `POST /api/jobs/:id/cancel` -> cancel tracking for a workflow job
- `GET /api/images/:path/prompt` -> get prompt metadata for an image

MCP endpoints (Model Context Protocol):
- `POST /mcp` -> Streamable HTTP MCP JSON-RPC transport (initialize/tool calls)
- `GET /mcp` -> Streamable HTTP MCP SSE stream for active sessions
- `DELETE /mcp` -> Streamable HTTP MCP session termination
- `GET /mcp/sse` -> SSE stream for MCP client connections
- `POST /mcp/messages` -> JSON-RPC message handling for MCP tools
- MCP tools: `list_workflows`, `run_workflow`, `get_job_status`

### Client (Vite + React)
Entry: `src/client/main.tsx` (React Router setup), `src/client/App.tsx` (layout shell)
Pages: `src/client/pages/GalleryPage.tsx`, `src/client/pages/WorkflowsPage.tsx`
Component modules live in `src/client/components`, with shared hooks/utilities in `src/client/hooks`, `src/client/utils`, and `src/client/lib`.

Key UI features:
- App navigation with Gallery and Workflows tabs.
- Top toolbar with icon buttons and a single active tool popover.
- Drawer navigation for tag filters sorted by image count, plus an untagged view.
- Image grid:
  - "Cover" mode: fixed square tiles with object-fit cover.
  - "Content" mode: tile size becomes the smaller dimension, width/height scaled
    by natural image ratio, tiled via flex-wrap.
- Favorites and hidden toggles on cards and modal toolbar.
- Hide hidden items on All Images only; tag filters show hidden items.
- Zoom/pan modal for selected image with prompt metadata viewing.
- Modal tag editor with add/remove controls.
- Workflows page:
  - Workflow list sidebar with import/delete actions.
  - JSON import wizard with node selection for configuring inputs.
  - Workflow runner form with text, number, seed, and image input fields.
  - Image picker modal for selecting existing synced images.
  - Job history with status indicators and output image previews.

Key client behaviors:
- LocalStorage persists theme, columns per row, display mode,
  and hide-hidden flag.
- Hidden/favorite/tag updates are optimistic, then persisted via API.

Styles: `src/client/globals.css`

## Development Notes

Common scripts (from `package.json`):
- `npm run dev` for local development.
- `npm run build` for production build.

## Semantic Versioning + Changelog

This project uses semantic versioning (MAJOR.MINOR.PATCH).
- Update `package.json` version for every change.
- Maintain `CHANGELOG.md` as the source of truth for releases.

Changelog workflow:
1) Create a changelog entry in `CHANGELOG.md`.
2) Use the version number from `package.json` for the entry.

## Codex Workflow Rules (Project-Specific)

This is a living document. Keep it fully up to date with:
- All changes made to the codebase (summarized).
- Current working projects and any in-progress tasks.

Required steps before finishing any action (in order):
1) Create a changelog entry in `CHANGELOG.md` (semantic versioning).
2) If npm dependencies or `package-lock.json` changed, run `scripts/update-npm-deps-hash.sh` and commit the updated `flake.nix`.
3) Update this `AGENTS.md` with all changes and current projects.
4) Add needed files to git, add non-needed files to `.gitignore`, and create a detailed commit.

Testing workflow:
- If a user asks to "run all tests" (or equivalent), run the full suite with `npm run test` (alias: `npm run test:all`), which executes both `test:server` and `test:client`.
- For coverage requests, run `npm run test:coverage`.

If a request is purely informational and makes no changes, do not commit.

## Current Projects

- Maintain living documentation, semantic versioning, and changelog discipline.
- Maintain and expand the unified Vitest test suite for server/client core behavior and regression protection.
- Maintain a reproducible mock sandbox dev mode for screenshot/demo workflows while keeping real ComfyUI API execution paths.
- Expand mock sandbox workflow demo coverage with seeded in-progress/queued/completed job states that render realistic workflow cards without requiring live generations.
- Workflows feature: Add WebSocket relay for real-time job status updates (pending).
- Continue backend modularization by extracting remaining `src/server/index.js` bootstrap/wiring concerns into dedicated modules (in progress).

## Recent Changes
- Added standard MCP Streamable HTTP transport compatibility and session stability fixes (v0.9.1): introduced `/mcp` (`POST`/`GET`/`DELETE`) for spec-aligned MCP clients like Open WebUI, switched MCP session handling to isolated per-session server instances to prevent reconnect/initialize failures, and kept legacy `/mcp/sse` + `/mcp/messages` routes for backward compatibility.
- Added external workflow trigger API, MCP server, and Export API modal (v0.9.0): added `POST /api/workflows/:id/trigger` for label-based external workflow execution, `GET /api/workflows/:id/trigger-schema` for API discovery, MCP server at `/mcp/sse` with `list_workflows`/`run_workflow`/`get_job_status` tools using `@modelcontextprotocol/sdk`, Export API modal in the workflow UI with JSON/curl/Open WebUI Tool tabs, extracted shared execution helpers from the `/run` handler, and added test coverage for all new endpoints and MCP tools.
- Reintroduced iOS/mobile input focus zoom prevention (v0.8.11): added a WebKit + mobile CSS safeguard in `src/client/globals.css` that forces 16px font size on text-entry controls so Safari no longer zooms and shifts the viewport when inputs are focused.
- Expanded mock sandbox jobs for workflow demos (v0.8.10): `mock:seed` now preloads workflow jobs across completed/running/queued/pending/error/cancelled states with seeded inputs and outputs, `dev:mock` now enables `MOCK_DEV_MODE=1`, workflow job payloads now include static mock progress/queue/preview data for seeded in-progress cards, and queue resume skips polling mock prompt IDs so demo states remain stable for screenshots.
- Added mock sandbox dev mode on top of the modern UI branch (v0.8.9): added `scripts/seed-mock-dev-data.mjs` to seed `.mock-dev/source` and `.mock-dev/data` with sample images + metadata + starter workflows, added `npm run mock:seed` and `npm run dev:mock`, documented `MOCK_DEV_ROOT` and sandbox usage in README/.env example, restored swipe-based image navigation in the detail modal (removing left/right half-screen tap-next/tap-prev), and refreshed `flake.nix` npmDepsHash after the package-lock/version update.
- Modal navigation simplification + mobile lag fix (v0.8.8): removed swipe/gesture navigation handlers from `ImageModal`, switched to left/right half click/tap navigation using the same prev/next path as toolbar buttons, preserved zoom/pan support with pan/pinch cooldown guards to prevent accidental taps after gestures, removed swipe-entry opacity transition state, and refreshed `flake.nix` npmDepsHash after bumping to 0.8.8.
- WebKit modal lag fix follow-up (v0.8.7): removed transform/compositor hint overrides (`will-change`, `translateZ`, forced modal touch-action) that caused severe iOS detail-view movement delay, retained Safari-specific modal chrome blur fallback, restricted modal debug overlay enablement to explicit `?debug=1`, and refreshed `flake.nix` npmDepsHash after bumping to 0.8.7.
- Modal interaction regression rollback (v0.8.6): restored the image detail interaction model from the pre-regression implementation (before recent modal perf experiments) while keeping the redesigned toolbar visuals, reverted progressive image source promotion and adjacent preload wiring, restored prior swipe thresholds/timing and transform lifecycle behavior (`TransformWrapper` remount/reset/fit flow), and refreshed `flake.nix` npmDepsHash after the version bump to 0.8.6.
- Deep-dive detail-view performance/mobile swipe pass (v0.8.5): improved modal perceived load speed with progressive thumb-to-full image promotion, removed extra swipe fade transition churn, optimized fit-scale computation to use natural image dimensions, applied earlier layout-effect transform reset, tuned swipe thresholds for mobile responsiveness, reduced mobile modal bar blur cost, kept adjacent image preloading + prompt metadata caching/deferred loading, bumped version to 0.8.5, and refreshed `flake.nix` npmDepsHash.
- Detail-view performance optimization pass (v0.8.4): reduced modal open/navigation lag by deferring prompt metadata fetches to background prefetch, loading prompt state on demand when the prompt panel is opened, caching per-image prompt metadata in memory, preloading adjacent image URLs for faster prev/next transitions, removing transform-wrapper remount churn between images, and tightening modal transition/decode behavior for snappier interaction.
- Release-readiness quality + accessibility/performance pass (v0.8.3): removed invalid nested button markup from gallery cards, added keyboard-accessible card semantics, tightened icon-button labeling and modal backdrop/dialog semantics, synced browser `color-scheme` + `theme-color` with theme mode, replaced key `transition-all` usages with targeted transitions, polished loading/status copy/ARIA live regions, cleared stale gallery ratio cache on image-window changes, stabilized related tests (including `TagsContext` async act coverage and slideshow overlay-close assertions), bumped version to 0.8.3, and refreshed `flake.nix` npmDepsHash.
- Improved gallery first-load smoothness and performance (v0.8.2): centered empty-state orb/text reliably, introduced large-initial-batch progressive gallery rendering with off-screen IntersectionObserver prefetch buffering, added short clean card entrance animation for initial render only, and faded in loaded thumbnails to reduce visible loading flashes while scrolling.
- Creative UI polish pass (v0.8.1): animated mesh gradient background, floating ambient orbs, animated nav border shimmer, gradient title text, card hover lift/glow/tilt, spinning conic-gradient border on selected cards, favorite heart burst animation, rating badge shimmer, staggered card cascade fade-in, tag chip pop animations, filter pill pulse, tool button scale/glow hover, dramatic modal entrance with blur clearing, status slide-in with spring overshoot, scrollbar gradient thumbs, slideshow Ken Burns zoom, gallery empty state with pulsing orb, and `prefers-reduced-motion` support.
- Full modern UI redesign (v0.8.0): new orange/violet palette with glassmorphism, Inter font, gradient accents; edge-to-edge gallery grid with consistent gap/padding; merged StatusBar into TopBar; modernized modals/popovers with glass panels and slide-in animations; eliminated per-card backdrop-filter for scroll performance; fixed mobile double-tap via `@media (hover: hover)`; replaced `content-visibility: auto` with `contain: layout style paint` plus fade-in placeholders; fixed `useElementSize` content-box measurement consistency; shrunk mobile toolbar to prevent overflow; matched workflows sidebar to tag drawer glass style.
- Added a full Vitest testing system with server/client configs, test setup, and npm scripts (`test`, `test:all`, targeted watch/coverage commands), plus broad coverage for core routes/services/state and major client utilities/hooks/components/workspaces; stabilized workflow workspace test routing assertions, ignored generated `coverage/` artifacts in `.gitignore`, and bumped version to 0.7.7.
- Extracted Comfy runtime/event handling into `src/server/services/createComfyRuntimeService.js`, extracted queue/resume orchestration into `src/server/services/createQueueService.js`, preserved callback-based route/runtime contracts, and bumped version to 0.7.6.
- Extracted image/file sync/delete/thumbnail responsibilities into `src/server/services/createImageService.js`, extracted workflow output/finalization/polling responsibilities into `src/server/services/createWorkflowExecutionService.js`, preserved route/runtime contracts via dependency injection, and bumped version to 0.7.5.
- Fixed DB/runtime regressions from workflow route modularization by wiring shared job-update broadcasting back into `src/server/index.js`, fixing folder reorder updates to avoid nulling folder names, tightening SQLite job-output index migration writes, and bumped version to 0.7.4.
- Refreshed the Nix npm dependency hash after the package-lock version bump.
- Fixed missing workflow route helper wiring after modularization (`isGeneratingStatus`, polling, websocket client set, and file existence checks), resolved `isGeneratingStatus is not defined` during workflow runs, and bumped version to 0.7.3.
- Refreshed the Nix npm dependency hash after the package-lock version bump.
- Fixed the workflow image input picker modal sizing so the selectable grid no longer collapses to a single column, improved initial element-size measurements in `useElementSize`, and bumped version to 0.7.2.
- Refreshed the Nix npm dependency hash after the package-lock version bump.
- Extracted server DB schema/statement setup and metadata repository operations into `src/server/db` modules, reduced `src/server/index.js` responsibilities, and bumped version to 0.7.1.
- Reorganized the repo into `src/client` + `src/server`, extracted server API routes and Comfy SDK/state modules, split workflow detail/workspace UI plus gallery/workflow page wrappers, and bumped version to 0.7.0.
- Modularized workflows UI into isolated component modules, extracted shared workflow formatting/types helpers, introduced a backend `ComfyRuntimeState` class, and bumped version to 0.6.7.
- Hardened workflow/frontend state safety (stale async guards, resilient hooks/api parsing), fixed strict TS workflow typing issues, improved server job/output idempotency and upload limits, and bumped version to 0.6.6.
- Refresh image metadata on failed optimistic updates, optimize gallery rendering for large libraries, and bump version to 0.6.5.
- Consolidated image metadata API calls into a shared client helper, centralized localStorage/media query handling via new hooks, and bumped version to 0.6.4.
- Resumed in-flight workflow job tracking after server restarts and bumped the app version to 0.6.3.
- Reset workflow detail state when switching workflows mid-run and bumped the app version to 0.6.2.
- Hid the live preview panel until frames arrive and bumped the app version to 0.6.1.
- Added overall job progress, updated the header pill to show overall %, and added live preview hints (v0.6.0).
- Refreshed the Nix npm dependency hash after the package-lock version bump.
- Refreshed the Nix npm dependency hash after the package-lock version bump.
- Marked jobs completed via ComfyUI execution events and restricted queue badges to active jobs (v0.5.20).
- Refreshed the Nix npm dependency hash after the package-lock version bump.
- Returned live progress/preview/queue metadata from the workflow jobs list API and bumped version to 0.5.19.
- Refreshed the Nix npm dependency hash after the package-lock version bump.
- Parsed ComfyUI progress values and expanded websocket debug output; bumped version to 0.5.18.
- Refreshed the Nix npm dependency hash after the package-lock version bump.
- Added ComfyUI websocket status debug endpoint and live update warning UI for workflow jobs.
- Hardened queue prompt ID extraction and bumped the app version to 0.5.17.
- Refreshed the Nix npm dependency hash after the package-lock version bump.
- Ensured the ComfyUI websocket reconnects with the server-assigned session id so progress/preview events stream correctly.
- Bumped the app version to 0.5.16 after the websocket handshake fix.
- Refreshed the Nix npm dependency hash after the package-lock version bump.
- Normalized ComfyUI websocket messages so progress and live preview frames update reliably.
- Bumped the app version to 0.5.15 after the websocket adapter fix.
- Added ComfyUI websocket preview frames, queue position tracking, system stats, and real interrupt cancels for workflow jobs.
- Refined workflow job cards with live previews, queue badges, and mobile-first progress layouts.
- Bumped the app version to 0.5.14 after adding job progress/preview enhancements.
- Refreshed the Nix npm dependency hash after the package-lock version bump.
- Added ComfyUI websocket progress updates to workflow job cards with a cleaner, mobile-friendly layout.
- Bumped the app version to 0.5.13 after the job progress UI update.
- Refreshed the Nix npm dependency hash after the package-lock version bump.
- Routed ComfyUI prompt queueing, history polling, image fetches, and uploads through the ComfyUI SDK client.
- Bumped the app version to 0.5.12 and refreshed the Nix npm dependency hash after the lockfile update.
- Added job output recheck handling for completed workflows and recorded outputs from existing files.
- Added editable default values for workflow inputs, seeded from workflow JSON and saved for run prefills.
- Added workflow job output recovery retries so completed runs restore preview thumbnails.
- Added cancel tracking for running workflow jobs with cancelled status styling.
- Kept the tag editor tool open while adding tags in the image detail modal.
- Uploaded workflow input images into a local inputs folder with hash dedupe before sending them to ComfyUI.
- Rebuilt the workflow image picker virtualization so scroll height matches the full list and sorted picker results newest-first.
- Enabled workflow input thumbnails to open in the image detail modal.
- Added virtualized rendering for the workflow image picker and switched thumbnails to contain-fit.
- Streamed ComfyUI image uploads through the proxy to avoid browser network errors.
- Fixed workflow image picker grid sizing so thumbnails no longer overlap.
- Removed the workflow image picker search/limit and ensured image inputs include filename/subfolder/type metadata in prompt payloads.
- Restored the workflow image picker modal stacking and made gallery-selected image inputs upload to ComfyUI before running.
- Improved image input previews to show local gallery selections or fallback labels.
- Fixed tag selection UI not showing all existing tags in both gallery and workflow detail views by adding a global TagsContext, removing stale memoization, and ensuring consistent tag normalization.
- Added workflow folder organization with single-level nesting and drag-and-drop reordering.
- Fixed job output race condition by syncing before broadcasting updates and adding frontend retry logic.
- Increased job polling timeout to 1 hour for large models.
- Prevented iOS Safari zoom on input focus with 16px minimum font-size on mobile.
- Changed organization mode icon from hamburger to folder-plus for clarity.
- Added save/cancel buttons to folder rename editing for clearer UX.
- Fixed folder header layout overflow and drag handle positioning on mobile.
- Replaced the two-image slideshow crossfade with a single-frame fade using preloaded images to prevent flashes.
- Pushed unloaded slideshow frames offscreen so Safari never flashes them before the fade.
- Padded slideshow crossfade frames so images no longer overlap the bottom control bar.
- Kept slideshow images hidden until fully loaded and shifted the progress bar to transform-based animation.
- Smoothed slideshow progress with CSS transitions and added preloaded crossfades between images.
- Smoothed slideshow progress updates, refreshed timing/order icons, and blocked background interaction during slideshows.
- Adjusted the slideshow settings modal styling to align with dark mode theming.
- Refined slideshow settings with ordering/timing cards, shuffle support, and a bottom control bar while removing the paused overlay.
- Bumped the app version to 0.4.1 and refreshed the Nix npm dependency hash after the lockfile update.
- Bumped the app version to 0.4.0 for the Workflows page release and refreshed npmDepsHash after the lockfile update.
- Resolved merge conflict markers in metadata files to restore valid JSON for Nix builds.
- Stored workflow output hashes to hide blacklisted outputs and removed deleted outputs from job logs immediately.
- Defaulted the workflows page to open the first available workflow and hid job output thumbnails for deleted images.
- Added a close button to the prompt metadata overlay and filtered deleted output thumbnails from workflow job logs.
- Persisted workflow prefill payloads in session storage to restore input values when navigating from the gallery.
- Simplified the prompt metadata overlay to a static centered panel and removed flip messaging.
- Improved workflow prefill matching from gallery navigation using labels/input keys and exposed input keys in prompt metadata.
- Replaced the prompt metadata popover with a centered flip-card prompt view that closes by clicking outside.
- Added a Load Workflow action on prompt metadata to jump to workflows with prefilled inputs and missing-workflow messaging.
- Stored workflow IDs/input IDs with image prompt metadata and exposed job inputs in the prompt API response.
- Kept workflow job polling active during runs and pulled newly created jobs immediately after starting.
- Disabled sticky positioning for modal bars and removed prior Safari-only safe-area tweaks.
- Removed extra modal topbar padding on Safari and hid the prompt info icon when metadata is missing.
- Enabled viewport-fit=cover and safe-area padding for the app nav to fix Safari modal spacing.
- Reduced the modal top bar offset for image detail view and added a data-dir fallback for workflow output downloads.
- Removed the extra mobile top bar offset so the gallery toolbar sits flush under the tab bar.
- Fixed the mobile gallery top bar offset so it sits below the new tab navigation.
- Added workflow job output thumbnails that open in the full image modal, plus per-output metadata loading.
- Stored workflow run inputs as JSON for the modal info panel and displayed custom input labels with system label subtitles.
- Added workflow deletion controls and enforced SQLite foreign-key cascades for workflow/job cleanup.
- Updated the Nix npm dependency hash after the package-lock version bump.
- Refreshed the Nix npm dependency hash after the latest version bump.
- Refreshed the Nix npm dependency hash after the latest lockfile update.
- Refreshed the Nix npm dependency hash after the latest version bump.
- Refreshed the Nix npm dependency hash after the latest version bump.
- Refreshed the Nix npm dependency hash after the latest version bump.
- Refreshed the Nix npm dependency hash after the latest version bump.
- Removed the redundant hamburger toggle inside the workflow drawer header.
- Added a websocket connection fallback so job polling continues when live updates drop.
- Added a debug prompt JSON preview in workflow runs and a toggleable workflow list drawer with a sleek run button.
- Added a workflow editor legend clarifying text-input (blue) and selected (orange) highlights.
- Updated workflow job cards with generating status text, live duration timers, and periodic polling fallback.
- Ensured workflow runs only overwrite configured inputs, leaving other node values intact.
- Swapped workflow edit mode to an in-place editor view with a modern toggle and sorted selected inputs to the top.
- Fixed workflow input deletions by clearing job input references to avoid foreign key errors.
- Added WebSocket job updates with generating indicators for workflow runs.
- Swapped workflow import to a right-side editor panel with an edit mode toggle for updating inputs later.
- Moved the gallery home action to the top tab bar title and removed the gallery header title/theme selector (theme now in filters).
- Updated the npm deps hash script to use an SRI-compatible placeholder hash and refreshed npmDepsHash after adding ws.
- Fixed npmDepsHash mismatch in flake.nix to resolve Nix build errors (manually updated to sha256-gGHPHrhMb744d7YID7jHWHIAQ4rZeNQyWul258Ul9bM=).
- Updated the Nix npm dependency hash again after the latest npm lockfile change.
- Updated the Nix npm dependency hash for the latest npm lockfile.
- Fixed the npm dependency hash update script to handle hash values containing slashes.
- Added `scripts/update-npm-deps-hash.sh` to refresh the Nix npm dependency hash and documented it in the workflow.
- Forced the zoom content container to fill the stage so images respect max-height constraints.
- Constrained modal images to the stage with inline sizing to avoid oversized initial renders in production.
- Forced the modal zoom wrapper to fill the stage so production builds don't lock to image dimensions.
- Expanded modal zoom debug overlay with viewport and device pixel ratio diagnostics.
- Attach modal zoom resize observers after the transform wrapper initializes for consistent prod sizing.
- Expanded the modal zoom debug overlay with viewport sizing, image completion, and render metrics.
- Added an optional modal zoom debug overlay to inspect wrapper/image sizing in production builds.
- Refit modal zoom after wrapper/image resizes to keep initial desktop zoom contained.
- Recomputed modal zoom fit from natural image sizes and let zoom content size to the image for consistent initial fit.
- Fit modal images to the viewport on load and relaxed minimum zoom to prevent cropped tall images in production builds.
- Expanded the README with Nix flake usage and detailed runtime configuration guidance.
- Added a Nix flake with a NixOS module and systemd service options for deployment.
- Restored card overlay buttons to the correct corner layout with rating in the bottom-left.
- Defaulted rating filters to Any/Any and added rating chips to gallery cards.
- Added 5-star ratings with modal and bulk controls, rating-based filters/sort, and persisted rating metadata.
- Swapped favorite icons to pink hearts and refreshed multi-select bulk actions to include rating.
- Added modal progress indicator and updated the tag drawer layout with bottom-pinned actions.
- Added a modal download button and ensured zoom/position reset on image load with a centered pop-in.
- Removed the modal filename caption, reset zoom on image change, and simplified the swipe transition.
- Kept modal action bars single-row on mobile, moved the filename to a bottom-left caption, and wired zoom buttons to the transform ref.
- Split the modal detail view into top action and bottom navigation/zoom bars with refreshed styling.
- Replaced folder navigation with tag-based organization and filtering.
- Added tag editing in the modal with create-or-select suggestions.
- Introduced tag counts in the drawer plus an untagged view shortcut.
- Updated server API and metadata storage to track tags per image.
- Bumped `package.json` version to 0.2.0 and documented the release in `CHANGELOG.md`.
- Normalized tag data on load and while building tag counts to keep tag filters populated.
- Added visible tag suggestion chips in filter and modal editors and reduced modal drag-dismiss behavior.
- Added multi-select mode with bulk tag/hide/favorite actions and selection styling.
- Batched bulk tag/hide/favorite updates to avoid metadata overwrites during multi-select actions.
- Switched metadata storage to SQLite with a JSON migration on startup.
- Added modal delete action that blacklists image hashes to prevent re-sync.
- Added bulk delete action for multi-select with blacklist-aware removal.
- Made the header title area reset filters back to all images.
