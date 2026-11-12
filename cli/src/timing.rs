use std::fmt;
use std::io::{self, Write};
use std::time::Duration;

pub struct Time(pub Duration);

impl fmt::Display for Time {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let seconds = self.0.as_secs_f64();
        if seconds >= 1.0 {
            write!(f, "{seconds:.3}s")
        } else if seconds >= 0.001 {
            write!(f, "{:.3}ms", seconds * 1e3)
        } else {
            write!(f, "{:.3}us", seconds * 1e6)
        }
    }
}

pub fn command(
    out: &mut impl Write,
    name: &str,
    elapsed: Duration,
    success: bool,
) -> io::Result<()> {
    writeln!(
        out,
        "[time] command={name} status={} elapsed={}",
        if success { "ok" } else { "error" },
        Time(elapsed)
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn timing_uses_compact_units() {
        assert_eq!(Time(Duration::from_micros(20)).to_string(), "20.000us");
        assert_eq!(Time(Duration::from_millis(40)).to_string(), "40.000ms");
        assert_eq!(Time(Duration::from_secs(2)).to_string(), "2.000s");
    }
}
