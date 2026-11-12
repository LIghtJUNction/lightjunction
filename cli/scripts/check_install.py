#!/usr/bin/env python3
"""Smoke-test the native installer with a real locally packaged release archive.

Example: uv run --no-project python scripts/check_install.py --archive dist/ARCHIVE \
    --target x86_64-unknown-linux-musl --version 0.2.1
Only the HTTPS transport is mocked. Native platform detection, SHA-256 verification,
archive validation, installation, upgrade, and the installed executable run for real.
"""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import tempfile
from pathlib import Path

from test_installers import CLI, InstallerFixture, powershell_executables


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archive", type=Path, required=True)
    parser.add_argument("--target", required=True)
    parser.add_argument("--version", required=True)
    arguments = parser.parse_args()
    archive = arguments.archive.resolve()
    if not archive.is_file():
        parser.error(f"Archive is missing: {archive}")
    with tempfile.TemporaryDirectory(prefix="lightjunction-native-install-") as temporary:
        root = Path(temporary)
        fixture = InstallerFixture(root, arguments.target, version=arguments.version, native=True)
        if archive.name != fixture.asset:
            parser.error(f"Expected archive name {fixture.asset}, received {archive.name}")
        shutil.copyfile(archive, fixture.archive)
        fixture.refresh_checksum()
        engines = powershell_executables() if os.name == "nt" else [None]
        if not engines:
            parser.error("Windows installation checks require PowerShell")
        for engine in engines:
            # An existing file exercises the same-volume atomic replacement path.
            fixture.old_installation()
            result = fixture.run(version=arguments.version, engine=engine)
            if result.returncode:
                raise RuntimeError(result.stdout + result.stderr)
            for command in (("--version",), ("keys", "ssh", "--no-timing")):
                output = subprocess.run(
                    [str(fixture.destination), *command],
                    capture_output=True,
                    text=True,
                    timeout=30,
                    check=True,
                )
                if command == ("--version",) and output.stdout.strip() != f"lightjunction {arguments.version}":
                    raise RuntimeError(f"Installed binary reports an unexpected version: {output.stdout}")
                if command[0] == "keys" and output.stdout != (CLI / "keys/ssh-public-keys.txt").read_text():
                    raise RuntimeError("Installed binary did not produce the bundled SSH public key")
            if list(fixture.temporary.iterdir()) or list(fixture.install_dir.glob(".lightjunction-install-*")):
                raise RuntimeError("Installer left temporary files behind")
        print(f"PASS: {arguments.target} real archive installed and upgraded; --version and SSH key output verified.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
