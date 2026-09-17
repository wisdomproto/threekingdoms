#!/bin/sh
set -eu
if [ "${TK_STUDIO_ENABLED:-}" = "1" ] && [ -z "${TK_STUDIO_PASSWORD:-}" ]; then
  echo "TK_STUDIO_PASSWORD is required when Studio is enabled." >&2
  exit 1
fi
mkdir -p "$TK_STUDIO_DATA_DIR" "$TK_STUDIO_ASSET_DIR"
# Populate missing packaged assets, preserving all existing user edits.
cp -an /app/apps/web/public/assets/. "$TK_STUDIO_ASSET_DIR/"
cd /app/apps/web
exec node node_modules/next/dist/bin/next start --hostname 0.0.0.0 --port "${PORT:-3000}"
