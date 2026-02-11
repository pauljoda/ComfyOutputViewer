# Installation Guide

This project supports Nix flakes and direct Node-based installs on Linux, macOS, and Windows.

## Requirements

- Node.js 20+
- npm
- Optional: ComfyUI running for workflow execution features

## Nix Install

Run directly:

```bash
nix run .#
```

Build only:

```bash
nix build .#
./result/bin/comfy-output-viewer
```

NixOS module users should also see `nix/module.nix` and `README.md`.

## Linux Install

```bash
./scripts/install-linux.sh
```

Production-only dependency install:

```bash
./scripts/install-linux.sh --production
```

What the script does:

1. Verifies Node.js and npm exist.
2. Verifies Node major version is at least 20.
3. Runs `npm install` (or `npm install --omit=dev` with `--production`).
4. Runs `npm run build`.
5. Creates `.env` from `.env.example` if missing.

## macOS Install

```bash
./scripts/install-macos.sh
```

Production-only dependency install:

```bash
./scripts/install-macos.sh --production
```

macOS installer uses the same shared Unix logic as Linux.

## Windows Install

PowerShell:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-windows.ps1
```

Production-only dependencies:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-windows.ps1 -Production
```

Alternative cmd entrypoint:

```bat
scripts\install-windows.cmd
```

What the script does:

1. Verifies Node.js and npm are available.
2. Verifies Node major version is at least 20.
3. Runs dependency install and build.
4. Creates `.env` if missing.

## Start Commands

Cross-platform startup command:

```bash
npm run start
```

The start script forces production mode and defaults to port `8008` when no port env var is set.

## Environment Setup

At minimum, configure:

- `COMFY_OUTPUT_DIR`: Your ComfyUI output directory.
- `DATA_DIR`: Writable directory for mirrored data, thumbnails, and SQLite metadata.

Use `.env.example` as your baseline.

## Optional Service Setup

### Linux (systemd user service example)

Create `~/.config/systemd/user/comfy-output-viewer.service`:

```ini
[Unit]
Description=Comfy Output Viewer
After=network.target

[Service]
Type=simple
WorkingDirectory=/path/to/ComfyOutputViewer
ExecStart=/usr/bin/npm run start
Restart=on-failure
Environment=COMFY_OUTPUT_DIR=/path/to/comfy/output
Environment=DATA_DIR=/path/to/comfy/data

[Install]
WantedBy=default.target
```

Enable and start:

```bash
systemctl --user daemon-reload
systemctl --user enable --now comfy-output-viewer
```

### macOS (launchd)

Use `launchctl` with a plist that runs `npm run start` from the repo directory and sets `COMFY_OUTPUT_DIR` / `DATA_DIR`.

### Windows (Task Scheduler)

Create a task that runs:

```powershell
npm run start
```

from the repository directory with needed environment variables.
