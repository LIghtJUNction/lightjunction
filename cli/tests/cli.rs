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
fn non_terminal_default_is_a_generated_scene_and_exits() {
    let output = run(&[]);
    successful(&output);
    let stdout = text(&output.stdout);
    assert!(stdout.chars().any(|ch| "@#%*".contains(ch)));
    assert!(!stdout.contains("LJ://"));
    assert!(!stdout.contains("help"));
    assert!(!stdout.contains("lightjunction >"));
    assert!(!stdout.contains("About"));
    timed(&output, "play", "ok");
}

#[test]
fn avatar_help_and_version_are_timed() {
    for command in ["play", "avatar", "orbit"] {
        let output = run(&[command]);
        successful(&output);
        assert!(text(&output.stdout).chars().any(|ch| "@#%*".contains(ch)));
        timed(&output, command, "ok");
    }
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
fn bounded_avatar_output_is_reproducible() {
    let first = run(&["avatar", "--frames", "8"]);
    let second = run(&["--frames=8", "avatar"]);
    successful(&first);
    successful(&second);
    assert_eq!(first.stdout, second.stdout);
    assert_eq!(text(&first.stdout).lines().count(), 8 * 24);
    assert_ne!(
        run(&["avatar", "--frames", "1"]).stdout,
        run(&["avatar", "--frames", "2"]).stdout
    );
}

#[test]
fn options_work_before_and_after_avatar_command() {
    for arguments in [
        vec!["--lang", "en", "--plain", "avatar"],
        vec!["avatar", "--plain", "--lang=en"],
        vec!["avatar", "--lang", "en", "--plain"],
    ] {
        let output = run(&arguments);
        successful(&output);
        timed(&output, "avatar", "ok");
    }
}

#[test]
fn chinese_help_is_available() {
    let help = run(&["--lang=zh", "--help"]);
    successful(&help);
    assert!(text(&help.stdout).contains("拖拽"));
}

#[test]
fn no_timing_keeps_successful_stderr_empty() {
    for command in ["play", "avatar", "orbit", "--help", "--version"] {
        let output = run(&[command, "--no-timing"]);
        successful(&output);
        assert!(
            output.stderr.is_empty(),
            "{command}: {}",
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
        vec!["--frames", "0"],
        vec!["--frames", "10001"],
        vec!["--frames", "many"],
        vec!["--seed", "-1"],
        vec!["--seed", "not-a-number"],
        vec!["avatar", "unexpected"],
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
        .args(["orbit", "--frames", "3"])
        .stdout(Stdio::from(writer))
        .stderr(Stdio::piped())
        .output()
        .expect("run with closed output pipe");
    assert!(output.status.success(), "{}", text(&output.stderr));
    assert!(!text(&output.stderr).contains("panicked"));
    assert!(!text(&output.stderr).contains("Broken pipe"));
    assert!(text(&output.stderr).contains("[time]"));
}
