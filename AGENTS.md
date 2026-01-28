# Codex Agent Guide: Comfy Output Viewer

This file describes the application, architecture, and expected workflow for Codex
while working in this repository.

## App Overview

Comfy Output Viewer is a local-first image browser for ComfyUI output folders.
It mirrors images from a configured source directory into a data directory,
generates thumbnails, and provides a modern web UI for browsing, filtering,
and managing images.

### Key User Flows
- Browse images in a grid, newest-first.
- Navigate folders via a left drawer (Home = root).
- Toggle favorites and hidden states.
- Hide hidden items on the Home feed only.
- Open a modal viewer with zoom/pan controls and toolbar actions.
- Move images between folders.

## Architecture

### Server (Node/Express)
Entry: `server/index.js`

Responsibilities:
- Serve the SPA in production.
- Serve image files from the data directory at `/images`.
- Provide API endpoints for listing images, syncing, favorites, hidden state,
  folder creation, and moving images.
- Maintain a small JSON DB for metadata (favorites/hidden).
- Generate thumbnails (if `sharp` is available).

Important paths/config:
- `COMFY_OUTPUT_DIR` or `OUTPUT_DIR`: source folder to sync from.
- `DATA_DIR`: local data folder for images, thumbnails, and DB.
- Thumbnails are stored in `.thumbs` under the data dir.
- DB stored at `.comfy_viewer.json`.

API endpoints:
- `GET /api/images` -> `{ images, folders, sourceDir, dataDir }`
- `POST /api/favorite` -> `{ path, value }`
- `POST /api/hidden` -> `{ path, value }`
- `POST /api/folders` -> `{ path }`
- `POST /api/move` -> `{ path, targetFolder }`
- `POST /api/sync` -> `{ scanned, copied, thumbnails? }`

### Client (Vite + React)
Entry: `src/App.tsx`

Key UI features:
- Top toolbar with icon buttons and a single active tool popover.
- Drawer navigation for folders (Home == root).
- Image grid:
  - "Cover" mode: fixed square tiles with object-fit cover.
  - "Content" mode: tile size becomes the smaller dimension, width/height scaled
    by natural image ratio, tiled via flex-wrap.
- Favorites and hidden toggles on cards and modal toolbar.
- Hide hidden items on Home only; folder views show all.
- Zoom/pan modal for selected image.

Key client behaviors:
- LocalStorage persists theme, columns per row, display mode,
  and hide-hidden flag.
- Hidden/favorite updates are optimistic, then persisted via API.

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

- Limited the columns slider maximum based on available width to avoid overly small tiles.
- Moved grid filenames into a single-line footer in the modal view.
- Bumped `package.json` version to 0.1.3 and documented the release in `CHANGELOG.md`.
