# Comfy Output Viewer

A simple local-only React + TypeScript gallery for ComfyUI outputs. It copies images from a read-only output folder into a local working directory where you can favorite and organize them.

## Requirements
- Node.js 20+
- npm (or another Node package manager)

## Usage
1) Install dependencies:
```bash
npm install
```
2) (Optional) Create a `.env` file based on `.env.example`.
3) Run the dev servers (Vite + API):
```bash
npm run dev
```
- Frontend: http://localhost:8008
- API server: http://localhost:8009

### Configuration
The server reads configuration from environment variables:
- `COMFY_OUTPUT_DIR` or `OUTPUT_DIR`: source folder to sync from. Default: `/var/lib/comfyui/output`.
- `DATA_DIR`: local data folder for images, thumbnails, and metadata. Default: `~/comfy_viewer/data`.
- `SERVER_PORT` or `PORT`: server port. Default: `8009` in dev, `8008` in production.
- `SYNC_INTERVAL_MS`: auto-sync interval in milliseconds (disabled when unset or `0`).
- `THUMB_MAX`: maximum thumbnail dimension. Default: `512`.
- `THUMB_QUALITY`: JPEG quality for thumbnails. Default: `72`.

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

## Nix (flake)
This repo ships a flake with a package and NixOS module.

Build or run locally:
```bash
nix build .#
./result/bin/comfy-output-viewer
```

```bash
nix run .#
```

## NixOS
Example `configuration.nix` using the overlay + module:
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
    # syncIntervalMs = 60000;
    # thumbMax = 512;
    # thumbQuality = 72;
  };
}
```

Service options:
- `enable`: start the server on boot.
- `openFirewall`: open the configured port in the firewall.
- `outputDir`: source directory for ComfyUI outputs.
- `dataDir`: writable data directory for images, thumbnails, and metadata.
- `port`: HTTP port (default 8008).
- `syncIntervalMs`: optional auto-sync interval in ms (null disables).
- `thumbMax` and `thumbQuality`: thumbnail settings.
- `user`, `group`, `createUser`: control the system user/group used by the service.
- `extraEnvironment`: extra environment variables for the service.

## Notes
- Source directory (read-only) defaults to `/var/lib/comfyui/output`.
- Working data directory defaults to `~/comfy_viewer/data` and stores favorites/folders.
- Use the **Sync** button to copy new/updated images from the source.
- Optional auto-sync: set `SYNC_INTERVAL_MS` (for example `60000` for 1 minute).
- Thumbnails are generated on sync (configurable with `THUMB_MAX` and `THUMB_QUALITY`).
