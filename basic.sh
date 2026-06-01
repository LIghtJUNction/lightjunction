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

# Track imported files (indexed URL list for Bash 3.2 compatibility)
__IMPORTED_FILES=()

# Verify downloaded file content against expected SHA256
# Usage: verify_sha256 <file_path> <expected_sha256>
verify_sha256() {
    local file="${1:?}" expected="${2:?}"
    local actual
    actual=$(openssl dgst -sha256 "$file" | awk '{print $2}')
    if [[ "$actual" != "$expected" ]]; then
        echo "import: SHA256 mismatch for $file" >&2
        echo "  expected: $expected" >&2
        echo "  actual:   $actual" >&2
        rm -f "$file"
        return 1
    fi
}

# -- Core import function --
import() {
    local file="${1:?}" branch="${2:-main}" repo="${3:-lightjunction}" user="${4:-lightjunction}"
    local base_url="${5:-https://raw.githubusercontent.com}"
    local sha256="${6:-}" url="$base_url/$user/$repo/$branch/$file"

    # Skip if already imported (by URL)
    local imported
    for imported in "${__IMPORTED_FILES[@]}"; do
        [[ "$imported" == "$url" ]] && return 0
    done
    __IMPORTED_FILES+=("$url")

    # Download to temp file and source
    local tmpfile
    tmpfile=$(mktemp) || return 1
    curl -fsSL --connect-timeout 10 "$url" -o "$tmpfile" 2>/dev/null || {
        rm -f "$tmpfile"
        echo "import: failed to download $url" >&2
        return 1
    }

    # Verify SHA256 if provided
    if [[ -n "$sha256" ]]; then
        verify_sha256 "$tmpfile" "$sha256" || return 1
    fi

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
