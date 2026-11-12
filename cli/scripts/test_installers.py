#!/usr/bin/env python3
"""Offline installer regression tests with real archives and SHA-256 checksums.

Run with `uv run --no-project python scripts/test_installers.py` from cli/.
Unix runs install.sh; Windows runs Windows PowerShell 5.1 and PowerShell 7 when available.
Only transport commands/functions and platform probes are mocked, not verification/install logic.
The public installers have no test-only download URL or mirror override.
"""

from __future__ import annotations

import hashlib
import io
import json
import os
import shlex
import shutil
import stat
import subprocess
import sys
import tarfile
import tempfile
import unittest
import warnings
import zipfile
from pathlib import Path

CLI = Path(__file__).resolve().parents[1]
REPOSITORY = "https://github.com/LIghtJUNction/lightjunction"
LATEST = "https://api.github.com/repos/LIghtJUNction/lightjunction/releases/latest"
VERSION = "1.2.3"
PAYLOAD = b"#!/bin/sh\nprintf 'installer fixture; never automatically executed\\n'\n"

MOCK_CURL = r'''
import json
import os
import shutil
import sys
from pathlib import Path

config = json.loads(Path(os.environ["LJ_INSTALLER_FIXTURE"]).read_text())
arguments = sys.argv[1:]
if not arguments or arguments[0] != "-q":
    sys.exit("curl did not disable .curlrc")
for flag in ("--proto", "--proto-redir"):
    if arguments[arguments.index(flag) + 1] != "=https":
        sys.exit("curl did not require HTTPS")
if "--insecure" in arguments or "-k" in arguments:
    sys.exit("curl disabled certificate validation")
url = arguments[-1]
destination = arguments[arguments.index("--output") + 1]
with Path(config["log"]).open("a") as log:
    log.write(url + "\n")
if url in config["fail"] or url not in config["files"]:
    sys.exit(22)
shutil.copyfile(config["files"][url], destination)
'''

MOCK_POWERSHELL = r'''
$ErrorActionPreference = 'Stop'
function Invoke-WebRequest {
    [CmdletBinding()]
    param([Uri] $Uri, [switch] $UseBasicParsing,
          [int] $MaximumRedirection, [int] $TimeoutSec, [hashtable] $Headers)
    if ($Uri.Scheme -cne 'https' -or $MaximumRedirection -ne 0) {
        throw 'HTTPS and manual redirect verification are required.'
    }
    $Fixture = Get-Content -LiteralPath $env:LJ_INSTALLER_FIXTURE -Raw | ConvertFrom-Json
    [IO.File]::AppendAllText($Fixture.log, $Uri.AbsoluteUri + "`n")
    if ($Fixture.fail -contains $Uri.AbsoluteUri) { throw 'Simulated download failure.' }
    $Source = $Fixture.files.PSObject.Properties[$Uri.AbsoluteUri]
    if ($null -eq $Source) { throw ('Unexpected URL: ' + $Uri.AbsoluteUri) }
    [pscustomobject] @{
        StatusCode = 200
        Headers = @{}
        RawContentStream = [IO.MemoryStream]::new([IO.File]::ReadAllBytes([string] $Source.Value))
    }
}
if ($env:LJ_INSTALLER_NATIVE -ne '1') {
    Add-Type -TypeDefinition @'
using System;
public static class LightjunctionInstallerNative {
    public static string Architecture() {
        return Environment.GetEnvironmentVariable("LJ_INSTALLER_ARCH");
    }
}
'@
}
$Options = Get-Content -LiteralPath $env:LJ_INSTALLER_OPTIONS -Raw | ConvertFrom-Json
$Parameters = @{}
foreach ($Property in $Options.PSObject.Properties) { $Parameters[$Property.Name] = $Property.Value }
& $env:LJ_INSTALLER_SCRIPT @Parameters
if (-not $?) { exit 1 }
'''


def powershell_executables() -> list[str]:
    result = []
    for name in ("powershell.exe", "pwsh.exe", "pwsh"):
        executable = shutil.which(name)
        if executable and executable not in result:
            result.append(executable)
    return result


def make_archive(path: Path, payload: bytes, binary: str, variant: str = "normal") -> None:
    members = [(binary, payload), ("LICENSE", b"Fixture license\n"), ("README.md", b"Fixture README\n")]
    if variant == "traversal":
        members.append(("../escaped", b"must not be extracted"))
    if variant == "duplicate":
        members.append((binary, b"duplicate binary"))
    if path.suffix == ".zip":
        with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as archive:
            for name, contents in members:
                entry = zipfile.ZipInfo(name)
                entry.create_system = 3
                mode = stat.S_IFLNK | 0o777 if variant == "symlink" and name == binary else stat.S_IFREG | 0o755
                entry.external_attr = mode << 16
                with warnings.catch_warnings():
                    warnings.simplefilter("ignore", UserWarning)
                    archive.writestr(entry, contents)
    else:
        with tarfile.open(path, "w:gz", format=tarfile.USTAR_FORMAT) as archive:
            for name, contents in members:
                entry = tarfile.TarInfo(name)
                entry.mode = 0o755 if name == binary else 0o644
                if variant == "symlink" and name == binary:
                    entry.type = tarfile.SYMTYPE
                    entry.linkname = "../outside"
                    archive.addfile(entry)
                else:
                    entry.size = len(contents)
                    archive.addfile(entry, io.BytesIO(contents))


class InstallerFixture:
    """Shared offline transport harness for regression tests and real release archive smoke checks."""

    def __init__(self, root: Path, target: str, *, version: str = VERSION, native: bool = False):
        self.root = root
        self.target = target
        self.version = version
        self.windows = "windows" in target
        self.native = native
        self.install_dir = root / "install path with spaces"
        self.binary = "lightjunction.exe" if self.windows else "lightjunction"
        self.destination = self.install_dir / self.binary
        self.asset = f"lightjunction-v{version}-{target}" + (".zip" if self.windows else ".tar.gz")
        self.archive = root / self.asset
        self.checksums = root / "SHA256SUMS"
        self.latest = root / "latest.json"
        self.config_path = root / "fixture.json"
        self.log = root / "requests.log"
        self.options = root / "options.json"
        self.mock_bin = root / "mock-bin"
        self.mock_bin.mkdir()
        self.temporary = root / "temporary"
        self.temporary.mkdir()
        self.environment = dict(os.environ)
        for name in ("LIGHTJUNCTION_VERSION", "LIGHTJUNCTION_INSTALL_DIR"):
            self.environment.pop(name, None)
        self.environment.update(
            LJ_INSTALLER_FIXTURE=str(self.config_path),
            LJ_INSTALLER_OPTIONS=str(self.options),
            LJ_INSTALLER_SCRIPT=str(CLI / ("install.ps1" if self.windows else "install.sh")),
            LJ_INSTALLER_ARCH="ARM64" if target.startswith("aarch64") else "AMD64",
            LJ_INSTALLER_NATIVE="1" if native else "0",
            TMPDIR=str(self.temporary),
            TMP=str(self.temporary),
            TEMP=str(self.temporary),
            LC_ALL="C",
        )
        self.config: dict[str, object] = {
            "files": {
                LATEST: str(self.latest),
                f"{REPOSITORY}/releases/download/cli-v{version}/{self.asset}": str(self.archive),
                f"{REPOSITORY}/releases/download/cli-v{version}/SHA256SUMS": str(self.checksums),
            },
            "fail": [],
            "log": str(self.log),
        }
        self.set_latest(f"cli-v{version}")
        self.write_archive()
        self.write_transport()

    def set_latest(self, tag: str, **changes: object) -> None:
        data = {"tag_name": tag, "draft": False, "prerelease": False}
        data.update(changes)
        self.latest.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")

    def write_archive(self, payload: bytes = PAYLOAD, variant: str = "normal") -> None:
        make_archive(self.archive, payload, self.binary, variant)
        self.refresh_checksum()

    def refresh_checksum(self) -> None:
        digest = hashlib.sha256(self.archive.read_bytes()).hexdigest()
        self.checksums.write_text(f"{digest}  {self.asset}\n", encoding="ascii")

    def write_transport(self) -> None:
        helper = self.root / "mock_curl.py"
        helper.write_text(MOCK_CURL, encoding="utf-8")
        curl = self.mock_bin / "curl"
        curl.write_text(
            f"#!/bin/sh\nexec {shlex.quote(sys.executable)} {shlex.quote(str(helper))} \"$@\"\n",
            encoding="utf-8",
        )
        curl.chmod(0o755)
        if not self.native:
            probes = {
                "uname": '#!/bin/sh\ncase "$1" in -s) printf "%s\\n" "$LJ_INSTALLER_OS" ;; -m) printf "%s\\n" "$LJ_INSTALLER_MACHINE" ;; *) exit 1 ;; esac\n',
                "sysctl": '#!/bin/sh\nprintf "%s\\n" "${LJ_INSTALLER_ROSETTA:-0}"\n',
            }
            for name, script in probes.items():
                probe = self.mock_bin / name
                probe.write_text(script, encoding="utf-8")
                probe.chmod(0o755)
            self.environment.update(
                LJ_INSTALLER_OS="Darwin" if "apple" in self.target else "Linux",
                LJ_INSTALLER_MACHINE="aarch64" if self.target.startswith("aarch64") else "x86_64",
            )
        self.environment["PATH"] = str(self.mock_bin) + os.pathsep + self.environment.get("PATH", "")
        self.wrapper = self.root / "mock_transport.ps1"
        self.wrapper.write_text(MOCK_POWERSHELL, encoding="utf-8")

    def run(
        self,
        *,
        version: str | None = VERSION,
        install_dir: Path | None = None,
        explicit_dir: bool = True,
        engine: str | None = None,
    ) -> subprocess.CompletedProcess[str]:
        self.config_path.write_text(json.dumps(self.config), encoding="utf-8")
        chosen_dir = self.install_dir if install_dir is None else install_dir
        if self.windows:
            engines = powershell_executables()
            if not engines:
                raise RuntimeError("Windows installer tests require PowerShell 5.1 or PowerShell 7")
            options = {}
            if version is not None:
                options["Version"] = version
            if explicit_dir:
                options["InstallDir"] = str(chosen_dir)
            self.options.write_text(json.dumps(options), encoding="utf-8")
            command = [engine or engines[0], "-NoLogo", "-NoProfile", "-NonInteractive", "-File", str(self.wrapper)]
        else:
            command = ["sh", str(CLI / "install.sh")]
            if version is not None:
                command += ["--version", version]
            if explicit_dir:
                command += ["--install-dir", str(chosen_dir)]
        return subprocess.run(
            command,
            capture_output=True,
            text=True,
            env=self.environment,
            stdin=subprocess.DEVNULL,
            timeout=90,
            check=False,
        )

    def requests(self) -> list[str]:
        return self.log.read_text().splitlines() if self.log.exists() else []

    def old_installation(self) -> None:
        self.install_dir.mkdir(parents=True, exist_ok=True)
        self.destination.write_bytes(b"previous installation")


class InstallerTests(unittest.TestCase):
    engine: str | None = None

    def setUp(self) -> None:
        directory = tempfile.TemporaryDirectory(prefix="lightjunction-installer-test-")
        self.addCleanup(directory.cleanup)
        target = "x86_64-pc-windows-msvc" if os.name == "nt" else "x86_64-unknown-linux-musl"
        self.fixture = InstallerFixture(Path(directory.name), target)

    def run_installer(self, **options: object) -> subprocess.CompletedProcess[str]:
        result = self.fixture.run(engine=self.engine, **options)
        self.assertFalse(list(self.fixture.install_dir.glob(".lightjunction-install-*")))
        self.assertEqual(list(self.fixture.temporary.iterdir()), [])
        return result

    def assert_failure_preserves_old(self) -> None:
        self.fixture.old_installation()
        result = self.run_installer()
        self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(self.fixture.destination.read_bytes(), b"previous installation")

    def test_pinned_version_and_path_with_spaces(self) -> None:
        result = self.run_installer()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(self.fixture.destination.read_bytes(), PAYLOAD)
        self.assertNotIn(LATEST, self.fixture.requests())
        self.assertEqual(len(self.fixture.requests()), 2)

    def test_latest_uses_field_not_release_body(self) -> None:
        self.fixture.set_latest(f"cli-v{VERSION}", body='Example: "tag_name": "cli-v9.9.9"')
        result = self.run_installer(version=None)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(self.fixture.requests()[0], LATEST)
        self.assertEqual(self.fixture.destination.read_bytes(), PAYLOAD)

    def test_compact_latest_with_escaped_and_nested_metadata(self) -> None:
        self.fixture.set_latest(
            f"cli-v{VERSION}",
            body='Escapes: \\ \" { } [ ] , :\n"tag_name":"cli-v9.9.9","draft":true',
            author={"tag_name": "cli-v9.9.9", "draft": True, "prerelease": True},
            assets=[{"tag_name": "cli-v8.8.8", "draft": True}],
        )
        data = json.loads(self.fixture.latest.read_text())
        self.fixture.latest.write_text(json.dumps(data, separators=(",", ":")))
        result = self.run_installer(version=None)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(self.fixture.destination.read_bytes(), PAYLOAD)
        self.assertEqual(self.fixture.requests()[0], LATEST)

    def test_nested_latest_fields_do_not_replace_missing_root_fields(self) -> None:
        self.fixture.latest.write_text(json.dumps({
            "author": {"tag_name": f"cli-v{VERSION}", "draft": False, "prerelease": False},
        }, separators=(",", ":")))
        self.fixture.old_installation()
        result = self.run_installer(version=None)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.fixture.destination.read_bytes(), b"previous installation")

    def test_truncated_latest_metadata_preserves_existing_installation(self) -> None:
        self.fixture.set_latest(f"cli-v{VERSION}", body="incomplete response")
        self.fixture.latest.write_text(self.fixture.latest.read_text().rstrip()[:-1])
        self.fixture.old_installation()
        result = self.run_installer(version=None)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.fixture.destination.read_bytes(), b"previous installation")

    @unittest.skipIf(os.name == "nt", "Unix root-field lexer validation")
    def test_invalid_root_metadata_preserves_existing_installation(self) -> None:
        good = json.dumps({"tag_name": f"cli-v{VERSION}", "draft": False, "prerelease": False})
        for data in (
            good + "trailing garbage",
            good + good,
            good[:-1] + ',"tag_name":"cli-v9.9.9"}',
            good[:-1] + ',"draft":false}',
            good[:-1] + ',"body":"unterminated',
            good[:-1] + ',"assets":[}}',
            "[" + good + "]",
        ):
            with self.subTest(data=data):
                self.fixture.latest.write_text(data)
                self.fixture.old_installation()
                result = self.run_installer(version=None)
                self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
                self.assertEqual(self.fixture.destination.read_bytes(), b"previous installation")

    def test_invalid_latest_and_prerelease_fail(self) -> None:
        for tag, prerelease in (("site-v1.2.3", False), (f"cli-v{VERSION}", True)):
            with self.subTest(tag=tag, prerelease=prerelease):
                self.fixture.set_latest(tag, prerelease=prerelease, body='"tag_name": "cli-v1.2.3"')
                self.fixture.old_installation()
                result = self.run_installer(version=None)
                self.assertNotEqual(result.returncode, 0)
                self.assertEqual(self.fixture.destination.read_bytes(), b"previous installation")

    def test_environment_defaults_and_argument_precedence(self) -> None:
        self.fixture.environment["LIGHTJUNCTION_VERSION"] = VERSION
        self.fixture.environment["LIGHTJUNCTION_INSTALL_DIR"] = str(self.fixture.install_dir)
        result = self.run_installer(version=None, explicit_dir=False)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.fixture.environment["LIGHTJUNCTION_VERSION"] = "9.9.9"
        self.fixture.environment["LIGHTJUNCTION_INSTALL_DIR"] = str(self.fixture.root / "unused")
        result = self.run_installer()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertFalse((self.fixture.root / "unused").exists())

    def test_invalid_version_fails_before_download(self) -> None:
        for version in ("v1.2.3", "01.2.3", "1.2.3-rc.1", "1.2.3\n9.9.9", "1.2.3/../../bad"):
            with self.subTest(version=version):
                self.assertNotEqual(self.run_installer(version=version).returncode, 0)
        self.assertEqual(self.fixture.requests(), [])

    def test_wrong_checksum_preserves_existing_installation(self) -> None:
        self.fixture.checksums.write_text(f"{'0' * 64}  {self.fixture.asset}\n")
        self.assert_failure_preserves_old()

    def test_missing_checksum_preserves_existing_installation(self) -> None:
        self.fixture.checksums.write_text(f"{'0' * 64}  another-asset.zip\n")
        self.assert_failure_preserves_old()

    def test_duplicate_checksum_preserves_existing_installation(self) -> None:
        self.fixture.checksums.write_text(self.fixture.checksums.read_text() * 2)
        self.assert_failure_preserves_old()

    def test_malformed_checksum_preserves_existing_installation(self) -> None:
        self.fixture.checksums.write_text(self.fixture.checksums.read_text().replace("  ", " "))
        self.assert_failure_preserves_old()

    def test_download_failures_preserve_existing_installation(self) -> None:
        for suffix in (self.fixture.asset, "SHA256SUMS"):
            with self.subTest(suffix=suffix):
                self.fixture.config["fail"] = [
                    f"{REPOSITORY}/releases/download/cli-v{VERSION}/{suffix}"
                ]
                self.assert_failure_preserves_old()

    def test_unsupported_architecture_does_not_download(self) -> None:
        self.fixture.environment.update(LJ_INSTALLER_MACHINE="riscv64", LJ_INSTALLER_ARCH="IA64")
        self.assert_failure_preserves_old()
        self.assertEqual(self.fixture.requests(), [])

    @unittest.skipIf(os.name == "nt", "Unix operating-system selection")
    def test_unsupported_operating_system_does_not_download(self) -> None:
        self.fixture.environment["LJ_INSTALLER_OS"] = "FreeBSD"
        self.assert_failure_preserves_old()
        self.assertEqual(self.fixture.requests(), [])

    def test_upgrade_replaces_only_the_binary(self) -> None:
        self.fixture.old_installation()
        sentinel = self.fixture.install_dir / "unrelated file"
        sentinel.write_bytes(b"preserve me")
        result = self.run_installer()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(self.fixture.destination.read_bytes(), PAYLOAD)
        self.assertEqual(sentinel.read_bytes(), b"preserve me")

    def test_directory_destination_is_rejected(self) -> None:
        self.fixture.destination.mkdir(parents=True)
        self.assertNotEqual(self.run_installer().returncode, 0)
        self.assertEqual(list(self.fixture.destination.iterdir()), [])

    def test_symlink_destination_is_rejected(self) -> None:
        self.fixture.install_dir.mkdir()
        outside = self.fixture.root / "outside"
        outside.write_bytes(b"keep this file")
        try:
            self.fixture.destination.symlink_to(outside)
        except OSError as error:
            self.skipTest(f"OS does not permit test symlinks: {error}")
        self.assertNotEqual(self.run_installer().returncode, 0)
        self.assertTrue(self.fixture.destination.is_symlink())
        self.assertEqual(outside.read_bytes(), b"keep this file")

    def test_archive_traversal_duplicate_and_symlink_are_rejected(self) -> None:
        for variant in ("traversal", "duplicate", "symlink"):
            with self.subTest(variant=variant):
                self.fixture.write_archive(variant=variant)
                self.assert_failure_preserves_old()
                self.assertFalse((self.fixture.root / "escaped").exists())

    def test_arm64_selection_including_rosetta(self) -> None:
        nested = self.fixture.root / "arm64"
        nested.mkdir()
        target = "aarch64-pc-windows-msvc" if os.name == "nt" else "aarch64-apple-darwin"
        self.fixture = InstallerFixture(nested, target)
        if os.name != "nt":
            self.fixture.environment.update(LJ_INSTALLER_MACHINE="x86_64", LJ_INSTALLER_ROSETTA="1")
        result = self.run_installer()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(self.fixture.destination.read_bytes(), PAYLOAD)
        self.assertIn("aarch64", self.fixture.requests()[0])


@unittest.skipUnless(os.name == "nt" and shutil.which("pwsh.exe"), "PowerShell 7 on Windows")
class PowerShell7InstallerTests(InstallerTests):
    engine = shutil.which("pwsh.exe")


if __name__ == "__main__":
    unittest.main(verbosity=2)
