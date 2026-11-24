#!/usr/bin/env python3
"""Generate the self-reporting profile GIF from the repository root.

Install profile/requirements.txt and Chromium with Noto Sans / Noto Sans Mono.
Run: python profile/render_typewriter.py
"""

import argparse
import base64
import io
import json
import mimetypes
import random
import re
import shutil
import struct
import subprocess
import tempfile
import textwrap
import time
from pathlib import Path
from urllib.parse import unquote, urlparse
from urllib.request import urlopen

import mistune
import websocket
from bs4 import BeautifulSoup
from PIL import Image, ImageChops, ImageDraw, ImageFont

W, H, M = 576, 180, 28
SCROLL_MS, README_STEP, SOURCE_STEP = 40, 2, 3
SENTENCES = (
    "AI is terrible. I had to dig through a pile of junk to piece together something usable.",
    "AI is powerful, so I used AI to build these things.",
    "I am terrible, so I use AI to make these things.",
    "I am strong. Yes — I am strong.",
)
# Three-bit palette: four text levels, three warm image colors, transparency.
COLORS = [
    (0, 0, 0),
    (82, 82, 82),
    (168, 168, 168),
    (238, 238, 238),
    (250, 249, 246),
    (41, 39, 34),
    (173, 104, 60),
    (255, 0, 255),
]
PAL = Image.new("P", (1, 1))
PAL.putpalette(bytes(c for rgb in COLORS[:-1] for c in rgb))
LUT = [min(range(4), key=lambda i: abs(v - COLORS[i][0])) for v in range(256)]
CSS = f"""
*{{box-sizing:border-box}} html,body{{margin:0;background:#000;color:#eee}}
main{{margin:11px {M}px;width:{W - 2 * M}px;
font:12px/1.36 'Noto Sans',sans-serif;overflow-wrap:anywhere;orphans:2;widows:2}}
h1,h2,h3,h4{{font-weight:600;margin:0 0 5px;break-after:avoid;line-height:1.2}}
h1{{font-size:20px}} h2{{font-size:17px}} h3,h4{{font-size:14px}}
p,ul,ol{{margin:0 0 6px}} ul,ol{{padding-left:18px}}
a{{color:inherit;text-decoration:underline;text-underline-offset:2px}}
code{{font-family:'Noto Sans Mono',monospace;font-size:.91em}}
pre{{margin:0 0 6px;font:10px/1.3 'Noto Sans Mono',monospace;
white-space:pre-wrap;overflow-wrap:anywhere;color:#ddd}}
pre code{{font-size:inherit}} img{{display:block;max-width:100%;max-height:135px;
object-fit:contain;margin:0 auto;break-inside:avoid}} p:has(img){{break-inside:avoid}}
blockquote{{margin:0 0 6px;padding-left:12px;border-left:2px solid #555}}
table{{border-collapse:collapse;max-width:100%}} td,th{{padding:3px 6px}}
"""


def screenshot(html):
    """Render one continuous document with Chromium's DevTools protocol."""
    chrome = shutil.which("chromium") or shutil.which("google-chrome")
    if not chrome:
        raise RuntimeError("Chromium or Google Chrome is required")
    with tempfile.TemporaryDirectory() as tmp:
        args = [
            chrome,
            "--headless",
            "--disable-background-networking",
            "--disable-extensions",
            "--no-first-run",
            "--no-default-browser-check",
            "--remote-debugging-port=0",
            "--remote-debugging-address=127.0.0.1",
            f"--user-data-dir={tmp}",
            "about:blank",
        ]
        with subprocess.Popen(args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL) as proc:
            ws = None
            try:
                portfile = Path(tmp) / "DevToolsActivePort"
                for _ in range(200):
                    if portfile.exists():
                        break
                    if proc.poll() is not None:
                        raise RuntimeError("Chromium exited before initialization")
                    time.sleep(0.05)
                port = portfile.read_text().splitlines()[0]
                with urlopen(f"http://127.0.0.1:{port}/json/list", timeout=10) as response:
                    targets = json.load(response)
                target = next(t for t in targets if t["type"] == "page")
                ws = websocket.create_connection(
                    target["webSocketDebuggerUrl"], suppress_origin=True, timeout=30
                )
                serial = 0

                def cdp(method, **params):
                    nonlocal serial
                    serial += 1
                    ws.send(json.dumps({"id": serial, "method": method, "params": params}))
                    while True:
                        reply = json.loads(ws.recv())
                        if reply.get("id") != serial:
                            continue
                        if "error" in reply:
                            raise RuntimeError(reply["error"])
                        return reply["result"]

                def viewport(height):
                    cdp(
                        "Emulation.setDeviceMetricsOverride",
                        width=W,
                        height=height,
                        deviceScaleFactor=1,
                        mobile=False,
                    )

                def evaluate(expression):
                    result = cdp(
                        "Runtime.evaluate",
                        expression=expression,
                        awaitPromise=True,
                        returnByValue=True,
                    )
                    if result.get("exceptionDetails"):
                        raise RuntimeError(result["exceptionDetails"])
                    return result["result"].get("value")

                cdp("Page.enable")
                viewport(H)
                tree = cdp("Page.getFrameTree")
                cdp("Page.setDocumentContent", frameId=tree["frameTree"]["frame"]["id"], html=html)
                evaluate("document.fonts.ready.then(()=>true)")
                evaluate("Promise.all([...document.images].map(i=>i.decode()))")
                if evaluate("[...document.images].some(i=>!i.naturalWidth)"):
                    raise RuntimeError("README image failed to render")
                height = max(
                    H,
                    evaluate(
                        "Math.ceil(document.querySelector('main')"
                        ".getBoundingClientRect().bottom + 11)"
                    ),
                )
                viewport(height)
                data = cdp(
                    "Page.captureScreenshot",
                    format="png",
                    clip={"x": 0, "y": 0, "width": W, "height": height, "scale": 1},
                    captureBeyondViewport=True,
                )
                return Image.open(io.BytesIO(base64.b64decode(data["data"]))).convert("RGB")
            finally:
                if ws is not None:
                    ws.close()
                proc.terminate()
                try:
                    proc.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    proc.kill()
                    proc.wait()


def readme_document(path):
    raw = path.read_text(encoding="utf-8")
    # Recover the real content of a GIF-only profile, avoiding self-embedding.
    hidden = re.findall(r"<!--(.*?)-->", raw, re.S)
    real = [s for s in hidden if re.search(r"^#{1,3} ", s, re.M)]
    if real and re.search(r"\.gif(?:[?\"')]|$)", raw, re.I):
        raw = max(real, key=len)
    html = mistune.create_markdown(escape=False, plugins=["table"])(raw)
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup.find_all(["script", "iframe", "object", "embed", "style", "link"]):
        tag.decompose()
    for img in soup.find_all("img"):
        src = img.get("src", "")
        if src.startswith("data:"):
            continue
        url = urlparse(src)
        if url.scheme in ("http", "https"):
            with urlopen(src, timeout=15) as r:
                data, mime = r.read(), r.headers.get_content_type()
        else:
            asset = path.parent / unquote(url.path)
            data, mime = asset.read_bytes(), mimetypes.guess_type(asset)[0]
        img["src"] = f"data:{mime};base64," + base64.b64encode(data).decode()
        img.attrs.pop("srcset", None)
    csp = "default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src 'none'"
    return screenshot(
        f'<meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="{csp}">'
        f"<style>{CSS}</style><main>{soup}</main>"
    )


def lzw(pixels):
    """GIF LZW with a three-bit minimum code size; little-endian bit packing."""
    clear, end = 8, 9
    table, next_code, width = {}, 10, 4
    buf = bytearray()
    acc = bits = 0

    def emit(code):
        nonlocal acc, bits
        acc |= code << bits
        bits += width
        while bits >= 8:
            buf.append(acc & 255)
            acc >>= 8
            bits -= 8

    emit(clear)
    prefix = pixels[0]
    for pixel in pixels[1:]:
        key = prefix * 8 + pixel
        code = table.get(key)
        if code is not None:
            prefix = code
            continue
        emit(prefix)
        if next_code < 4096:
            table[key] = next_code
            next_code += 1
            if next_code > 1 << width and width < 12:
                width += 1
        else:
            emit(clear)
            table.clear()
            next_code, width = 10, 4
        prefix = pixel
    emit(prefix)
    if next_code == 1 << width and width < 12:
        width += 1
    emit(end)
    if bits:
        buf.append(acc)
    return (
        b"\x03"
        + b"".join(
            bytes([len(buf[i : i + 255])]) + buf[i : i + 255] for i in range(0, len(buf), 255)
        )
        + b"\x00"
    )


def indices(im):
    if im.mode == "L":
        return im.point(LUT)
    p = im.convert("RGB").quantize(palette=PAL, dither=Image.Dither.NONE)
    return Image.frombytes("L", im.size, p.tobytes())


def frame(p, last, ms):
    # Pick the smaller of opaque and transparent changed rectangles.
    box = (0, 0, W, H) if last is None else ImageChops.difference(p, last).getbbox()
    if box is None:
        box = (0, 0, 1, 1)
    a = p.crop(box)
    options = [(lzw(a.tobytes()), False)]
    if last is not None:
        diff = ImageChops.difference(a, last.crop(box))
        a.paste(7, mask=diff.point(lambda x: 0 if x else 255))
        options.append((lzw(a.tobytes()), True))
    data, transparent = min(options, key=lambda t: len(t[0]))
    x, y, r, b = box
    return (
        b"!\xf9\x04"
        + struct.pack("<BHBB", 4 + transparent, ms // 10, 7, 0)
        + b","
        + struct.pack("<HHHHB", x, y, r - x, b - y, 0)
        + data
    )


def scroll_positions(end, step):
    """Ease in/out over a few pixels, with no jumps or repeated positions."""
    y = 0
    yield y
    while y < end:
        stride = min(step, 1 + min(y, end - y) // 6)
        y = min(end, y + stride)
        yield y


def source_document(font):
    """Render every physical source line into one continuous strip."""
    cols = int((W - 2 * M) / font.getlength("M"))
    lines = []
    for line in Path(__file__).read_text(encoding="utf-8").splitlines():
        lines.extend(
            textwrap.wrap(
                line,
                cols,
                replace_whitespace=False,
                drop_whitespace=False,
                break_on_hyphens=False,
            )
            or [""]
        )
    im = Image.new("L", (W, max(H, 16 + len(lines) * 13)))
    d = ImageDraw.Draw(im)
    for i, line in enumerate(lines):
        d.text((M, 8 + i * 13), line, font=font, fill=238)
    return im


def render(readme, output, font_path):
    font = ImageFont.truetype(font_path, 19)
    small = ImageFont.truetype(font_path, 10)
    rng = random.Random(20261125)
    last = None
    frames = total = 0
    document = readme_document(readme)
    source = source_document(small)
    with output.open("wb") as fp:
        fp.write(b"GIF89a" + struct.pack("<HHBBB", W, H, 0xF2, 0, 0))
        fp.write(bytes(c for rgb in COLORS for c in rgb))
        fp.write(b"!\xff\x0bNETSCAPE2.0\x03\x01\x00\x00\x00")

        def push_indices(p, ms):
            nonlocal last, frames, total
            fp.write(frame(p, last, ms))
            last = p
            frames += 1
            total += ms

        def push(im, ms):
            push_indices(indices(im), ms)

        def scroll(im, step):
            strip = indices(im)
            end = strip.height - H
            for y in scroll_positions(end, step):
                delay = 1600 if y == end else 1400 if y == 0 else SCROLL_MS
                push_indices(strip.crop((0, y, W, y + H)), delay)

        def type_frame(s, n, ms):
            im = Image.new("L", (W, H))
            d = ImageDraw.Draw(im)
            width = int((W - 2 * M - 10) / font.getlength("M"))
            start = 0
            x = M
            y = 80
            for i, line in enumerate(textwrap.wrap(s, width, break_on_hyphens=False)):
                start = s.index(line, start)
                if n < start:
                    break
                part = line[: max(0, n - start)]
                y = 80 + i * 36
                d.text((M, y), part, font=font, fill=238, anchor="ls")
                x = round(M + font.getlength(part))
                start += len(line)
            d.rectangle((x + 3, y - 17, x + 4, y + 4), fill=238)
            push(im, ms)

        def typing(s, hold=3100, erase=True):
            type_frame(s, 0, 180)
            for n, c in enumerate(s, 1):
                delay = rng.choice((40, 40, 50, 50, 60, 70, 80))
                if c in ".,—":
                    delay += 100 if c == "," else 220
                type_frame(s, n, hold if n == len(s) else delay)
            if erase:
                for n in range(len(s) - 1, -1, -1):
                    type_frame(s, n, 180 if not n else 60 if len(s) - n <= 3 else 30)

        for i, s in enumerate(SENTENCES):
            typing(s, 4100 if i == 3 else 3100)
        typing("$ cat README.md", 1000, False)
        scroll(document, README_STEP)
        typing(f"$ cat {Path(__file__).name}", 1000, False)
        scroll(source, SOURCE_STEP)
        cols = int((W - 2 * M) / small.getlength("M"))

        # A size field changes the size it describes. Solve the fixed point.
        def final(n):
            im = Image.new("L", (W, H))
            d = ImageDraw.Draw(im)
            cmd = f"$ stat -c '%s bytes' {output.name}"
            for i, line in enumerate(textwrap.wrap(cmd, cols)):
                d.text((M, 52 + i * 13), line, font=small, fill=238)
            d.text((M, 97), f"{n} bytes", font=font, fill=238)
            return frame(indices(im), last, 4500)

        prefix = fp.tell()
        estimate = prefix + len(final(prefix)) + 1
        # Search first for an exact solution, with no added bytes.
        candidates = []
        for delta in range(129):
            for n in {estimate + delta, estimate - delta} if delta else {estimate}:
                payload = final(n)
                gap = n - prefix - len(payload) - 1
                if gap == 0:
                    candidates = [(0, n, payload)]
                    break
                if gap == 3 or 5 <= gap <= 259:
                    candidates.append((gap, n, payload))
            if candidates and candidates[-1][0] == 0:
                break
        if not candidates:
            raise RuntimeError("Cannot resolve file size")
        gap, target, payload = min(candidates, key=lambda t: t[:2])
        fp.write(payload)
        # If no natural fixed point exists, use the smallest GIF comment.
        if gap:
            fp.write(b"!\xfe" + (bytes([gap - 4]) + b" " * (gap - 4) if gap > 3 else b"") + b"\x00")
        fp.write(b";")
    assert output.stat().st_size == target
    print(f"README: {document.height}px; source: {source.height}px")
    print(f"{frames + 1} frames; {(total + 4500) / 1000:.2f} s")
    print(f"{target} bytes; self-reference exact; comment padding={gap} bytes")


def default_font():
    for path in (
        "/usr/share/fonts/noto/NotoSansMono-Regular.ttf",
        "/usr/share/fonts/truetype/noto/NotoSansMono-Regular.ttf",
    ):
        if Path(path).is_file():
            return path
    return "NotoSansMono-Regular.ttf"


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--readme", type=Path, default=Path("README.md"))
    ap.add_argument("--font", default=default_font())
    ap.add_argument("-o", "--output", type=Path, default=Path("profile/profile.gif"))
    args = ap.parse_args()
    render(args.readme, args.output, args.font)
