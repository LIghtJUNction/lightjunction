use std::io::Write;
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

fn menu(args: &[&str], input: &[u8]) -> Output {
    let mut child = cli()
        .args(args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("start menu");
    child
        .stdin
        .take()
        .expect("menu stdin")
        .write_all(input)
        .expect("write menu choices");
    child.wait_with_output().expect("finish menu")
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
fn non_terminal_default_is_a_card_and_exits() {
    let output = run(&[]);
    successful(&output);
    assert!(text(&output.stdout).contains("LIghtJUNction"));
    assert!(!text(&output.stdout).contains("lightjunction >"));
    timed(&output, "card", "ok");
}

#[test]
fn every_page_help_and_version_is_timed() {
    for command in [
        "card",
        "about",
        "projects",
        "principles",
        "links",
        "tour",
        "spark",
    ] {
        let output = run(&[command]);
        successful(&output);
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
fn options_work_before_and_after_commands() {
    for arguments in [
        vec!["--lang", "en", "--plain", "projects", "magicnet"],
        vec!["projects", "magicnet", "--plain", "--lang=en"],
        vec!["projects", "--lang", "en", "magicnet", "--plain"],
    ] {
        let output = run(&arguments);
        successful(&output);
        assert!(
            text(&output.stdout)
                .to_ascii_lowercase()
                .contains("magicnet")
        );
        timed(&output, "projects", "ok");
    }
}

#[test]
fn named_projects_are_available() {
    for project in ["magicnet", "z", "lmm-api", "onimods", "humangrant"] {
        let output = run(&["projects", project]);
        successful(&output);
        timed(&output, "projects", "ok");
    }
}

#[test]
fn no_timing_keeps_successful_stderr_empty() {
    for command in [
        "card",
        "about",
        "projects",
        "principles",
        "links",
        "tour",
        "spark",
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
fn json_is_clean_and_has_a_consistent_envelope() {
    for language in ["en", "zh"] {
        for command in [
            "card",
            "about",
            "projects",
            "principles",
            "links",
            "tour",
            "spark",
        ] {
            let output = run(&[command, "--json", "--lang", language]);
            successful(&output);
            let stdout = text(&output.stdout).trim();
            assert!(stdout.starts_with('{') && stdout.ends_with('}'));
            for key in ["command", "language", "sections", "title", "lines"] {
                assert!(
                    stdout.contains(&format!("\"{key}\"")),
                    "missing {key}: {stdout}"
                );
            }
            assert!(stdout.contains(&format!("\"{command}\"")));
            assert!(stdout.contains(&format!("\"{language}\"")));
            timed(&output, command, "ok");
        }
    }
}

#[test]
fn usage_errors_exit_two_and_include_timing() {
    for arguments in [
        vec!["unknown"],
        vec!["--unknown"],
        vec!["--lang"],
        vec!["--lang", "fr"],
        vec!["about", "unexpected"],
        vec!["projects", "not-a-project"],
        vec!["--interactive", "about"],
        vec!["--interactive", "--json"],
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

#[test]
fn menu_records_each_command_and_reports_a_session() {
    let output = menu(&["--interactive", "--plain"], b"1\n2\ns\nq\n");
    successful(&output);
    let stdout = text(&output.stdout);
    let stderr = text(&output.stderr);
    assert!(stdout.contains("lightjunction >"));
    assert!(stdout.contains("[stats] commands=2"));
    assert_eq!(
        stderr
            .lines()
            .filter(|line| line.starts_with("[time]"))
            .count(),
        4
    );
    assert!(stderr.contains("command=about status=ok"));
    assert!(stderr.contains("command=projects status=ok"));
    assert!(stderr.contains("[stats] commands=4"));
    assert!(stderr.contains("[session] active="));
    assert!(stderr.contains(" wait=") && stderr.contains(" total="));
}

#[test]
fn menu_handles_eof_and_timing_opt_out() {
    let eof = menu(&["--interactive"], b"");
    successful(&eof);
    assert!(text(&eof.stderr).contains("[stats] commands=0"));
    let quiet = menu(&["--interactive", "--no-timing"], b"1\ns\nq\n");
    successful(&quiet);
    assert!(quiet.stderr.is_empty());
    assert!(text(&quiet.stdout).contains("[stats]"));
}

#[test]
fn menu_recovers_from_unknown_input_without_echoing_control_codes() {
    let output = menu(&["--interactive"], b"\x1b[31mbogus\n1\nq\n");
    successful(&output);
    let stderr = text(&output.stderr);
    assert!(stderr.contains("command=error status=error"));
    assert!(stderr.contains("command=about status=ok"));
    assert!(!stderr.contains('\x1b'));
}

#[test]
fn menu_rejects_oversized_lines() {
    let output = menu(&["--interactive"], &vec![b'x'; 4097]);
    assert!(!output.status.success());
    assert!(text(&output.stderr).contains("Input exceeds 4096 bytes"));
    assert!(!text(&output.stderr).contains("panicked"));
}

#[cfg(unix)]
#[test]
fn non_utf8_arguments_report_usage_errors_without_panicking() {
    use std::ffi::OsString;
    use std::os::unix::ffi::OsStringExt;

    let output = cli()
        .arg("projects")
        .arg(OsString::from_vec(vec![0xff]))
        .output()
        .expect("run with native non-UTF-8 argument");
    assert_eq!(output.status.code(), Some(2));
    assert!(text(&output.stderr).contains("valid UTF-8"));
    assert!(!text(&output.stderr).contains("panicked"));
    timed(&output, "error", "error");
}

#[cfg(unix)]
#[test]
fn closed_output_pipe_exits_cleanly_without_a_panic() {
    use std::os::fd::OwnedFd;
    use std::os::unix::net::UnixStream;

    // Close the reader before spawn, so the first write deterministically gets EPIPE.
    let (writer, reader) = UnixStream::pair().expect("output socket pair");
    drop(reader);
    let writer: OwnedFd = writer.into();
    let output = cli()
        .arg("tour")
        .stdout(Stdio::from(writer))
        .stderr(Stdio::piped())
        .output()
        .expect("run with closed output pipe");
    assert!(output.status.success(), "{}", text(&output.stderr));
    assert!(!text(&output.stderr).contains("panicked"));
    assert!(!text(&output.stderr).contains("Broken pipe"));
    assert!(text(&output.stderr).contains("[time]"));
}
