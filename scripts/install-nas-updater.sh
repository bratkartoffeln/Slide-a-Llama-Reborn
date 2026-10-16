#!/bin/sh
set -eu
umask 077
base=/share/Container/slide-a-llama
app="$base/app"
state="$base/.slide-updater"
export PATH=/share/CACHEDEV1_DATA/.qpkg/container-station/usr/bin:/share/CACHEDEV1_DATA/.qpkg/container-station/bin:$PATH
export DOCKER_HOST=unix:///var/run/docker.sock
export DOCKER_CONFIG="${HOME}/.docker"
compose=/share/CACHEDEV1_DATA/.qpkg/container-station/usr/local/lib/docker/cli-plugins/docker-compose
source_dir=$(CDPATH= cd -- "$(dirname -- "$0")/../deploy/nas-updater" && pwd)
test -f "$app/compose.yaml"
mkdir -p "$state/runtime"
chmod 700 "$state"
for name in Dockerfile .dockerignore core.mjs main.mjs core.test.mjs compose.updater.yaml; do
    cp "$source_dir/$name" "$state/runtime/$name"
done
docker build -t slide-a-llama-updater:1 "$state/runtime"
"$compose" -p slide-a-llama-updater -f "$state/runtime/compose.updater.yaml" config --quiet
"$compose" -p slide-a-llama-updater -f "$state/runtime/compose.updater.yaml" up -d --no-build --wait --wait-timeout 60 updater
echo 'Slide updater installed. The first poll records main as baseline; it does not replace the current game.'
