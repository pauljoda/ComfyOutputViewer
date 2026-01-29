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

## Architecture

### Server (Node/Express)
Entry: `server/index.js`

Responsibilities:
- Serve the SPA in production.
- Serve image files from the data directory at `/images`.
- Provide API endpoints for listing images, syncing, favorites, hidden state,
  and per-image tags.
- Maintain a small JSON DB for metadata (favorites/hidden/tags).
- Generate thumbnails (if `sharp` is available).

Important paths/config:
- `COMFY_OUTPUT_DIR` or `OUTPUT_DIR`: source folder to sync from.
- `DATA_DIR`: local data folder for images, thumbnails, and DB.
- Thumbnails are stored in `.thumbs` under the data dir.
- DB stored at `.comfy_viewer.json`.

API endpoints:
- `GET /api/images` -> `{ images, sourceDir, dataDir }`
- `POST /api/favorite` -> `{ path, value }`
- `POST /api/hidden` -> `{ path, value }`
- `POST /api/tags` -> `{ path, tags }`
- `POST /api/sync` -> `{ scanned, copied, thumbnails? }`

### Client (Vite + React)
Entry: `src/App.tsx`
Component modules live in `src/components`, with shared hooks/utilities in `src/hooks`, `src/utils`, and `src/lib`.

Key UI features:
- Top toolbar with icon buttons and a single active tool popover.
- Drawer navigation for tag filters sorted by image count, plus an untagged view.
- Image grid:
  - "Cover" mode: fixed square tiles with object-fit cover.
  - "Content" mode: tile size becomes the smaller dimension, width/height scaled
    by natural image ratio, tiled via flex-wrap.
- Favorites and hidden toggles on cards and modal toolbar.
- Hide hidden items on All Images only; tag filters show hidden items.
- Zoom/pan modal for selected image.
- Modal tag editor with add/remove controls.

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
2) Update this `AGENTS.md` with all changes and current projects.
3) Add needed files to git, add non-needed files to `.gitignore`, and create a detailed commit.

If a request is purely informational and makes no changes, do not commit.

## Current Projects

- Maintain living documentation, semantic versioning, and changelog discipline.

## Recent Changes

- Replaced folder navigation with tag-based organization and filtering.
- Added tag editing in the modal with create-or-select suggestions.
- Introduced tag counts in the drawer plus an untagged view shortcut.
- Updated server API and metadata storage to track tags per image.
- Bumped `package.json` version to 0.2.0 and documented the release in `CHANGELOG.md`.
- Normalized tag data on load and while building tag counts to keep tag filters populated.
- Added visible tag suggestion chips in filter and modal editors and reduced modal drag-dismiss behavior.
