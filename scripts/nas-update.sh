#!/bin/sh
# Does not fetch or overwrite sources. Copy the reviewed release first.
set -eu
project_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$project_dir"
case "${1:-}" in
    lan) set -- -p slide-a-lama -f compose.yaml ;;
    https) set -- -p slide-a-lama -f compose.yaml -f compose.https.yaml ;;
    *) printf '%s\n' 'Usage: sh scripts/nas-update.sh lan|https' >&2; exit 2 ;;
esac
for required in package.json package-lock.json; do
    if [ ! -f "$required" ]; then
        printf '%s\n' "Application missing: $required. See QNAP-DEPLOYMENT.md." >&2
        exit 1
    fi
done
# mkdir is atomic, preventing two updates of this project at once.
if ! mkdir .nas-update.lock 2>/dev/null; then
    printf '%s\n' 'Another update is running, or a stale .nas-update.lock needs inspection.' >&2
    exit 1
fi
trap 'rmdir .nas-update.lock' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
docker compose "$@" config --quiet
# A failed build leaves the currently running containers untouched.
docker compose "$@" build
docker compose "$@" up -d --no-build --force-recreate --wait --wait-timeout 180
docker compose "$@" ps
