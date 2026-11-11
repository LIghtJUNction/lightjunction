#!/usr/bin/env python3
"""Check real age/GPG encryption to the bundled public keys, without any private key.

Run after `cargo build --locked`; the default binary is target/debug/lightjunction.
Use --binary target/release/lightjunction to check a release build instead.
age 1.1+, age-plugin-yubikey, and GnuPG 2.2+ must all be on PATH.
This checks encryption, formats, recipients, and file handling; it is not a decrypt roundtrip.
"""

from __future__ import annotations

import argparse
import base64
import os
import random
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

AGE_TAG = b"StZkSQ"
GPG_RECIPIENT = b"E78F1DC59509F8E9"
TIMING = re.compile(rb"(?m)^\[time\] command=encrypt status=ok elapsed=[0-9.]+(?:us|ms|s)$")


def require(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(message)


def snapshot(directory: Path) -> dict[str, tuple[str, bytes | str | None]]:
    result: dict[str, tuple[str, bytes | str | None]] = {}
    for path in directory.rglob("*"):
        name = path.relative_to(directory).as_posix()
        if path.is_symlink():
            result[name] = ("symlink", os.readlink(path))
        elif path.is_file():
            result[name] = ("file", path.read_bytes())
        else:
            result[name] = ("directory", None)
    return result


def check_age(ciphertext: bytes, armored: bool) -> None:
    if armored:
        lines = ciphertext.splitlines()
        require(
            len(lines) >= 3
            and lines[0] == b"-----BEGIN AGE ENCRYPTED FILE-----"
            and lines[-1] == b"-----END AGE ENCRYPTED FILE-----",
            "age armor delimiters are missing or stdout contains extra text",
        )
        ciphertext = base64.b64decode(b"".join(lines[1:-1]), validate=True)
    require(ciphertext.startswith(b"age-encryption.org/v1\n"), "Invalid age v1 header")
    boundary = ciphertext.find(b"\n--- ")
    require(boundary > 0, "age header MAC line is missing")
    recipients = [
        line.split() for line in ciphertext[:boundary].splitlines() if line.startswith(b"-> ")
    ]
    require(
        len(recipients) == 1
        and len(recipients[0]) == 4
        and recipients[0][:3] == [b"->", b"piv-p256", AGE_TAG],
        "age ciphertext does not target exactly the bundled YubiKey recipient",
    )
    header_end = ciphertext.find(b"\n", boundary + 1)
    require(
        header_end >= 0 and len(ciphertext) > header_end + 32,
        "age ciphertext payload is missing",
    )


def check_gpg(
    ciphertext: bytes,
    armored: bool,
    gpg: str,
    inspection_home: Path,
    environment: dict[str, str],
) -> None:
    if armored:
        lines = ciphertext.splitlines()
        require(
            bool(lines)
            and lines[0] == b"-----BEGIN PGP MESSAGE-----"
            and lines[-1] == b"-----END PGP MESSAGE-----",
            "GPG armor delimiters are missing or stdout contains extra text",
        )
    inspection = subprocess.run(
        [
            gpg,
            "--no-options",
            "--homedir",
            str(inspection_home),
            "--batch",
            "--no-tty",
            "--no-autostart",
            "--no-keyring",
            "--disable-dirmngr",
            "--list-only",
            "--list-packets",
        ],
        input=ciphertext,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        env=environment,
        timeout=60,
        check=False,
    )
    require(
        inspection.returncode == 0,
        "Isolated GPG packet inspection failed: "
        + inspection.stderr.decode(errors="replace")[:2000],
    )
    recipient_ids = re.findall(
        rb"(?m)^:pubkey enc packet:.*\bkeyid ([0-9A-F]+)$", inspection.stdout
    )
    require(recipient_ids == [GPG_RECIPIENT], "GPG ciphertext has an unexpected recipient list")
    require(b":symkey enc packet:" not in inspection.stdout, "GPG added a symmetric recipient")
    require(b":encrypted data packet:" in inspection.stdout, "GPG encrypted payload is missing")


def check(binary: Path, tools: dict[str, str]) -> int:
    checks = 0
    small = b"lightjunction non-sensitive encryption fixture\x00\n" + bytes(range(256)) * 4
    large = random.Random(0).randbytes(3 * 1024 * 1024)
    with tempfile.TemporaryDirectory(prefix="lightjunction-crypto-check-") as temporary:
        root = Path(temporary)
        caller_home = root / "caller-gnupg"
        inspection_home = root / "inspection-gnupg"
        cli_temporary = root / "cli-temporary"
        for directory in (caller_home, inspection_home, cli_temporary):
            directory.mkdir(mode=0o700)
        (caller_home / "gpg.conf").write_text(
            "this-option-must-never-be-read\nencrypt-to 0000000000000000\n", encoding="utf-8"
        )
        (caller_home / "sentinel").write_bytes(b"Do not modify the caller's GnuPG home.\n")
        untouched = snapshot(caller_home)
        environment = dict(
            os.environ,
            GNUPGHOME=str(caller_home),
            TMPDIR=str(cli_temporary),
            TMP=str(cli_temporary),
            TEMP=str(cli_temporary),
            LC_ALL="C",
            LANG="C",
            NO_COLOR="1",
            TERM="dumb",
        )

        # Versions are read from executables on PATH; no key or hardware discovery is invoked.
        for name, executable in tools.items():
            command = [executable, "--version"]
            if name == "gpg":
                command = [
                    executable,
                    "--no-options",
                    "--homedir",
                    str(inspection_home),
                    "--version",
                ]
            version = subprocess.run(
                command,
                stdin=subprocess.DEVNULL,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                env=environment,
                timeout=15,
                check=False,
            )
            require(version.returncode == 0, f"{name} is present but --version failed")

        def invoke(arguments: list[str], data: bytes | None = None, success: bool = True) -> bytes:
            result = subprocess.run(
                [str(binary), *arguments],
                input=data,
                stdin=subprocess.DEVNULL if data is None else None,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                env=environment,
                timeout=90,
                check=False,
            )
            require(
                (result.returncode == 0) == success,
                f"Unexpected exit {result.returncode} for {arguments!r}: "
                + result.stderr.decode(errors="replace")[:2000],
            )
            if success:
                require(
                    TIMING.search(result.stderr) is not None,
                    "Encryption timing missing from stderr",
                )
            require(snapshot(caller_home) == untouched, "The caller's GNUPGHOME was modified")
            require(
                not list(cli_temporary.iterdir()),
                "An isolated GPG temporary home was left behind",
            )
            require(
                not list(root.glob(".lightjunction-*")),
                "A ciphertext staging file was left behind",
            )
            return result.stdout

        def validate(ciphertext: bytes, protocol: str, armored: bool = False) -> None:
            require(bool(ciphertext), "No ciphertext was produced")
            require(b"[time]" not in ciphertext, "Timing text contaminated ciphertext stdout")
            if protocol == "age":
                check_age(ciphertext, armored)
            else:
                check_gpg(ciphertext, armored, tools["gpg"], inspection_home, environment)

        source = root / "input with spaces.bin"
        source.write_bytes(small)
        for protocol in ("age", "gpg"):
            output = root / f"file.{protocol}"
            stdout = invoke(["encrypt", protocol, "--input", str(source), "--output", str(output)])
            require(stdout == b"", "File encryption unexpectedly wrote to stdout")
            validate(output.read_bytes(), protocol)
            require(source.read_bytes() == small, "File encryption modified its input")
            checks += 1

            validate(invoke(["encrypt", protocol], small), protocol)
            checks += 1

            validate(
                invoke(["encrypt", protocol, "--input", "-", "--output", "-", "--armor"], small),
                protocol,
                armored=True,
            )
            checks += 1

            armored_output = root / f"armored.{protocol}"
            stdout = invoke(
                [
                    "encrypt",
                    protocol,
                    "--input",
                    str(source),
                    "--output",
                    str(armored_output),
                    "--armor",
                ]
            )
            require(stdout == b"", "Armored file encryption unexpectedly wrote to stdout")
            validate(armored_output.read_bytes(), protocol, armored=True)
            checks += 1

            large_output = root / f"large.{protocol}"
            require(
                invoke(["encrypt", protocol, "--output", str(large_output)], large) == b"",
                "Large file encryption unexpectedly wrote to stdout",
            )
            ciphertext = large_output.read_bytes()
            validate(ciphertext, protocol)
            require(len(ciphertext) > 3_000_000, "Large-input ciphertext was unexpectedly small")
            checks += 1

            previous = output.read_bytes()
            require(
                invoke(
                    ["encrypt", protocol, "--input", str(source), "--output", str(output)],
                    success=False,
                )
                == b"",
                "Refused overwrite wrote to stdout",
            )
            require(output.read_bytes() == previous, "An existing ciphertext file was overwritten")
            checks += 1

            invoke(
                ["encrypt", protocol, "--input", str(source), "--output", str(source)],
                success=False,
            )
            require(source.read_bytes() == small, "An input/output alias destroyed plaintext")
            checks += 1

        require(snapshot(caller_home) == untouched, "The caller's GnuPG state changed")
        print(
            f"PASS: {checks} real age/GPG encryption checks; 3 MiB streams, armor, recipients, "
            "no-overwrite, isolated GnuPG."
        )
        print(
            "Public-key encryption and packet inspection only; "
            "no private keys or decryption were used."
        )
    return checks


def main() -> int:
    crate = Path(__file__).resolve().parents[1]
    executable = "lightjunction.exe" if os.name == "nt" else "lightjunction"
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--binary", type=Path, default=crate / "target" / "debug" / executable)
    arguments = parser.parse_args()
    binary = arguments.binary.resolve()
    if not binary.is_file():
        parser.error(f"CLI binary not found: {binary}; run cargo build --locked first")
    tools: dict[str, str] = {}
    for name in ("age", "age-plugin-yubikey", "gpg"):
        executable_path = shutil.which(name)
        if executable_path is None:
            parser.error(f"Required real backend is missing from PATH: {name}")
        tools[name] = executable_path
    try:
        check(binary, tools)
    except (OSError, RuntimeError, ValueError, subprocess.SubprocessError) as error:
        print(f"FAIL: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
