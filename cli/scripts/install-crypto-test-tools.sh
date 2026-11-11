#!/usr/bin/env bash
set -euo pipefail

# Test-only tools: keep downloads, installed binaries and build output outside the repo.
if [[ ${GITHUB_ACTIONS:-} != true || $(uname -s) != Linux || $(uname -m) != x86_64 ]]; then
  printf 'This installer requires a GitHub Actions Linux x86_64 runner.\n' >&2
  exit 1
fi
: "${RUNNER_TEMP:?GitHub Actions must provide RUNNER_TEMP}"
: "${GITHUB_PATH:?GitHub Actions must provide GITHUB_PATH}"

tools_dir=$(mktemp -d "${RUNNER_TEMP%/}/lightjunction-crypto.XXXXXX")
age_archive="$tools_dir/age-v1.3.2-linux-amd64.tar.gz"
age_sha256=cbe24006683f8eb669266162894b9a522a1af52f2665fbc63a4bb032ed26ac10

sudo apt-get update
sudo apt-get install --yes --no-install-recommends gnupg libpcsclite-dev pkg-config

curl --fail --show-error --location --retry 3 --proto '=https' --proto-redir '=https' \
  --output "$age_archive" \
  'https://github.com/FiloSottile/age/releases/download/v1.3.2/age-v1.3.2-linux-amd64.tar.gz'
printf '%s  %s\n' "$age_sha256" "$age_archive" | sha256sum --check --strict -
tar --extract --gzip --file "$age_archive" --directory "$tools_dir" \
  --no-same-owner --no-same-permissions age/

cargo install age-plugin-yubikey --version '=0.5.1' --locked \
  --root "$tools_dir/yubikey" --target-dir "$tools_dir/yubikey-build"

test -x "$tools_dir/age/age"
test -x "$tools_dir/yubikey/bin/age-plugin-yubikey"
printf '%s\n' "$tools_dir/age" "$tools_dir/yubikey/bin" >> "$GITHUB_PATH"
printf 'Installed age 1.3.2 and age-plugin-yubikey 0.5.1 for real crypto checks.\n'
