#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
flake_file="$root_dir/flake.nix"

if ! rg -q "npmDepsHash" "$flake_file"; then
  echo "error: npmDepsHash not found in $flake_file" >&2
  exit 1
fi

original_expr="$(sed -n 's/.*npmDepsHash = \(.*\);/\1/p' "$flake_file" | head -n1)"
if [[ -z "$original_expr" ]]; then
  echo "error: failed to parse npmDepsHash from $flake_file" >&2
  exit 1
fi

restore_expr="$original_expr"
restore_hash() {
  if [[ -n "${restore_expr:-}" ]]; then
    perl -0pi -e "s~npmDepsHash = .*?;~npmDepsHash = ${restore_expr};~s" "$flake_file"
  fi
}
trap restore_hash EXIT

perl -0pi -e 's~npmDepsHash = .*?;~npmDepsHash = lib.fakeSha256;~s' "$flake_file"

echo "computing npmDepsHash via nix build..."
if output=$(nix build .#comfy-output-viewer --no-link 2>&1); then
  echo "error: build succeeded; expected hash mismatch. No changes applied." >&2
  exit 1
fi

got_hash=$(printf '%s' "$output" | rg -o 'got:[[:space:]]*sha256-[A-Za-z0-9+/=]+' | head -n1 | sed 's/got:[[:space:]]*//')
if [[ -z "$got_hash" ]]; then
  echo "error: could not parse hash from nix output" >&2
  printf '%s\n' "$output" >&2
  exit 1
fi

perl -0pi -e "s~npmDepsHash = .*?;~npmDepsHash = \"$got_hash\";~s" "$flake_file"
restore_expr=""

echo "updated npmDepsHash to $got_hash"
