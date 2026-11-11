"""Prepare stable versions and verify immutable crates.io releases (Python 3.11+)."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import subprocess
import time
import tomllib
import urllib.error
import urllib.request
from pathlib import Path

NAME = "lightjunction"
INDEX_URL = "https://index.crates.io/li/gh/lightjunction"
VERSION = re.compile(r"(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\Z")
MAX_COMPONENT = 2**64 - 1


def version_parts(value: str) -> tuple[int, int, int]:
    if not VERSION.fullmatch(value):
        raise ValueError(f"Expected a stable MAJOR.MINOR.PATCH version, got {value!r}")
    major, minor, patch = map(int, value.split("."))
    if max(major, minor, patch) > MAX_COMPONENT:
        raise ValueError("Version components must fit an unsigned 64-bit integer")
    return major, minor, patch


def next_version(current: str, bump: str, custom: str) -> str:
    parts = version_parts(current)
    if custom:
        if bump != "none":
            raise ValueError("An exact version cannot be combined with a version bump")
        if version_parts(custom) <= parts:
            raise ValueError(
                "An exact version must be newer; use bump=none for the current version"
            )
        return custom
    major, minor, patch = parts
    match bump:
        case "none":
            return current
        case "patch":
            result = f"{major}.{minor}.{patch + 1}"
        case "minor":
            result = f"{major}.{minor + 1}.0"
        case "major":
            result = f"{major + 1}.0.0"
        case _:
            raise ValueError(f"Unsupported bump: {bump!r}")
    version_parts(result)
    return result


def replace_version(block: str, value: str) -> str:
    updated, count = re.subn(
        r'(?m)^version\s*=\s*"[^"\n]*"(?:\s*#[^\n]*)?$',
        f'version = "{value}"',
        block,
    )
    if count != 1:
        raise ValueError("Expected exactly one standalone version in the package table")
    return updated


def prepare(crate: Path, bump: str = "none", custom: str = "") -> tuple[str, bool]:
    manifest_path, lock_path = crate / "Cargo.toml", crate / "Cargo.lock"
    manifest, lock = manifest_path.read_text(), lock_path.read_text()
    package = tomllib.loads(manifest)["package"]
    if package["name"] != NAME:
        raise ValueError("Refusing to release a different package")
    current = package["version"]
    target = next_version(current, bump, custom)
    entries = [
        entry
        for entry in tomllib.loads(lock)["package"]
        if entry["name"] == NAME and "source" not in entry
    ]
    if len(entries) != 1 or entries[0]["version"] != current:
        raise ValueError("Cargo.lock must contain exactly one matching local package version")
    if target == current:
        return target, False

    package_table = re.search(r"(?ms)^\[package\]\n.*?(?=^\[|\Z)", manifest)
    if package_table is None:
        raise ValueError("Expected a standalone [package] table")
    new_manifest = (
        manifest[: package_table.start()]
        + replace_version(package_table.group(), target)
        + manifest[package_table.end() :]
    )
    new_lock = lock
    for block in re.finditer(r"(?ms)^\[\[package\]\]\n.*?(?=^\[\[package\]\]|\Z)", lock):
        entry = tomllib.loads(block.group())["package"][0]
        if entry["name"] == NAME and "source" not in entry:
            new_lock = (
                lock[: block.start()] + replace_version(block.group(), target) + lock[block.end() :]
            )
            break
    if new_lock == lock:
        raise ValueError("Could not update the local package in Cargo.lock")
    # Check both outputs before writing either. Dependencies remain unchanged.
    tomllib.loads(new_manifest)
    tomllib.loads(new_lock)
    manifest_path.write_text(new_manifest)
    lock_path.write_text(new_lock)
    return target, True


def registry_record(version: str) -> dict | None:
    request = urllib.request.Request(
        INDEX_URL,
        headers={"User-Agent": "lightjunction-release", "Cache-Control": "no-cache"},
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            content = response.read().decode("utf-8")
    except urllib.error.HTTPError as error:
        if error.code == 404:
            return None
        raise
    for line in content.splitlines():
        record = json.loads(line)
        if record["name"] == NAME and record["vers"] == version:
            return record
    return None


def verify_checksum(archive: Path, record: dict) -> None:
    if record.get("yanked"):
        raise ValueError("The existing crate version is yanked; publish a new version instead")
    with archive.open("rb") as source:
        checksum = hashlib.file_digest(source, "sha256").hexdigest()
    if checksum != record["cksum"]:
        raise ValueError(
            "This version already exists with a different archive checksum. "
            "Use its exact release commit or bump the version; it cannot be overwritten."
        )


def publish(crate: Path) -> None:
    version, _ = prepare(crate)
    status = subprocess.check_output(["git", "status", "--porcelain"], cwd=crate, text=True)
    if status:
        raise ValueError("Publishing requires a completely clean checkout")
    subprocess.run(["cargo", "package", "--locked"], cwd=crate, check=True)
    archive = crate / "target" / "package" / f"{NAME}-{version}.crate"
    record = registry_record(version)
    if record is not None:
        verify_checksum(archive, record)
        print(f"{NAME} {version} is already published with the identical archive checksum")
        return

    subprocess.run(["cargo", "publish", "--locked"], cwd=crate, check=True)
    # cargo publish waits for availability too; verify our actual archive independently.
    for attempt in range(12):
        record = registry_record(version)
        if record is not None:
            verify_checksum(archive, record)
            print(f"Verified {NAME} {version} in the official crates.io sparse index")
            return
        if attempt < 11:
            time.sleep(5)
    raise RuntimeError(
        "Publish returned successfully, but the registry checksum is not visible yet"
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    subcommands = parser.add_subparsers(dest="command", required=True)
    prepare_parser = subcommands.add_parser(
        "prepare", help="Validate and update package/lock versions"
    )
    prepare_parser.add_argument(
        "--bump", choices=["none", "patch", "minor", "major"], default="none"
    )
    prepare_parser.add_argument("--version", default="")
    subcommands.add_parser("publish", help="Publish from a clean checkout and verify its checksum")
    args = parser.parse_args()
    crate = Path(__file__).resolve().parents[1]
    try:
        if args.command == "prepare":
            version, changed = prepare(crate, args.bump, args.version)
            outputs = {
                "version": version,
                "tag": f"cli-v{version}",
                "changed": str(changed).lower(),
            }
            print(json.dumps(outputs))
            if output := os.environ.get("GITHUB_OUTPUT"):
                with Path(output).open("a") as target:
                    target.write("".join(f"{key}={value}\n" for key, value in outputs.items()))
        else:
            publish(crate)
    except (ValueError, KeyError, OSError, RuntimeError, subprocess.CalledProcessError) as error:
        parser.exit(1, f"Release failed: {error}\n")


if __name__ == "__main__":
    main()
