# Comfy Output Viewer

<p align="center">
  <img src="logo.png" alt="Comfy Output Viewer logo" width="120" />
</p>

<p align="left">
  <a href="https://nodejs.org/"><img alt="Node 20+" src="https://img.shields.io/badge/Node-20%2B-5FA04E?logo=node.js&logoColor=white"></a>
  <a href="./flake.nix"><img alt="Nix Flake" src="https://img.shields.io/badge/Nix-Flake-5277C3?logo=nixos&logoColor=white"></a>
  <a href="./CHANGELOG.md"><img alt="Changelog" src="https://img.shields.io/badge/Changelog-Keep%20a%20Changelog-F08D49"></a>
  <a href="./LICENSE"><img alt="License MIT" src="https://img.shields.io/badge/License-MIT-2EA043"></a>
</p>

A local-first gallery and workflow runner for ComfyUI outputs.

- Browse, rate, tag, favorite, hide, and bulk-manage large image libraries.
- Import ComfyUI API JSON workflows and run them from the browser.
- Track jobs with live status/progress and attach outputs back into the gallery.
- Expose workflows through HTTP trigger and MCP tools for AI agents.

<p>
  <img src="screenshots/screenshot1.png" alt="Gallery view" width="49%" />
  <img src="screenshots/screenshot2.png" alt="Workflow view" width="49%" />
</p>

## Table of Contents

- [Highlights](#highlights)
- [Architecture](#architecture)
- [Install](#install)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [API Reference](#api-reference)
- [Development](#development)
- [Testing](#testing)
- [Release Workflow](#release-workflow)
- [Troubleshooting](#troubleshooting)
- [License](#license)

## Highlights

### Gallery

- Sync from a read-only ComfyUI output source into an independent managed data directory.
- Tag system with drawer navigation, single-select drawer behavior, and multi-tag filter tools.
- Favorites, hidden state, ratings (0-5), and bulk actions.
- Bulk auto-tag from prompt metadata with review-and-edit modal before apply.
- Fast thumbnail browsing with detail modal zoom/pan and mobile-friendly navigation.
- Slideshow mode based on current filters/sort.

### Workflows

- Import API-format ComfyUI workflow JSON and select editable inputs.
- Run workflows with text/number/seed/image inputs.
- Job history with queued/running/completed/error/cancelled states.
- Output previews linked to synced gallery images.
- Workflow organization with folders and reorder controls.

### Integrations

- External workflow trigger API (`/api/workflows/:id/trigger`) with trigger schema endpoint.
- MCP server support at `/mcp` (Streamable HTTP) plus legacy SSE endpoints.
- MCP tools: `list_workflows`, `run_workflow`, `get_job_status`.

## Architecture

- **Frontend**: React 18 + TypeScript + Vite (`src/client`)
- **Backend**: Express + ws (`src/server`)
- **Metadata**: SQLite via Node built-in `node:sqlite`
- **Image pipeline**: sync/mirror, thumbnails (`sharp` when available), and blacklist-aware delete

Key files:

- `src/server/index.js`: app bootstrap + route wiring
- `src/server/routes/*`: API route modules
- `src/server/services/*`: image/comfy runtime/queue/workflow execution services
- `src/server/db/*`: schema + metadata repository
- `src/client/pages/GalleryPage.tsx`
- `src/client/pages/WorkflowsPage.tsx`

## Install

Detailed platform docs: [`docs/INSTALL.md`](docs/INSTALL.md)

### Option 1: Nix (flake)

```bash
nix run .#
```

Or build binary:

```bash
nix build .#
./result/bin/comfy-output-viewer
```

NixOS module usage:

```nix
{
  nixpkgs.overlays = [ inputs.comfy-output-viewer.overlays.default ];
  imports = [ inputs.comfy-output-viewer.nixosModules.default ];

  services.comfy-output-viewer = {
    enable = true;
    openFirewall = true;
    outputDir = "/var/lib/comfyui/output";
    dataDir = "/var/lib/comfy-output-viewer";
    port = 8008;
  };
}
```

### Option 2: Linux/macOS script

Linux:

```bash
./scripts/install-linux.sh
```

macOS:

```bash
./scripts/install-macos.sh
```

Shared Unix installer (both):

```bash
./scripts/install-unix.sh
```

### Option 3: Windows script

PowerShell:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-windows.ps1
```

Or cmd wrapper:

```bat
scripts\install-windows.cmd
```

### Option 4: Manual Node install

```bash
npm install
npm run build
npm run start
```

## Quick Start

1. Create `.env` (optional):

```bash
cp .env.example .env
```

2. Set at least:
- `COMFY_OUTPUT_DIR` to your ComfyUI output folder.
- `DATA_DIR` to a writable folder for mirrored data and SQLite.

3. Start server/UI:

```bash
npm run start
```

4. Open `http://localhost:8008` and click **Sync**.

### Mock Sandbox Mode

For deterministic demos/screenshots with seeded image/workflow/job states:

```bash
npm run dev:mock
```

This seeds `.mock-dev/source` + `.mock-dev/data` and runs with `MOCK_DEV_MODE=1`.

## Configuration

Configure via environment variables or `.env`:

| Variable | Default | Description |
|---|---|---|
| `COMFY_OUTPUT_DIR` | `/var/lib/comfyui/output` | Source directory to scan (read-only by app design). |
| `OUTPUT_DIR` | n/a | Legacy alias for `COMFY_OUTPUT_DIR`. |
| `DATA_DIR` | `~/comfy_viewer/data` | App-managed mirror, thumbnails, sqlite db, and workflow files. |
| `COMFY_API_URL` | `http://127.0.0.1:8188` | ComfyUI API base URL. |
| `COMFY_CLIENT_ID` | auto-generated | Optional ComfyUI websocket client id override. |
| `SERVER_PORT` | `8008` in prod / `8009` in dev | Preferred server port variable. |
| `PORT` | fallback | Legacy port fallback. |
| `SYNC_INTERVAL_MS` | `0` | Auto-sync interval in ms (`0` disables). |
| `THUMB_MAX` | `512` | Max thumbnail dimension. |
| `THUMB_QUALITY` | `72` | JPEG thumbnail quality (0-100). |
| `MAX_INPUT_UPLOAD_BYTES` | `52428800` | Max workflow image upload payload size. |
| `QUEUE_REMAINING_OVERRIDE_TTL_MS` | `10000` | Queue override cache TTL. |
| `MOCK_DEV_ROOT` | `.mock-dev` | Seed root used by `npm run mock:seed`. |
| `MOCK_DEV_MODE` | `0` | Enables stable mock job payload behavior for demos. |

## API Reference

### Image + metadata endpoints

- `GET /api/images`
- `POST /api/favorite`
- `POST /api/hidden`
- `POST /api/tags`
- `POST /api/delete`
- `POST /api/delete/bulk`
- `POST /api/prompts/bulk`
- `POST /api/sync`
- `GET /api/images/:path/prompt`

### Workflow + jobs endpoints

- `GET /api/workflows`
- `POST /api/workflows`
- `GET /api/workflows/:id`
- `PUT /api/workflows/:id`
- `DELETE /api/workflows/:id`
- `POST /api/workflows/:id/run`
- `GET /api/workflows/:id/trigger-schema`
- `POST /api/workflows/:id/trigger`
- `GET /api/jobs/:id`
- `POST /api/jobs/:id/cancel`

### MCP endpoints

- `POST /mcp`
- `GET /mcp`
- `DELETE /mcp`
- `GET /mcp/sse` (legacy)
- `POST /mcp/messages` (legacy)

## Development

```bash
npm run dev
```

Useful scripts:

```bash
npm run mock:seed
npm run dev:mock
npm run build
npm run preview
npm run start
```

Install helper scripts:

```bash
npm run install:unix
npm run install:linux
npm run install:macos
npm run install:windows
```

## Testing

```bash
npm run test
npm run test:all
npm run test:server
npm run test:client
npm run test:coverage
```

Watch mode:

```bash
npm run test:server:watch
npm run test:client:watch
```

## Release Workflow

1. Update `package.json` version (semver).
2. Update `CHANGELOG.md` entry for the same version.
3. If `package-lock.json` changed, refresh Nix npm hash:

```bash
./scripts/update-npm-deps-hash.sh
```

4. Verify:

```bash
npm run build
npm run test
nix build .#comfy-output-viewer --no-link
```

## Troubleshooting

- If startup fails with missing source dir, verify `COMFY_OUTPUT_DIR` exists and permissions allow read access.
- If thumbnails are slow, ensure `sharp` can load native deps (notably `libvips` on Linux).
- If Comfy job updates stall, verify `COMFY_API_URL` and websocket accessibility.
- If deleted images reappear, verify deletion used app APIs so hashes enter blacklist metadata.

## License

MIT
