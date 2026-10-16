#!/bin/sh
# Run interactively on the NAS. No token is written to the project folder.
set -eu
state=/share/Container/slide-a-llama/.slide-updater
umask 077
mkdir -p "$state"
chmod 700 "$state"
temp_file=''
terminal_state=''
cleanup() {
    if [ -n "$terminal_state" ]; then stty "$terminal_state" < /dev/tty 2>/dev/null || :; fi
    if [ -n "$temp_file" ]; then rm -f "$temp_file"; fi
}
trap cleanup 0
trap 'exit 130' 2
trap 'exit 143' 15
if ( printf '\n' | ( IFS= read -r -s -p '' probe ) ) 2>/dev/null; then
    IFS= read -r -s -p 'GitHub token for Slide-a-Llama (hidden): ' token < /dev/tty 2> /dev/tty
elif command -v stty >/dev/null 2>&1; then
    terminal_state=$(stty -g < /dev/tty)
    stty -echo < /dev/tty
    printf '%s' 'GitHub token for Slide-a-Llama (hidden): ' > /dev/tty
    IFS= read -r token < /dev/tty
    stty "$terminal_state" < /dev/tty
    terminal_state=''
else
    echo 'Hidden input unavailable in this shell.' >&2
    exit 1
fi
printf '\n' > /dev/tty
case "$token" in ''|*[![:graph:]]*) echo 'Token must be one value without whitespace.' >&2;exit 1;; esac
temp_file=$(mktemp "$state/.github-token.XXXXXX")
printf '%s\n' "$token" > "$temp_file"
unset token
chmod 600 "$temp_file"
mv -f "$temp_file" "$state/github-deploy.token"
temp_file=''
echo 'GitHub token stored outside the project. The updater reads it at its next poll.'
