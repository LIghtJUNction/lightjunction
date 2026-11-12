use std::ffi::{OsStr, OsString};

use zclap::{Arg, Command, Event};

pub const COMMANDS: &[&str] = &["play", "orbit", "rain", "wave", "snake", "keys", "encrypt"];

const ARGS: &[Arg<'static>] = &[
    Arg::flag("help").short('h').help("Show help"),
    Arg::flag("version").short('V').help("Show version"),
    Arg::flag("plain").help("Disable colors"),
    Arg::flag("no-timing").help("Hide timing output"),
    Arg::flag("json").help("Write public-key content as JSON"),
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
    Arg::value("frames").help("Render a bounded animation without keyboard input"),
    Arg::value("seed").help("Seed the particle field and Snake food"),
    Arg::positional("command")
        .one_of(COMMANDS)
        .help("Playground scene, keys, or encrypt"),
    Arg::positional("subject").help("Public-key or encryption format: age, gpg, ssh"),
];

pub const CLI: Command<'static> = Command::new("lightjunction")
    .about("A terminal playground with generative art, Snake, and public-key encryption")
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
    pub json: bool,
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
            subject: None,
            input: None,
            output: None,
            armor: false,
            json: false,
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
                    "json" => result.json = true,
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
        if result.subject.is_some() && !matches!(result.command, Some("keys" | "encrypt")) {
            return Err("A format is only accepted after keys or encrypt".into());
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
                return Err("--json is for public keys; encryption writes ciphertext".into());
            }
        } else if result.input.is_some() || result.output.is_some() || result.armor {
            return Err("--input, --output, and --armor require the encrypt command".into());
        }
        if result.json && result.command != Some("keys") {
            return Err("--json is available for keys only".into());
        }
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

    #[test]
    fn keeps_encryption_and_public_key_validation() {
        let argv = args(&["encrypt", "age", "--input", "note.txt"]);
        assert!(Options::parse(&argv).is_ok());
        assert!(Options::parse(&args(&["encrypt", "ssh"])).is_err());
        assert!(Options::parse(&args(&["keys", "unknown"])).is_err());
        assert!(Options::parse(&args(&["snake", "--json"])).is_err());
    }
}
