"""Test version changes and the safeguards around immutable registry artifacts."""

import hashlib
import tempfile
import unittest
import urllib.error
from pathlib import Path
from unittest import mock

import release

MANIFEST = """[package]
name = "lightjunction"
version = "0.1.0"
edition = "2024"

[dependencies]
zclap = { version = "=0.1.4" }
"""
LOCK = """version = 4

[[package]]
name = "lightjunction"
version = "0.1.0"
dependencies = ["zclap"]

[[package]]
name = "zclap"
version = "0.1.4"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "dependency-checksum"
"""


class ReleaseTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.crate = Path(self.temporary.name)
        (self.crate / "Cargo.toml").write_text(MANIFEST)
        (self.crate / "Cargo.lock").write_text(LOCK)

    def test_bumps_have_semver_reset_behavior(self):
        for bump, expected in [
            ("none", "1.2.3"),
            ("patch", "1.2.4"),
            ("minor", "1.3.0"),
            ("major", "2.0.0"),
        ]:
            with self.subTest(bump=bump):
                self.assertEqual(release.next_version("1.2.3", bump, ""), expected)

    def test_custom_version_must_be_newer_stable_and_unambiguous(self):
        for custom in [
            "0.0.9",
            "0.1.0",
            "01.2.3",
            "0.2.0-rc.1",
            "v1.0.0",
            "1.2.3\n",
            "1.2.3;false",
        ]:
            with self.subTest(custom=custom), self.assertRaises(ValueError):
                release.next_version("0.1.0", "none", custom)
        with self.assertRaises(ValueError):
            release.next_version("0.1.0", "patch", "0.2.0")
        with self.assertRaises(ValueError):
            release.next_version(f"0.0.{2**64 - 1}", "patch", "")
        self.assertEqual(release.next_version("0.1.0", "none", "0.2.0"), "0.2.0")

    def test_manifest_and_lock_are_updated_without_dependency_changes(self):
        self.assertEqual(release.prepare(self.crate, "minor"), ("0.2.0", True))
        self.assertEqual(
            (self.crate / "Cargo.toml").read_text(), MANIFEST.replace('"0.1.0"', '"0.2.0"')
        )
        self.assertEqual(
            (self.crate / "Cargo.lock").read_text(), LOCK.replace('"0.1.0"', '"0.2.0"')
        )
        self.assertEqual(release.prepare(self.crate), ("0.2.0", False))

    def test_inconsistent_lock_fails_before_any_write(self):
        inconsistent = LOCK.replace('"0.1.0"', '"0.0.9"')
        (self.crate / "Cargo.lock").write_text(inconsistent)
        with self.assertRaises(ValueError):
            release.prepare(self.crate, "patch")
        self.assertEqual((self.crate / "Cargo.toml").read_text(), MANIFEST)
        self.assertEqual((self.crate / "Cargo.lock").read_text(), inconsistent)

    def test_duplicate_local_package_is_rejected(self):
        (self.crate / "Cargo.lock").write_text(
            LOCK + '\n[[package]]\nname="lightjunction"\nversion="0.1.0"\n'
        )
        with self.assertRaises(ValueError):
            release.prepare(self.crate, "patch")

    def test_checksum_rejects_different_or_yanked_archives(self):
        archive = self.crate / "release.crate"
        archive.write_bytes(b"verified crate bytes")
        record = {"cksum": hashlib.sha256(archive.read_bytes()).hexdigest(), "yanked": False}
        release.verify_checksum(archive, record)
        with self.assertRaises(ValueError):
            release.verify_checksum(archive, {**record, "yanked": True})
        archive.write_bytes(b"different crate bytes")
        with self.assertRaises(ValueError):
            release.verify_checksum(archive, record)

    def test_only_a_real_404_counts_as_a_missing_registry_package(self):
        for status in [403, 429, 500]:
            error = urllib.error.HTTPError(release.INDEX_URL, status, "unavailable", {}, None)
            with (
                self.subTest(status=status),
                mock.patch("urllib.request.urlopen", side_effect=error),
                self.assertRaises(urllib.error.HTTPError),
            ):
                release.registry_record("0.1.0")
        error = urllib.error.HTTPError(release.INDEX_URL, 404, "not found", {}, None)
        with mock.patch("urllib.request.urlopen", side_effect=error):
            self.assertIsNone(release.registry_record("0.1.0"))

    def test_dirty_checkout_cannot_publish(self):
        with (
            mock.patch("subprocess.check_output", return_value=" M src/main.rs\n"),
            mock.patch("subprocess.run") as run,
            self.assertRaises(ValueError),
        ):
            release.publish(self.crate)
        run.assert_not_called()

    def test_existing_different_version_cannot_publish(self):
        archive = self.crate / "target/package/lightjunction-0.1.0.crate"
        archive.parent.mkdir(parents=True)
        archive.write_bytes(b"local archive")
        with (
            mock.patch("subprocess.check_output", return_value=""),
            mock.patch("subprocess.run") as run,
            mock.patch(
                "release.registry_record", return_value={"cksum": "different", "yanked": False}
            ),
            self.assertRaises(ValueError),
        ):
            release.publish(self.crate)
        self.assertEqual(
            [call.args[0] for call in run.call_args_list], [["cargo", "package", "--locked"]]
        )

    def test_identical_published_archive_is_an_idempotent_success(self):
        archive = self.crate / "target/package/lightjunction-0.1.0.crate"
        archive.parent.mkdir(parents=True)
        archive.write_bytes(b"identical published archive")
        record = {"cksum": hashlib.sha256(archive.read_bytes()).hexdigest(), "yanked": False}
        with (
            mock.patch("subprocess.check_output", return_value=""),
            mock.patch("subprocess.run") as run,
            mock.patch("release.registry_record", return_value=record),
            mock.patch("builtins.print"),
        ):
            release.publish(self.crate)
        self.assertEqual(
            [call.args[0] for call in run.call_args_list], [["cargo", "package", "--locked"]]
        )


if __name__ == "__main__":
    unittest.main()
