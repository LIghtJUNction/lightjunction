use std::io::{self, Write};

use crate::{Error, args::Language};

const AGE_KEY: &str = include_str!("../keys/age-recipients.txt");
const GPG_KEY: &str = include_str!("../keys/pubkey.asc");
const SSH_KEYS: &str = include_str!("../keys/ssh-public-keys.txt");

pub fn render(
    format: Option<&str>,
    language: Language,
    json: bool,
    out: &mut impl Write,
) -> Result<(), Error> {
    let selected = match format {
        Some("age") => Some(("age", AGE_KEY)),
        Some("gpg") => Some(("gpg", GPG_KEY)),
        Some("ssh") => Some(("ssh", SSH_KEYS)),
        None => None,
        Some(_) => {
            return Err(Error::Usage(
                "Choose a public-key format: age, gpg, or ssh".into(),
            ));
        }
    };
    if let Some((_, key)) = selected
        && !json
    {
        out.write_all(key.as_bytes())?;
        return Ok(());
    }

    let sections: Vec<(&str, Vec<&str>)> = if let Some((name, key)) = selected {
        vec![(name, vec![key])]
    } else {
        vec![
            ("age", vec![AGE_KEY.trim_end(), "lightjunction keys age"]),
            (
                "OpenPGP",
                vec![
                    "EB21B83AB1E982DF66F08387A67178405F7736FD",
                    "lightjunction keys gpg",
                ],
            ),
            ("SSH", vec![SSH_KEYS.trim_end(), "lightjunction keys ssh"]),
            (
                language.text("Encrypt a file", "加密文件"),
                vec![
                    "lightjunction encrypt age --input note.txt --output note.txt.age",
                    "lightjunction encrypt gpg --input note.txt --output note.txt.gpg",
                ],
            ),
        ]
    };
    if json {
        write!(out, "{{\"command\":\"keys\",\"language\":")?;
        json_string(out, language.code())?;
        write!(out, ",\"sections\":[")?;
        for (index, (title, lines)) in sections.iter().enumerate() {
            if index != 0 {
                write!(out, ",")?;
            }
            write!(out, "{{\"title\":")?;
            json_string(out, title)?;
            write!(out, ",\"lines\":[")?;
            for (line_index, line) in lines.iter().enumerate() {
                if line_index != 0 {
                    write!(out, ",")?;
                }
                json_string(out, line)?;
            }
            write!(out, "]}}")?;
        }
        writeln!(out, "]}}")?;
    } else {
        for (title, lines) in sections {
            writeln!(out, "\n  {title}\n")?;
            for line in lines {
                writeln!(out, "  {line}")?;
            }
        }
        writeln!(out)?;
    }
    Ok(())
}

fn json_string(out: &mut impl Write, value: &str) -> io::Result<()> {
    out.write_all(b"\"")?;
    let mut start = 0;
    for (i, byte) in value.bytes().enumerate() {
        if byte == b'"' || byte == b'\\' || byte <= 0x1f {
            out.write_all(&value.as_bytes()[start..i])?;
            match byte {
                b'"' => out.write_all(b"\\\"")?,
                b'\\' => out.write_all(b"\\\\")?,
                byte => write!(out, "\\u{byte:04x}")?,
            }
            start = i + 1;
        }
    }
    out.write_all(&value.as_bytes()[start..])?;
    out.write_all(b"\"")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn json_escapes_quotes_backslashes_and_controls_without_losing_unicode() {
        let mut out = Vec::new();
        json_string(&mut out, "\"\\\n\t\0你好").unwrap();
        assert_eq!(
            String::from_utf8(out).unwrap(),
            "\"\\\"\\\\\\u000a\\u0009\\u0000你好\""
        );
    }
}
