# Changelog

All notable changes to this project will be documented in this file.

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
