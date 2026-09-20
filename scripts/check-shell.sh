#!/usr/bin/env bash
set -euo pipefail
# shellcheck source=scripts/lib/check-common.sh
source "$(dirname -- "${BASH_SOURCE[0]}")/lib/check-common.sh"
require_command git shellcheck

shell_files=()
while IFS= read -r -d '' file; do shell_files+=("$file"); done < <(git ls-files -z -- '*.sh')
wait "$!"
((${#shell_files[@]} > 0)) || { printf 'No tracked shell scripts found\n' >&2; exit 1; }

log 'Shell syntax'
for file in "${shell_files[@]}"; do bash -n "$file"; done
log ShellCheck
shellcheck --severity=warning "${shell_files[@]}"
