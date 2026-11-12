//! Public-key and process-boundary tests. Fake tools test I/O, never cryptography.

use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Output, Stdio};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

const AGE: &[u8] = include_bytes!("../keys/age-recipients.txt");
const GPG: &[u8] = include_bytes!("../keys/pubkey.asc");
const SSH: &[u8] = include_bytes!("../keys/ssh-public-keys.txt");
static NEXT_DIRECTORY: AtomicU64 = AtomicU64::new(0);

struct Directory(PathBuf);

impl Directory {
    fn new() -> Self {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let count = NEXT_DIRECTORY.fetch_add(1, Ordering::Relaxed);
        let path = std::env::temp_dir().join(format!(
            "lightjunction-crypto-test-{}-{nonce}-{count}",
            std::process::id()
        ));
        fs::create_dir(&path).unwrap();
        Self(path)
    }

    fn join(&self, name: impl AsRef<Path>) -> PathBuf {
        self.0.join(name)
    }
}

impl Drop for Directory {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

fn cli() -> Command {
    let mut command = Command::new(env!("CARGO_BIN_EXE_lightjunction"));
    command
        .env("LC_ALL", "C")
        .env("LANG", "C")
        .env("NO_COLOR", "1")
        .env("TERM", "dumb")
        .stdin(Stdio::null());
    command
}

fn text(bytes: &[u8]) -> &str {
    std::str::from_utf8(bytes).expect("text output")
}

fn timed(output: &Output, status: &str) {
    let stderr = text(&output.stderr);
    assert!(stderr.contains("[time] command="), "{stderr}");
    assert!(
        stderr.contains(&format!("status={status} elapsed=")),
        "{stderr}"
    );
    assert!(!stderr.contains("panicked"), "{stderr}");
}

#[test]
fn public_key_exports_are_exact_source_bytes_without_terminal_decoration() {
    for (name, expected) in [("age", AGE), ("gpg", GPG), ("ssh", SSH)] {
        let output = cli().args(["keys", name]).output().unwrap();
        assert!(output.status.success(), "{}", text(&output.stderr));
        assert_eq!(output.stdout, expected, "{name} raw output changed");
        timed(&output, "ok");
        let quiet = cli().args(["--no-timing", "keys", name]).output().unwrap();
        assert!(quiet.status.success());
        assert_eq!(quiet.stdout, expected);
        assert!(quiet.stderr.is_empty());
    }
}

#[test]
fn key_summary_and_json_are_available_without_encryption_tools() {
    for language in ["en", "zh"] {
        let summary = cli().args(["keys", "--lang", language]).output().unwrap();
        assert!(summary.status.success(), "{}", text(&summary.stderr));
        let body = text(&summary.stdout).to_ascii_lowercase();
        for name in ["age", "gpg", "ssh"] {
            assert!(body.contains(name), "missing {name}: {body}");
        }
        for (selector, marker) in [
            (
                "age",
                "age1yubikey1qgaqxkh32x84vm957584pc0980z3x2agpljavmsh3jwz5q02tlth5suju8n",
            ),
            ("gpg", "-----BEGIN PGP PUBLIC KEY BLOCK-----"),
            ("ssh", "sk-ssh-ed25519@openssh.com"),
        ] {
            let output = cli()
                .args(["keys", selector, "--json", "--lang", language])
                .output()
                .unwrap();
            assert!(output.status.success(), "{}", text(&output.stderr));
            let json = text(&output.stdout).trim();
            assert!(json.starts_with('{') && json.ends_with('}'));
            for field in ["command", "language", "sections", "title", "lines"] {
                assert!(json.contains(&format!("\"{field}\"")), "{json}");
            }
            assert!(json.contains(marker), "{json}");
            assert!(!output.stdout.contains(&0x1b));
            assert!(!json.contains("[time]"));
            timed(&output, "ok");
        }
    }
}

#[test]
fn bundled_snapshots_match_public_repository_files_and_contain_only_public_material() {
    let root = Path::new(env!("CARGO_MANIFEST_DIR")).parent().unwrap();
    // The enclosing website is present in source checkouts, but not in a .crate archive.
    for (relative, embedded) in [("public/age-recipients.txt", AGE), ("pubkey.asc", GPG)] {
        let source = root.join(relative);
        if source.is_file() {
            assert_eq!(fs::read(source).unwrap(), embedded);
        }
    }
    assert_eq!(
        text(SSH).trim(),
        "sk-ssh-ed25519@openssh.com AAAAGnNrLXNzaC1lZDI1NTE5QG9wZW5zc2guY29tAAAAIBRejvIqShvPCeZ2u8W8uUfFjWAHuASsak/cSusmurziAAAABHNzaDo="
    );
    for material in [AGE, GPG, SSH] {
        assert!(!text(material).contains("PRIVATE KEY"));
        assert!(!text(material).contains("AGE-SECRET-KEY"));
    }
}

#[test]
fn invalid_encryption_usage_fails_before_reading_or_creating_files() {
    for arguments in [
        vec!["encrypt"],
        vec!["encrypt", "ssh"],
        vec!["encrypt", "age", "--json"],
        vec!["encrypt", "age", "--input"],
        vec!["encrypt", "gpg", "--output"],
        vec!["keys", "unknown"],
        vec!["keys", "age", "--input", "anything"],
        vec!["about", "--output", "anything"],
        vec!["card", "--armor"],
        vec!["--input", "anything"],
        vec!["encrypt", "age", "extra"],
    ] {
        let output = cli().args(&arguments).output().unwrap();
        assert_eq!(
            output.status.code(),
            Some(2),
            "{arguments:?}: {}",
            text(&output.stderr)
        );
        assert!(output.stdout.is_empty(), "{arguments:?}");
        timed(&output, "error");
    }
}

#[test]
fn unavailable_encryption_tools_have_clear_errors_and_clean_up_staging_files() {
    for protocol in ["age", "gpg"] {
        let directory = Directory::new();
        let input = directory.join("input.bin");
        let destination = directory.join("output");
        let temporary = directory.join("temporary");
        fs::write(&input, b"tool availability test").unwrap();
        fs::create_dir(&destination).unwrap();
        fs::create_dir(&temporary).unwrap();
        let output = cli()
            .current_dir(&directory.0)
            .env("PATH", "")
            .env("TMPDIR", &temporary)
            .env("TMP", &temporary)
            .env("TEMP", &temporary)
            .args(["encrypt", protocol, "--input"])
            .arg(&input)
            .arg("--output")
            .arg(destination.join("message.enc"))
            .output()
            .unwrap();
        assert_eq!(output.status.code(), Some(1), "{}", text(&output.stderr));
        let diagnostic = text(&output.stderr).to_ascii_lowercase();
        assert!(diagnostic.contains(protocol), "{diagnostic}");
        assert!(
            diagnostic.contains("not found") && diagnostic.contains("install"),
            "{diagnostic}"
        );
        assert!(output.stdout.is_empty());
        assert_eq!(fs::read_dir(destination).unwrap().count(), 0);
        assert_eq!(fs::read_dir(temporary).unwrap().count(), 0);
        timed(&output, "error");
    }
}

#[cfg(unix)]
mod unix {
    use super::*;
    use std::io::Write;
    use std::os::unix::fs::{PermissionsExt, symlink};

    const CIPHERTEXT: &[u8] = b"FAKE-CIPHERTEXT\0END\n";
    const PAYLOAD: &[u8] = b"private test plaintext\0binary\xff\n";
    const FAKE_TOOL: &str = "#!/bin/sh\nset -eu\nprintf '%s\\n' \"$@\" > \"$TEST_ARGV\"\nprevious=''\nfor argument in \"$@\"; do\n  if [ \"$previous\" = '--recipient-file' ]; then /bin/cat \"$argument\" > \"$TEST_KEY\"; fi\n  previous=$argument\ndone\n/bin/cat > \"$TEST_INPUT\"\nprintf 'FAKE-CIPHERTEXT\\000END\\n'\nif [ \"${TEST_FAIL-}\" = 1 ]; then\n  printf 'fake backend rejected input\\n' >&2\n  exit 23\nfi\n";

    struct Harness {
        root: Directory,
        tools: PathBuf,
        output: PathBuf,
        temporary: PathBuf,
    }

    impl Harness {
        fn new() -> Self {
            let root = Directory::new();
            let tools = root.join("tools");
            let output = root.join("output");
            let temporary = root.join("temporary");
            for path in [&tools, &output, &temporary] {
                fs::create_dir(path).unwrap();
            }
            for name in ["age", "gpg"] {
                let path = tools.join(name);
                fs::write(&path, FAKE_TOOL).unwrap();
                fs::set_permissions(&path, fs::Permissions::from_mode(0o700)).unwrap();
            }
            Self {
                root,
                tools,
                output,
                temporary,
            }
        }

        fn command(&self) -> Command {
            let mut command = cli();
            command
                .current_dir(&self.root.0)
                .env("PATH", &self.tools)
                .env("TMPDIR", &self.temporary)
                .env("TMP", &self.temporary)
                .env("TEMP", &self.temporary)
                .env("TEST_ARGV", self.root.join("argv"))
                .env("TEST_INPUT", self.root.join("received"))
                .env("TEST_KEY", self.root.join("recipient"));
            command
        }

        fn assert_received(&self, plaintext: &[u8], protocol: &str) {
            assert_eq!(fs::read(self.root.join("received")).unwrap(), plaintext);
            let argv = fs::read(self.root.join("argv")).unwrap();
            assert!(!argv.windows(plaintext.len()).any(|part| part == plaintext));
            let arguments = text(&argv);
            assert!(!arguments.contains("private test plaintext"));
            assert!(arguments.lines().any(|arg| arg == "--encrypt"));
            if protocol == "age" {
                assert!(arguments.contains(text(AGE).trim()));
            } else {
                assert_eq!(fs::read(self.root.join("recipient")).unwrap(), GPG);
            }
            assert_eq!(fs::read_dir(&self.temporary).unwrap().count(), 0);
        }
    }

    #[test]
    fn stdin_streams_to_backends_and_binary_stdout_contains_only_ciphertext() {
        for protocol in ["age", "gpg"] {
            for explicit_dash in [false, true] {
                let harness = Harness::new();
                let mut command = harness.command();
                command.args(["encrypt", protocol]);
                if explicit_dash {
                    command.args(["--input", "-", "--output", "-"]);
                }
                let mut child = command
                    .stdin(Stdio::piped())
                    .stdout(Stdio::piped())
                    .stderr(Stdio::piped())
                    .spawn()
                    .unwrap();
                child.stdin.take().unwrap().write_all(PAYLOAD).unwrap();
                let output = child.wait_with_output().unwrap();
                assert!(output.status.success(), "{}", text(&output.stderr));
                assert_eq!(output.stdout, CIPHERTEXT);
                timed(&output, "ok");
                harness.assert_received(PAYLOAD, protocol);
            }
        }
    }

    #[test]
    fn files_stream_to_backends_with_armor_and_publish_complete_ciphertext() {
        for protocol in ["age", "gpg"] {
            let harness = Harness::new();
            let input = harness.root.join("payload with spaces;$(not-a-shell).bin");
            let destination = harness.output.join("encrypted file.bin");
            let payload: Vec<u8> = (0..200_000).map(|i| (i % 251) as u8).collect();
            fs::write(&input, &payload).unwrap();
            let output = harness
                .command()
                .args(["encrypt", protocol, "--input"])
                .arg(&input)
                .arg("-o")
                .arg(&destination)
                .arg("-a")
                .output()
                .unwrap();
            assert!(output.status.success(), "{}", text(&output.stderr));
            assert!(output.stdout.is_empty());
            assert_eq!(fs::read(&destination).unwrap(), CIPHERTEXT);
            assert_eq!(fs::read_dir(&harness.output).unwrap().count(), 1);
            assert_eq!(
                fs::metadata(destination).unwrap().permissions().mode() & 0o777,
                0o600
            );
            assert!(
                fs::read_to_string(harness.root.join("argv"))
                    .unwrap()
                    .lines()
                    .any(|arg| arg == "--armor")
            );
            harness.assert_received(&payload, protocol);
            timed(&output, "ok");
        }
    }

    #[test]
    fn failed_backends_do_not_leave_partial_output_or_temporary_keyrings() {
        for protocol in ["age", "gpg"] {
            let harness = Harness::new();
            let input = harness.root.join("message.txt");
            fs::write(&input, PAYLOAD).unwrap();
            let output = harness
                .command()
                .env("TEST_FAIL", "1")
                .args(["encrypt", protocol, "--input"])
                .arg(input)
                .arg("--output")
                .arg(harness.output.join("failed.enc"))
                .output()
                .unwrap();
            assert_eq!(output.status.code(), Some(1), "{}", text(&output.stderr));
            assert!(output.stdout.is_empty());
            assert!(text(&output.stderr).contains("fake backend rejected input"));
            assert_eq!(fs::read_dir(&harness.output).unwrap().count(), 0);
            harness.assert_received(PAYLOAD, protocol);
            timed(&output, "error");
        }
    }

    #[test]
    fn existing_files_symlinks_and_input_as_output_are_not_overwritten() {
        for protocol in ["age", "gpg"] {
            let harness = Harness::new();
            let original = harness.root.join("original.txt");
            fs::write(&original, PAYLOAD).unwrap();
            let existing = harness.output.join("existing.enc");
            fs::write(&existing, b"keep existing ciphertext").unwrap();
            let link = harness.output.join("link.enc");
            symlink(&original, &link).unwrap();
            let hard_link = harness.output.join("hard-link.enc");
            fs::hard_link(&original, &hard_link).unwrap();
            let missing = harness.root.join("absent.txt");
            let dangling = harness.output.join("dangling.enc");
            symlink(&missing, &dangling).unwrap();
            for destination in [&original, &existing, &link, &hard_link, &dangling] {
                let output = harness
                    .command()
                    .args(["encrypt", protocol, "--input"])
                    .arg(&original)
                    .arg("--output")
                    .arg(destination)
                    .output()
                    .unwrap();
                assert_eq!(output.status.code(), Some(1), "{}", text(&output.stderr));
                timed(&output, "error");
                assert!(output.stdout.is_empty());
                assert_eq!(fs::read(&original).unwrap(), PAYLOAD);
                assert_eq!(fs::read(&hard_link).unwrap(), PAYLOAD);
                assert_eq!(fs::read(&existing).unwrap(), b"keep existing ciphertext");
                assert!(
                    fs::symlink_metadata(&link)
                        .unwrap()
                        .file_type()
                        .is_symlink()
                );
                assert!(
                    fs::symlink_metadata(&dangling)
                        .unwrap()
                        .file_type()
                        .is_symlink()
                );
                assert!(!missing.exists());
            }
            assert_eq!(fs::read_dir(&harness.output).unwrap().count(), 4);
            assert_eq!(fs::read_dir(&harness.temporary).unwrap().count(), 0);
        }
    }

    // Linux filesystems accept byte paths; macOS APFS rejects invalid UTF-8 names.
    #[cfg(target_os = "linux")]
    #[test]
    fn non_utf8_file_names_remain_valid_operating_system_paths() {
        use std::ffi::OsString;
        use std::os::unix::ffi::OsStringExt;

        for protocol in ["age", "gpg"] {
            let harness = Harness::new();
            let input = harness
                .root
                .join(OsString::from_vec(b"input-\xff.bin".to_vec()));
            let destination = harness
                .output
                .join(OsString::from_vec(b"output-\xfe.enc".to_vec()));
            fs::write(&input, PAYLOAD).unwrap();
            let output = harness
                .command()
                .args(["encrypt", protocol, "--input"])
                .arg(input)
                .arg("--output")
                .arg(&destination)
                .output()
                .unwrap();
            assert!(output.status.success(), "{}", text(&output.stderr));
            assert_eq!(fs::read(destination).unwrap(), CIPHERTEXT);
            harness.assert_received(PAYLOAD, protocol);
            timed(&output, "ok");
        }
    }
}
