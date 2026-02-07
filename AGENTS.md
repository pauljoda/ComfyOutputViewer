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
Entry: `server/index.js`

Responsibilities:
- Serve the SPA in production.
- Serve image files from the data directory at `/images`.
- Provide API endpoints for listing images, syncing, favorites, hidden state,
  and per-image tags.
- Maintain a SQLite DB for metadata (favorites/hidden/tags) and hash blacklisting.
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
- `GET /api/jobs/:id` -> get job status and outputs
- `GET /api/images/:path/prompt` -> get prompt metadata for an image

### Client (Vite + React)
Entry: `src/main.tsx` (React Router setup), `src/App.tsx` (layout shell)
Pages: `src/pages/GalleryPage.tsx`, `src/pages/WorkflowsPage.tsx`
Component modules live in `src/components`, with shared hooks/utilities in `src/hooks`, `src/utils`, and `src/lib`.

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

Styles: `src/styles.css`

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

If a request is purely informational and makes no changes, do not commit.

## Current Projects

- Maintain living documentation, semantic versioning, and changelog discipline.
- Workflows feature: Add WebSocket relay for real-time job status updates (pending).

## Recent Changes
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
