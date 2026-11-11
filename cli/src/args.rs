use std::ffi::{OsStr, OsString};

use zclap::{Arg, Command, Event};

pub const COMMANDS: &[&str] = &[
    "card",
    "about",
    "projects",
    "principles",
    "links",
    "tour",
    "spark",
    "keys",
    "encrypt",
];

const ARGS: &[Arg<'static>] = &[
    Arg::flag("help").short('h').help("Show help"),
    Arg::flag("version").short('V').help("Show version"),
    Arg::flag("plain").help("Disable terminal styling"),
    Arg::flag("json")
        .conflicts_with(&["interactive"])
        .help("Write JSON to stdout"),
    Arg::flag("interactive")
        .short('i')
        .help("Start a menu, including with piped input"),
    Arg::flag("no-timing").help("Hide timing output"),
    Arg::flag("armor")
        .short('a')
        .help("Write text-armored ciphertext"),
    Arg::value("input").help("Plaintext file, or - for stdin (encrypt only)"),
    Arg::value("output")
        .short('o')
        .help("New ciphertext file, or - for stdout (encrypt only)"),
    Arg::value("lang")
        .one_of(&["en", "zh"])
        .help("Language: en or zh"),
    Arg::positional("command")
        .one_of(COMMANDS)
        .help("Page to explore"),
    Arg::positional("subject").help("Project name or key format: age, gpg, ssh"),
];

pub const CLI: Command<'static> = Command::new("lightjunction")
    .about("Small tools. Open code. Your machine.")
    .args(ARGS);

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Language {
    En,
    Zh,
}

impl Language {
    pub fn detect() -> Self {
        for key in ["LC_ALL", "LC_MESSAGES", "LANG"] {
            if let Ok(value) = std::env::var(key)
                && !value.is_empty()
            {
                return if value.eq_ignore_ascii_case("zh")
                    || value.get(..3).is_some_and(|s| {
                        s.eq_ignore_ascii_case("zh_") || s.eq_ignore_ascii_case("zh-")
                    }) {
                    Self::Zh
                } else {
                    Self::En
                };
            }
        }
        Self::En
    }

    pub fn text<'a>(self, en: &'a str, zh: &'a str) -> &'a str {
        match self {
            Self::En => en,
            Self::Zh => zh,
        }
    }

    pub fn code(self) -> &'static str {
        self.text("en", "zh")
    }
}

#[derive(Debug)]
pub struct Options<'a> {
    pub command: Option<&'a str>,
    pub subject: Option<&'a str>,
    pub input: Option<&'a OsStr>,
    pub output: Option<&'a OsStr>,
    pub armor: bool,
    pub language: Language,
    pub interactive: bool,
    pub plain: bool,
    pub json: bool,
    pub timing: bool,
    pub help: bool,
    pub version: bool,
}

impl<'a> Options<'a> {
    pub fn parse(argv: &'a [OsString]) -> Result<Self, String> {
        let mut result = Self {
            command: None,
            subject: None,
            input: None,
            output: None,
            armor: false,
            language: Language::detect(),
            interactive: false,
            plain: false,
            json: false,
            timing: true,
            help: false,
            version: false,
        };
        let mut parser = CLI.parse_os(argv);
        while let Some(event) = parser.next().map_err(|e| e.to_string())? {
            match event {
                Event::Flag { arg } => match arg {
                    "help" => result.help = true,
                    "version" => result.version = true,
                    "plain" => result.plain = true,
                    "json" => result.json = true,
                    "interactive" => result.interactive = true,
                    "no-timing" => result.timing = false,
                    "armor" => result.armor = true,
                    _ => unreachable!("static command schema"),
                },
                Event::Value { arg, value } => {
                    if arg == "input" {
                        result.input = Some(value);
                        continue;
                    }
                    if arg == "output" {
                        result.output = Some(value);
                        continue;
                    }
                    let value = value.to_str().ok_or("Arguments must be valid UTF-8")?;
                    match arg {
                        "lang" => {
                            result.language = if value == "zh" {
                                Language::Zh
                            } else {
                                Language::En
                            }
                        }
                        "command" => result.command = Some(value),
                        "subject" => result.subject = Some(value),
                        _ => unreachable!("static command schema"),
                    }
                }
                _ => unreachable!("no subcommands in the static schema"),
            }
        }
        parser.finish().map_err(|e| e.to_string())?;
        if result.help || result.version {
            return Ok(result);
        }
        if result.subject.is_some()
            && !matches!(result.command, Some("projects" | "keys" | "encrypt"))
        {
            return Err(
                "A second argument is only accepted after projects, keys, or encrypt".into(),
            );
        }
        if result.command == Some("keys")
            && result
                .subject
                .is_some_and(|format| !["age", "gpg", "ssh"].contains(&format))
        {
            return Err("Choose a public-key format: age, gpg, or ssh".into());
        }
        if result.command == Some("encrypt") {
            if !matches!(result.subject, Some("age" | "gpg")) {
                return Err("Choose an encryption format: lightjunction encrypt age|gpg".into());
            }
            if result.json {
                return Err(
                    "--json is for profile content and public keys; encryption writes ciphertext"
                        .into(),
                );
            }
        } else if result.input.is_some() || result.output.is_some() || result.armor {
            return Err("--input, --output, and --armor require the encrypt command".into());
        }
        if result.interactive && result.command.is_some() {
            return Err("Use --interactive by itself to enter the menu".into());
        }
        Ok(result)
    }
}
