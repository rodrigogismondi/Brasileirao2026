#!/usr/bin/env python3
"""Generate simple Brasileirão PWA icons (green/gold). Requires Pillow."""

from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    raise SystemExit("Install Pillow: pip install Pillow")

OUT = Path(__file__).resolve().parents[1] / "public"
OUT.mkdir(exist_ok=True)

BG = (10, 31, 18, 255)
GOLD = (240, 196, 25, 255)
TEXT = (10, 31, 18, 255)


def make(size: int, maskable: bool = False) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    pad = int(size * (0.1 if maskable else 0.06))
    draw.rounded_rectangle([pad, pad, size - pad, size - pad], radius=int(size * 0.22), fill=BG)
    inner = int(size * 0.18)
    draw.rounded_rectangle(
        [inner, inner, size - inner, size - inner],
        radius=int(size * 0.16),
        fill=GOLD,
    )
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", int(size * 0.22))
    except OSError:
        font = ImageFont.load_default()
    label = "BR26"
    bbox = draw.textbbox((0, 0), label, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text(((size - tw) / 2, (size - th) / 2 - size * 0.02), label, font=font, fill=TEXT)
    return img


make(192).save(OUT / "pwa-192x192.png")
make(512).save(OUT / "pwa-512x512.png")
make(512, maskable=True).save(OUT / "pwa-maskable-512x512.png")
make(180).save(OUT / "apple-touch-icon.png")
make(32).save(OUT / "favicon-32x32.png")
make(32).save(OUT / "favicon.ico")
print("Icons written to", OUT)
