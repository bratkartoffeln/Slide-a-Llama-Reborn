#!/bin/sh
set -eu
token_file=/run/secrets/dynv6_api_token
if [ ! -r "$token_file" ]; then
    printf '%s\n' 'Slide-a-Lama: dynv6 secret missing or unreadable.' >&2
    exit 1
fi
DYNV6_API_TOKEN=$(tr -d '\r' < "$token_file")
case "$DYNV6_API_TOKEN" in
    ''|*[[:space:]]*)
        printf '%s\n' 'Slide-a-Lama: token must be one nonempty value without whitespace.' >&2
        exit 1 ;;
esac
case "${SLIDE_DOMAIN:-}" in
    ''|*[!a-zA-Z0-9.-]*|.*|*.|*..*|flusensieb.dns.navy|*.invalid)
        printf '%s\n' 'Slide-a-Lama: configure a separate valid hostname, without scheme or port.' >&2
        exit 1 ;;
esac
export DYNV6_API_TOKEN
exec "$@"
