# Changelog

All notable changes to this project will be documented in this file.

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
