#!/usr/bin/env bash
LENGTH=${1:-48}
if ! [[ "$LENGTH" =~ ^[1-9][0-9]*$ ]]; then
  echo "Usage: $0 [positive_length]" >&2
  exit 1
fi
RANDOM_PART=$(tr -dc 'a-km-np-zA-NP-Z2-9' < /dev/urandom 2>/dev/null | head -c "$LENGTH")
printf 'sk-%s\n' "$RANDOM_PART"
