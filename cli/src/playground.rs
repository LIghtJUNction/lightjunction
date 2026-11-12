use std::io::{self, Write};
use std::time::{Duration, Instant};

use crossterm::cursor::{Hide, MoveTo, Show};
use crossterm::event::{
    self, Event, KeyCode, KeyEvent, KeyEventKind, KeyModifiers, MouseButton, MouseEvent,
    MouseEventKind,
};
use crossterm::execute;
use crossterm::terminal::{self, EnterAlternateScreen, LeaveAlternateScreen};

use crate::args::Language;

const FRAME: Duration = Duration::from_millis(40);
const DEFAULT_WIDTH: usize = 80;
const DEFAULT_HEIGHT: usize = 24;

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
struct Vec3 {
    x: f64,
    y: f64,
    z: f64,
}

impl Vec3 {
    fn new(x: f64, y: f64, z: f64) -> Self {
        Self { x, y, z }
    }

    fn add(self, other: Self) -> Self {
        Self::new(self.x + other.x, self.y + other.y, self.z + other.z)
    }

    fn sub(self, other: Self) -> Self {
        Self::new(self.x - other.x, self.y - other.y, self.z - other.z)
    }

    fn scale(self, factor: f64) -> Self {
        Self::new(self.x * factor, self.y * factor, self.z * factor)
    }

    fn dot(self, other: Self) -> f64 {
        self.x * other.x + self.y * other.y + self.z * other.z
    }

    fn length(self) -> f64 {
        self.dot(self).sqrt()
    }

    fn normalized(self) -> Self {
        self.scale(1.0 / self.length())
    }
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum Material {
    Fur,
    Muzzle,
    InnerEar,
    Dark,
    Glint,
}

#[derive(Clone, Copy)]
struct Surface {
    distance: f64,
    material: Material,
}

fn ellipsoid(point: Vec3, center: Vec3, radii: Vec3, material: Material) -> Surface {
    let point = point.sub(center);
    let distance =
        ((point.x / radii.x).powi(2) + (point.y / radii.y).powi(2) + (point.z / radii.z).powi(2))
            .sqrt();
    Surface {
        distance: (distance - 1.0) * radii.x.min(radii.y).min(radii.z),
        material,
    }
}

fn tapered_capsule(
    point: Vec3,
    start: Vec3,
    end: Vec3,
    start_radius: f64,
    end_radius: f64,
    material: Material,
) -> Surface {
    let offset = point.sub(start);
    let axis = end.sub(start);
    let progress = (offset.dot(axis) / axis.dot(axis)).clamp(0.0, 1.0);
    Surface {
        distance: offset.sub(axis.scale(progress)).length() - start_radius
            + (start_radius - end_radius) * progress,
        material,
    }
}

fn nearest(first: Surface, second: Surface) -> Surface {
    if first.distance < second.distance {
        first
    } else {
        second
    }
}

fn dog_surface(point: Vec3) -> Surface {
    let mut surface = ellipsoid(
        point,
        Vec3::new(0.0, 0.05, 0.0),
        Vec3::new(0.82, 0.88, 0.68),
        Material::Fur,
    );
    for side in [-1.0, 1.0] {
        surface = nearest(
            surface,
            tapered_capsule(
                point,
                Vec3::new(side * 0.5, 0.55, -0.06),
                Vec3::new(side * 0.7, 1.42, -0.08),
                0.3,
                0.045,
                Material::Fur,
            ),
        );
        surface = nearest(
            surface,
            tapered_capsule(
                point,
                Vec3::new(side * 0.52, 0.68, 0.2),
                Vec3::new(side * 0.68, 1.31, 0.02),
                0.15,
                0.025,
                Material::InnerEar,
            ),
        );
        surface = nearest(
            surface,
            ellipsoid(
                point,
                Vec3::new(side * 0.3, 0.2, 0.64),
                Vec3::new(0.085, 0.105, 0.075),
                Material::Dark,
            ),
        );
        surface = nearest(
            surface,
            ellipsoid(
                point,
                Vec3::new(side * 0.28, 0.23, 0.715),
                Vec3::new(0.022, 0.026, 0.018),
                Material::Glint,
            ),
        );
        surface = nearest(
            surface,
            ellipsoid(
                point,
                Vec3::new(side * 0.19, -0.27, 0.63),
                Vec3::new(0.36, 0.3, 0.4),
                Material::Muzzle,
            ),
        );
    }
    nearest(
        nearest(
            surface,
            ellipsoid(
                point,
                Vec3::new(0.0, -0.13, 0.98),
                Vec3::new(0.2, 0.14, 0.16),
                Material::Dark,
            ),
        ),
        ellipsoid(
            point,
            Vec3::new(0.0, -0.45, 0.54),
            Vec3::new(0.3, 0.18, 0.28),
            Material::Muzzle,
        ),
    )
}

fn rotate_y(point: Vec3, angle: f64) -> Vec3 {
    let (sin, cos) = angle.sin_cos();
    Vec3::new(
        point.x * cos + point.z * sin,
        point.y,
        point.z * cos - point.x * sin,
    )
}

fn rotate_x(point: Vec3, angle: f64) -> Vec3 {
    let (sin, cos) = angle.sin_cos();
    Vec3::new(
        point.x,
        point.y * cos - point.z * sin,
        point.y * sin + point.z * cos,
    )
}

pub struct App {
    frame: u64,
    width: usize,
    height: usize,
    speed: u32,
    paused: bool,
    show_help: bool,
    yaw: f64,
    pitch: f64,
    zoom: f64,
    dragging: bool,
    mouse_x: u16,
    mouse_y: u16,
}

impl App {
    pub fn new(width: usize, height: usize) -> Self {
        Self {
            frame: 0,
            width: width.max(1),
            height: height.max(1),
            speed: 4,
            paused: false,
            show_help: false,
            yaw: 0.0,
            pitch: 0.0,
            zoom: 1.0,
            dragging: false,
            mouse_x: 0,
            mouse_y: 0,
        }
    }

    fn resize(&mut self, width: usize, height: usize) {
        self.width = width.max(1);
        self.height = height.max(1);
    }

    fn advance(&mut self) {
        if !self.paused {
            self.frame = self.frame.wrapping_add(u64::from(self.speed));
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
            KeyCode::Char(' ') => self.paused = !self.paused,
            KeyCode::Char('+') | KeyCode::Char('=') => self.speed = (self.speed + 1).min(9),
            KeyCode::Char('-') => self.speed = self.speed.saturating_sub(1).max(1),
            KeyCode::Char('r') => {
                self.frame = 0;
                self.yaw = 0.0;
                self.pitch = 0.0;
                self.zoom = 1.0;
            }
            KeyCode::Char('?') => self.show_help = !self.show_help,
            _ => {}
        }
        true
    }

    fn handle_mouse(&mut self, mouse: MouseEvent) {
        match mouse.kind {
            MouseEventKind::Down(MouseButton::Left) => self.dragging = true,
            MouseEventKind::Up(MouseButton::Left) => self.dragging = false,
            MouseEventKind::Drag(MouseButton::Left) if self.dragging => {
                let dx = f64::from(mouse.column) - f64::from(self.mouse_x);
                let dy = f64::from(mouse.row) - f64::from(self.mouse_y);
                self.yaw += dx * 0.045;
                self.pitch = (self.pitch + dy * 0.035).clamp(-1.1, 1.1);
            }
            MouseEventKind::ScrollUp => self.zoom = (self.zoom * 1.08).min(1.8),
            MouseEventKind::ScrollDown => self.zoom = (self.zoom / 1.08).max(0.65),
            _ => {}
        }
        self.mouse_x = mouse.column;
        self.mouse_y = mouse.row;
    }

    pub fn render(&self, display: Display, pad: bool) -> String {
        let mut canvas = Canvas::new(self.width, self.height);
        if self.width < 24 || self.height < 10 {
            return format!(
                "{}\n",
                display
                    .language
                    .text("Need a 24x10 terminal.", "终端至少需要 24x10。")
            );
        }
        self.avatar(&mut canvas);
        if self.show_help {
            self.help(&mut canvas, display.language);
        }
        canvas.render(display.color, pad)
    }

    fn avatar(&self, canvas: &mut Canvas) {
        let yaw = self.frame as f64 * 0.006 + self.yaw;
        let pitch = (self.frame as f64 * 0.002).sin() * 0.04 + self.pitch;
        let camera = rotate_x(rotate_y(Vec3::new(0.0, 0.12, 4.2), -yaw), -pitch);
        let key_light = Vec3::new(-0.45, 0.75, 0.8).normalized();
        let glyphs = b" .:-=+*#%@";

        for row in 0..canvas.height {
            for column in 0..canvas.width {
                let screen_x =
                    (column as f64 * 2.0 + 1.0 - canvas.width as f64) / canvas.height as f64 * 0.95
                        / self.zoom;
                let screen_y =
                    (canvas.height as f64 - row as f64 * 2.0 - 1.0) / canvas.height as f64 * 0.95
                        / self.zoom;
                let direction = rotate_x(
                    rotate_y(Vec3::new(screen_x, screen_y, -2.4).normalized(), -yaw),
                    -pitch,
                );
                let mut travel = 0.0;
                let mut hit = None;
                for _ in 0..80 {
                    let point = camera.add(direction.scale(travel));
                    let surface = dog_surface(point);
                    if surface.distance < 0.0015 {
                        hit = Some((point, surface.material));
                        break;
                    }
                    travel += surface.distance.max(0.001) * 0.85;
                    if travel > 7.0 {
                        break;
                    }
                }
                let Some((point, material)) = hit else {
                    continue;
                };
                let epsilon = 0.002;
                let normal = Vec3::new(
                    dog_surface(point.add(Vec3::new(epsilon, 0.0, 0.0))).distance
                        - dog_surface(point.sub(Vec3::new(epsilon, 0.0, 0.0))).distance,
                    dog_surface(point.add(Vec3::new(0.0, epsilon, 0.0))).distance
                        - dog_surface(point.sub(Vec3::new(0.0, epsilon, 0.0))).distance,
                    dog_surface(point.add(Vec3::new(0.0, 0.0, epsilon))).distance
                        - dog_surface(point.sub(Vec3::new(0.0, 0.0, epsilon))).distance,
                )
                .normalized();
                let normal = rotate_x(rotate_y(normal, yaw), pitch);
                let diffuse = normal.dot(key_light).max(0.0);
                let light = 0.3 + diffuse * 0.7;
                let rim = (1.0 - normal.z.abs()).powi(2);
                let base = match material {
                    Material::Fur => Rgb(211, 177, 119),
                    Material::Muzzle => Rgb(242, 220, 174),
                    Material::InnerEar => Rgb(190, 111, 112),
                    Material::Dark => Rgb(24, 27, 35),
                    Material::Glint => Rgb(225, 250, 255),
                };
                let shade =
                    |channel: u8| (f64::from(channel) * light + rim * 28.0).min(255.0) as u8;
                let glyph = if material == Material::Dark || material == Material::Glint {
                    '@'
                } else {
                    let index = (light * 0.85 * glyphs.len() as f64) as usize;
                    glyphs[index.min(glyphs.len() - 1)] as char
                };
                canvas.set(
                    column as i32,
                    row as i32,
                    glyph,
                    Rgb(shade(base.0), shade(base.1), shade(base.2)),
                );
            }
        }
    }

    fn help(&self, canvas: &mut Canvas, language: Language) {
        let lines = [
            language.text("DRAG  rotate", "拖拽  旋转"),
            language.text("WHEEL  zoom", "滚轮  缩放"),
            language.text("SPACE  pause", "空格  暂停"),
            language.text("+ / -  speed", "+ / -  速度"),
            language.text("R  reset", "R  重置"),
            language.text("Q / ESC  quit", "Q / ESC  退出"),
        ];
        let width = 24.min(self.width.saturating_sub(4));
        let x = (self.width - width) / 2;
        let y = (self.height - lines.len() - 2) / 2;
        for row in 0..lines.len() + 2 {
            canvas.text(x, y + row, &" ".repeat(width), Rgb(20, 25, 45));
        }
        for (row, line) in lines.into_iter().enumerate() {
            canvas.text(x + 2, y + row + 1, line, Rgb(200, 235, 255));
        }
    }
}

pub struct TerminalGuard;

impl TerminalGuard {
    fn enter() -> io::Result<Self> {
        terminal::enable_raw_mode()?;
        if let Err(error) = execute!(
            io::stdout(),
            EnterAlternateScreen,
            Hide,
            event::EnableMouseCapture
        ) {
            terminal::disable_raw_mode()?;
            return Err(error);
        }
        Ok(Self)
    }
}

impl Drop for TerminalGuard {
    fn drop(&mut self) {
        let _ = terminal::disable_raw_mode();
        let _ = execute!(
            io::stdout(),
            event::DisableMouseCapture,
            Show,
            LeaveAlternateScreen
        );
    }
}

pub fn interactive(display: Display) -> io::Result<()> {
    let _guard = TerminalGuard::enter()?;
    let (width, height) = terminal::size()?;
    let mut app = App::new(width as usize, height as usize);
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
                Event::Mouse(mouse) => app.handle_mouse(mouse),
                Event::Resize(width, height) => app.resize(width as usize, height as usize),
                _ => {}
            }
        }
    }
}

pub fn frames(
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
    let mut app = App::new(width, height);
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
    fn avatar_rotates_with_ascii_glyphs_and_truecolor() {
        let mut app = App::new(80, 24);
        let first = app.render(display(), false);
        for _ in 0..20 {
            app.advance();
        }
        let rotated = app.render(display(), false);
        assert_ne!(first, rotated);
        assert!(first.chars().any(|ch| "@#%*".contains(ch)));
        assert!(!first.contains("LJ://"));

        let colored = app.render(
            Display {
                language: Language::En,
                color: true,
            },
            false,
        );
        assert!(colored.contains("\x1b[38;2;"));
    }

    #[test]
    fn mouse_drag_rotates_and_wheel_zooms() {
        let mut app = App::new(80, 24);
        for (kind, column, row) in [
            (MouseEventKind::Down(MouseButton::Left), 20, 10),
            (MouseEventKind::Drag(MouseButton::Left), 30, 14),
            (MouseEventKind::Up(MouseButton::Left), 30, 14),
        ] {
            app.handle_mouse(MouseEvent {
                kind,
                column,
                row,
                modifiers: KeyModifiers::NONE,
            });
        }
        assert!((app.yaw - 0.45).abs() < 0.001);
        assert!((app.pitch - 0.14).abs() < 0.001);
        assert!(!app.dragging);
        app.handle_mouse(MouseEvent {
            kind: MouseEventKind::ScrollUp,
            column: 30,
            row: 14,
            modifiers: KeyModifiers::NONE,
        });
        assert!(app.zoom > 1.0);
    }

    #[test]
    fn controls_pause_and_reset_motion() {
        let mut app = App::new(80, 24);
        app.handle_key(KeyEvent::new(KeyCode::Char(' '), KeyModifiers::NONE));
        let frame = app.frame;
        app.advance();
        assert_eq!(app.frame, frame);
        app.handle_key(KeyEvent::new(KeyCode::Char('+'), KeyModifiers::NONE));
        assert_eq!(app.speed, 5);
        assert!(!app.handle_key(KeyEvent::new(KeyCode::Esc, KeyModifiers::NONE)));
    }

    #[test]
    fn plain_canvas_never_contains_escape_sequences() {
        let app = App::new(80, 24);
        assert!(!app.render(display(), false).contains('\x1b'));
    }
}
