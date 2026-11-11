use std::ffi::OsString;

use zclap::{Arg, Command, Event};

pub const COMMANDS: &[&str] = &[
    "card",
    "about",
    "projects",
    "principles",
    "links",
    "tour",
    "spark",
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
    Arg::value("lang")
        .one_of(&["en", "zh"])
        .help("Language: en or zh"),
    Arg::positional("command")
        .one_of(COMMANDS)
        .help("Page to explore"),
    Arg::positional("project").help("Project name (with projects only)"),
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
    pub project: Option<&'a str>,
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
            project: None,
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
                    _ => unreachable!("static command schema"),
                },
                Event::Value { arg, value } => {
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
                        "project" => result.project = Some(value),
                        _ => unreachable!("static command schema"),
                    }
                }
                _ => unreachable!("no subcommands in the static schema"),
            }
        }
        parser.finish().map_err(|e| e.to_string())?;
        if result.project.is_some() && result.command != Some("projects") {
            return Err("A project name is only accepted after 'projects'".into());
        }
        if result.interactive && result.command.is_some() {
            return Err("Use --interactive by itself to enter the menu".into());
        }
        Ok(result)
    }
}
