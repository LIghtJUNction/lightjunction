#!/bin/bash
# basic.sh - Core import() function and hook system
# Usage: source basic.sh
#
# import() - Download and source a script from GitHub
#   import env.sh                         → env.sh (root level)
#   import lib/str.sh                    → lib/str.sh (lib directory)
#   import file.sh [branch] [repo] [user]
#
#   Default: branch=main, repo=lightjunction, user=lightjunction
#
# hook() - Wrap an existing function (AOP-style around advice)
#   hook funcname <<'EOF'
#   local self=self_funcname
#   ... new body ...
#   self "$@"
#   EOF

# Track imported files (url -> 1)
declare -gA __IMPORTED_FILES
__IMPORTED_FILES=()

# -- Core import function --
import() {
    local file="${1:?}" branch="${2:-main}" repo="${3:-lightjunction}" user="${4:-lightjunction}"
    local base_url="${5:-https://raw.githubusercontent.com}"
    local url="$base_url/$user/$repo/$branch/$file"

    # Skip if already imported (by URL)
    [[ "${__IMPORTED_FILES[$url]:-}" == "1" ]] && return 0
    __IMPORTED_FILES[$url]=1

    # Download to temp file and source
    local tmpfile
    tmpfile=$(mktemp) || return 1
    curl -fsSL --connect-timeout 10 "$url" -o "$tmpfile" 2>/dev/null || {
        rm -f "$tmpfile"
        echo "import: failed to download $url" >&2
        return 1
    }
    source "$tmpfile"
    rm -f "$tmpfile"
}

# -- Hook system (AOP-style function wrapping) --
# Usage: hook myfunc <<'EOF'
#   local self=self_myfunc
#   ... new body with self "$@" to call original ...
# EOF
hook() {
    local func_decl="${1:?}"
    local func_name="${func_decl%%::*}"  # Support both "func()" and "func::" syntax
    func_name="${func_name%%()}"         # Strip "()"

    if ! declare -f "$func_name" >/dev/null 2>&1; then
        echo "hook: function '$func_name' not found" >&2
        return 1
    fi

    # Save original function as self_<name>
    if ! declare -f "self_$func_name" >/dev/null 2>&1; then
        eval "self_$func_name() { $func_name \"\$@\"; }"
    fi

    # Read new body from stdin
    local body
    body=$(cat)

    # Replace function with wrapped version
    eval "$func_name() {
        local self=self_$func_name
$body
    }"
}
