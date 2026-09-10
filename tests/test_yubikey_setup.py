"""Offline behavior tests for the public-key and YubiKey client entrypoints."""

from __future__ import annotations

import hashlib
import os
import shutil
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
KEY = "EB21B83AB1E982DF66F08387A67178405F7736FD"
SSH_KEY = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIIIfn9O6HwbXi4CWAXp52ZhIho/7pXniY4v3vfm9osY9 test"


def executable(path: Path, content: str) -> None:
    path.write_text("#!/usr/bin/env bash\nset -euo pipefail\n" + content, encoding="utf-8")
    path.chmod(0o755)


@pytest.fixture
def sandbox(tmp_path: Path) -> tuple[Path, dict[str, str]]:
    home = tmp_path / "home with spaces"
    home.mkdir()
    tools = tmp_path / "bin"
    tools.mkdir()
    listing = tmp_path / "listing"
    listing.write_text(f"pub:-:255:22:EXAMPLE:::::::c:\nfpr:::::::::{KEY}:\n")
    payload = tmp_path / "payload"
    payload.write_text("public certificate fixture")
    env = {
        key: value
        for key, value in os.environ.items()
        if not key.startswith(("LIGHTJUNCTION_", "GPG", "SSH_", "XDG_"))
        and key not in {"SUDO_USER", "ZDOTDIR"}
    }
    env.update(
        HOME=str(home),
        SHELL="/bin/zsh",
        GNUPGHOME=str(home / ".gnupg"),
        PATH=f"{tools}:{os.environ['PATH']}",
        MOCK_LOG=str(tmp_path / "calls"),
        MOCK_LISTING=str(listing),
        MOCK_PAYLOAD=str(payload),
        MOCK_FETCH=str(ROOT / "fetch-ssh-pub-key.sh"),
        MOCK_SSH_KEY=SSH_KEY,
    )
    executable(
        tools / "curl",
        r"""printf 'curl %s\n' "$*" >> "$MOCK_LOG"
output=''; source_file="$MOCK_PAYLOAD"
while (($#)); do
    case "$1" in
        *fetch-ssh-pub-key.sh) source_file="$MOCK_FETCH"; shift ;;
        -o) output="$2"; shift 2 ;;
        *) shift ;;
    esac
done
cp "$source_file" "$output"
exit "${MOCK_CURL_STATUS:-0}"
""",
    )
    executable(
        tools / "gpg",
        r"""printf 'gpg %s\n' "$*" >> "$MOCK_LOG"
case " $* " in
    *' --show-keys '*) cat "$MOCK_LISTING" ;;
    *' --export-ssh-key '*) printf '%s\n' "$MOCK_SSH_KEY" ;;
    *' --export '*) printf 'SELECTED PUBLIC CERTIFICATE\n' ;;
    *' --import '*|*' --recv-keys '*) exit 0 ;;
    *' --card-status '*) exit "${MOCK_CARD_STATUS:-1}" ;;
    *) exit 2 ;;
esac
""",
    )
    executable(
        tools / "gpgconf",
        r"""printf 'gpgconf %s\n' "$*" >> "$MOCK_LOG"
case "$*" in
    '--list-dirs homedir') printf '%s\n' "$GNUPGHOME" ;;
    '--list-dirs agent-ssh-socket') printf '%s/S.gpg-agent.ssh\n' "$GNUPGHOME" ;;
    '--reload gpg-agent'|'--launch gpg-agent') exit 0 ;;
    *) exit 2 ;;
esac
""",
    )
    executable(tools / "gpg-connect-agent", 'printf "connect %s\\n" "$*" >> "$MOCK_LOG"\n')
    executable(tools / "pinentry-curses", "exit 0\n")
    executable(
        tools / "systemctl",
        'printf "systemctl %s\\n" "$*" >> "$MOCK_LOG"\nexit "${MOCK_SYSTEMD_STATUS:-1}"\n',
    )
    return home, env


def run(script: str, env: dict[str, str], *args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["bash", str(ROOT / script), *args],
        env=env,
        text=True,
        capture_output=True,
        check=False,
        timeout=30,
    )


def test_fetch_stdout_and_atomic_output(sandbox: tuple[Path, dict[str, str]]) -> None:
    home, env = sandbox
    output = home / "key.pub"
    output.write_text("old")
    result = run("fetch-ssh-pub-key.sh", env, "--output", str(output))
    assert result.returncode == 0, result.stderr
    assert output.read_text() == SSH_KEY + "\n"
    assert output.stat().st_mode & 0o777 == 0o644
    assert not result.stdout
    assert run("fetch-ssh-pub-key.sh", env).stdout == SSH_KEY + "\n"
    log = Path(env["MOCK_LOG"]).read_text()
    assert "https://github.com/LIghtJUNction.gpg" in log
    assert "--proto =https --proto-redir =https" in log
    assert "--recv-keys" not in log


@pytest.mark.parametrize("kind", ["wrong", "subkey", "secret", "empty", "network"])
def test_failed_fetch_preserves_output(sandbox: tuple[Path, dict[str, str]], kind: str) -> None:
    home, env = sandbox
    output = home / "key.pub"
    output.write_text("keep this key\n")
    if kind == "network":
        env["MOCK_CURL_STATUS"] = "22"
    else:
        listings = {
            "wrong": "pub::::::::::\nfpr:::::::::0000000000000000000000000000000000000000:\n",
            "subkey": f"pub::::::::::\nfpr:::::::::OTHER:\nsub::::::::::\nfpr:::::::::{KEY}:\n",
            "secret": f"sec::::::::::\nfpr:::::::::{KEY}:\n",
            "empty": "",
        }
        Path(env["MOCK_LISTING"]).write_text(listings[kind])
    result = run("fetch-ssh-pub-key.sh", env, "--output", str(output))
    assert result.returncode != 0
    assert output.read_text() == "keep this key\n"
    assert "--import" not in Path(env["MOCK_LOG"]).read_text()
    assert not list(home.glob(".lightjunction-pub.*"))


def test_legacy_keyserver_does_not_require_curl(sandbox: tuple[Path, dict[str, str]]) -> None:
    _, env = sandbox
    env["LIGHTJUNCTION_GPG_KEYSERVER"] = "hkps://example.invalid"
    result = run("fetch-ssh-pub-key.sh", env)
    assert result.returncode == 0, result.stderr
    log = Path(env["MOCK_LOG"]).read_text()
    assert "--keyserver hkps://example.invalid --recv-keys" in log
    assert "curl " not in log


@pytest.mark.parametrize("args", [("--output", ""), ("--output=",), ("--bad",)])
def test_arguments_fail_before_fetch(
    sandbox: tuple[Path, dict[str, str]], args: tuple[str, ...]
) -> None:
    _, env = sandbox
    assert run("fetch-ssh-pub-key.sh", env, *args).returncode != 0
    assert not Path(env["MOCK_LOG"]).exists()


def test_setup_is_idempotent_and_preserves_existing_data(
    sandbox: tuple[Path, dict[str, str]],
) -> None:
    home, env = sandbox
    (home / ".ssh").mkdir()
    (home / ".ssh/authorized_keys").write_text("existing server access\n")
    (home / ".bashrc").write_text("export KEEP_ME=yes\n")
    (home / ".bashrc").chmod(0o640)
    first = run("setup-gpg-agent.sh", env, "--no-sync")
    assert first.returncode == 0, first.stderr
    names = (".bashrc", ".zshrc", ".gnupg/gpg-agent.conf", ".config/lightjunction/gpg-agent.sh")
    paths = [home / path for path in names]
    before = [(p.read_bytes(), p.stat().st_mtime_ns) for p in paths]
    second = run("setup-gpg-agent.sh", env, "--no-sync")
    assert second.returncode == 0, second.stderr
    assert before == [(p.read_bytes(), p.stat().st_mtime_ns) for p in paths]
    assert (home / ".bashrc.lightjunction.bak").read_text() == "export KEEP_ME=yes\n"
    assert (home / ".bashrc").stat().st_mode & 0o777 == 0o640
    assert (home / ".ssh/authorized_keys").read_text() == "existing server access\n"
    log = Path(env["MOCK_LOG"]).read_text()
    assert "--kill" not in log and "systemctl" not in log
    assert "--card-edit" not in log and "--import-ownertrust" not in log
    assert "Card not detected" in second.stderr
    assert run("fetch-ssh-pub-key.sh", env).returncode == 0
    manual = subprocess.run(
        [str(home / ".local/bin/lightjunction-key-sync")],
        env=env,
        text=True,
        capture_output=True,
        check=False,
        timeout=30,
    )
    assert manual.returncode == 0, manual.stderr


def test_setup_preserves_custom_agent_policy(sandbox: tuple[Path, dict[str, str]]) -> None:
    home, env = sandbox
    (home / ".gnupg").mkdir()
    conf = home / ".gnupg/gpg-agent.conf"
    custom = "pinentry-program /custom/pinentry\ndefault-cache-ttl 777\nlog-file /tmp/gpg-log\n"
    conf.write_text(custom)
    result = run("setup-gpg-agent.sh", env, "--no-sync")
    assert result.returncode == 0, result.stderr
    assert conf.read_text().startswith(custom)
    assert conf.read_text().count("pinentry-program") == 1
    assert "default-cache-ttl 3600" not in conf.read_text()


def test_setup_respects_symlink_dotfiles(sandbox: tuple[Path, dict[str, str]]) -> None:
    home, env = sandbox
    target = home / "bash-config"
    target.write_text("# user dotfile\n")
    (home / ".bashrc").symlink_to("bash-config")
    result = run("setup-gpg-agent.sh", env, "--no-sync")
    assert result.returncode == 0, result.stderr
    assert (home / ".bashrc").is_symlink()
    assert "# user dotfile" in target.read_text()
    assert "lightjunction gpg-agent" in target.read_text()


def test_setup_rejects_malformed_blocks(sandbox: tuple[Path, dict[str, str]]) -> None:
    home, env = sandbox
    (home / ".gnupg").mkdir()
    conf = home / ".gnupg/gpg-agent.conf"
    original = "keep\n# >>> lightjunction gpg-agent >>>\nunclosed\n"
    conf.write_text(original)
    result = run("setup-gpg-agent.sh", env, "--no-sync")
    assert result.returncode != 0
    assert conf.read_text() == original
    assert not (home / ".bashrc").exists()


def test_setup_checksum_rejects_helper(sandbox: tuple[Path, dict[str, str]]) -> None:
    home, env = sandbox
    env["LIGHTJUNCTION_FETCH_SHA256"] = "0" * 64
    result = run("setup-gpg-agent.sh", env, "--no-sync")
    assert result.returncode != 0
    assert "SHA256 mismatch" in result.stderr
    assert not (home / ".gnupg/gpg-agent.conf").exists()
    assert "--import" not in Path(env["MOCK_LOG"]).read_text()


def test_setup_stdin_entrypoint_and_user_timer(sandbox: tuple[Path, dict[str, str]]) -> None:
    home, env = sandbox
    env["MOCK_SYSTEMD_STATUS"] = "0"
    result = subprocess.run(
        ["bash"],
        input=(ROOT / "setup-gpg-agent.sh").read_text(),
        cwd=home,
        env=env,
        text=True,
        capture_output=True,
        check=False,
        timeout=30,
    )
    assert result.returncode == 0, result.stderr
    assert "fetch-ssh-pub-key.sh" in Path(env["MOCK_LOG"]).read_text()
    unit = (home / ".config/systemd/user/lightjunction-key-sync.service").read_text()
    assert 'ExecStart="%h/.local/bin/lightjunction-key-sync"' in unit
    assert "enable --now lightjunction-key-sync.timer" in Path(env["MOCK_LOG"]).read_text()


@pytest.mark.parametrize("forwarded", [False, True])
def test_shell_environment_keeps_forwarded_agent(
    sandbox: tuple[Path, dict[str, str]], forwarded: bool
) -> None:
    home, env = sandbox
    assert run("setup-gpg-agent.sh", env, "--no-sync").returncode == 0
    env["SSH_AUTH_SOCK"] = "/tmp/existing-agent"
    if forwarded:
        env["SSH_CONNECTION"] = "client 1000 server 22"
    result = subprocess.run(
        [
            "bash",
            "-c",
            '. "$1"; printf "%s" "$SSH_AUTH_SOCK"',
            "bash",
            str(home / ".config/lightjunction/gpg-agent.sh"),
        ],
        env=env,
        text=True,
        capture_output=True,
        check=False,
        timeout=30,
    )
    expected = "/tmp/existing-agent" if forwarded else env["GNUPGHOME"] + "/S.gpg-agent.ssh"
    assert result.returncode == 0 and result.stdout == expected, result.stderr


def test_fetch_pin_matches_current_source() -> None:
    digest = hashlib.sha256((ROOT / "fetch-ssh-pub-key.sh").read_bytes()).hexdigest()
    assert f"FETCH_SHA256:={digest}" in (ROOT / "setup-gpg-agent.sh").read_text()


@pytest.mark.skipif(shutil.which("gpg") is None, reason="GnuPG unavailable")
def test_real_gpg_imports_only_expected_public_certificate(
    sandbox: tuple[Path, dict[str, str]], tmp_path: Path
) -> None:
    """Exercise actual parsing/selection, with ephemeral keys and no network or card."""
    home, env = sandbox
    real_gpg = shutil.which("gpg") or ""
    assert real_gpg
    source = tmp_path / "source-keyring"
    source.mkdir(mode=0o700)

    def gpg(*args: str) -> str:
        return subprocess.run(
            [
                real_gpg,
                "--homedir",
                str(source),
                "--batch",
                "--pinentry-mode",
                "loopback",
                "--passphrase",
                "",
                *args,
            ],
            check=True,
            text=True,
            capture_output=True,
            timeout=30,
        ).stdout

    try:
        gpg("--quick-generate-key", "Fixture One <one@example.invalid>", "ed25519", "cert", "0")
        fingerprint = next(
            line.split(":")[9]
            for line in gpg("--with-colons", "--list-keys").splitlines()
            if line.startswith("fpr:")
        )
        gpg("--quick-add-key", fingerprint, "ed25519", "auth", "0")
        gpg("--quick-add-key", fingerprint, "ed25519", "sign", "0")
        gpg("--quick-generate-key", "Fixture Two <two@example.invalid>", "ed25519", "cert", "0")
        Path(env["MOCK_PAYLOAD"]).write_text(gpg("--armor", "--export"))
        script = tmp_path / "fetch-real.sh"
        script.write_text((ROOT / "fetch-ssh-pub-key.sh").read_text().replace(KEY, fingerprint))
        (home / ".gnupg").mkdir(mode=0o700)
        env["GPG_PATH"] = real_gpg
        result = run(str(script), env)
        assert result.returncode == 0, result.stderr
        assert result.stdout.startswith("ssh-ed25519 ")
        imported = subprocess.run(
            [real_gpg, "--homedir", env["GNUPGHOME"], "--with-colons", "--list-keys"],
            check=True,
            capture_output=True,
            text=True,
        ).stdout
        assert imported.count("\npub:") + imported.startswith("pub:") == 1
        assert "Fixture One" in imported and "Fixture Two" not in imported
        assert len([line for line in imported.splitlines() if line.startswith("sub:")]) == 2
        # A private-key payload must be rejected before importing into the real home.
        Path(env["MOCK_PAYLOAD"]).write_text(gpg("--armor", "--export-secret-keys", fingerprint))
        result = run(str(script), env)
        assert result.returncode != 0, "secret key input was not rejected"
    finally:
        real_gpgconf = shutil.which("gpgconf")
        if real_gpgconf:
            for keyring in (source, home / ".gnupg"):
                subprocess.run(
                    [real_gpgconf, "--homedir", str(keyring), "--kill", "all"], check=False
                )


@pytest.mark.parametrize("malformed", [False, True])
def test_server_sync_embeds_verified_fetch_and_preserves_unmanaged_keys(
    sandbox: tuple[Path, dict[str, str]], tmp_path: Path, malformed: bool
) -> None:
    home, env = sandbox
    deploy = (ROOT / "deploy-ssh-keys.sh").read_text()
    function = deploy.split("write_sync_script() {", 1)[1].split("\ninstall_termux()", 1)[0]
    generated = tmp_path / "sync.sh"
    result = subprocess.run(
        [
            "bash",
            "-c",
            'KEY_ID="$1"; FETCH_SCRIPT_BODY="$(cat "$2")";\n'
            + "write_sync_script() {"
            + function
            + '\nwrite_sync_script "$3"',
            "bash",
            KEY,
            str(ROOT / "fetch-ssh-pub-key.sh"),
            str(generated),
        ],
        env=env,
        check=False,
        text=True,
        capture_output=True,
    )
    assert result.returncode == 0, result.stderr
    assert "https://github.com/LIghtJUNction.gpg" in generated.read_text()
    (home / ".ssh").mkdir()
    authorized = home / ".ssh/authorized_keys"
    original = "ssh-ed25519 untouched-user-key\n"
    if malformed:
        original += "# >>> lightjunction managed key >>>\nold-managed-key\n"
    authorized.write_text(original)
    result = run(str(generated), env)
    if malformed:
        assert result.returncode != 0
        assert authorized.read_text() == original
    else:
        assert result.returncode == 0, result.stderr
        assert run(str(generated), env).returncode == 0
        content = authorized.read_text()
        assert content.startswith(original)
        assert content.count("# >>> lightjunction managed key >>>") == 1
        assert SSH_KEY in content
    digest = hashlib.sha256((ROOT / "fetch-ssh-pub-key.sh").read_bytes()).hexdigest()
    assert f"FETCH_SHA256:={digest}" in deploy
