use std::collections::VecDeque;
use std::f64::consts::TAU;
use std::io::{self, Write};
use std::time::{Duration, Instant};

use crossterm::cursor::{Hide, MoveTo, Show};
use crossterm::event::{self, Event, KeyCode, KeyEvent, KeyEventKind, KeyModifiers};
use crossterm::execute;
use crossterm::terminal::{self};

use crate::args::Language;

const FRAME: Duration = Duration::from_millis(40);
const DEFAULT_WIDTH: usize = 80;
const DEFAULT_HEIGHT: usize = 24;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Scene {
    Orbit,
    Rain,
    Wave,
    Snake,
}

impl Scene {
    pub fn from_command(command: &str) -> Self {
        match command {
            "rain" => Self::Rain,
            "wave" => Self::Wave,
            "snake" => Self::Snake,
            _ => Self::Orbit,
        }
    }

    fn name(self) -> &'static str {
        match self {
            Self::Orbit => "ORBIT",
            Self::Rain => "RAIN",
            Self::Wave => "WAVE",
            Self::Snake => "SNAKE",
        }
    }

    fn next(self) -> Self {
        match self {
            Self::Orbit => Self::Rain,
            Self::Rain => Self::Wave,
            Self::Wave => Self::Snake,
            Self::Snake => Self::Orbit,
        }
    }
}

#[derive(Clone, Copy)]
pub struct Display {
    pub language: Language,
    pub color: bool,
}

#[derive(Clone, Copy, PartialEq, Eq)]
struct Rgb(u8, u8, u8);

#[derive(Clone, Copy)]
struct Cell {
    ch: char,
    color: Option<Rgb>,
}

impl Default for Cell {
    fn default() -> Self {
        Self {
            ch: ' ',
            color: None,
        }
    }
}

struct Canvas {
    width: usize,
    height: usize,
    cells: Vec<Cell>,
}

impl Canvas {
    fn new(width: usize, height: usize) -> Self {
        Self {
            width,
            height,
            cells: vec![Cell::default(); width * height],
        }
    }

    fn set(&mut self, x: i32, y: i32, ch: char, color: Rgb) {
        if x >= 0 && y >= 0 && (x as usize) < self.width && (y as usize) < self.height {
            self.cells[y as usize * self.width + x as usize] = Cell {
                ch,
                color: Some(color),
            };
        }
    }

    fn text(&mut self, x: usize, y: usize, text: &str, color: Rgb) {
        for (offset, ch) in text.chars().enumerate() {
            self.set((x + offset) as i32, y as i32, ch, color);
        }
    }

    fn render(&self, color: bool, pad: bool) -> String {
        let mut output = String::with_capacity(self.cells.len() * 2 + self.height);
        for row in 0..self.height {
            let start = row * self.width;
            let end = self.cells[start..start + self.width]
                .iter()
                .rposition(|cell| cell.ch != ' ')
                .map_or(start, |last| start + last + 1);
            let end = if pad { start + self.width } else { end };
            let mut active = None;
            for cell in &self.cells[start..end] {
                if color && cell.color != active {
                    match cell.color {
                        Some(Rgb(r, g, b)) => {
                            output.push_str(&format!("\x1b[38;2;{r};{g};{b}m"));
                        }
                        None => output.push_str("\x1b[0m"),
                    }
                    active = cell.color;
                }
                output.push(cell.ch);
            }
            if color && active.is_some() {
                output.push_str("\x1b[0m");
            }
            output.push('\n');
        }
        output
    }
}

#[derive(Clone, Copy)]
struct Rng(u64);

impl Rng {
    fn next(&mut self) -> u64 {
        let mut value = self.0;
        value ^= value >> 12;
        value ^= value << 25;
        value ^= value >> 27;
        self.0 = value;
        value.wrapping_mul(0x2545_f491_4f6c_dd1d)
    }

    fn below(&mut self, upper: usize) -> usize {
        (self.next() % upper as u64) as usize
    }
}

fn noise(value: u64) -> u64 {
    let mut value = value.wrapping_add(0x9e37_79b9_7f4a_7c15);
    value = (value ^ (value >> 30)).wrapping_mul(0xbf58_476d_1ce4_e5b9);
    value = (value ^ (value >> 27)).wrapping_mul(0x94d0_49bb_1331_11eb);
    value ^ (value >> 31)
}

fn unit(value: u64) -> f64 {
    (noise(value) >> 11) as f64 / ((1_u64 << 53) as f64)
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
struct Point {
    x: i32,
    y: i32,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Direction {
    Up,
    Down,
    Left,
    Right,
}

impl Direction {
    fn delta(self) -> Point {
        match self {
            Self::Up => Point { x: 0, y: -1 },
            Self::Down => Point { x: 0, y: 1 },
            Self::Left => Point { x: -1, y: 0 },
            Self::Right => Point { x: 1, y: 0 },
        }
    }

    fn opposite(self, other: Self) -> bool {
        self.delta().x + other.delta().x == 0 && self.delta().y + other.delta().y == 0
    }
}

struct Snake {
    width: i32,
    height: i32,
    body: VecDeque<Point>,
    direction: Direction,
    queued: Direction,
    food: Point,
    rng: Rng,
    score: u32,
    game_over: bool,
}

impl Snake {
    fn new(seed: u64) -> Self {
        let mut snake = Self {
            width: 30,
            height: 12,
            body: VecDeque::new(),
            direction: Direction::Right,
            queued: Direction::Right,
            food: Point { x: 0, y: 0 },
            rng: Rng(seed),
            score: 0,
            game_over: false,
        };
        snake.reset();
        snake
    }

    fn reset(&mut self) {
        self.body = (0..4).map(|x| Point { x: 8 - x, y: 6 }).collect();
        self.direction = Direction::Right;
        self.queued = Direction::Right;
        self.score = 0;
        self.game_over = false;
        self.place_food();
    }

    fn steer(&mut self, direction: Direction) {
        if !self.direction.opposite(direction) {
            self.queued = direction;
        }
    }

    fn place_food(&mut self) {
        for _ in 0..(self.width * self.height) {
            let point = Point {
                x: self.rng.below(self.width as usize) as i32,
                y: self.rng.below(self.height as usize) as i32,
            };
            if !self.body.contains(&point) {
                self.food = point;
                return;
            }
        }
    }

    fn step(&mut self) {
        if self.game_over {
            return;
        }
        self.direction = self.queued;
        let delta = self.direction.delta();
        let head = self.body.front().copied().unwrap_or(Point { x: 0, y: 0 });
        let next = Point {
            x: head.x + delta.x,
            y: head.y + delta.y,
        };
        let eating = next == self.food;
        let collision_length = self.body.len() - usize::from(!eating);
        if next.x < 0
            || next.y < 0
            || next.x >= self.width
            || next.y >= self.height
            || self
                .body
                .iter()
                .take(collision_length)
                .any(|part| *part == next)
        {
            self.game_over = true;
            return;
        }
        self.body.push_front(next);
        if eating {
            self.score += 1;
            self.place_food();
        } else {
            self.body.pop_back();
        }
    }
}

pub struct App {
    scene: Scene,
    seed: u64,
    frame: u64,
    width: usize,
    height: usize,
    speed: u32,
    density: u32,
    paused: bool,
    show_help: bool,
    snake: Snake,
}

impl App {
    pub fn new(scene: Scene, seed: u64, width: usize, height: usize) -> Self {
        Self {
            scene,
            seed,
            frame: 0,
            width: width.max(1),
            height: height.max(1),
            speed: 4,
            density: 3,
            paused: false,
            show_help: false,
            snake: Snake::new(seed ^ 0x5eed_5eed_5eed_5eed),
        }
    }

    fn resize(&mut self, width: usize, height: usize) {
        self.width = width.max(1);
        self.height = height.max(1);
    }

    fn advance(&mut self) {
        if self.paused {
            return;
        }
        let previous = self.frame;
        self.frame = self.frame.wrapping_add(u64::from(self.speed));
        if self.scene == Scene::Snake && previous / 12 != self.frame / 12 {
            self.snake.step();
        }
    }

    fn handle_key(&mut self, key: KeyEvent) -> bool {
        if key.kind == KeyEventKind::Release {
            return true;
        }
        if key.modifiers.contains(KeyModifiers::CONTROL) && key.code == KeyCode::Char('c') {
            return false;
        }
        match key.code {
            KeyCode::Esc | KeyCode::Char('q') => return false,
            KeyCode::Char('1') => self.scene = Scene::Orbit,
            KeyCode::Char('2') => self.scene = Scene::Rain,
            KeyCode::Char('3') => self.scene = Scene::Wave,
            KeyCode::Char('4') => self.scene = Scene::Snake,
            KeyCode::Tab => self.scene = self.scene.next(),
            KeyCode::BackTab => {
                for _ in 0..3 {
                    self.scene = self.scene.next();
                }
            }
            KeyCode::Char(' ') => self.paused = !self.paused,
            KeyCode::Char('+') | KeyCode::Char('=') => self.speed = (self.speed + 1).min(9),
            KeyCode::Char('-') => self.speed = self.speed.saturating_sub(1).max(1),
            KeyCode::Char(']') => self.density = (self.density + 1).min(5),
            KeyCode::Char('[') => self.density = self.density.saturating_sub(1).max(1),
            KeyCode::Char('r') => {
                self.frame = 0;
                self.snake.reset();
            }
            KeyCode::Char('?') => self.show_help = !self.show_help,
            KeyCode::Enter if self.snake.game_over => self.snake.reset(),
            KeyCode::Up | KeyCode::Char('w') if self.scene == Scene::Snake => {
                self.snake.steer(Direction::Up);
            }
            KeyCode::Down | KeyCode::Char('s') if self.scene == Scene::Snake => {
                self.snake.steer(Direction::Down);
            }
            KeyCode::Left | KeyCode::Char('a') if self.scene == Scene::Snake => {
                self.snake.steer(Direction::Left);
            }
            KeyCode::Right | KeyCode::Char('d') if self.scene == Scene::Snake => {
                self.snake.steer(Direction::Right);
            }
            _ => {}
        }
        true
    }

    pub fn render(&self, display: Display, pad: bool) -> String {
        let mut canvas = Canvas::new(self.width, self.height);
        if self.width < 34 || self.height < 12 {
            return format!(
                "{}\n",
                display
                    .language
                    .text("Need a 34x12 terminal.", "终端至少需要 34x12。")
            );
        }
        // Render a full-screen frame so the previous frame is overwritten
        // without clearing the terminal, which stops flicker on fast refresh.
        self.chrome(&mut canvas, display.language);
        match self.scene {
            Scene::Orbit => self.orbit(&mut canvas),
            Scene::Rain => self.rain(&mut canvas),
            Scene::Wave => self.wave(&mut canvas),
            Scene::Snake => self.draw_snake(&mut canvas, display.language),
        }
        if self.show_help {
            self.help(&mut canvas, display.language);
        }
        canvas.render(display.color, pad)
    }

    fn chrome(&self, canvas: &mut Canvas, language: Language) {
        canvas.text(1, 0, "LJ://PLAY", Rgb(110, 245, 255));
        let tabs = [Scene::Orbit, Scene::Rain, Scene::Wave, Scene::Snake];
        let mut x = 14;
        for (index, scene) in tabs.into_iter().enumerate() {
            let label = format!(" {}:{} ", index + 1, scene.name());
            let color = if scene == self.scene {
                Rgb(255, 255, 255)
            } else {
                Rgb(80, 100, 135)
            };
            canvas.text(x, 0, &label, color);
            x += label.len() + 1;
        }
        canvas.text(
            1,
            1,
            &"─".repeat(self.width.saturating_sub(2)),
            Rgb(35, 55, 90),
        );
        let status = format!(
            "{}  speed:{}  density:{}  score:{:04}",
            if self.paused { "PAUSED" } else { "LIVE" },
            self.speed,
            self.density,
            self.snake.score
        );
        canvas.text(1, self.height - 2, &status, Rgb(110, 245, 190));
        canvas.text(
            1,
            self.height - 1,
            language.text(
                "1-4 scenes  TAB next  SPACE pause  +/- speed  [/] density  ? help  Q quit",
                "1-4 场景  TAB 切换  空格 暂停  +/- 速度  [/] 密度  ? 帮助  Q 退出",
            ),
            Rgb(120, 140, 175),
        );
    }

    fn scene_area(&self) -> (i32, i32, i32, i32) {
        let top = 2;
        let bottom = self.height as i32 - 2;
        (self.width as i32, bottom - top, top, bottom)
    }

    fn orbit(&self, canvas: &mut Canvas) {
        let (width, height, top, _) = self.scene_area();
        let cx = width / 2;
        let cy = height / 2 + top;
        let radius = (height / 2 - 1).max(1) as f64;
        for star in 0..self.density * 24 {
            let x = (unit(self.seed + u64::from(star) * 3) * width as f64) as i32;
            let y = top + (unit(self.seed + u64::from(star) * 3 + 1) * height as f64) as i32;
            let bright = !noise(u64::from(star) + self.frame / 8).is_multiple_of(5);
            canvas.set(x, y, if bright { '·' } else { '+' }, Rgb(45, 65, 105));
        }
        for particle in 0..self.density * 36 {
            let id = u64::from(particle);
            let phase = unit(self.seed ^ id.wrapping_mul(0x9e37)) * TAU;
            let velocity = 0.008 + unit(id + self.seed + 91) * 0.018;
            let distance = 0.18 + unit(id + self.seed + 17) * 0.82;
            for trail in (0..5).rev() {
                let angle = phase + (self.frame as f64 - f64::from(trail) * 2.0) * velocity;
                let squash = 0.35 + unit(id + 33) * 0.65;
                let x = cx + (angle.cos() * radius * distance * 2.05) as i32;
                let y = cy + (angle.sin() * radius * distance * squash) as i32;
                let hue = (phase / TAU + self.frame as f64 * 0.001) % 1.0;
                let fade = 1.0 - f64::from(trail) * 0.15;
                canvas.set(
                    x,
                    y,
                    match trail {
                        0 => '◆',
                        1 | 2 => '•',
                        _ => '·',
                    },
                    spectrum(hue, fade),
                );
            }
        }
        canvas.set(cx - 1, cy, 'L', Rgb(255, 255, 255));
        canvas.set(cx, cy, 'J', Rgb(255, 255, 255));
    }

    fn rain(&self, canvas: &mut Canvas) {
        let (width, height, top, _) = self.scene_area();
        let step = if self.density < 3 { 2 } else { 1 };
        let length = 4 + self.density as i32 * 2;
        let glyphs = "01{}[]<>+-*/=#@$%";
        for x in (0..width).step_by(step) {
            let offset = noise(self.seed ^ x as u64) % (height + length) as u64;
            let head = ((self.frame + offset) % (height + length) as u64) as i32 - length;
            for trail in 0..length {
                let y = head - trail;
                if y < 0 || y >= height {
                    continue;
                }
                let glyph_index = noise(
                    self.seed
                        ^ (x as u64) << 32
                        ^ (y as u64) << 8
                        ^ (self.frame / 3 + trail as u64),
                ) as usize
                    % glyphs.len();
                let ch = glyphs.as_bytes()[glyph_index] as char;
                let fade = 1.0 - trail as f64 / length as f64;
                let color = if trail == 0 {
                    Rgb(220, 255, 225)
                } else {
                    Rgb(0, (80.0 + 175.0 * fade) as u8, (45.0 + 80.0 * fade) as u8)
                };
                canvas.set(x, y + top, ch, color);
            }
        }
    }

    fn wave(&self, canvas: &mut Canvas) {
        let (width, height, top, _) = self.scene_area();
        let time = self.frame as f64 * 0.035;
        let frequency = 0.12 + f64::from(self.density) * 0.035;
        let glyphs = [' ', '·', ':', '-', '~', '=', '+', '*', '#', '%', '@'];
        for y in 0..height {
            for x in 0..width {
                let value = (f64::from(x) * frequency + time).sin()
                    + (f64::from(y) * 0.55 - time * 1.3).sin()
                    + ((f64::from(x + y)) * 0.09 + time * 0.7).sin();
                let normalized = ((value + 3.0) / 6.0).clamp(0.0, 0.999);
                let index = (normalized * glyphs.len() as f64) as usize;
                let hue = normalized * 0.45 + 0.5 + time * 0.015;
                canvas.set(x, y + top, glyphs[index], spectrum(hue % 1.0, 1.0));
            }
        }
    }

    fn draw_snake(&self, canvas: &mut Canvas, language: Language) {
        let origin_x = (self.width as i32 - self.snake.width - 2) / 2;
        let origin_y = 3;
        for x in 0..self.snake.width + 2 {
            canvas.set(origin_x + x, origin_y, '─', Rgb(65, 100, 145));
            canvas.set(
                origin_x + x,
                origin_y + self.snake.height + 1,
                '─',
                Rgb(65, 100, 145),
            );
        }
        for y in 0..self.snake.height + 2 {
            canvas.set(origin_x, origin_y + y, '│', Rgb(65, 100, 145));
            canvas.set(
                origin_x + self.snake.width + 1,
                origin_y + y,
                '│',
                Rgb(65, 100, 145),
            );
        }
        for (x, y, ch) in [
            (origin_x, origin_y, '┌'),
            (origin_x + self.snake.width + 1, origin_y, '┐'),
            (origin_x, origin_y + self.snake.height + 1, '└'),
            (
                origin_x + self.snake.width + 1,
                origin_y + self.snake.height + 1,
                '┘',
            ),
        ] {
            canvas.set(x, y, ch, Rgb(100, 180, 220));
        }
        canvas.set(
            origin_x + 1 + self.snake.food.x,
            origin_y + 1 + self.snake.food.y,
            '●',
            Rgb(255, 90, 145),
        );
        for (index, part) in self.snake.body.iter().enumerate() {
            canvas.set(
                origin_x + 1 + part.x,
                origin_y + 1 + part.y,
                if index == 0 { '◆' } else { '█' },
                if index == 0 {
                    Rgb(220, 255, 240)
                } else {
                    Rgb(70, 235, 150)
                },
            );
        }
        canvas.text(
            2,
            2,
            language.text("ARROWS / WASD TO STEER", "方向键 / WASD 控制"),
            Rgb(120, 150, 190),
        );
        if self.snake.game_over {
            canvas.text(
                (origin_x + 5).max(0) as usize,
                (origin_y + self.snake.height / 2) as usize,
                language.text("CRASH!  R / ENTER TO REBOOT", "撞了！按 R / ENTER 重启"),
                Rgb(255, 100, 130),
            );
        }
    }

    fn help(&self, canvas: &mut Canvas, language: Language) {
        let lines = [
            language.text("CONTROLS", "控制"),
            "",
            language.text(
                "1 / 2 / 3 / 4   jump to a scene",
                "1 / 2 / 3 / 4   跳转场景",
            ),
            language.text("TAB             cycle scenes", "TAB             循环切换"),
            language.text("ARROWS / WASD   steer Snake", "方向键 / WASD   控制贪吃蛇"),
            language.text("SPACE           freeze time", "空格            冻结时间"),
            language.text("+ / -           change speed", "+ / -           调整速度"),
            language.text("[ / ]           change density", "[ / ]           调整密度"),
            language.text("R               reset", "R               重置"),
            language.text(
                "?               close this panel",
                "?               关闭面板",
            ),
            language.text("Q / ESC         exit", "Q / ESC         退出"),
        ];
        let width = 38.min(self.width.saturating_sub(4));
        let x = (self.width - width) / 2;
        let y = 3;
        for row in 0..lines.len() + 2 {
            canvas.text(x, y + row, &" ".repeat(width), Rgb(20, 25, 45));
        }
        for (row, line) in lines.into_iter().enumerate() {
            canvas.text(x + 2, y + row + 1, line, Rgb(200, 235, 255));
        }
    }
}

fn spectrum(hue: f64, brightness: f64) -> Rgb {
    let hue = hue.rem_euclid(1.0) * 6.0;
    let x = 1.0 - (hue % 2.0 - 1.0).abs();
    let (r, g, b) = match hue as u8 {
        0 => (1.0, x, 0.0),
        1 => (x, 1.0, 0.0),
        2 => (0.0, 1.0, x),
        3 => (0.0, x, 1.0),
        4 => (x, 0.0, 1.0),
        _ => (1.0, 0.0, x),
    };
    Rgb(
        (r * brightness * 255.0) as u8,
        (g * brightness * 255.0) as u8,
        (b * brightness * 255.0) as u8,
    )
}

pub struct TerminalGuard;

impl TerminalGuard {
    fn enter() -> io::Result<Self> {
        terminal::enable_raw_mode()?;
        if let Err(error) = execute!(io::stdout(), EnterAlternateScreen, Hide) {
            terminal::disable_raw_mode()?;
            return Err(error);
        }
        Ok(Self)
    }
}

impl Drop for TerminalGuard {
    fn drop(&mut self) {
        let _ = terminal::disable_raw_mode();
        let _ = execute!(io::stdout(), Show, LeaveAlternateScreen);
    }
}

use crossterm::terminal::{EnterAlternateScreen, LeaveAlternateScreen};

pub fn interactive(scene: Scene, seed: u64, display: Display) -> io::Result<()> {
    let _guard = TerminalGuard::enter()?;
    let (width, height) = terminal::size()?;
    let mut app = App::new(scene, seed, width as usize, height as usize);
    let mut out = io::stdout().lock();
    let mut previous = Instant::now() - FRAME;
    loop {
        let started = Instant::now();
        if started.duration_since(previous) >= FRAME {
            app.advance();
            previous = started;
        }
        let (width, height) = terminal::size()?;
        app.resize(width as usize, height as usize);
        execute!(out, MoveTo(0, 0))?;
        out.write_all(app.render(display, true).as_bytes())?;
        out.flush()?;
        if event::poll(FRAME.saturating_sub(started.elapsed()))? {
            match event::read()? {
                Event::Key(key) if !app.handle_key(key) => return Ok(()),
                Event::Resize(width, height) => app.resize(width as usize, height as usize),
                _ => {}
            }
        }
    }
}

pub fn frames(
    scene: Scene,
    seed: u64,
    display: Display,
    count: u32,
    terminal: bool,
    out: &mut impl Write,
) -> io::Result<()> {
    let (width, height) = if terminal {
        terminal::size().map_or((DEFAULT_WIDTH, DEFAULT_HEIGHT), |(w, h)| {
            (w as usize, h as usize)
        })
    } else {
        (DEFAULT_WIDTH, DEFAULT_HEIGHT)
    };
    let mut app = App::new(scene, seed, width, height);
    if terminal && count > 1 {
        write!(out, "\x1b[?25l")?;
    }
    for frame in 0..count {
        if terminal && count > 1 {
            write!(out, "\x1b[H")?;
        }
        out.write_all(app.render(display, terminal && count > 1).as_bytes())?;
        if frame + 1 < count {
            app.advance();
            if terminal {
                std::thread::sleep(FRAME);
            }
        }
    }
    if terminal && count > 1 {
        write!(out, "\x1b[?25h")?;
    }
    out.flush()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn display() -> Display {
        Display {
            language: Language::En,
            color: false,
        }
    }

    #[test]
    fn seeded_frames_are_reproducible_and_scenes_differ() {
        let mut first = App::new(Scene::Orbit, 42, 60, 20);
        let mut second = App::new(Scene::Orbit, 42, 60, 20);
        for _ in 0..20 {
            first.advance();
            second.advance();
        }
        assert_eq!(
            first.render(display(), false),
            second.render(display(), false)
        );
        let rain = App::new(Scene::Rain, 42, 60, 20).render(display(), false);
        assert_ne!(first.render(display(), false), rain);
    }

    #[test]
    fn controls_pause_switch_scenes_and_tune_motion() {
        let mut app = App::new(Scene::Orbit, 7, 60, 20);
        assert!(app.handle_key(KeyEvent::new(KeyCode::Char('3'), KeyModifiers::NONE)));
        assert_eq!(app.scene, Scene::Wave);
        app.handle_key(KeyEvent::new(KeyCode::Char(' '), KeyModifiers::NONE));
        let frame = app.frame;
        app.advance();
        assert_eq!(app.frame, frame);
        app.handle_key(KeyEvent::new(KeyCode::Char('+'), KeyModifiers::NONE));
        assert_eq!(app.speed, 5);
        assert!(!app.handle_key(KeyEvent::new(KeyCode::Esc, KeyModifiers::NONE)));
    }

    #[test]
    fn snake_rejects_reversals_and_detects_walls() {
        let mut snake = Snake::new(9);
        snake.steer(Direction::Left);
        assert_eq!(snake.queued, Direction::Right);
        snake.body = VecDeque::from([Point { x: 0, y: 0 }]);
        snake.direction = Direction::Left;
        snake.queued = Direction::Left;
        snake.step();
        assert!(snake.game_over);
    }

    #[test]
    fn snake_eats_grows_and_scores() {
        let mut snake = Snake::new(9);
        let head = *snake.body.front().unwrap();
        snake.food = Point {
            x: head.x + 1,
            y: head.y,
        };
        let length = snake.body.len();
        snake.step();
        assert_eq!(snake.score, 1);
        assert_eq!(snake.body.len(), length + 1);
        assert!(!snake.game_over);
    }

    #[test]
    fn plain_canvas_never_contains_escape_sequences() {
        let app = App::new(Scene::Wave, 1, 50, 16);
        assert!(!app.render(display(), false).contains('\x1b'));
    }
}
