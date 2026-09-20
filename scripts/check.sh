#!/usr/bin/env bash
set -euo pipefail
# shellcheck source=scripts/lib/check-common.sh
source "$(dirname -- "${BASH_SOURCE[0]}")/lib/check-common.sh"
for check in shell python frontend; do
    bash "$ROOT_DIR/scripts/check-$check.sh"
done
