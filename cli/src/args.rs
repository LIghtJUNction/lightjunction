use std::ffi::OsString;

use zclap::{Arg, Command, Event};

pub const COMMANDS: &[&str] = &["play", "orbit", "rain", "wave", "snake"];

const ARGS: &[Arg<'static>] = &[
    Arg::flag("help").short('h').help("Show help"),
    Arg::flag("version").short('V').help("Show version"),
    Arg::flag("plain").help("Disable colors"),
    Arg::flag("no-timing").help("Hide timing output"),
    Arg::value("lang")
        .one_of(&["en", "zh"])
        .help("Language: en or zh"),
    Arg::value("frames").help("Render a bounded animation without keyboard input"),
    Arg::value("seed").help("Seed the particle field and Snake food"),
    Arg::positional("command")
        .one_of(COMMANDS)
        .help("Playground or starting scene"),
];

pub const CLI: Command<'static> = Command::new("lightjunction")
    .about("A tiny terminal playground: orbit, rain, waves, and Snake")
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
}

#[derive(Debug)]
pub struct Options<'a> {
    pub command: Option<&'a str>,
    pub language: Language,
    pub plain: bool,
    pub timing: bool,
    pub frames: Option<u32>,
    pub seed: Option<u64>,
    pub help: bool,
    pub version: bool,
}

impl<'a> Options<'a> {
    pub fn parse(argv: &'a [OsString]) -> Result<Self, String> {
        let mut result = Self {
            command: None,
            language: Language::detect(),
            plain: false,
            timing: true,
            frames: None,
            seed: None,
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
                            };
                        }
                        "frames" => {
                            let frames = value
                                .parse::<u32>()
                                .map_err(|_| "--frames expects an integer from 1 to 10000")?;
                            if !(1..=10_000).contains(&frames) {
                                return Err("--frames expects an integer from 1 to 10000".into());
                            }
                            result.frames = Some(frames);
                        }
                        "seed" => {
                            result.seed = Some(
                                value
                                    .parse::<u64>()
                                    .map_err(|_| "--seed expects an unsigned 64-bit integer")?,
                            );
                        }
                        "command" => result.command = Some(value),
                        _ => unreachable!("static command schema"),
                    }
                }
                _ => unreachable!("no subcommands in the static schema"),
            }
        }
        parser.finish().map_err(|e| e.to_string())?;
        Ok(result)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn args(values: &[&str]) -> Vec<OsString> {
        values.iter().map(OsString::from).collect()
    }

    #[test]
    fn parses_scene_and_bounded_animation_options() {
        let argv = args(&["snake", "--frames=12", "--seed", "42"]);
        let options = Options::parse(&argv).unwrap();
        assert_eq!(options.command, Some("snake"));
        assert_eq!(options.frames, Some(12));
        assert_eq!(options.seed, Some(42));
    }

    #[test]
    fn rejects_zero_frames_and_negative_seeds() {
        assert!(Options::parse(&args(&["--frames", "0"])).is_err());
        assert!(Options::parse(&args(&["--seed", "-1"])).is_err());
    }
}
