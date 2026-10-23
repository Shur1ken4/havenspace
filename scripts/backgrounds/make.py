"""Calm call backgrounds (our own generated art): python3 scripts/backgrounds/make.py
Writes apps/web/public/backgrounds/*.jpg (1280x720). Soft shapes, blurred, so they
read as an out-of-focus room behind the person, never as a busy picture."""
from __future__ import annotations

import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

W, H = 1280, 720
OUT = Path(__file__).resolve().parents[2] / "apps" / "web" / "public" / "backgrounds"


def gradient(top: tuple[int, int, int], bottom: tuple[int, int, int]) -> Image.Image:
    img = Image.new("RGB", (W, H))
    px = img.load()
    for y in range(H):
        t = y / (H - 1)
        c = tuple(round(a + (b - a) * t) for a, b in zip(top, bottom))
        for x in range(W):
            px[x, y] = c
    return img


def glow(img: Image.Image, x: int, y: int, r: int, color: tuple[int, int, int], alpha: int, blur: int) -> None:
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(layer).ellipse((x - r, y - r, x + r, y + r), fill=(*color, alpha))
    img.paste(layer.filter(ImageFilter.GaussianBlur(blur)), (0, 0), layer.filter(ImageFilter.GaussianBlur(blur)))


def shapes(img: Image.Image, draw_fn, blur: int) -> None:
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw_fn(ImageDraw.Draw(layer))
    soft = layer.filter(ImageFilter.GaussianBlur(blur))
    img.paste(soft, (0, 0), soft)


def leaf(d: ImageDraw.ImageDraw, cx: float, cy: float, length: float, angle: float, color) -> None:
    pts = []
    for i in range(41):
        t = i / 40
        w = math.sin(math.pi * t) * length * 0.28
        pts.append((t * length, w))
    pts += [(x, -y) for x, y in reversed(pts)]
    ca, sa = math.cos(angle), math.sin(angle)
    d.polygon([(cx + x * ca - y * sa, cy + x * sa + y * ca) for x, y in pts], fill=color)


def warm() -> Image.Image:
    img = gradient((246, 240, 230), (226, 214, 198))
    glow(img, 980, 160, 360, (255, 246, 228), 200, 120)
    shapes(img, lambda d: d.rectangle((0, 560, W, H), fill=(205, 186, 164, 140)), 30)  # a low shelf / floor line
    shapes(img, lambda d: d.rounded_rectangle((120, 230, 330, 520), 18, fill=(214, 196, 174, 120)), 40)  # a frame on the wall
    return img


def sage() -> Image.Image:
    img = gradient((231, 238, 233), (198, 214, 204))
    rnd = random.Random(7)

    def plants(d: ImageDraw.ImageDraw) -> None:
        for _ in range(26):
            leaf(d, rnd.uniform(1000, 1260), rnd.uniform(380, 700), rnd.uniform(140, 260), rnd.uniform(-2.6, -1.2),
                 (rnd.randint(90, 120), rnd.randint(130, 150), rnd.randint(105, 120), 150))
        for _ in range(14):
            leaf(d, rnd.uniform(0, 160), rnd.uniform(420, 720), rnd.uniform(120, 220), rnd.uniform(-2.0, -0.6),
                 (rnd.randint(100, 125), rnd.randint(135, 155), rnd.randint(110, 125), 120))

    shapes(img, plants, 22)
    glow(img, 640, 120, 420, (250, 252, 246), 150, 140)
    return img


def window() -> Image.Image:
    img = gradient((244, 239, 231), (222, 213, 200))

    def beams(d: ImageDraw.ImageDraw) -> None:
        for i in range(4):
            x = 520 + i * 170
            d.polygon([(x, 0), (x + 120, 0), (x - 260, H), (x - 420, H)], fill=(255, 250, 238, 120))
        # window frame, far away and soft
        d.rectangle((760, 60, 1180, 470), outline=(196, 180, 160, 160), width=18)
        d.line((970, 60, 970, 470), fill=(196, 180, 160, 160), width=14)
        d.line((760, 265, 1180, 265), fill=(196, 180, 160, 160), width=14)

    shapes(img, beams, 26)
    glow(img, 970, 260, 300, (255, 251, 240), 170, 110)
    return img


def evening() -> Image.Image:
    img = gradient((52, 58, 54), (30, 36, 33))
    glow(img, 1040, 300, 260, (232, 176, 120), 150, 120)  # a lamp
    glow(img, 1040, 300, 90, (255, 214, 160), 160, 50)
    shapes(img, lambda d: d.rectangle((0, 590, W, H), fill=(24, 28, 26, 160)), 30)
    shapes(img, lambda d: [d.rounded_rectangle((90 + i * 70, 200, 140 + i * 70, 560), 6, fill=(70 + i * 6, 74, 66, 150)) for i in range(5)], 18)  # books
    return img


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for name, fn in {"warm": warm, "sage": sage, "window": window, "evening": evening}.items():
        fn().save(OUT / f"{name}.jpg", quality=84, optimize=True, progressive=True)
        print("wrote", name)
