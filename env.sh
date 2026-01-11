#!/bin/bash

: "${SCRIPT_PATH:=${BASH_SOURCE[0]}}"
: "${SCRIPT_DIR:=$(cd "$(dirname "$SCRIPT_PATH")" && pwd)}"

: "${DEBUG:=0}"
: "${NO_COLOR:=0}"
: "${NON_INTERACTIVE:=0}"
: "${STRICT_MODE:=1}"

: "${OS_NAME:=$(uname -s)}"
: "${OS_ARCH:=$(uname -m)}"

: "${IS_ROOT:=$(( EUID == 0 ? 1 : 0 ))}"

