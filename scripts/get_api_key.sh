#!/bin/bash
LENGTH=${1:-32}
RANDOM_PART=$(tr -dc 'a-km-np-zA-NP-Z2-9' < /dev/urandom | head -c "$LENGTH")
echo "sk-${RANDOM_PART}"
# get_api_key.sh 48