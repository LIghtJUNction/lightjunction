mod args;
mod crypto;
mod keys;
mod playground;
mod timing;

use std::ffi::OsString;
use std::io::{self, IsTerminal, Write};
use std::process::ExitCode;
use std::time::{Instant, SystemTime, UNIX_EPOCH};

use args::Options;
use playground::{Display, Scene};

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
            let _ = timing::command(&mut err, "error", started.elapsed(), false);
            return ExitCode::from(2);
        }
    };
    let terminal = io::stdin().is_terminal() && io::stdout().is_terminal();
    let display = Display {
        language: options.language,
        color: !options.plain
            && terminal
            && std::env::var_os("NO_COLOR").is_none()
            && std::env::var_os("TERM").is_none_or(|term| term != "dumb"),
    };
    let command = if options.help {
        "help"
    } else if options.version {
        "version"
    } else {
        options.command.unwrap_or("play")
    };
    let seed = options.seed.unwrap_or_else(random_seed);
    let result = if options.help {
        help(&mut out, options.language).map_err(Error::Io)
    } else if options.version {
        writeln!(out, "lightjunction {}", env!("CARGO_PKG_VERSION")).map_err(Error::Io)
    } else if command == "encrypt" {
        crypto::encrypt(&options)
    } else if command == "keys" {
        keys::render(options.subject, options.language, options.json, &mut out)
    } else if terminal && options.frames.is_none() {
        playground::interactive(Scene::from_command(command), seed, display).map_err(Error::Io)
    } else {
        playground::frames(
            Scene::from_command(command),
            seed,
            display,
            options.frames.unwrap_or(1),
            terminal,
            &mut out,
        )
        .map_err(Error::Io)
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
        Err(Error::Usage(message)) => {
            let _ = writeln!(err, "error: {message}");
            ExitCode::from(2)
        }
        Err(Error::Runtime(message)) => {
            let _ = writeln!(err, "error: {message}");
            ExitCode::FAILURE
        }
        Err(Error::Io(error)) => {
            let _ = writeln!(err, "error: {error}");
            ExitCode::FAILURE
        }
    };
    if options.timing {
        let _ = timing::command(&mut err, command, started.elapsed(), success);
    }
    exit
}

fn random_seed() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos() as u64
        ^ u64::from(std::process::id()).rotate_left(17)
}

fn help(out: &mut impl Write, language: args::Language) -> io::Result<()> {
    writeln!(out, "lightjunction {}", env!("CARGO_PKG_VERSION"))?;
    writeln!(out, "LJ://PLAY — orbit / rain / wave / snake\n")?;
    writeln!(out, "Usage: lightjunction [OPTIONS] [COMMAND] [FORMAT]\n")?;
    writeln!(out, "Playground:")?;
    writeln!(out, "  play       Open the playground (default)")?;
    writeln!(out, "  orbit      Generative particle orbits")?;
    writeln!(out, "  rain       Falling terminal glyphs")?;
    writeln!(out, "  wave       Animated color interference")?;
    writeln!(out, "  snake      Playable Snake\n")?;
    writeln!(out, "Keys and encryption:")?;
    writeln!(
        out,
        "  keys [age|gpg|ssh]  Show or export bundled public keys"
    )?;
    writeln!(
        out,
        "  encrypt age|gpg     Encrypt to the bundled public key\n"
    )?;
    writeln!(out, "Keys:")?;
    writeln!(
        out,
        "{}",
        language.text(
            "  1-4 / TAB   Switch scenes       SPACE   Pause",
            "  1-4 / TAB   切换场景            空格    暂停",
        )
    )?;
    writeln!(
        out,
        "{}",
        language.text(
            "  ARROWS/WASD Steer Snake         +/-     Speed",
            "  方向键/WASD 控制贪吃蛇          +/-     速度",
        )
    )?;
    writeln!(
        out,
        "{}",
        language.text(
            "  [ / ]       Density             R       Reset",
            "  [ / ]       密度                R       重置",
        )
    )?;
    writeln!(
        out,
        "{}",
        language.text(
            "  ?             Controls          Q/ESC   Quit\n",
            "  ?             控制说明          Q/ESC   退出\n",
        )
    )?;
    writeln!(out, "Options:")?;
    writeln!(
        out,
        "  --frames N      Render N frames without keyboard input"
    )?;
    writeln!(out, "  --seed N        Reproduce the same particle field")?;
    writeln!(
        out,
        "  --input FILE    Plaintext file, or - for stdin (encrypt only)"
    )?;
    writeln!(
        out,
        "  -o, --output FILE  New ciphertext file, or - for stdout"
    )?;
    writeln!(out, "  -a, --armor     Write text-armored ciphertext")?;
    writeln!(out, "  --json          Write public-key content as JSON")?;
    writeln!(out, "  --lang en|zh    Select interface language")?;
    writeln!(out, "  --plain         Disable colors")?;
    writeln!(out, "  --no-timing     Hide timing output")?;
    writeln!(out, "  -h, --help      Show this help")?;
    writeln!(out, "  -V, --version   Show the version\n")?;
    writeln!(out, "Examples:")?;
    writeln!(out, "  lightjunction")?;
    writeln!(out, "  lightjunction snake")?;
    writeln!(out, "  lightjunction keys age > recipient.txt")?;
    writeln!(
        out,
        "  lightjunction encrypt age --input note.txt -o note.txt.age"
    )?;
    writeln!(out, "  lightjunction orbit --frames 120 --plain")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn help_describes_actions_not_profile_pages() {
        let mut out = Vec::new();
        help(&mut out, args::Language::En).unwrap();
        let out = String::from_utf8(out).unwrap();
        assert!(out.contains("ARROWS/WASD"));
        assert!(out.contains("--frames"));
        assert!(out.contains("encrypt age|gpg"));
        assert!(!out.contains("About"));
        assert!(!out.contains("Principles"));
    }
}
