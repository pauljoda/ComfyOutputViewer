#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root_dir"

usage() {
  cat <<'EOF'
Usage: scripts/install-unix.sh [--production]

Options:
  --production   Install production dependencies only.
  --help         Show this help message.
EOF
}

production_only=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --production)
      production_only=1
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "error: unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if ! command -v node >/dev/null 2>&1; then
  echo "error: node is required but not found in PATH" >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "error: npm is required but not found in PATH" >&2
  exit 1
fi

node_major="$(node -p "process.versions.node.split('.')[0]")"
if [[ "$node_major" -lt 20 ]]; then
  echo "error: Node.js 20+ is required (found $(node -v))" >&2
  exit 1
fi

echo "Installing dependencies..."
if [[ "$production_only" -eq 1 ]]; then
  npm install --omit=dev
else
  npm install
fi

echo "Building web client..."
npm run build

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Created .env from .env.example"
fi

cat <<'EOF'

Install complete.

Start the app:
  npm run start

Default URL:
  http://localhost:8008
EOF
