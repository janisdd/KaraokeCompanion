#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
target="${1:-$root}"

echo "Target directory: $target"
read -r -p "Is this the correct root directory? [y/N] " confirm
case "$confirm" in
  [yY]|[yY][eE][sS]) ;;
  *)
    echo "Aborted."
    exit 1
    ;;
esac

find "$target" \
  \( -path '*/node_modules' -o -path '*/storage_dir' -o -path '*/.*' \) -prune \
  -o -type f ! \( \
    -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' -o -iname '*.gif' \
    -o -iname '*.webp' -o -iname '*.svg' -o -iname '*.ico' -o -iname '*.bmp' \
    -o -iname '*.tif' -o -iname '*.tiff' -o -iname '*.avif' -o -iname '*.heic' \
    -o -iname '*.heif' \
  \) -print0 \
  | xargs -0 wc -l
