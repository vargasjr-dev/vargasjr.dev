#!/usr/bin/env bash
set -euo pipefail
repo_root="$(cd "$(dirname "$0")/../.." && pwd)"
build_dir="$(mktemp -d)"
trap 'rm -rf "$build_dir"' EXIT
git -C "$build_dir" init -q
git -C "$build_dir" remote add origin https://github.com/vargasjr-dev/mycadet-temp.git
git -C "$build_dir" fetch --depth 1 origin b434b2445fa070b4ac85e73230e25a4fd655425d
git -C "$build_dir" checkout --detach FETCH_HEAD
git -C "$build_dir" apply "$repo_root/scripts/cadet-app/embedded.patch"
cd "$build_dir"
bun install --frozen-lockfile --ignore-scripts --filter @mycadet/app
cd clients/app
bun --bun node_modules/vite/bin/vite.js build --config vite.embedded.config.ts
node "$repo_root/scripts/cadet-app/package.mjs" "$PWD/dist/embedded"
npm pack "$PWD/dist/embedded" --pack-destination "$repo_root/vendor"

mkdir -p "$repo_root/public/cadet-dev"
cp dist/embedded/app.css "$repo_root/public/cadet-dev/app.css"
