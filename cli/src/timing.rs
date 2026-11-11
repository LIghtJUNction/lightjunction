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

#[derive(Default)]
pub struct Stats {
    count: u32,
    sum: Duration,
    min: Duration,
    max: Duration,
}

impl Stats {
    pub fn record(&mut self, elapsed: Duration) {
        self.min = if self.count == 0 {
            elapsed
        } else {
            self.min.min(elapsed)
        };
        self.max = self.max.max(elapsed);
        self.sum += elapsed;
        self.count += 1;
    }

    pub fn distribution(&self, out: &mut impl Write) -> io::Result<()> {
        writeln!(
            out,
            "[stats] commands={} min={} mean={} max={} work={}",
            self.count,
            Time(self.min),
            Time(self.sum.checked_div(self.count).unwrap_or_default()),
            Time(self.max),
            Time(self.sum)
        )
    }

    pub fn summary(
        &self,
        out: &mut impl Write,
        total: Duration,
        waiting: Duration,
    ) -> io::Result<()> {
        self.distribution(out)?;
        writeln!(
            out,
            "[session] active={} wait={} total={}",
            Time(total.saturating_sub(waiting)),
            Time(waiting),
            Time(total)
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn statistics_measure_commands_without_input_wait() {
        let mut stats = Stats::default();
        let mut out = Vec::new();
        stats
            .summary(&mut out, Duration::ZERO, Duration::ZERO)
            .unwrap();
        assert!(
            String::from_utf8(out)
                .unwrap()
                .contains("commands=0 min=0.000us mean=0.000us")
        );
        stats.record(Duration::from_micros(20));
        stats.record(Duration::from_micros(60));
        let mut out = Vec::new();
        stats
            .summary(
                &mut out,
                Duration::from_secs(2) + Duration::from_micros(80),
                Duration::from_secs(2),
            )
            .unwrap();
        let out = String::from_utf8(out).unwrap();
        assert!(out.contains("commands=2 min=20.000us mean=40.000us max=60.000us work=80.000us"));
        assert!(out.contains("active=80.000us wait=2.000s"));
    }
}
