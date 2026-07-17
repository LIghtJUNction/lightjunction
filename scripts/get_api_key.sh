#!/usr/bin/env bash
set -euo pipefail

LENGTH=${1:-48}
if ! [[ "$LENGTH" =~ ^[1-9][0-9]*$ ]]; then
  echo "Usage: $0 [positive_length]" >&2
  exit 1
fi
RANDOM_PART=""
while ((${#RANDOM_PART} < LENGTH)); do
  CHUNK=$(openssl rand -base64 "$((LENGTH + 16))" | LC_ALL=C tr -cd 'a-km-np-zA-NP-Z2-9')
  RANDOM_PART+="$CHUNK"
done
RANDOM_PART=${RANDOM_PART:0:LENGTH}
printf 'sk-%s\n' "$RANDOM_PART"
