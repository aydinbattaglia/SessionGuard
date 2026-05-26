#!/usr/bin/env python3
"""Generate SessionGuard extension icons at 16, 48, and 128px."""

from PIL import Image, ImageDraw
import os
import math

BLUE   = (37, 99, 235, 255)   # #2563eb
WHITE  = (255, 255, 255, 255)
CLEAR  = (0, 0, 0, 0)

def shield_polygon(size, pad_frac=0.12):
    """
    Returns a list of (x, y) points for a shield shape that fits within `size`.
    The shield has a flat top, rounded upper corners, and a pointed bottom.
    """
    p = size * pad_frac
    w = size - 2 * p
    h = size - 2 * p

    # Control points as fractions of width/height
    pts = [
        (p,             p + h * 0.15),   # top-left after curve start
        (p,             p + h * 0.58),   # left mid
        (p + w * 0.5,   p + h),          # bottom point
        (p + w,         p + h * 0.58),   # right mid
        (p + w,         p + h * 0.15),   # top-right after curve start
        (p + w * 0.75,  p),              # top right
        (p + w * 0.25,  p),              # top left
    ]
    return pts


def checkmark_points(size, pad_frac=0.12):
    """Returns two line segments forming a checkmark, scaled to size."""
    p = size * pad_frac
    w = size - 2 * p
    h = size - 2 * p

    # Checkmark: short stroke then long stroke
    cx = p + w * 0.5
    cy = p + h * 0.55

    short_start = (cx - w * 0.26, cy - h * 0.02)
    short_end   = (cx - w * 0.06, cy + h * 0.18)
    long_end    = (cx + w * 0.30, cy - h * 0.22)

    return short_start, short_end, long_end


def make_icon(size):
    img = Image.new('RGBA', (size, size), CLEAR)
    draw = ImageDraw.Draw(img)

    # --- Rounded background circle ---
    radius = size * 0.18
    draw.rounded_rectangle(
        [0, 0, size - 1, size - 1],
        radius=radius,
        fill=BLUE,
    )

    # --- Shield shape (white) ---
    pts = shield_polygon(size, pad_frac=0.14)
    draw.polygon(pts, fill=WHITE)

    # --- Blue interior of shield (slightly smaller) ---
    inner_pts = shield_polygon(size, pad_frac=0.22)
    draw.polygon(inner_pts, fill=BLUE)

    # --- Checkmark (white) ---
    if size >= 24:
        lw = max(2, int(size * 0.07))
        s, m, e = checkmark_points(size, pad_frac=0.22)
        draw.line([s, m], fill=WHITE, width=lw, joint='curve')
        draw.line([m, e], fill=WHITE, width=lw, joint='curve')

    return img


if __name__ == '__main__':
    out_dir = os.path.join(os.path.dirname(__file__), '..', 'icons')
    os.makedirs(out_dir, exist_ok=True)

    sizes = {
        'icon16.png':  16,
        'icon48.png':  48,
        'icon128.png': 128,
    }

    for fname, size in sizes.items():
        img = make_icon(size)
        path = os.path.join(out_dir, fname)
        img.save(path, 'PNG')
        print(f'Generated {fname} ({size}x{size})')
