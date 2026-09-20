#!/usr/bin/env bash
set -euo pipefail
# shellcheck source=scripts/lib/check-common.sh
source "$(dirname -- "${BASH_SOURCE[0]}")/lib/check-common.sh"
require_command npm
log 'Frontend typecheck + interaction tests + build'
npm run check
