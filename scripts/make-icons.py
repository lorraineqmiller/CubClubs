#!/usr/bin/env python3
"""
Builds the site icons from the source logo.

    python3 scripts/make-icons.py [source.png]

Does three things the browser tab actually needs:

1. Removes the white background properly. The naive trick (alpha from pixel
   darkness) would wreck this logo: the baby-blue letters are light, so they'd
   come out near-black at ~34% alpha. Looks identical on white, wrong on a dark
   tab bar. Instead we detect the flat logo colours and, for every pixel, solve
   for the alpha that would have produced it when that colour was composited
   over white — which keeps antialiased edges smooth and colours true.

2. Crops to the artwork. The source has wide margins; at 16px those margins are
   most of the icon and the letters become an unreadable smudge.

3. Emits every size Next's metadata convention picks up automatically.
"""

import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
APP = ROOT / "src" / "app"

SOURCE = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "assets" / "logo.png"

# Fraction of the cropped size added back as breathing room on each side.
MARGIN = 0.05
# How close to white a pixel must be to count as background.
WHITE_TOLERANCE = 12


def dominant_logo_colours(rgb: np.ndarray, count: int = 2) -> list[np.ndarray]:
    """The most common strongly-non-white colours, as the flat logo inks."""
    flat = rgb.reshape(-1, 3)
    # Only consider pixels well clear of white, so antialiased edge pixels don't
    # register as their own "colour".
    solid = flat[flat.min(axis=1) < 200]
    # Quantise to 8 levels per channel so near-identical pixels group together.
    keys = (solid // 32).astype(np.int32)
    packed = keys[:, 0] * 64 + keys[:, 1] * 8 + keys[:, 2]
    values, counts = np.unique(packed, return_counts=True)
    inks = []
    for value in values[np.argsort(-counts)][:count]:
        member = solid[packed == value]
        inks.append(member.mean(axis=0))
    return inks


def flatten_onto_white(image: Image.Image) -> Image.Image:
    """
    Composite the source over white, honouring any alpha it already has.

    Sources arrive both ways — exported flat on a white background, or already
    cut out. A plain `.convert("RGB")` discards alpha and leaves whatever RGB
    sat under the transparent pixels, which for a cut-out PNG is black; the ink
    detector then reads that black as the logo's main colour and the crop spans
    the whole canvas. Flattening first makes both inputs behave identically, and
    for an already-transparent source the unmix downstream recovers the same
    alpha it started with.
    """
    source = image.convert("RGBA")
    canvas = Image.new("RGBA", source.size, (255, 255, 255, 255))
    return Image.alpha_composite(canvas, source)


def unmix_from_white(image: Image.Image) -> Image.Image:
    rgb = np.asarray(image.convert("RGB")).astype(np.float64)
    height, width, _ = rgb.shape
    white = np.array([255.0, 255.0, 255.0])

    inks = dominant_logo_colours(rgb)
    print(f"  detected inks: {[tuple(int(c) for c in ink) for ink in inks]}")

    best_alpha = np.zeros((height, width))
    best_resid = np.full((height, width), np.inf)
    best_ink = np.zeros((height, width, 3))

    for ink in inks:
        direction = white - ink
        denom = float(direction @ direction)
        # alpha that best explains this pixel as `ink` composited over white
        alpha = ((white - rgb) @ direction) / denom
        alpha = np.clip(alpha, 0.0, 1.0)
        modelled = white + alpha[..., None] * (ink - white)
        resid = np.linalg.norm(rgb - modelled, axis=-1)

        better = resid < best_resid
        best_resid = np.where(better, resid, best_resid)
        best_alpha = np.where(better, alpha, best_alpha)
        best_ink = np.where(better[..., None], ink, best_ink)

    # Anything essentially white is background, whatever the solver decided.
    is_white = (255.0 - rgb).max(axis=-1) < WHITE_TOLERANCE
    best_alpha = np.where(is_white, 0.0, best_alpha)

    out = np.dstack([best_ink, best_alpha * 255.0]).astype(np.uint8)
    return Image.fromarray(out, mode="RGBA")


def ensure_transparent(image: Image.Image) -> Image.Image:
    """
    Return the logo on a transparent field, doing as little as possible.

    A source that is already cut out is left alone: pushing it through
    flatten-then-unmix is a lossy round trip that roughens every antialiased
    edge for no gain. Only a logo sitting on solid white needs the unmix.
    """
    rgba = image.convert("RGBA")
    alpha = np.asarray(rgba.getchannel("A"))
    already_cut_out = (alpha == 0).mean() > 0.05

    if already_cut_out:
        print(f"  source already transparent ({(alpha == 0).mean() * 100:.0f}%) — using its alpha as-is")
        return rgba

    print("  source is on white — unmixing background to alpha")
    return unmix_from_white(flatten_onto_white(rgba))


def crop_to_content(image: Image.Image) -> Image.Image:
    bbox = image.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    if bbox is None:
        return image
    left, top, right, bottom = bbox
    # Square it off around the artwork's centre so nothing is distorted.
    side = max(right - left, bottom - top)
    pad = int(side * MARGIN)
    side += pad * 2
    cx, cy = (left + right) // 2, (top + bottom) // 2
    box = (cx - side // 2, cy - side // 2, cx + side // 2, cy + side // 2)

    square = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    square.paste(image.crop(box), (0, 0))
    return square


def main() -> None:
    if not SOURCE.exists():
        sys.exit(f"No source logo at {SOURCE}")

    print(f"Reading {SOURCE.relative_to(ROOT)} …")
    source = Image.open(SOURCE)
    transparent = ensure_transparent(source)
    cropped = crop_to_content(transparent)
    print(f"  cropped {source.size} -> {cropped.size}")

    def resized(size: int) -> Image.Image:
        return cropped.resize((size, size), Image.LANCZOS)

    # Next's file conventions: these are picked up automatically and the correct
    # <link> tags are emitted, so nothing needs wiring in layout.tsx.
    resized(512).save(APP / "icon.png")
    print("  wrote src/app/icon.png (512px, transparent)")

    resized(48).save(
        APP / "favicon.ico",
        sizes=[(16, 16), (32, 32), (48, 48)],
    )
    print("  wrote src/app/favicon.ico (16/32/48, transparent)")

    # iOS ignores transparency on home-screen icons and composites on black, so
    # this one gets an explicit light background rather than a murky square.
    apple = Image.new("RGBA", (180, 180), (255, 255, 255, 255))
    art = cropped.resize((156, 156), Image.LANCZOS)
    apple.paste(art, (12, 12), art)
    apple.convert("RGB").save(APP / "apple-icon.png")
    print("  wrote src/app/apple-icon.png (180px, white background)")


if __name__ == "__main__":
    main()
