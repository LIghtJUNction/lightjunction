mod args;
mod content;
mod crypto;
mod timing;

use std::ffi::OsString;
use std::io::{self, BufRead, IsTerminal, Read, Write};
use std::process::ExitCode;
use std::time::{Duration, Instant};

use args::Options;
use content::Display;
use timing::Stats;

#[derive(Debug)]
enum Error {
    Usage(String),
    Runtime(String),
    Io(io::Error),
}

impl From<io::Error> for Error {
    fn from(error: io::Error) -> Self {
        Self::Io(error)
    }
}

fn main() -> ExitCode {
    let started = Instant::now();
    let argv: Vec<OsString> = std::env::args_os().skip(1).collect();
    let mut out = io::BufWriter::new(io::stdout().lock());
    let mut err = io::stderr().lock();
    let options = match Options::parse(&argv) {
        Ok(options) => options,
        Err(message) => {
            let _ = writeln!(err, "error: {message}\nTry 'lightjunction --help'.");
            // Invalid arguments always get a timing line, even if parsing failed early.
            let _ = timing::command(&mut err, "error", started.elapsed(), false);
            return ExitCode::from(2);
        }
    };
    let terminal = io::stdin().is_terminal() && io::stdout().is_terminal();
    let display = Display {
        language: options.language,
        color: !options.plain
            && !options.json
            && io::stdout().is_terminal()
            && std::env::var_os("NO_COLOR").is_none()
            && std::env::var_os("TERM").is_none_or(|term| term != "dumb"),
        json: options.json,
    };
    let menu = !options.help
        && !options.version
        && (options.interactive || (terminal && options.command.is_none() && !options.json));
    let command = if options.help {
        "help"
    } else if options.version {
        "version"
    } else {
        options.command.unwrap_or("card")
    };
    let mut stats = Stats::default();
    let mut waiting = Duration::ZERO;
    let result = if menu {
        interactive(
            &options,
            &display,
            &mut out,
            &mut err,
            &mut stats,
            &mut waiting,
        )
    } else if command == "encrypt" {
        crypto::encrypt(&options)
    } else {
        content::render(command, options.subject, &display, &mut out)
    }
    .and_then(|()| out.flush().map_err(Error::Io));
    let success = result.is_ok();
    let exit = match result {
        Ok(()) => ExitCode::SUCCESS,
        Err(Error::Io(error))
            if error.kind() == io::ErrorKind::BrokenPipe && command != "encrypt" =>
        {
            ExitCode::SUCCESS
        }
        Err(Error::Runtime(message)) => {
            let _ = writeln!(err, "error: {message}");
            ExitCode::FAILURE
        }
        Err(Error::Io(error)) => {
            let _ = writeln!(err, "error: {error}");
            ExitCode::FAILURE
        }
        Err(Error::Usage(message)) => {
            let _ = writeln!(err, "error: {message}\nTry 'lightjunction --help'.");
            ExitCode::from(2)
        }
    };
    if options.timing {
        let elapsed = started.elapsed();
        if menu {
            let _ = stats.summary(&mut err, elapsed, waiting);
        } else {
            let _ = timing::command(&mut err, command, elapsed, success);
        }
    }
    exit
}

fn read_input(
    input: &mut impl BufRead,
    line: &mut String,
    waiting: &mut Duration,
) -> io::Result<usize> {
    line.clear();
    let started = Instant::now();
    let result = input.take(4097).read_line(line);
    *waiting += started.elapsed();
    let bytes = result?;
    if bytes > 4096 {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "Input exceeds 4096 bytes",
        ));
    }
    Ok(bytes)
}

fn interactive(
    options: &Options<'_>,
    display: &Display,
    out: &mut impl Write,
    err: &mut impl Write,
    stats: &mut Stats,
    waiting: &mut Duration,
) -> Result<(), Error> {
    let language = display.language;
    content::render("card", None, display, out)?;
    menu(out, display)?;
    let mut input = io::stdin().lock();
    let mut line = String::with_capacity(80);
    loop {
        write!(out, "\n  lightjunction > ")?;
        out.flush()?;
        if read_input(&mut input, &mut line, waiting)? == 0 {
            writeln!(out)?;
            return Ok(());
        }
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        let started = Instant::now();
        let mut words = line.split_whitespace();
        let command = match words.next().unwrap_or_default() {
            "1" => "about",
            "2" => "projects",
            "3" => "principles",
            "4" => "links",
            "5" => "tour",
            "6" => "spark",
            "7" => "keys",
            "?" | "help" | "menu" => "help",
            "s" | "stats" => "stats",
            "0" | "q" | "quit" | "exit" => "quit",
            value => value,
        };
        let project = words.next();
        let valid =
            words.next().is_none() && (project.is_none() || matches!(command, "projects" | "keys"));
        let result = if !valid {
            Err(Error::Usage(
                "Use a menu number, a command, 'projects NAME', or 'keys age|gpg|ssh'".into(),
            ))
        } else {
            match command {
                "quit" => writeln!(
                    out,
                    "\n  {}\n",
                    language.text("See you at the next commit.", "下个 commit 见。")
                )
                .map_err(Error::Io),
                "help" => menu(out, display).map_err(Error::Io),
                "stats" => stats.distribution(out).map_err(Error::Io),
                "encrypt" => Err(Error::Usage("Run 'lightjunction encrypt age|gpg --input FILE --output FILE' from your shell".into())),
                value if args::COMMANDS.contains(&value) => {
                    content::render(value, project, display, out)
                }
                _ => Err(Error::Usage(
                    language
                        .text(
                            "Unknown command. Type ? for the menu.",
                            "未知命令。输入 ? 查看菜单。",
                        )
                        .into(),
                )),
            }
        };
        let success = result.is_ok();
        match result {
            Err(Error::Usage(message)) => writeln!(err, "error: {message}")?,
            Err(error) => return Err(error),
            Ok(()) => {}
        }
        out.flush()?;
        let elapsed = started.elapsed();
        stats.record(elapsed);
        if options.timing {
            // Use a fixed label for invalid input; never echo terminal control sequences.
            timing::command(
                err,
                if success { command } else { "error" },
                elapsed,
                success,
            )?;
        }
        if command == "quit" && success {
            return Ok(());
        }
    }
}

fn menu(out: &mut impl Write, display: &Display) -> io::Result<()> {
    let l = display.language;
    writeln!(
        out,
        "  1  {}\n  2  {}\n  3  {}\n  4  {}\n  5  {}\n  6  {}\n  7  {}\n",
        l.text("About", "关于我"),
        l.text("Projects", "项目"),
        l.text("Principles", "做事原则"),
        l.text("Links", "找到我"),
        l.text("Take the tour", "逛一圈"),
        l.text("An engineering spark", "一个工程问题"),
        l.text(
            "Public keys (keys age|gpg|ssh)",
            "公开密钥（keys age|gpg|ssh）"
        )
    )?;
    writeln!(
        out,
        "  s  {}    ?  {}    q  {}",
        l.text("timing stats", "耗时统计"),
        l.text("menu", "菜单"),
        l.text("quit", "退出")
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bounded_input_accepts_eof_and_rejects_unbounded_lines() {
        let mut line = String::new();
        let mut wait = Duration::ZERO;
        assert_eq!(
            read_input(&mut &b"q\n"[..], &mut line, &mut wait).unwrap(),
            2
        );
        assert_eq!(line, "q\n");
        assert_eq!(read_input(&mut &b""[..], &mut line, &mut wait).unwrap(), 0);
        let long = vec![b'x'; 4097];
        assert_eq!(
            read_input(&mut long.as_slice(), &mut line, &mut wait)
                .unwrap_err()
                .kind(),
            io::ErrorKind::InvalidData
        );
    }
}
