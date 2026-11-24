"""Round-trip regression tests for the lossless GIF frame encoder."""

import io
import random
import struct
import unittest

from gif_codec import PALETTE, encode_frame, lzw
from PIL import Image, ImageChops


def header(width, height):
    return b"GIF89a" + struct.pack("<HHBBB", width, height, 0xF2, 0, 0) + PALETTE


class CodecTests(unittest.TestCase):
    def test_lzw_roundtrip(self):
        rng = random.Random(10)
        for width, height in ((1, 1), (17, 13), (64, 112), (384, 100)):
            for colors in (2, 3, 4, 5, 8):
                pixels = bytes(v % colors for v in rng.randbytes(width * height))
                for lookahead in (False, True):
                    with self.subTest(
                        width=width, height=height, colors=colors, lookahead=lookahead
                    ):
                        data = (
                            header(width, height)
                            + b","
                            + struct.pack("<HHHHB", 0, 0, width, height, 0)
                            + lzw(pixels, lookahead)
                            + b";"
                        )
                        with Image.open(io.BytesIO(data)) as decoded:
                            self.assertEqual(decoded.tobytes(), pixels)

    def test_frame_roundtrip(self):
        rng = random.Random(32)
        for colors in (2, 3, 4, 5, 8):
            width, height = 139, 43
            previous = None
            frames = []
            data = bytearray(header(width, height))
            for i in range(4):
                if previous is not None and i == 2:
                    image = previous.copy()
                    image.paste(colors - 1, (3, 4, 60, 31))
                else:
                    pixels = bytes(v % colors for v in rng.randbytes(width * height))
                    image = Image.frombytes("L", (width, height), pixels)
                data.extend(encode_frame(image, previous, 40))
                frames.append(image)
                previous = image
            data.extend(b";")
            with Image.open(io.BytesIO(data)) as decoded:
                self.assertEqual(decoded.n_frames, len(frames))
                for i, image in enumerate(frames):
                    decoded.seek(i)
                    expected = image.convert("P")
                    expected.putpalette(PALETTE)
                    self.assertIsNone(
                        ImageChops.difference(
                            decoded.convert("RGB"), expected.convert("RGB")
                        ).getbbox()
                    )
                    self.assertEqual(decoded.info["duration"], 40)


if __name__ == "__main__":
    unittest.main()
