mod args;
mod crypto;
mod keys;
mod timing;

use std::ffi::OsString;
use std::io::{self, Write};
use std::process::ExitCode;
use std::time::Instant;

use args::Options;

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
    let command = if options.help {
        "help"
    } else if options.version {
        "version"
    } else {
        options.command.unwrap_or("help")
    };
    let result = match command {
        "help" => help(&mut out, options.language).map_err(Error::Io),
        "version" => {
            writeln!(out, "lightjunction {}", env!("CARGO_PKG_VERSION")).map_err(Error::Io)
        }
        "encrypt" => crypto::encrypt(&options),
        "keys" => keys::render(options.subject, options.language, options.json, &mut out),
        _ => unreachable!("validated command"),
    }
    .and_then(|()| out.flush().map_err(Error::Io));
    let result = match result {
        Err(Error::Io(error))
            if error.kind() == io::ErrorKind::BrokenPipe && command != "encrypt" =>
        {
            Ok(())
        }
        result => result,
    };
    let success = result.is_ok();
    let exit = match result {
        Ok(()) => ExitCode::SUCCESS,
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

fn help(out: &mut impl Write, language: args::Language) -> io::Result<()> {
    writeln!(out, "lightjunction {}", env!("CARGO_PKG_VERSION"))?;
    writeln!(
        out,
        "{}\n",
        language.text(
            "Public keys and local file encryption.",
            "公钥导出与本地文件加密。",
        )
    )?;
    writeln!(out, "Usage: lightjunction [OPTIONS] [COMMAND] [FORMAT]\n")?;
    writeln!(out, "{}", language.text("Commands:", "命令："))?;
    writeln!(
        out,
        "  keys [age|gpg|ssh]  {}",
        language.text("Show or export bundled public keys", "查看或导出内置公钥")
    )?;
    writeln!(
        out,
        "  encrypt age|gpg    {}\n",
        language.text("Encrypt to the bundled public key", "使用内置公钥加密")
    )?;
    writeln!(out, "{}", language.text("Options:", "选项："))?;
    writeln!(
        out,
        "  --input FILE       {}",
        language.text(
            "Plaintext file, or - for stdin (encrypt only)",
            "明文文件，- 表示标准输入（仅加密）"
        )
    )?;
    writeln!(
        out,
        "  -o, --output FILE  {}",
        language.text(
            "New ciphertext file, or - for stdout",
            "新密文文件，- 表示标准输出"
        )
    )?;
    writeln!(
        out,
        "  -a, --armor        {}",
        language.text("Write text-armored ciphertext", "输出文本格式的密文")
    )?;
    writeln!(
        out,
        "  --json             {}",
        language.text("Write public-key content as JSON", "以 JSON 格式输出公钥")
    )?;
    writeln!(
        out,
        "  --lang en|zh       {}",
        language.text("Select interface language", "选择界面语言")
    )?;
    writeln!(
        out,
        "  --no-timing        {}",
        language.text("Hide timing output", "隐藏耗时输出")
    )?;
    writeln!(
        out,
        "  -h, --help         {}",
        language.text("Show this help (default)", "显示帮助（默认）")
    )?;
    writeln!(
        out,
        "  -V, --version      {}\n",
        language.text("Show the version", "显示版本")
    )?;
    writeln!(out, "{}", language.text("Examples:", "示例："))?;
    writeln!(out, "  lightjunction keys age > recipient.txt")?;
    writeln!(out, "  lightjunction keys --json")?;
    writeln!(
        out,
        "  lightjunction encrypt age --input note.txt -o note.txt.age"
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn help_describes_public_keys_and_encryption() {
        let mut out = Vec::new();
        help(&mut out, args::Language::En).unwrap();
        let out = String::from_utf8(out).unwrap();
        assert!(out.contains("keys [age|gpg|ssh]"));
        assert!(out.contains("encrypt age|gpg"));
        assert!(out.contains("--no-timing"));
        assert!(!out.contains("avatar"));
        assert!(!out.contains("--frames"));
        assert!(!out.contains("--plain"));
    }
}
