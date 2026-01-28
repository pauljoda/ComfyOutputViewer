# Comfy Output Viewer

A simple local-only React + TypeScript gallery for ComfyUI outputs. It copies images from a read-only output folder into a local working directory where you can favorite and organize them.

## Requirements
- Node.js 20+
- npm (or another Node package manager)

## Setup
```bash
npm install
```

Optionally create a `.env` file based on `.env.example`.

## Development
```bash
npm run dev
```
- Frontend: http://localhost:8008
- API server: http://localhost:8009

## Production
```bash
npm run build
npm run start
```
Runs the API + static UI on http://localhost:8008.

## Notes
- Source directory (read-only) defaults to `/var/lib/comfyui/output`.
- Working data directory defaults to `~/comfy_viewer/data` and stores favorites/folders.
- Use the **Sync** button to copy new/updated images from the source.
- Optional auto-sync: set `SYNC_INTERVAL_MS` (for example `60000` for 1 minute).
- Thumbnails are generated on sync (configurable with `THUMB_MAX` and `THUMB_QUALITY`).
