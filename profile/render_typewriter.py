#!/usr/bin/env python3
"""Render the profile's Markdown, images, source and exact GIF size.

Install profile/requirements.txt, Chromium and Noto Sans / Noto Sans Mono.
Run from the repository root: python profile/render_typewriter.py
The GIF scrolls this file verbatim; gif_codec.py is the reusable encoder.
"""

import argparse
import base64
import mimetypes
import random
import re
import shutil
import struct
import subprocess
import tempfile
import textwrap
from pathlib import Path
from urllib.parse import unquote, urlparse
from urllib.request import urlopen

import mistune
from bs4 import BeautifulSoup
from gif_codec import PALETTE, STATS, encode_frame
from PIL import Image, ImageChops, ImageDraw, ImageFont

W, H, M = 448, 96, 18
FRAME_MS, README_STEP, SOURCE_STEP = 40, 6, 11
LIMIT = 1024 * 1024
SENTENCES = (
    "AI is terrible. I had to dig through a pile of junk to piece together something usable.",
    "AI is powerful, so I used AI to build these things.",
    "I am terrible, so I use AI to make these things.",
    "I am strong. Yes — I am strong.",
)
CSS = f"""
*{{box-sizing:border-box}}
body{{margin:0;background:#000;color:#fff;font:10px/1.35 'Noto Sans',sans-serif}}
main{{margin:8px {M}px;overflow-wrap:anywhere;display:flow-root}}
h1,h2,h3,h4,p,ul,ol,pre{{margin:0 0 5px}}
h1,h2{{font-size:15px}} h3,h4{{font-size:12px}} ul,ol{{padding-left:16px}}
a{{color:inherit;text-decoration:underline}}
pre,code{{font:9px/1.3 'Noto Sans Mono',monospace;white-space:pre-wrap}}
img{{display:block;max-width:100%;max-height:90px;object-fit:contain;margin:auto}}
"""


def document(path):
    raw = path.read_text(encoding="utf-8")
    hidden = re.findall(r"<!--(.*?)-->", raw, re.S)
    raw = next((s for s in hidden if re.search(r"^## ", s, re.M)), raw)
    soup = BeautifulSoup(mistune.create_markdown(escape=False)(raw), "html.parser")
    for tag in soup.find_all(["script", "iframe", "object", "embed", "style", "link"]):
        tag.decompose()
    for img in soup.find_all("img"):
        src = img["src"]
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
    chrome = shutil.which("chromium") or shutil.which("google-chrome")
    if not chrome:
        raise RuntimeError("Chromium is required")
    with tempfile.TemporaryDirectory() as tmp:
        html, png = Path(tmp) / "readme.html", Path(tmp) / "readme.png"
        csp = "default-src 'none'; img-src data:; style-src 'unsafe-inline'"
        html.write_text(
            f'<meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="{csp}">'
            f"<style>{CSS}</style><main>{soup}</main>"
            '<div style="width:1px;height:1px;background:#ff00ff"></div>',
            encoding="utf-8",
        )
        for height in (4096, 8192, 16384):
            subprocess.run(
                [
                    chrome,
                    "--headless",
                    "--disable-background-networking",
                    "--hide-scrollbars",
                    "--force-device-scale-factor=1",
                    f"--user-data-dir={tmp}/browser",
                    f"--window-size={W},{height}",
                    f"--screenshot={png}",
                    html.as_uri(),
                ],
                check=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=60,
            )
            im = Image.open(png).convert("RGB")
            end = next((y for y in range(im.height) if im.getpixel((0, y)) == (255, 0, 255)), None)
            if end is not None:
                return im.crop((0, 0, W, max(end, H)))
    raise RuntimeError("README exceeds the screenshot height")


def indexed(im, smooth=False):
    levels = [0 if v < 40 else 1 if v < 125 else 2 if v < 210 else 3 for v in range(256)]
    gray = im.convert("L").point(levels if smooth else [3 * int(v >= 85) for v in range(256)])
    if im.mode == "RGB":
        r, _, b = im.split()
        warm = ImageChops.subtract(r, b).point(lambda v: 255 if v > 45 else 0)
        gray.paste(4, mask=warm)
    return gray


def source(font):
    cols = int((W - 2 * M) / font.getlength("M"))
    lines = []
    for line in Path(__file__).read_text(encoding="utf-8").splitlines():
        lines.extend(textwrap.wrap(line, cols, drop_whitespace=False) or [""])
    im = Image.new("L", (W, max(H, 12 + 11 * len(lines))))
    draw = ImageDraw.Draw(im)
    for i, line in enumerate(lines):
        draw.text((M, 6 + 11 * i), line, font=font, fill=255)
    return indexed(im)


def positions(end, step):
    y = 0
    yield y
    while y < end:
        y = min(end, y + min(step, 1 + min(y, end - y) // 4))
        yield y


def render(readme, output, font_path, readme_step, source_step):
    font = ImageFont.truetype(font_path, 15)
    small = ImageFont.truetype(font_path, 10)
    rng = random.Random(20261125)
    doc, code = indexed(document(readme)), source(small)
    prev = None
    frames = total = 0
    with output.open("wb") as fp:
        fp.write(b"GIF89a" + struct.pack("<HHBBB", W, H, 0xF2, 0, 0))
        fp.write(PALETTE)
        fp.write(b"!\xff\x0bNETSCAPE2.0\x03\x01\x00\x00\x00")

        def push(im, ms):
            nonlocal prev, frames, total
            fp.write(encode_frame(im, prev, ms, measure=True))
            prev = im
            frames += 1
            total += ms

        def typing(s, hold=3100, erase=True):
            cols = int((W - 2 * M - 6) / font.getlength("M"))
            lines = textwrap.wrap(s, cols, break_on_hyphens=False)

            def show(n, ms):
                im = Image.new("L", (W, H))
                d = ImageDraw.Draw(im)
                x, y, start = M, 40, 0
                for i, line in enumerate(lines):
                    start = s.index(line, start)
                    if n < start:
                        break
                    part = line[: n - start]
                    y = 40 + i * 21
                    d.text((M, y), part, font=font, fill=255, anchor="ls")
                    x = round(M + font.getlength(part))
                    start += len(line)
                d.rectangle((x + 2, y - 12, x + 3, y + 2), fill=255)
                push(indexed(im, smooth=True), ms)

            show(0, 180)
            for n, c in enumerate(s, 1):
                ms = rng.choice((40, 40, 50, 60, 70, 80)) + (120 if c in ".,—" else 0)
                show(n, hold if n == len(s) else ms)
            if erase:
                for n in range(len(s) - 1, -1, -1):
                    show(n, 30 if n else 180)

        def scroll(strip, step):
            end = strip.height - H
            for y in positions(end, step):
                push(strip.crop((0, y, W, y + H)), 1500 if y in (0, end) else FRAME_MS)

        for i, s in enumerate(SENTENCES):
            typing(s, 4100 if i == 3 else 3100)
        typing("$ cat README.md", 1000, False)
        scroll(doc, readme_step)
        typing("$ cat profile/render_typewriter.py", 1000, False)
        scroll(code, source_step)

        def last(n):
            im = Image.new("L", (W, H))
            d = ImageDraw.Draw(im)
            d.text((M, 24), f"$ stat -c '%s bytes' {output.name}", font=small, fill=255)
            d.text((M, 52), f"{n} bytes", font=font, fill=255)
            return encode_frame(indexed(im, smooth=True), prev, 4500)

        prefix = fp.tell()
        estimate = prefix + len(last(prefix)) + 1
        candidates = []
        for n in range(estimate - 128, estimate + 129):
            payload = last(n)
            gap = n - prefix - len(payload) - 1
            if gap == 0 or gap == 3 or 5 <= gap <= 259:
                candidates.append((gap, n, payload))
                if gap == 0:
                    break
        gap, n, payload = min(candidates)
        fp.write(payload)
        if gap:
            fp.write(b"!\xfe" + (bytes([gap - 4]) + b" " * (gap - 4) if gap > 3 else b"") + b"\x00")
        fp.write(b";")
    assert output.stat().st_size == n
    print(
        f"README {doc.height}px; source {code.height}px; "
        f"{frames + 1} frames; {(total + 4500) / 1000:.2f}s"
    )
    print(f"{n} bytes; exact size; comment padding={gap}")
    print(dict(STATS))
    if n > LIMIT:
        raise RuntimeError(f"GIF exceeds {LIMIT} bytes")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--readme", type=Path, default=Path("README.md"))
    ap.add_argument("--font", default="/usr/share/fonts/noto/NotoSansMono-Regular.ttf")
    ap.add_argument("--readme-step", type=int, default=README_STEP)
    ap.add_argument("--source-step", type=int, default=SOURCE_STEP)
    ap.add_argument("-o", "--output", type=Path, default=Path("profile/profile.gif"))
    args = ap.parse_args()
    if min(args.readme_step, args.source_step) < 1:
        ap.error("scroll steps must be positive")
    with tempfile.TemporaryDirectory(dir=args.output.parent) as tmp:
        staged = Path(tmp) / args.output.name
        render(args.readme, staged, args.font, args.readme_step, args.source_step)
        staged.replace(args.output)
