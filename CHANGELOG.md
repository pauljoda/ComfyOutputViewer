# Changelog

All notable changes to this project will be documented in this file.

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
