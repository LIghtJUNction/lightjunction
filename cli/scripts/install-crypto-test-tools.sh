#!/usr/bin/env bash
set -euo pipefail

age_only=false
if [[ $# -eq 1 && $1 == --age-only ]]; then
  age_only=true
elif [[ $# -ne 0 ]]; then
  printf 'Usage: %s [--age-only]\n' "$0" >&2
  exit 1
fi

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

if [[ $age_only == false ]]; then
  : "${GITHUB_ENV:?GitHub Actions must provide GITHUB_ENV for the private PC/SC runtime}"
  if ! command -v gpg >/dev/null 2>&1; then
    printf 'Real crypto checks require GnuPG (gpg) already installed on the runner.\n' >&2
    exit 1
  fi

  # pcsc-sys accepts an explicit library directory; no development headers or
  # package-manager access are needed when the runner already has the PC/SC runtime.
  ldconfig_binary=$(command -v ldconfig || true)
  if [[ -z "$ldconfig_binary" ]]; then
    for candidate in /sbin/ldconfig /usr/sbin/ldconfig; do
      if [[ -x "$candidate" ]]; then
        ldconfig_binary=$candidate
        break
      fi
    done
  fi
  if [[ -z "$ldconfig_binary" ]] || ! library_cache=$("$ldconfig_binary" -p); then
    printf 'Cannot inspect the runner library cache with ldconfig -p.\n' >&2
    exit 1
  fi
  pcsc_runtime=''
  while IFS= read -r candidate; do
    if [[ "$candidate" == /* && -f "$candidate" && -r "$candidate" ]]; then
      pcsc_runtime=$candidate
      break
    fi
  done < <(printf '%s\n' "$library_cache" | awk '$1 == "libpcsclite.so.1" && /x86-64/ { print $NF }')
  if [[ -z "$pcsc_runtime" ]]; then
    if ! command -v dpkg-deb >/dev/null 2>&1; then
      printf 'The PC/SC runtime is absent; dpkg-deb is required to extract its verified package.\n' >&2
      exit 1
    fi
    # Official Ubuntu Noble runtime, downloaded from an Ubuntu-listed HTTPS mirror.
    # SHA-256: https://packages.ubuntu.com/noble/amd64/libpcsclite1/download
    pcsc_archive="$tools_dir/libpcsclite1_2.0.3-1build1_amd64.deb"
    pcsc_sha256=703bacc9204a7ecc24486ac8c96d15d0b9e2c91c385388e132ad4fd8f56f035a
    curl --fail --show-error --location --retry 3 --proto '=https' --proto-redir '=https' \
      --output "$pcsc_archive" \
      'https://mirrors.edge.kernel.org/ubuntu/pool/main/p/pcsc-lite/libpcsclite1_2.0.3-1build1_amd64.deb'
    printf '%s  %s\n' "$pcsc_sha256" "$pcsc_archive" | sha256sum --check --strict -
    dpkg-deb --extract "$pcsc_archive" "$tools_dir/pcsc-runtime"
    pcsc_runtime="$tools_dir/pcsc-runtime/usr/lib/x86_64-linux-gnu/libpcsclite.so.1"
    if [[ ! -f "$pcsc_runtime" || ! -r "$pcsc_runtime" ]]; then
      printf 'The verified Ubuntu package did not provide a readable PC/SC runtime.\n' >&2
      exit 1
    fi
  fi
  mkdir -m 700 "$tools_dir/lib"
  ln -s "$pcsc_runtime" "$tools_dir/lib/libpcsclite.so"
  ln -s "$pcsc_runtime" "$tools_dir/lib/libpcsclite.so.1"
fi

curl --fail --show-error --location --retry 3 --proto '=https' --proto-redir '=https' \
  --output "$age_archive" \
  'https://github.com/FiloSottile/age/releases/download/v1.3.2/age-v1.3.2-linux-amd64.tar.gz'
printf '%s  %s\n' "$age_sha256" "$age_archive" | sha256sum --check --strict -
tar --extract --gzip --file "$age_archive" --directory "$tools_dir" \
  --no-same-owner --no-same-permissions age/
test -x "$tools_dir/age/age"
if [[ $age_only == true ]]; then
  printf '%s\n' "$tools_dir/age" >> "$GITHUB_PATH"
  printf 'Installed checksum-verified age 1.3.2 for frontend checks.\n'
  exit 0
fi

PCSC_LIB_DIR="$tools_dir/lib" PCSC_LIB_NAME=pcsclite \
  cargo install age-plugin-yubikey --version '=0.5.1' --locked \
  --root "$tools_dir/yubikey" --target-dir "$tools_dir/yubikey-build"

test -x "$tools_dir/yubikey/bin/age-plugin-yubikey"
LD_LIBRARY_PATH="$tools_dir/lib${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}" \
  "$tools_dir/yubikey/bin/age-plugin-yubikey" --version
printf 'LD_LIBRARY_PATH=%s\n' "$tools_dir/lib${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}" >> "$GITHUB_ENV"
printf '%s\n' "$tools_dir/age" "$tools_dir/yubikey/bin" >> "$GITHUB_PATH"
printf 'Installed age 1.3.2 and age-plugin-yubikey 0.5.1 for real crypto checks.\n'
