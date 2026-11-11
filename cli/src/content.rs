use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::io::{self, Write};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use crate::{Error, args::Language};

pub struct Display {
    pub language: Language,
    pub color: bool,
    pub json: bool,
}

struct Project {
    id: &'static str,
    name: &'static str,
    en: &'static str,
    zh: &'static str,
    url: &'static str,
}

const PROJECTS: &[Project] = &[
    Project {
        id: "z",
        name: "Project Z",
        en: "Small Rust libraries. One responsibility at a time.",
        zh: "小而专注的 Rust 库，一次把一件事做好。",
        url: "https://github.com/LIghtJUNction/lightjunction#project-z",
    },
    Project {
        id: "lmm-api",
        name: "LMM API",
        en: "A self-hostable gateway for models and tools.",
        zh: "可自行部署的模型与工具网关。",
        url: "https://github.com/TokenNotIncluded/lmm-api",
    },
    Project {
        id: "magicnet",
        name: "MagicNet",
        en: "Networking tools for rooted Android devices.",
        zh: "为已 root 的 Android 设备构建网络工具。",
        url: "https://github.com/LIghtJUNction/MagicNet",
    },
    Project {
        id: "onimods",
        name: "OniMods",
        en: "Tools and experiments for Oxygen Not Included.",
        zh: "围绕《缺氧》的工具与实验。",
        url: "https://github.com/LIghtJUNction/OniMods",
    },
    Project {
        id: "humangrant",
        name: "HumanGrant",
        en: "Explicit permission for AI agents.",
        zh: "为 AI 智能体提供明确的授权。",
        url: "https://github.com/LIghtJUNction/humangrant",
    },
];

const SPARKS: &[(&str, &str)] = &[
    (
        "What would you remove if this tool had to fit in one file?",
        "如果这个工具只能写在一个文件里，你会删掉什么？",
    ),
    (
        "Which part of 'slow' have you actually measured?",
        "你说的‘慢’，具体测量过哪一部分？",
    ),
    (
        "Could someone understand the interface without reading its implementation?",
        "不读实现，别人能理解这个接口吗？",
    ),
    (
        "What still works when the network disappears?",
        "断网之后，哪些功能依然能用？",
    ),
    (
        "If the happy path is tiny, where did all the code go?",
        "如果正常流程很短，剩下的代码都在做什么？",
    ),
    (
        "Can you replace a promise with a reproducible test?",
        "能不能把一句保证，换成一个可复现的测试？",
    ),
];

pub fn render(
    command: &str,
    filter: Option<&str>,
    display: &Display,
    out: &mut impl Write,
) -> Result<(), Error> {
    let selected = if let Some(name) = filter {
        Some(
            PROJECTS
                .iter()
                .find(|p| p.id.eq_ignore_ascii_case(name) || p.name.eq_ignore_ascii_case(name))
                .ok_or_else(|| {
                    Error::Usage(
                        "Unknown project. Choose: z, lmm-api, magicnet, onimods, humangrant".into(),
                    )
                })?,
        )
    } else {
        None
    };
    let mut page = Page::new(command, display, out)?;
    let l = display.language;
    match command {
        "card" => page.section(
            "LIghtJUNction",
            &[
                l.text(
                    "Small tools. Open code. Your machine.",
                    "小工具。开放代码。自己的机器。",
                ),
                "",
                l.text(
                    "I build tools around AI, Linux, networking, and Rust.",
                    "我围绕 AI、Linux、网络与 Rust 构建工具。",
                ),
                l.text(
                    "Simplicity / Beauty / Openness / Freedom / Encryption",
                    "简洁 / 美感 / 开放 / 自由 / 加密",
                ),
                "",
                l.text(
                    "Try: lightjunction tour  |  lightjunction --interactive",
                    "试试：lightjunction tour  |  lightjunction --interactive",
                ),
            ],
        )?,
        "about" => about(&mut page)?,
        "projects" => projects(&mut page, selected)?,
        "principles" => principles(&mut page)?,
        "links" => links(&mut page)?,
        "tour" => {
            about(&mut page)?;
            projects(&mut page, None)?;
            principles(&mut page)?;
            links(&mut page)?;
        }
        "spark" => {
            let seed = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default();
            let (en, zh) = SPARKS[spark_index(seed)];
            page.section(
                l.text("A small engineering question", "一个小小的工程问题"),
                &[
                    l.text(en, zh),
                    "",
                    l.text(
                        "A prompt from this CLI, not a quote or a live AI response.",
                        "这是 CLI 内置的问题，不是历史引语或在线 AI 回答。",
                    ),
                ],
            )?;
        }
        "version" => page.section(concat!("lightjunction ", env!("CARGO_PKG_VERSION")), &[])?,
        "help" => page.section(
            concat!("lightjunction ", env!("CARGO_PKG_VERSION")),
            &[
                "Usage: lightjunction [OPTIONS] [COMMAND] [PROJECT]",
                "",
                "card         A short introduction (default when piped)",
                "about        Meet LIghtJUNction",
                "projects     Explore projects; optionally add a project name",
                "principles   How I build",
                "links        Public GitHub and website links",
                "tour         Read the complete introduction",
                "spark        Draw a small engineering question",
                "",
                "-i, --interactive  Enter the menu, even with piped input",
                "    --lang en|zh   Select a language (otherwise use locale)",
                "    --plain        Disable terminal styling",
                "    --json         Write structured JSON to stdout",
                "    --no-timing    Hide timing output",
                "-h, --help         Show this help",
                "-V, --version      Show the version",
                "",
                "With no command, a terminal opens the menu. Pipes receive a card.",
                "Timing goes to stderr. Menu input waiting is measured separately.",
                "Project names: z, lmm-api, magicnet, onimods, humangrant",
                "Menu: 1..6, a command, projects NAME, s/stats, ?/help, q/quit/exit",
            ],
        )?,
        _ => return Err(Error::Usage("Unknown command".into())),
    }
    page.finish()?;
    Ok(())
}

fn about(page: &mut Page<'_, impl Write>) -> io::Result<()> {
    let l = page.display.language;
    page.section(
        l.text("Hello, I'm LIghtJUNction.", "你好，我是 LIghtJUNction。"),
        &[
            l.text(
                "I build open-source tools that are easy to inspect, run, and own.",
                "我构建容易检查、运行和自主掌控的开源工具。",
            ),
            l.text(
                "My interests meet at AI, Linux, networking, and small Rust libraries.",
                "我的兴趣交汇在 AI、Linux、网络与小型 Rust 库。",
            ),
            "",
            l.text(
                "Start with a small idea. Make it work. Measure it. Keep it readable.",
                "从一个小想法开始。把它做出来，测一测，让它容易读懂。",
            ),
        ],
    )
}

fn spark_index(seed: Duration) -> usize {
    // Mix the timestamp before reducing it: coarse clocks can have always-even nanoseconds.
    let mut hash = DefaultHasher::new();
    seed.hash(&mut hash);
    (hash.finish() % SPARKS.len() as u64) as usize
}

fn projects(page: &mut Page<'_, impl Write>, selected: Option<&Project>) -> io::Result<()> {
    for project in PROJECTS {
        if selected.is_some_and(|p| p.id != project.id) {
            continue;
        }
        page.section(
            project.name,
            &[
                page.display.language.text(project.en, project.zh),
                project.url,
            ],
        )?;
    }
    Ok(())
}

fn principles(page: &mut Page<'_, impl Write>) -> io::Result<()> {
    let l = page.display.language;
    page.section(
        l.text("How I build", "做事原则"),
        &[
            l.text("01  Keep the scope small.", "01  把问题的范围收小。"),
            l.text("02  Make the interface readable.", "02  让接口容易读懂。"),
            l.text("03  Measure what matters.", "03  测量真正重要的部分。"),
            l.text(
                "04  Let people inspect and own their tools.",
                "04  让使用者能检查并掌控自己的工具。",
            ),
        ],
    )
}

fn links(page: &mut Page<'_, impl Write>) -> io::Result<()> {
    let l = page.display.language;
    page.section(
        l.text("Find me", "找到我"),
        &[
            "GitHub   https://github.com/LIghtJUNction",
            "Website  https://lightjunction.github.io/lightjunction/",
            "",
            l.text(
                "Pick a project. Read a little. Build something.",
                "选一个项目，读一点代码，做点东西。",
            ),
        ],
    )
}

struct Page<'a, W> {
    display: &'a Display,
    out: &'a mut W,
    first: bool,
}

impl<'a, W: Write> Page<'a, W> {
    fn new(command: &str, display: &'a Display, out: &'a mut W) -> io::Result<Self> {
        if display.json {
            write!(out, "{{\"command\":")?;
            json_string(out, command)?;
            write!(
                out,
                ",\"language\":\"{}\",\"sections\":[",
                display.language.code()
            )?;
        }
        Ok(Self {
            display,
            out,
            first: true,
        })
    }

    fn section(&mut self, title: &str, lines: &[&str]) -> io::Result<()> {
        if self.display.json {
            if !self.first {
                write!(self.out, ",")?;
            }
            write!(self.out, "{{\"title\":")?;
            json_string(self.out, title)?;
            write!(self.out, ",\"lines\":[")?;
            for (i, line) in lines.iter().enumerate() {
                if i != 0 {
                    write!(self.out, ",")?;
                }
                json_string(self.out, line)?;
            }
            write!(self.out, "]}}")?;
        } else {
            if self.display.color {
                writeln!(self.out, "\n  \x1b[1;97m{title}\x1b[0m\n")?;
            } else {
                writeln!(self.out, "\n  {title}\n")?;
            }
            for line in lines {
                if line.is_empty() {
                    writeln!(self.out)?;
                } else {
                    writeln!(self.out, "  {line}")?;
                }
            }
        }
        self.first = false;
        Ok(())
    }

    fn finish(self) -> io::Result<()> {
        if self.display.json {
            writeln!(self.out, "]}}")
        } else {
            writeln!(self.out)
        }
    }
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
    fn coarse_clock_ticks_can_reach_every_question() {
        for resolution in [100, 1_000, 1_000_000] {
            let mut seen = [false; SPARKS.len()];
            for tick in 0..100 {
                let seed = Duration::new(1_700_000_000, tick * resolution);
                seen[spark_index(seed)] = true;
            }
            assert!(
                seen.into_iter().all(|value| value),
                "resolution={resolution}ns"
            );
        }
    }

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
