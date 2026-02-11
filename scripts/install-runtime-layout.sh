#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 4 ]]; then
  echo "usage: scripts/install-runtime-layout.sh <app-dir> <node-bin> <wrapper-path> <runtime-shell>" >&2
  exit 1
fi

app_dir="$1"
node_bin="$2"
wrapper_path="$3"
runtime_shell="$4"

mkdir -p "$app_dir"
cp -r dist src package.json node_modules "$app_dir/"
mkdir -p "$(dirname "$wrapper_path")"

cat > "$wrapper_path" <<EOF
#!$runtime_shell
set -eu
cd "$app_dir"
if [ -n "\${NODE_PATH-}" ]; then
  export NODE_PATH="$app_dir/node_modules:\$NODE_PATH"
else
  export NODE_PATH="$app_dir/node_modules"
fi
exec "$node_bin" "$app_dir/src/server/index.js" "\$@"
EOF

chmod +x "$wrapper_path"
