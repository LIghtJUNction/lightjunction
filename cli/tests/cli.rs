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
    assert!(stdout.contains("LJ://PLAY"));
    assert!(stdout.contains("1:ORBIT"));
    assert!(stdout.contains("LIVE"));
    assert!(!stdout.contains("lightjunction >"));
    assert!(!stdout.contains("About"));
    timed(&output, "play", "ok");
}

#[test]
fn every_scene_help_and_version_is_timed() {
    for command in ["play", "orbit", "rain", "wave", "snake"] {
        let output = run(&[command]);
        successful(&output);
        assert!(text(&output.stdout).contains("LJ://PLAY"));
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
fn seeded_output_is_reproducible_and_scenes_are_distinct() {
    let first = run(&["orbit", "--seed", "42", "--frames", "8"]);
    let second = run(&["--seed=42", "--frames=8", "orbit"]);
    successful(&first);
    successful(&second);
    assert_eq!(first.stdout, second.stdout);
    assert_eq!(text(&first.stdout).matches("LJ://PLAY").count(), 8);

    let rain = run(&["rain", "--seed", "42", "--frames", "8"]);
    assert_ne!(first.stdout, rain.stdout);
}

#[test]
fn options_work_before_and_after_scenes() {
    for arguments in [
        vec!["--lang", "en", "--plain", "snake", "--seed", "7"],
        vec!["snake", "--seed=7", "--plain", "--lang=en"],
        vec!["snake", "--lang", "en", "--plain", "--seed", "7"],
    ] {
        let output = run(&arguments);
        successful(&output);
        assert!(text(&output.stdout).contains("score:0000"));
        timed(&output, "snake", "ok");
    }
}

#[test]
fn chinese_controls_and_help_are_available() {
    let output = run(&["snake", "--lang", "zh"]);
    successful(&output);
    assert!(text(&output.stdout).contains("方向键 / WASD 控制"));
    let help = run(&["--lang=zh", "--help"]);
    successful(&help);
    assert!(text(&help.stdout).contains("切换场景"));
}

#[test]
fn no_timing_keeps_successful_stderr_empty() {
    for command in [
        "play",
        "orbit",
        "rain",
        "wave",
        "snake",
        "--help",
        "--version",
    ] {
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
        vec!["snake", "unexpected"],
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
