"""Exercise archive integrity, target identity, reproducibility and release completeness."""

import hashlib
import io
import shutil
import struct
import tarfile
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest import mock

import package_binary as packaging

VERSION = "0.2.1"


def executable(target, runtime=None):
    arm = target.startswith("aarch64")
    if "linux" in target:
        data = bytearray(120)
        data[:6] = b"\x7fELF\x02\x01"
        struct.pack_into("<H", data, 18, 183 if arm else 62)
        struct.pack_into("<Q", data, 32, 64)
        struct.pack_into("<HH", data, 54, 56, 1)
        struct.pack_into("<I", data, 64, 3 if runtime else 1)
    elif "darwin" in target:
        data = bytearray(32)
        data[:4] = b"\xcf\xfa\xed\xfe"
        struct.pack_into("<I", data, 4, 0x0100000C if arm else 0x01000007)
    else:
        data = bytearray(1024)
        data[:2] = b"MZ"
        struct.pack_into("<I", data, 60, 128)
        data[128:132] = b"PE\0\0"
        struct.pack_into("<HH", data, 132, 0xAA64 if arm else 0x8664, 1)
        struct.pack_into("<H", data, 148, 240)
        struct.pack_into("<H", data, 152, 0x20B)
        if runtime:
            struct.pack_into("<II", data, 272, 0x1000, 40)
            struct.pack_into("<IIII", data, 400, 512, 0x1000, 512, 512)
            struct.pack_into("<I", data, 524, 0x1040)
            name = runtime.encode() + b"\0"
            data[576 : 576 + len(name)] = name
    return bytes(data)


class PackageTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        self.crate = self.root / "crate"
        self.crate.mkdir()
        (self.crate / "Cargo.toml").write_text(
            f'[package]\nname="lightjunction"\nversion="{VERSION}"\n'
        )
        (self.crate / "LICENSE").write_bytes(b"license bytes\n")
        (self.crate / "README.md").write_bytes(b"readme bytes\n")
        (self.crate / "install.sh").write_bytes(b"#!/bin/sh\nexit 0\n")
        (self.crate / "install.ps1").write_bytes(b"exit 0\n")
        self.artifacts = self.root / "artifacts"
        self.artifacts.mkdir()
        self.package = self.root / f"lightjunction-{VERSION}.crate"
        self.write_crate(VERSION)

    def write_crate(self, version):
        content = f'[package]\nname="lightjunction"\nversion="{version}"\n'.encode()
        with tarfile.open(self.package, "w:gz") as archive:
            member = tarfile.TarInfo(f"lightjunction-{VERSION}/Cargo.toml")
            member.size = len(content)
            archive.addfile(member, io.BytesIO(content))

    def write_archives(self):
        for target in packaging.TARGETS:
            packaging.write_archive(
                self.artifacts / packaging.archive_name(VERSION, target),
                target,
                {
                    packaging.binary_name(target): executable(target),
                    "LICENSE": (self.crate / "LICENSE").read_bytes(),
                    "README.md": (self.crate / "README.md").read_bytes(),
                },
            )

    def test_six_names_and_version_constraints(self):
        names = {packaging.archive_name(VERSION, target) for target in packaging.TARGETS}
        self.assertEqual(len(names), 6)
        self.assertEqual(sum(name.endswith(".zip") for name in names), 2)
        for bad in ["v0.2.1", "0.2.1-rc1", "00.2.1", "../0.2.1", "0.2.1\n", f"{2**64}.0.0"]:
            with self.subTest(version=bad), self.assertRaises(ValueError):
                packaging.archive_name(bad, packaging.TARGETS[0])
        with self.assertRaises(ValueError):
            packaging.archive_name(VERSION, "x86_64-unknown-linux-gnu")

    def test_binary_headers_must_match_each_target(self):
        for target in packaging.TARGETS:
            with self.subTest(target=target):
                packaging.check_binary(executable(target), target)
                wrong_arch = (
                    target.replace("aarch64", "x86_64")
                    if target.startswith("aarch64")
                    else target.replace("x86_64", "aarch64")
                )
                with self.assertRaises(ValueError):
                    packaging.check_binary(executable(wrong_arch), target)
                with self.assertRaises(ValueError):
                    packaging.check_binary(b"not an executable", target)

    def test_linux_archives_cannot_need_a_dynamic_loader(self):
        for target in packaging.TARGETS[:2]:
            with self.subTest(target=target), self.assertRaises(ValueError):
                packaging.check_binary(executable(target, runtime=True), target)

    def test_windows_archives_cannot_need_a_separate_c_runtime(self):
        for target in packaging.TARGETS[-2:]:
            packaging.check_binary(executable(target, "KERNEL32.dll"), target)
            for runtime in [
                "VCRUNTIME140.dll",
                "MSVCP140.dll",
                "ucrtbase.dll",
                "api-ms-win-crt-heap-l1-1-0.dll",
            ]:
                with self.subTest(target=target, runtime=runtime), self.assertRaises(ValueError):
                    packaging.check_binary(executable(target, runtime), target)

    def test_archives_are_deterministic_and_have_only_three_regular_members(self):
        self.write_archives()
        for target in packaging.TARGETS:
            path = self.artifacts / packaging.archive_name(VERSION, target)
            files = packaging.read_archive(path, target)
            self.assertEqual(set(files), {packaging.binary_name(target), "LICENSE", "README.md"})
            second = self.root / path.name
            packaging.write_archive(second, target, files)
            self.assertEqual(path.read_bytes(), second.read_bytes())
            if "windows" in target:
                with zipfile.ZipFile(path) as archive:
                    self.assertTrue(
                        all(item.date_time == (1980, 1, 1, 0, 0, 0) for item in archive.infolist())
                    )
            else:
                with tarfile.open(path) as archive:
                    for member in archive.getmembers():
                        self.assertEqual((member.uid, member.gid, member.mtime), (0, 0, 0))
                        self.assertEqual(
                            member.mode, 0o755 if member.name == "lightjunction" else 0o644
                        )

    def test_archive_traversal_and_extra_members_are_rejected_without_extraction(self):
        target = packaging.TARGETS[0]
        path = self.artifacts / packaging.archive_name(VERSION, target)
        packaging.write_archive(
            path,
            target,
            {"../outside": b"unexpected", "LICENSE": b"license", "README.md": b"readme"},
        )
        with self.assertRaises(ValueError):
            packaging.read_archive(path, target)
        self.assertFalse((self.root / "outside").exists())

    def test_build_rejects_wrong_versions_and_smoke_failure_removes_output(self):
        target = packaging.TARGETS[0]
        binary = self.root / "lightjunction"
        binary.write_bytes(executable(target))
        output = self.root / "packed"
        with self.assertRaises(ValueError):
            packaging.build(self.crate, binary, target, "0.2.2", output)
        self.assertFalse(output.exists())
        with (
            mock.patch("package_binary.native_smoke", side_effect=ValueError("wrong version")),
            self.assertRaises(ValueError),
        ):
            packaging.build(self.crate, binary, target, VERSION, output)
        self.assertEqual(list(output.iterdir()), [])

    def test_assembly_emits_all_ten_assets_and_strict_checksums(self):
        self.write_archives()
        output = self.root / "release"
        packaging.assemble(self.crate, self.artifacts, self.package, VERSION, output)
        self.assertEqual(len(list(output.iterdir())), 10)
        lines = (output / "SHA256SUMS").read_text().splitlines()
        self.assertEqual(len(lines), 9)
        for line in lines:
            self.assertRegex(line, r"^[0-9a-f]{64}  [A-Za-z0-9._-]+$")
            checksum, name = line.split("  ")
            self.assertNotEqual(name, "SHA256SUMS")
            self.assertEqual(checksum, hashlib.sha256((output / name).read_bytes()).hexdigest())
        self.assertEqual(lines, sorted(lines, key=lambda line: line.split("  ")[1]))
        self.assertTrue((output / "SHA256SUMS").read_bytes().endswith(b"\n"))
        self.assertNotIn(b"\r", (output / "SHA256SUMS").read_bytes())

    def test_missing_extra_or_mixed_version_artifacts_cannot_be_assembled(self):
        self.write_archives()
        removed = self.artifacts / packaging.archive_name(VERSION, packaging.TARGETS[-1])
        removed.unlink()
        with self.assertRaises(ValueError):
            packaging.assemble(
                self.crate, self.artifacts, self.package, VERSION, self.root / "missing"
            )
        (self.artifacts / "unreviewed.exe").write_bytes(b"unreviewed")
        with self.assertRaises(ValueError):
            packaging.assemble(
                self.crate, self.artifacts, self.package, VERSION, self.root / "extra"
            )

    def test_different_documentation_and_cargo_versions_are_rejected(self):
        self.write_archives()
        self.write_crate("0.2.0")
        with self.assertRaises(ValueError):
            packaging.assemble(
                self.crate, self.artifacts, self.package, VERSION, self.root / "wrong-crate"
            )
        self.write_crate(VERSION)
        (self.crate / "README.md").write_bytes(b"new docs not in artifacts")
        with self.assertRaises(ValueError):
            packaging.assemble(
                self.crate, self.artifacts, self.package, VERSION, self.root / "wrong-docs"
            )

    def test_published_assets_are_immutable(self):
        expected, actual = self.root / "expected", self.root / "actual"
        expected.mkdir()
        (expected / "asset.tar.gz").write_bytes(b"original bytes")
        shutil.copytree(expected, actual)
        packaging.compare(expected, actual)
        (actual / "extra").write_bytes(b"extra")
        with self.assertRaises(ValueError):
            packaging.compare(expected, actual)
        (actual / "extra").unlink()
        (actual / "asset.tar.gz").write_bytes(b"replacement bytes")
        with self.assertRaises(ValueError):
            packaging.compare(expected, actual)


if __name__ == "__main__":
    unittest.main()
