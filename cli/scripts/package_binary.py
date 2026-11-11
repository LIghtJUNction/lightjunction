"""Build deterministic native CLI archives and verify complete release asset sets."""

from __future__ import annotations

import argparse
import gzip
import hashlib
import io
import json
import os
import re
import shutil
import stat
import struct
import subprocess
import tarfile
import tempfile
import tomllib
import zipfile
from pathlib import Path

TARGETS = (
    "x86_64-unknown-linux-musl",
    "aarch64-unknown-linux-musl",
    "x86_64-apple-darwin",
    "aarch64-apple-darwin",
    "x86_64-pc-windows-msvc",
    "aarch64-pc-windows-msvc",
)
VERSION = re.compile(r"(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\Z")
CRATE = Path(__file__).resolve().parents[1]


def check_version(version: str) -> None:
    if not VERSION.fullmatch(version) or any(int(part) >= 2**64 for part in version.split(".")):
        raise ValueError("Expected a stable MAJOR.MINOR.PATCH version with u64 components")


def binary_name(target: str) -> str:
    if target not in TARGETS:
        raise ValueError(f"Unsupported target: {target!r}")
    return "lightjunction.exe" if "windows" in target else "lightjunction"


def archive_name(version: str, target: str) -> str:
    check_version(version)
    extension = "zip" if binary_name(target).endswith(".exe") else "tar.gz"
    return f"lightjunction-v{version}-{target}.{extension}"


def read_regular(path: Path) -> bytes:
    if path.is_symlink() or not path.is_file():
        raise ValueError(f"Expected a regular file, not a symlink: {path}")
    content = path.read_bytes()
    if not content:
        raise ValueError(f"File is empty: {path}")
    return content


def pe_imports(data: bytes, pe: int) -> list[str]:
    optional = pe + 24
    optional_size = struct.unpack_from("<H", data, pe + 20)[0]
    if optional_size < 128 or struct.unpack_from("<H", data, optional)[0] != 0x20B:
        raise ValueError("Expected a PE32+ optional header")
    import_rva = struct.unpack_from("<I", data, optional + 120)[0]
    if not import_rva:
        return []
    section_count = struct.unpack_from("<H", data, pe + 6)[0]
    section_start = optional + optional_size

    def offset(rva: int) -> int:
        for index in range(section_count):
            section = section_start + 40 * index
            _, address, raw_size, raw_offset = struct.unpack_from("<IIII", data, section + 8)
            if address <= rva < address + raw_size:
                result = raw_offset + rva - address
                if result >= len(data):
                    break
                return result
        raise ValueError("Invalid PE import address")

    imports = []
    descriptor = offset(import_rva)
    for index in range(256):
        fields = struct.unpack_from("<IIIII", data, descriptor + index * 20)
        if not any(fields):
            return imports
        start = offset(fields[3])
        end = data.find(b"\0", start, start + 256)
        if end < 0:
            raise ValueError("Invalid PE import name")
        imports.append(data[start:end].decode("ascii").lower())
    raise ValueError("Unterminated PE import directory")


def check_binary(data: bytes, target: str) -> None:
    binary_name(target)
    arm = target.startswith("aarch64")
    try:
        if "linux" in target:
            if data[:6] != b"\x7fELF\x02\x01":
                raise ValueError("Expected a little-endian ELF64 executable")
            if struct.unpack_from("<H", data, 18)[0] != (183 if arm else 62):
                raise ValueError("ELF architecture does not match the release target")
            start = struct.unpack_from("<Q", data, 32)[0]
            size, count = struct.unpack_from("<HH", data, 54)
            if size < 56 or count == 0 or start + size * count > len(data):
                raise ValueError("Invalid ELF program headers")
            if any(struct.unpack_from("<I", data, start + size * i)[0] == 3 for i in range(count)):
                raise ValueError("Linux musl releases must not require a dynamic ELF interpreter")
        elif "darwin" in target:
            if data[:4] != b"\xcf\xfa\xed\xfe":
                raise ValueError("Expected a little-endian Mach-O 64 executable")
            if struct.unpack_from("<I", data, 4)[0] != (0x0100000C if arm else 0x01000007):
                raise ValueError("Mach-O architecture does not match the release target")
        else:
            if data[:2] != b"MZ":
                raise ValueError("Expected a Windows PE executable")
            pe = struct.unpack_from("<I", data, 60)[0]
            if data[pe : pe + 4] != b"PE\0\0":
                raise ValueError("Invalid PE signature")
            if struct.unpack_from("<H", data, pe + 4)[0] != (0xAA64 if arm else 0x8664):
                raise ValueError("PE architecture does not match the release target")
            for imported in pe_imports(data, pe):
                if (
                    imported.startswith(("vcruntime", "msvcp", "api-ms-win-crt-"))
                    or imported == "ucrtbase.dll"
                ):
                    raise ValueError(f"Windows release requires a separate C runtime: {imported}")
    except (struct.error, UnicodeDecodeError) as error:
        raise ValueError("Malformed executable header") from error


def write_archive(path: Path, target: str, files: dict[str, bytes]) -> None:
    executable = binary_name(target)
    if "windows" in target:
        with zipfile.ZipFile(
            path, "x", compression=zipfile.ZIP_DEFLATED, compresslevel=9
        ) as archive:
            for name, content in files.items():
                member = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
                member.create_system = 3
                member.external_attr = (
                    stat.S_IFREG | (0o755 if name == executable else 0o644)
                ) << 16
                member.compress_type = zipfile.ZIP_DEFLATED
                archive.writestr(member, content, compresslevel=9)
    else:
        with (
            path.open("xb") as raw,
            gzip.GzipFile(filename="", mode="wb", fileobj=raw, mtime=0) as compressed,
            tarfile.open(fileobj=compressed, mode="w", format=tarfile.USTAR_FORMAT) as archive,
        ):
            for name, content in files.items():
                member = tarfile.TarInfo(name)
                member.size = len(content)
                member.mode = 0o755 if name == executable else 0o644
                member.mtime = 0
                archive.addfile(member, io.BytesIO(content))


def read_archive(path: Path, target: str) -> dict[str, bytes]:
    read_regular(path)
    executable = binary_name(target)
    expected = {executable, "LICENSE", "README.md"}
    files = {}
    if "windows" in target:
        with zipfile.ZipFile(path) as archive:
            members = archive.infolist()
            if len(members) != 3 or {member.filename for member in members} != expected:
                raise ValueError(f"Archive must contain exactly {sorted(expected)}")
            for member in members:
                if member.is_dir() or stat.S_IFMT(member.external_attr >> 16) != stat.S_IFREG:
                    raise ValueError("ZIP members must be regular files")
                files[member.filename] = archive.read(member)
    else:
        with tarfile.open(path, "r:gz") as archive:
            members = archive.getmembers()
            if len(members) != 3 or {member.name for member in members} != expected:
                raise ValueError(f"Archive must contain exactly {sorted(expected)}")
            for member in members:
                if not member.isfile() or member.mode != (
                    0o755 if member.name == executable else 0o644
                ):
                    raise ValueError(
                        "Tar members must be regular files with the expected permissions"
                    )
                source = archive.extractfile(member)
                if source is None:
                    raise ValueError("Missing archive member content")
                files[member.name] = source.read()
    if not all(files.values()):
        raise ValueError("Archive members must not be empty")
    check_binary(files[executable], target)
    return files


def native_smoke(archive: Path, target: str, version: str, crate: Path) -> None:
    files = read_archive(archive, target)
    with tempfile.TemporaryDirectory(prefix="lightjunction-smoke-") as temporary:
        executable = Path(temporary) / binary_name(target)
        executable.write_bytes(files[executable.name])
        executable.chmod(0o755)

        def run(*arguments: str) -> bytes:
            result = subprocess.run(
                [str(executable), "--no-timing", *arguments],
                stdin=subprocess.DEVNULL,
                capture_output=True,
                check=True,
                timeout=20,
            )
            if result.stderr:
                raise ValueError(f"Packaged binary wrote unexpected stderr: {result.stderr!r}")
            return result.stdout

        if run("--version").strip() != f"lightjunction {version}".encode():
            raise ValueError("Packaged binary reports a different version")
        about = json.loads(run("about", "--json", "--lang", "en"))
        if (
            about.get("command") != "about"
            or about.get("language") != "en"
            or not about.get("sections")
        ):
            raise ValueError("Packaged binary did not produce the expected JSON introduction")
        if run("keys", "ssh") != read_regular(crate / "keys" / "ssh-public-keys.txt"):
            raise ValueError("Packaged binary exports different SSH public keys")


def build(crate: Path, binary: Path, target: str, version: str, output: Path) -> Path:
    name = archive_name(version, target)
    manifest = tomllib.loads(read_regular(crate / "Cargo.toml").decode())
    if manifest["package"]["name"] != "lightjunction" or manifest["package"]["version"] != version:
        raise ValueError("Manifest name/version does not match the requested release")
    if binary.name != binary_name(target):
        raise ValueError("Unexpected input executable name")
    data = read_regular(binary)
    check_binary(data, target)
    files = {
        binary.name: data,
        "LICENSE": read_regular(crate / "LICENSE"),
        "README.md": read_regular(crate / "README.md"),
    }
    output.mkdir(parents=True, exist_ok=True)
    destination = output / name
    write_archive(destination, target, files)
    try:
        native_smoke(destination, target, version, crate)
    except Exception:
        destination.unlink()
        raise
    return destination.resolve()


def directory_files(directory: Path) -> dict[str, Path]:
    if directory.is_symlink() or not directory.is_dir():
        raise ValueError(f"Expected an asset directory: {directory}")
    result = {path.name: path for path in directory.iterdir()}
    for path in result.values():
        read_regular(path)
    return result


def digest(path: Path) -> str:
    with path.open("rb") as source:
        return hashlib.file_digest(source, "sha256").hexdigest()


def assemble(crate: Path, artifacts: Path, package: Path, version: str, output: Path) -> None:
    check_version(version)
    expected = {archive_name(version, target) for target in TARGETS}
    archives = directory_files(artifacts)
    if set(archives) != expected:
        raise ValueError(
            "Expected exactly six native archives; "
            f"missing={sorted(expected - archives.keys())}, "
            f"extra={sorted(archives.keys() - expected)}"
        )
    for target in TARGETS:
        files = read_archive(archives[archive_name(version, target)], target)
        for name in ("LICENSE", "README.md"):
            if files[name] != read_regular(crate / name):
                raise ValueError(f"{target} contains different {name} content")
    if package.name != f"lightjunction-{version}.crate":
        raise ValueError("Unexpected Cargo archive filename")
    read_regular(package)
    with tarfile.open(package, "r:gz") as archive:
        member = archive.getmember(f"lightjunction-{version}/Cargo.toml")
        if not member.isfile():
            raise ValueError("Cargo manifest must be a regular file")
        source = archive.extractfile(member)
        if source is None:
            raise ValueError("Cargo archive does not contain its manifest")
        metadata = tomllib.loads(source.read().decode())["package"]
        if metadata["name"] != "lightjunction" or metadata["version"] != version:
            raise ValueError("Cargo archive name/version does not match the native archives")
    assets = {**archives, package.name: package}
    for installer in ("install.sh", "install.ps1"):
        read_regular(crate / installer)
        assets[installer] = crate / installer
    if output.exists() and any(output.iterdir()):
        raise ValueError("Release output directory must be empty")
    output.mkdir(parents=True, exist_ok=True)
    for name, source in sorted(assets.items()):
        shutil.copyfile(source, output / name)
    checksum = "".join(f"{digest(output / name)}  {name}\n" for name in sorted(assets))
    (output / "SHA256SUMS").write_text(checksum, encoding="ascii", newline="\n")


def compare(expected: Path, actual: Path) -> None:
    expected_files, actual_files = directory_files(expected), directory_files(actual)
    if expected_files.keys() != actual_files.keys():
        raise ValueError(
            "Published asset names differ; use a new version instead of replacing them"
        )
    for name, source in expected_files.items():
        if digest(source) != digest(actual_files[name]):
            raise ValueError(
                f"Published asset {name} differs; use a new version instead of replacing it"
            )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    package = commands.add_parser("build", help="Package and natively test one target")
    package.add_argument("--target", choices=TARGETS, required=True)
    package.add_argument("--version", required=True)
    package.add_argument("--binary", type=Path, required=True)
    package.add_argument("--output-dir", type=Path, required=True)
    assembly = commands.add_parser("assemble", help="Verify and collect all release assets")
    assembly.add_argument("--version", required=True)
    assembly.add_argument("--artifacts", type=Path, required=True)
    assembly.add_argument("--crate", type=Path, required=True)
    assembly.add_argument("--output-dir", type=Path, required=True)
    comparison = commands.add_parser("compare", help="Require identical published assets")
    comparison.add_argument("--expected", type=Path, required=True)
    comparison.add_argument("--actual", type=Path, required=True)
    args = parser.parse_args()
    try:
        if args.command == "build":
            archive = build(CRATE, args.binary, args.target, args.version, args.output_dir)
            outputs = {"archive": str(archive), "asset": archive.name}
            print(json.dumps(outputs))
            if output := os.environ.get("GITHUB_OUTPUT"):
                with Path(output).open("a", encoding="utf-8", newline="\n") as stream:
                    stream.write("".join(f"{key}={value}\n" for key, value in outputs.items()))
        elif args.command == "assemble":
            assemble(CRATE, args.artifacts, args.crate, args.version, args.output_dir)
            print("Verified six native archives, two installers, one crate and SHA256SUMS")
        else:
            compare(args.expected, args.actual)
            print("All published asset names and SHA-256 checksums match")
    except (
        ValueError,
        KeyError,
        OSError,
        tarfile.TarError,
        zipfile.BadZipFile,
        subprocess.SubprocessError,
    ) as error:
        parser.exit(1, f"Packaging failed: {error}\n")


if __name__ == "__main__":
    main()
