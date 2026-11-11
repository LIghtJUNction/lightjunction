#!/bin/sh
# Install an official, checksum-verified lightjunction release without administrator access.
set -eu
umask 077

fail() { printf 'lightjunction installer: %s\n' "$*" >&2; exit 1; }
usage() {
    cat <<'EOF'
Usage: sh install.sh [--version MAJOR.MINOR.PATCH] [--install-dir DIRECTORY]

Defaults: latest stable cli-v release, installed in $HOME/.local/bin.
LIGHTJUNCTION_VERSION and LIGHTJUNCTION_INSTALL_DIR supply optional defaults.
Existing regular binaries are upgraded atomically; shell profiles are not changed.
Requires curl, tar, and sha256sum or shasum.
EOF
}

version=${LIGHTJUNCTION_VERSION:-}
install_dir=${LIGHTJUNCTION_INSTALL_DIR:-}
while [ "$#" -gt 0 ]; do
    case "$1" in
        --version)
            [ "$#" -ge 2 ] && [ -n "$2" ] || fail '--version needs MAJOR.MINOR.PATCH'
            version=$2; shift 2 ;;
        --install-dir)
            [ "$#" -ge 2 ] && [ -n "$2" ] || fail '--install-dir needs a directory'
            install_dir=$2; shift 2 ;;
        -h|--help) usage; exit 0 ;;
        *) fail "unknown argument: $1" ;;
    esac
done
if [ -z "$install_dir" ]; then
    [ -n "${HOME:-}" ] || fail 'HOME is not set; specify --install-dir'
    install_dir="$HOME/.local/bin"
fi

valid_version() {
    case "$1" in ''|*[!0-9.]*) return 1 ;; esac
    printf '%s\n' "$1" | awk -F. '
        NF == 3 && $1 ~ /^(0|[1-9][0-9]*)$/ &&
        $2 ~ /^(0|[1-9][0-9]*)$/ && $3 ~ /^(0|[1-9][0-9]*)$/ { ok = 1 }
        END { exit !ok }'
}
[ -z "$version" ] || valid_version "$version" || fail 'version must be MAJOR.MINOR.PATCH'

for tool in curl tar awk sed mktemp; do
    command -v "$tool" >/dev/null 2>&1 || fail "required command not found: $tool"
done
if command -v sha256sum >/dev/null 2>&1; then
    hash_tool=sha256sum
elif command -v shasum >/dev/null 2>&1; then
    hash_tool=shasum
else
    fail 'install sha256sum or shasum before running this installer'
fi

os=$(uname -s) || fail 'cannot identify the operating system'
machine=$(uname -m) || fail 'cannot identify the CPU architecture'
case "$os" in
    Linux) platform=unknown-linux-musl ;;
    Darwin)
        platform=apple-darwin
        # uname reports x86_64 inside Rosetta; install the native Apple silicon build.
        if [ "$machine" = x86_64 ] && [ "$(sysctl -n sysctl.proc_translated 2>/dev/null || :)" = 1 ]; then
            machine=arm64
        fi ;;
    *) fail "unsupported operating system: $os (use install.ps1 on Windows)" ;;
esac
case "$machine" in
    x86_64|amd64) architecture=x86_64 ;;
    aarch64|arm64) architecture=aarch64 ;;
    *) fail "unsupported CPU architecture: $machine" ;;
esac

temporary=''
staging=''
cleanup() {
    [ -z "$staging" ] || rm -rf "$staging"
    [ -z "$temporary" ] || rm -rf "$temporary"
}
trap cleanup 0
trap 'exit 1' HUP INT TERM
temporary=$(mktemp -d "${TMPDIR:-/tmp}/lightjunction-install.XXXXXXXX") || fail 'cannot create a temporary directory'
download() {
    # -q must be first: a caller's .curlrc cannot disable certificate verification.
    curl -q --fail --silent --show-error --location --proto '=https' --proto-redir '=https' \
        --tlsv1.2 --retry 2 --connect-timeout 15 --max-time 180 \
        --header 'User-Agent: lightjunction-installer' --output "$2" "$1" || fail "download failed: $1"
}

repository=https://github.com/LIghtJUNction/lightjunction
if [ -z "$version" ]; then
    download 'https://api.github.com/repos/LIghtJUNction/lightjunction/releases/latest' "$temporary/latest.json"
    # Match the API's complete tag_name field, never text embedded in release notes.
    tag=$(sed -n 's/^[[:space:]]*"tag_name"[[:space:]]*:[[:space:]]*"\([^"]*\)"[[:space:]]*,\{0,1\}[[:space:]]*$/\1/p' "$temporary/latest.json")
    prerelease=$(sed -n 's/^[[:space:]]*"prerelease"[[:space:]]*:[[:space:]]*\([a-z]*\)[[:space:]]*,\{0,1\}[[:space:]]*$/\1/p' "$temporary/latest.json")
    draft=$(sed -n 's/^[[:space:]]*"draft"[[:space:]]*:[[:space:]]*\([a-z]*\)[[:space:]]*,\{0,1\}[[:space:]]*$/\1/p' "$temporary/latest.json")
    [ "$prerelease" = false ] && [ "$draft" = false ] || fail 'latest release is not stable; specify --version'
    case "$tag" in cli-v*) version=${tag#cli-v} ;; *) fail 'latest release is not a stable cli-v release; specify --version' ;; esac
    valid_version "$version" || fail 'latest release has an invalid cli-v version; specify --version'
fi
asset="lightjunction-v$version-$architecture-$platform.tar.gz"
base_url="$repository/releases/download/cli-v$version"
archive="$temporary/$asset"
download "$base_url/$asset" "$archive"
download "$base_url/SHA256SUMS" "$temporary/SHA256SUMS"

expected=$(awk -v wanted="$asset" '
    {
        hash = substr($0, 1, 64)
        name = substr($0, 67)
        if (length(hash) != 64 || hash ~ /[^0-9a-fA-F]/ || substr($0, 65, 2) != "  " ||
            name !~ /^[A-Za-z0-9][A-Za-z0-9._-]*$/) invalid = 1
        if (name == wanted) { count++; result = tolower(hash) }
    }
    END { if (invalid || count != 1) exit 1; print result }
' "$temporary/SHA256SUMS") || fail 'SHA256SUMS must contain exactly one valid checksum for the archive'
if [ "$hash_tool" = sha256sum ]; then
    actual=$(sha256sum "$archive") || fail 'SHA-256 calculation failed'
else
    actual=$(shasum -a 256 "$archive") || fail 'SHA-256 calculation failed'
fi
actual=${actual%% *}
[ "$actual" = "$expected" ] || fail 'SHA-256 mismatch; existing installation was not changed'

# Only known top-level members are permitted, and only the binary is streamed out.
tar -tzf "$archive" > "$temporary/members" || fail 'invalid release archive'
awk '
    $0 != "lightjunction" && $0 != "LICENSE" && $0 != "README.md" { invalid = 1 }
    { count[$0]++ }
    END { exit (invalid || count["lightjunction"] != 1 || count["LICENSE"] != 1 || count["README.md"] != 1) }
' "$temporary/members" || fail 'archive contains unexpected or duplicate paths'
tar -tvzf "$archive" lightjunction > "$temporary/binary-entry" || fail 'cannot inspect archive binary'
awk 'substr($0, 1, 1) != "-" { invalid = 1 } END { exit (invalid || NR != 1) }' \
    "$temporary/binary-entry" || fail 'archive binary is not a regular file'

case "$install_dir" in /*) ;; *) install_dir="$PWD/$install_dir" ;; esac
destination="$install_dir/lightjunction"
check_destination() {
    [ ! -L "$destination" ] || fail "refusing to replace a symbolic link: $destination"
    if [ -e "$destination" ] && [ ! -f "$destination" ]; then
        fail "installation target is not a regular file: $destination"
    fi
}
check_destination
mkdir -p "$install_dir" || fail "cannot create install directory: $install_dir"
staging=$(mktemp -d "$install_dir/.lightjunction-install.XXXXXXXX") || fail 'cannot stage in the install directory'
tar -xOzf "$archive" lightjunction > "$staging/lightjunction" || fail 'cannot extract the binary'
[ -s "$staging/lightjunction" ] || fail 'archive binary is empty'
chmod 755 "$staging/lightjunction" || fail 'cannot mark the binary executable'
check_destination
# Both paths are on the same filesystem. Passing the parent directory prevents mv
# from treating a newly appeared destination directory as another extraction path.
mv -f "$staging/lightjunction" "$install_dir/" || fail 'cannot replace the installed binary'
printf 'Installed lightjunction %s to %s\n' "$version" "$destination"
case ":${PATH:-}:" in
    *":$install_dir:"*) ;;
    *) printf 'Add %s to PATH to use lightjunction from any directory.\n' "$install_dir" ;;
esac
