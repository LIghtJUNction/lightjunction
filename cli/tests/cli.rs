use std::process::{Command, Output, Stdio};

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

fn run(args: &[&str]) -> Output {
    cli().args(args).output().expect("run lightjunction")
}

fn text(bytes: &[u8]) -> &str {
    std::str::from_utf8(bytes).expect("UTF-8 output")
}

fn successful(output: &Output) {
    assert!(output.status.success(), "{}", text(&output.stderr));
    assert!(!output.stdout.is_empty(), "command should produce content");
    assert!(!output.stdout.contains(&0x1b), "piped output has no ANSI");
}

fn timed(output: &Output, name: &str, status: &str) {
    let stderr = text(&output.stderr);
    let prefix = format!("[time] command={name} status={status} elapsed=");
    let elapsed = stderr
        .lines()
        .find_map(|line| line.strip_prefix(&prefix))
        .unwrap_or_else(|| panic!("missing timing {prefix:?}: {stderr}"));
    let number = elapsed
        .strip_suffix("us")
        .or_else(|| elapsed.strip_suffix("ms"))
        .or_else(|| elapsed.strip_suffix('s'))
        .expect("documented timing unit");
    let number: f64 = number.parse().expect("numeric elapsed time");
    assert!(number.is_finite() && number >= 0.0);
    assert!(!text(&output.stdout).contains("[time]"));
}

#[test]
fn default_shows_help_and_exits() {
    let output = run(&[]);
    successful(&output);
    assert_eq!(output.stdout, run(&["--help"]).stdout);
    let stdout = text(&output.stdout);
    assert!(stdout.contains("keys [age|gpg|ssh]"));
    assert!(stdout.contains("encrypt age|gpg"));
    assert!(!stdout.contains("avatar"));
    timed(&output, "help", "ok");
}

#[test]
fn help_and_version_are_timed() {
    for (flag, command) in [
        ("--help", "help"),
        ("-h", "help"),
        ("--version", "version"),
        ("-V", "version"),
    ] {
        let output = run(&[flag]);
        successful(&output);
        timed(&output, command, "ok");
        if command == "version" {
            assert!(text(&output.stdout).contains(env!("CARGO_PKG_VERSION")));
        }
    }
}

#[test]
fn key_options_work_before_and_after_the_command() {
    let expected = run(&["keys", "--lang=en", "--json"]).stdout;
    for arguments in [
        vec!["--lang", "en", "--json", "keys"],
        vec!["keys", "--json", "--lang=en"],
        vec!["--json", "keys", "--lang", "en"],
    ] {
        let output = run(&arguments);
        successful(&output);
        assert_eq!(output.stdout, expected);
        timed(&output, "keys", "ok");
    }
}

#[test]
fn chinese_help_is_available() {
    let help = run(&["--lang=zh", "--help"]);
    successful(&help);
    assert!(text(&help.stdout).contains("公钥导出与本地文件加密"));
    assert!(text(&help.stdout).contains("--input FILE"));
}

#[test]
fn explicit_language_overrides_locale() {
    let output = cli()
        .env("LC_ALL", "zh_CN.UTF-8")
        .args(["--lang", "en"])
        .output()
        .expect("run with explicit language");
    successful(&output);
    assert!(text(&output.stdout).contains("Public keys and local file encryption"));
}

#[test]
fn locale_precedence_is_preserved() {
    for (all, messages, lang, expected) in [
        ("zh_CN.UTF-8", "en_US.UTF-8", "en_US.UTF-8", "公钥导出"),
        ("", "zh_TW.UTF-8", "en_US.UTF-8", "公钥导出"),
        ("", "", "zh-HK", "公钥导出"),
        ("C", "zh_CN.UTF-8", "zh_CN.UTF-8", "Public keys"),
    ] {
        let output = cli()
            .env("LC_ALL", all)
            .env("LC_MESSAGES", messages)
            .env("LANG", lang)
            .output()
            .expect("run with locale");
        successful(&output);
        assert!(text(&output.stdout).contains(expected));
    }
}

#[test]
fn no_timing_keeps_successful_stderr_empty() {
    for arguments in [
        vec!["--no-timing"],
        vec!["keys", "--no-timing"],
        vec!["keys", "age", "--no-timing"],
        vec!["--help", "--no-timing"],
        vec!["--version", "--no-timing"],
    ] {
        let output = run(&arguments);
        successful(&output);
        assert!(
            output.stderr.is_empty(),
            "{arguments:?}: {}",
            text(&output.stderr)
        );
    }
}

#[test]
fn usage_errors_exit_two_and_include_timing() {
    for arguments in [
        vec!["unknown"],
        vec!["--unknown"],
        vec!["--lang"],
        vec!["--lang", "fr"],
        vec!["play"],
        vec!["avatar"],
        vec!["orbit"],
        vec!["--frames", "1"],
        vec!["--plain"],
        vec!["keys", "unexpected"],
        vec!["--json"],
        vec!["--no-timing", "--unknown"],
    ] {
        let output = run(&arguments);
        assert_eq!(
            output.status.code(),
            Some(2),
            "{arguments:?}: {}",
            text(&output.stderr)
        );
        let stderr = text(&output.stderr);
        assert!(stderr.contains("error:"), "{arguments:?}: {stderr}");
        assert!(stderr.contains("[time]"), "{arguments:?}: {stderr}");
        assert!(stderr.contains("status=error"), "{arguments:?}: {stderr}");
        assert!(!stderr.contains("panicked"));
    }
}

#[cfg(unix)]
#[test]
fn non_utf8_arguments_report_usage_errors_without_panicking() {
    use std::ffi::OsString;
    use std::os::unix::ffi::OsStringExt;

    let output = cli()
        .arg(OsString::from_vec(vec![0xff]))
        .output()
        .expect("run with native non-UTF-8 argument");
    assert_eq!(output.status.code(), Some(2));
    assert!(text(&output.stderr).contains("error:"));
    assert!(!text(&output.stderr).contains("panicked"));
    timed(&output, "error", "error");
}

#[cfg(unix)]
#[test]
fn closed_output_pipe_exits_cleanly_without_a_panic() {
    use std::os::fd::OwnedFd;
    use std::os::unix::net::UnixStream;

    let (writer, reader) = UnixStream::pair().expect("output socket pair");
    drop(reader);
    let writer: OwnedFd = writer.into();
    let output = cli()
        .args(["keys", "gpg"])
        .stdout(Stdio::from(writer))
        .stderr(Stdio::piped())
        .output()
        .expect("run with closed output pipe");
    assert!(output.status.success(), "{}", text(&output.stderr));
    assert!(!text(&output.stderr).contains("panicked"));
    assert!(!text(&output.stderr).contains("Broken pipe"));
    timed(&output, "keys", "ok");
}
