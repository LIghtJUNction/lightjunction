"""Lossless, size-selective GIF89a frame encoding for the scrolling profile."""

import struct
from collections import Counter

from PIL import ImageChops

PALETTE = bytes.fromhex("000000 525252 a8a8a8 eeeeee ad683c faf9f6 292722 ff00ff")
STATS = Counter()


def lzw(pixels, lookahead=False):
    """Encode GIF LZW; optionally try an earlier phrase boundary."""
    minimum = max(2, max(pixels).bit_length())
    clear = 1 << minimum
    table, next_code, width = {}, clear + 2, minimum + 1
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

    def extend(prefix, pixel):
        nonlocal next_code, width
        if next_code < 4096:
            table.setdefault(prefix * 8 + pixel, next_code)
            next_code += 1
            if next_code > 1 << width and width < 12:
                width += 1
        else:
            # A full dictionary can legally remain in use. Try this policy
            # separately from the clear-on-full policy via the lookahead parse.
            if not lookahead:
                emit(clear)
                table.clear()
                next_code, width = clear + 2, minimum + 1

    def match(start):
        code, end = pixels[start], start + 1
        while end < len(pixels):
            child = table.get(code * 8 + pixels[end])
            if child is None:
                break
            code = child
            end += 1
        return code, end

    emit(clear)
    if lookahead:
        start = 0
        while start < len(pixels):
            code, end = match(start)
            if end < len(pixels) and end - start > 2:
                _, farthest = match(end)
                best_end = end
                for cut in range(end - 1, max(start, end - 4) - 1, -1):
                    if cut <= start:
                        break
                    _, future = match(cut)
                    if future > farthest + 1:
                        best_end, farthest = cut, future
                if best_end != end:
                    end = best_end
                    code = pixels[start]
                    for pixel in pixels[start + 1 : end]:
                        code = table[code * 8 + pixel]
            emit(code)
            if end < len(pixels):
                extend(code, pixels[end])
            start = end
    else:
        prefix = pixels[0]
        for pixel in pixels[1:]:
            key = prefix * 8 + pixel
            child = table.get(key)
            if child is not None:
                prefix = child
                continue
            emit(prefix)
            extend(prefix, pixel)
            prefix = pixel
        emit(prefix)
    if next_code == 1 << width and width < 12:
        width += 1
    emit(clear + 1)
    if bits:
        buf.append(acc)
    blocks = (bytes([len(buf[i : i + 255])]) + buf[i : i + 255] for i in range(0, len(buf), 255))
    return bytes([minimum]) + b"".join(blocks) + b"\x00"


def interlace(pixels, w, h):
    """GIF's standard four-pass row order; the image itself is unchanged."""
    return b"".join(
        pixels[y * w : (y + 1) * w]
        for start, step in ((0, 8), (4, 8), (2, 4), (1, 2))
        for y in range(start, h, step)
    )


def encode_frame(im, prev, ms, *, measure=False):
    """Select the cheapest legal GIF rectangle, palette, scan and LZW parse."""
    w, h = im.size
    difference = ImageChops.difference(im, prev) if prev is not None else None
    box = (0, 0, w, h) if difference is None else difference.getbbox() or (0, 0, 1, 1)
    best = None
    baseline = None

    def candidate(rect, pixels, transparent=None, local=b"", flags=0, mode="opaque", trial=True):
        nonlocal best, baseline
        x, y, r, b = rect
        width, height = r - x, b - y
        gce = b"!\xf9\x04" + struct.pack(
            "<BHBB", 4 + (transparent is not None), ms // 10, transparent or 0, 0
        )
        scans = [(pixels, flags, mode)]
        if trial and height > 8 and len(pixels) >= 1024:
            scans.append((interlace(pixels, width, height), flags | 64, mode + "/interlace"))
        for data, f, name in scans:
            header = gce + b"," + struct.pack("<HHHHB", x, y, width, height, f) + local
            encoded = header + lzw(data)
            if rect == box and not local and not f and mode in ("opaque", "delta"):
                baseline = len(encoded) if baseline is None else min(baseline, len(encoded))
            if best is None or len(encoded) < len(best[0]):
                best = (encoded, name, header, data)

    def variants(rect):
        image = im.crop(rect)
        pixels = image.tobytes()
        used = sorted(set(pixels))
        candidate(rect, pixels, trial=True)
        # If sparse global indices enlarge the initial code width, a local
        # palette may save more bytes than its table costs.
        if max(2, max(used).bit_length()) > max(2, (len(used) - 1).bit_length()):
            table_size = 1 << max(1, (len(used) - 1).bit_length())
            mapping = bytearray(range(256))
            for j, i in enumerate(used):
                mapping[i] = j
            palette = b"".join(PALETTE[i * 3 : i * 3 + 3] for i in used)
            palette = palette.ljust(table_size * 3, b"\0")
            candidate(
                rect,
                pixels.translate(mapping),
                local=palette,
                flags=128 | (table_size.bit_length() - 2),
                mode="local",
            )
        if difference is not None:
            # Transparent is a free index in this rectangle, not a fixed
            # high index that needlessly increases LZW's starting width.
            trans = next((i for i in range(8) if i not in used), None)
            if trans is not None:
                same = difference.crop(rect).point(lambda v: 0 if v else 255)
                image.paste(trans, mask=same)
                candidate(rect, image.tobytes(), trans, mode="delta")

    variants(box)
    # Alignment can improve row-to-row LZW phrase reuse. Only test one
    # padded rectangle, and always retain the exact bounding-box candidate.
    x, y, r, b = box
    aligned = (x // 8 * 8, y, min(w, (r + 7) // 8 * 8), b)
    if aligned != box and (r - x) * (b - y) >= 4096:
        candidate(aligned, im.crop(aligned).tobytes(), mode="aligned", trial=False)

    encoded, mode, header, pixels = best
    if len(pixels) >= 4096:
        alt = header + lzw(pixels, lookahead=True)
        if len(alt) < len(encoded):
            encoded, mode = alt, mode + "/lookahead"
    if measure:
        STATS["baseline_bytes"] += baseline
        STATS["selected_bytes"] += len(encoded)
        STATS[mode] += 1
    return encoded
