#!/usr/bin/env python3
"""
Composite archetype icons onto badge backgrounds (SVG rasterized via PyMuPDF).

Removes baked-in matte backgrounds from icons (edge-ring color sample + flood), composites
onto badge art, and draws only the archetype `name` on the ribbon. Chaos `category`,
strategy, and frequency from JSON are never drawn.

Background files live next to this script under archetype_logic/badge images/backgrounds/.
Paths are resolved from the script directory so the correct `.svg` is used even if
your shell cwd is elsewhere.

SVG vs PNG:
  When the expected file is `foo.svg`, that SVG is rasterized if it exists. Only if the
  `.svg` is missing does the script fall back to `foo.png` (often legacy art with a baked
  background). Use `--verbose` to see which file loaded per badge.

Coordinate system (BADGE_W x BADGE_H, default 360x480):
  Pixel (0, 0) is the top-left corner of the saved composed PNG. The entire SVG page
  is scaled to fill that canvas; if the SVG viewBox has empty margin above the hex,
  the visible badge does not start at y=0. Ribbon L/T/R/B numbers must be measured on
  this same output (or on a flat 360x480 bitmap with no extra letterboxing outside it).

Optional `--strip-badge-scene` trims dark pixels connected to the edges (partial help
when a scene is baked in). For a fully transparent background, edit the SVG export
or use an image editor.

Chaos-tier icons (filename prefix 361–389) get a faded, rounded purple splash close to the icon
silhouette when compositing so they read on the dark chaos badge template.

Per-icon tuning: `archetype_logic/badge images/icon_compose_overrides.json` lists filenames
for stronger background stripping (aggressive_strip_filenames), optional scale_mult / y_extra / x_extra,
no_strip_filenames (curated transparent PNGs: composite only), strip_black_center_filenames
(remove opaque dark blob from center), and strip_white_edge_filenames (solid white matte: edge
flood only so interior white stays). Use `python build_badges.py --no-compose-overrides`
to ignore that file.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import textwrap
from collections import deque

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

try:
    import fitz  # PyMuPDF — renders SVG without the Cairo system library (Windows-friendly)
except ImportError:  # pragma: no cover
    fitz = None  # type: ignore

_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
JSON_PATH = os.path.join(_SCRIPT_DIR, "archetype_logic", "badge images", "icon_prompts.json")
ICON_COMPOSE_OVERRIDES_PATH = os.path.join(
    _SCRIPT_DIR, "archetype_logic", "badge images", "icon_compose_overrides.json"
)
ICONS_DIR = os.path.join(_SCRIPT_DIR, "badges", "icons")
BACKGROUNDS_DIR = os.path.join(_SCRIPT_DIR, "archetype_logic", "badge images", "backgrounds")
OUTPUT_DIR = os.path.join(_SCRIPT_DIR, "badges", "composed")

# Composed badge size (matches legacy PNG templates)
BADGE_W, BADGE_H = 360, 480

# Chaos-tier icon filenames use numeric prefix 361–389 (see icon_prompts.json). A tight faded
# rounded splash helps icons read on the dark chaos template.
CHAOS_TIER_SPLASH_ID_MIN = 361
CHAOS_TIER_SPLASH_ID_MAX = 389

# Default chaos splash tint: muted violet/purple (reads as a soft glow on the dark chaos template).
CHAOS_SPLASH_PLATE_RGB_DEFAULT = (142, 98, 205)  # ~ #8e62cd, between violet-500 and violet-600

# Background SVG page sizes vary (see `python build_badges.py --print-bg-sizes`). Typical: 360x420 art
# scaled to 360px wide, then letterboxed (centered) to 360x480.
# `render_svg_to_rgba` scales to BADGE_W by width, then pads (vertically centered) or fits down to BADGE_W x BADGE_H
# without non-uniform stretch. (e.g. 360x420 art: 30px transparent top + 30px bottom on a 360x480 canvas.)
# For accurate ribbon placement, use `svg_ribbon_aabb_to_layout_fractions` or
#   python build_badges.py --convert-ribbon <file.svg> L T R B
# RIBBON_LAYOUT is always expressed as fractions of the final 360x480 image.


def _svg_user_to_final_px(
    sx: float,
    sy: float,
    *,
    k: float,
    iw: int,
    ih: int,
    target_w: int,
    target_h: int,
) -> tuple[float, float]:
    """Map SVG user units to composite pixel coords; matches `render_svg_to_rgba` (pad / fit, vertically centered)."""
    px, py = sx * k, sy * k
    nat_w, nat_h = float(iw), float(ih)
    if nat_w > target_w or nat_h > target_h:
        fit = min(target_w / nat_w, target_h / nat_h)
        px *= fit
        py *= fit
        nat_w *= fit
        nat_h *= fit
    ox = (target_w - nat_w) / 2.0
    oy = (target_h - nat_h) / 2.0
    return px + ox, py + oy


def svg_ribbon_aabb_to_layout_fractions(
    svg_path: str,
    left: float,
    top: float,
    right: float,
    bottom: float,
    *,
    target_w: int = BADGE_W,
    target_h: int = BADGE_H,
) -> tuple[float, float, float]:
    """
    Map a ribbon rectangle in the SVG file's user units (left, top, right, bottom) to
    (y_center_frac, half_height_frac, x_margin_frac) for RIBBON_LAYOUT.

    Matches `render_svg_to_rgba`: scale to target_w by width, uniform fit-down if needed, else pad on
    transparent canvas with the raster vertically centered.
    """
    if fitz is None:
        raise RuntimeError("PyMuPDF (fitz) is required for SVG ribbon conversion.")
    doc = fitz.open(svg_path)
    try:
        page = doc[0]
        rw = float(page.rect.width)
        k = target_w / rw
        mat = fitz.Matrix(k, k)
        pix = page.get_pixmap(matrix=mat, alpha=True)
        iw, ih = pix.width, pix.height
    finally:
        doc.close()

    def mp(sx: float, sy: float) -> tuple[float, float]:
        return _svg_user_to_final_px(sx, sy, k=k, iw=iw, ih=ih, target_w=target_w, target_h=target_h)

    left_px, top_px = mp(left, top)
    _, bottom_px = mp(left, bottom)
    right_px, _ = mp(right, top)

    yc = (top_px + bottom_px) / 2.0
    span = bottom_px - top_px + 1.0
    hh = (span - 1.0) / 2.0
    xm = left_px
    return (yc / target_h, hh / target_h, xm / target_w)


def ribbon_layout_from_final_inclusive_bounds(
    left: float,
    top: float,
    right: float,
    bottom: float,
    *,
    canvas_w: int = BADGE_W,
    canvas_h: int = BADGE_H,
) -> tuple[float, float, float]:
    """
    Ribbon box measured on the final composed badge (canvas_w x canvas_h, default 360x480).
    left, top, right, bottom are inclusive pixel coordinates (origin top-left), matching a ruler
    on the exported PNG. Converts to (y_center_frac, half_height_frac, x_margin_frac) for
    draw_archetype_name_on_gold_ribbon (integer yc/hh chosen so the band covers bottom..top).
    `right` is reserved for future asymmetric horizontal insets; only `left` sets x margin today.
    """
    T = int(round(top))
    B = int(round(bottom))
    span_y = B - T + 1
    hh = max(1, (span_y - 1) // 2)
    yc = T + hh
    y1 = min(canvas_h, yc + hh + 1)
    if y1 - 1 < B:
        hh += 1
        yc = T + hh
        y1 = min(canvas_h, yc + hh + 1)
        if yc + hh >= canvas_h:
            yc = max(hh, canvas_h - hh - 1)
    xm = max(0, min(int(round(left)), canvas_w - 1))
    return (yc / canvas_h, hh / canvas_h, xm / canvas_w)


# Final 360x480 composite ribbon boxes (inclusive L, T, R, B). R is stored for reference;
# layout uses `left` for x margin only (see ribbon_layout_from_final_inclusive_bounds).
#
# Tune per template: measure L,T,R,B on a composed PNG (`--debug-ribbon` helps), or use
#   python build_badges.py --convert-ribbon <template.svg> L T R B
# Measured on 360x420 art; T/B shifted +30 for vertical centering on final 360x480 composite.
HERO_RB_RIBBON_FINAL_LTRB = (21, 307, 338, 362)
BPA_RIBBON_FINAL_LTRB = (18, 306, 338, 363)
CHAOS_RIBBON_FINAL_LTRB = (37, 320, 325, 375)
HYBRID_RIBBON_FINAL_LTRB = (38, 321, 322, 378)
ZERO_RB_RIBBON_FINAL_LTRB = (37, 325, 325, 376)
ROBUST_RB_RIBBON_FINAL_LTRB = (21, 307, 338, 365)

_HERO_RB_RIBBON = ribbon_layout_from_final_inclusive_bounds(*HERO_RB_RIBBON_FINAL_LTRB)
_BPA_RIBBON = ribbon_layout_from_final_inclusive_bounds(*BPA_RIBBON_FINAL_LTRB)
_CHAOS_RIBBON = ribbon_layout_from_final_inclusive_bounds(*CHAOS_RIBBON_FINAL_LTRB)
_HYBRID_RIBBON = ribbon_layout_from_final_inclusive_bounds(*HYBRID_RIBBON_FINAL_LTRB)
_ZERO_RB_RIBBON = ribbon_layout_from_final_inclusive_bounds(*ZERO_RB_RIBBON_FINAL_LTRB)
_ROBUST_RB_RIBBON = ribbon_layout_from_final_inclusive_bounds(*ROBUST_RB_RIBBON_FINAL_LTRB)


def get_ribbon_label(entry: dict) -> str:
    """
    Text for the gold ribbon: only the archetype title (icon_prompts `name`).

    Does not use `category`, `rb_strategy`, `frequency`, or any other field.
    """
    raw = (entry.get("name") or "").strip()
    if not raw:
        return ""
    # First line only (no accidental multi-line labels)
    if "\n" in raw:
        raw = raw.split("\n", 1)[0].strip()
    return raw


# Ribbon layout per SVG basename: (y_center_frac, half_height_frac, x_margin_frac).
# Text is laid out in the band y_center +/- half_height (pixels: yc +/- hh), with horizontal
# inset x_margin_frac * width on both sides. Tune per template if art differs.
# Use `python build_badges.py --print-bg-sizes` for each file's SVG page size and scale k.
# Use `--debug-ribbon` to draw the computed box on composed PNGs while tuning.
#
# Per-template *RIBBON_FINAL_LTRB on 360x480; also svg_ribbon_aabb_to_layout_fractions / --convert-ribbon.
RIBBON_LAYOUT: dict[str, tuple[float, float, float]] = {
    "best_player_available.svg": _BPA_RIBBON,
    "hero_rb.svg": _HERO_RB_RIBBON,
    "robust_rb.svg": _ROBUST_RB_RIBBON,
    "zero_rb.svg": _ZERO_RB_RIBBON,
    "hybrid.svg": _HYBRID_RIBBON,
    "chaos.svg": _CHAOS_RIBBON,
}
_DEFAULT_RIBBON = _BPA_RIBBON

# Inset archetype text inside the drawn ribbon so it does not touch the gold edges.
RIBBON_TEXT_PAD_X = 12
RIBBON_TEXT_PAD_Y = 6

# Document height used for layout (matches 360x420 badge art). Letterbox top on 480px canvas = (BADGE_H - h) // 2.
SVG_LAYOUT_DOC_HEIGHT = 420


# Per-template icon scale override; otherwise `cli_scale` from `--scale` is used.
# best_player_available art is shorter than 480px tall (padded to 360x480); slightly smaller icon avoids crowding.
ICON_SCALE_BY_TEMPLATE: dict[str, float] = {
    "best_player_available.svg": 0.48,
}


def icon_scale_for_template(template_basename: str | None, cli_scale: float) -> float:
    if template_basename and template_basename in ICON_SCALE_BY_TEMPLATE:
        return ICON_SCALE_BY_TEMPLATE[template_basename]
    return cli_scale


# Icon vertical band (T, B) inclusive rows on 360x420 SVG art. Map to composite: row += (BADGE_H - 420)//2.
# Vertical alignment: the geometric center of the icon bitmap (mid-height of the pasted image) is placed on
# the midpoint of [T, B] on the composite — e.g. viable rows 65..295 -> mid (65+295)/2; a 100px-tall icon's
# vertical center (row 50 from its top) sits on that mid row. `--y-offset` nudges after that.
ICON_VERTICAL_BAND_420: dict[str, tuple[int, int]] = {
    "best_player_available.svg": (60, 269),
    "robust_rb.svg": (65, 269),
    "hero_rb.svg": (61, 267),
    "zero_rb.svg": (65, 287),
    "hybrid.svg": (63, 283),
    "chaos.svg": (60, 282),
}


# Added to CLI `--y-offset` (pixels; positive = move icon down). Optional per-template fine-tune.
ICON_Y_OFFSET_BY_TEMPLATE: dict[str, int] = {}


def icon_y_offset_for_template(template_basename: str | None, cli_y: int) -> int:
    return cli_y + ICON_Y_OFFSET_BY_TEMPLATE.get(template_basename or "", 0)


_OVERRIDES_CACHE: (
    tuple[
        frozenset[str],
        frozenset[str],
        frozenset[str],
        frozenset[str],
        dict[str, dict[str, float | int]],
    ]
    | None
) = None


def _load_icon_compose_overrides() -> tuple[
    frozenset[str], frozenset[str], frozenset[str], frozenset[str], dict[str, dict[str, float | int]]
]:
    """
    Load archetype_logic/badge images/icon_compose_overrides.json if present:
      aggressive_strip_filenames: stronger edge stripping
      no_strip_filenames: skip all background strip (icon already has alpha)
      strip_black_center_filenames: only remove connected dark blob from center (no edge strip)
      strip_white_edge_filenames: remove only near-white pixels 4-connected to image edges
        (solid white matte); interior white not connected to the border is kept
      filename_overrides: { "001_the_captain.png": { "scale_mult": 0.92, "y_extra": 4, "x_extra": -6 }, ... }
    y_extra: pixels added to icon top (positive = move icon down).
    x_extra: horizontal nudge after centering (positive = right, negative = left).
    """
    path = ICON_COMPOSE_OVERRIDES_PATH
    if not os.path.isfile(path):
        return frozenset(), frozenset(), frozenset(), frozenset(), {}
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, json.JSONDecodeError):
        return frozenset(), frozenset(), frozenset(), frozenset(), {}
    agg = frozenset(str(x) for x in (data.get("aggressive_strip_filenames") or []))
    no_strip = frozenset(str(x) for x in (data.get("no_strip_filenames") or []))
    black_ctr = frozenset(str(x) for x in (data.get("strip_black_center_filenames") or []))
    white_edge = frozenset(str(x) for x in (data.get("strip_white_edge_filenames") or []))
    raw = data.get("filename_overrides") or {}
    out: dict[str, dict[str, float | int]] = {}
    for fn, v in raw.items():
        if isinstance(v, dict) and isinstance(fn, str):
            out[fn] = {k: v[k] for k in ("scale_mult", "y_extra", "x_extra") if k in v}
    return agg, no_strip, black_ctr, white_edge, out


def _compose_overrides() -> tuple[
    frozenset[str], frozenset[str], frozenset[str], frozenset[str], dict[str, dict[str, float | int]]
]:
    global _OVERRIDES_CACHE
    if _OVERRIDES_CACHE is None:
        _OVERRIDES_CACHE = _load_icon_compose_overrides()
    return _OVERRIDES_CACHE


def print_background_svg_sizes() -> None:
    """Log PyMuPDF page size per backgrounds/*.svg and scale k to BADGE_W x BADGE_H."""
    if fitz is None:
        print("PyMuPDF not installed.")
        return
    if not os.path.isdir(BACKGROUNDS_DIR):
        print(f"Missing dir: {BACKGROUNDS_DIR}")
        return
    for fn in sorted(os.listdir(BACKGROUNDS_DIR)):
        if not fn.lower().endswith(".svg"):
            continue
        path = os.path.join(BACKGROUNDS_DIR, fn)
        try:
            doc = fitz.open(path)
            r = doc[0].rect
            doc.close()
        except Exception as e:  # pragma: no cover
            print(f"{fn}: error {e}")
            continue
        k = BADGE_W / float(r.width)
        h_scaled = float(r.height) * k
        print(
            f"{fn}: SVG page {r.width:.0f}x{r.height:.0f} user units; "
            f"k = BADGE_W/width = {k:.6f}; scaled height ~{h_scaled:.2f} then pad/fit to {BADGE_W}x{BADGE_H}"
        )


def render_svg_to_rgba(svg_path: str, target_w: int = BADGE_W, target_h: int = BADGE_H) -> Image.Image:
    """
    Rasterize an SVG to RGBA using PyMuPDF (no Cairo DLL on Windows).

    Scales to `target_w` by width (uniform), then:
    - If the result is larger than target_w x target_h, scales down uniformly to fit.
    - Otherwise pastes onto a transparent target_w x target_h canvas, **vertically centered**
      (equal margin top/bottom when shorter than target_h). No non-uniform stretch.
    """
    if fitz is None:
        raise RuntimeError("PyMuPDF (pymupdf) is required for SVG backgrounds: pip install pymupdf")
    doc = fitz.open(svg_path)
    try:
        page = doc[0]
        scale = target_w / float(page.rect.width)
        mat = fitz.Matrix(scale, scale)
        pix = page.get_pixmap(matrix=mat, alpha=True)
        img = Image.frombytes("RGBA", [pix.width, pix.height], pix.samples)
    finally:
        doc.close()

    nat_w, nat_h = img.size
    if nat_w > target_w or nat_h > target_h:
        fit = min(target_w / nat_w, target_h / nat_h)
        nw = max(1, int(round(nat_w * fit)))
        nh = max(1, int(round(nat_h * fit)))
        img = img.resize((nw, nh), Image.Resampling.LANCZOS)
        nat_w, nat_h = img.size

    if (nat_w, nat_h) == (target_w, target_h):
        return img

    out = Image.new("RGBA", (target_w, target_h), (0, 0, 0, 0))
    ox = (target_w - nat_w) // 2
    oy = (target_h - nat_h) // 2
    out.paste(img, (ox, oy), img)
    return out


def strip_badge_scene_edges(img: Image.Image, *, seed_lum: float = 52.0, max_lum: float = 95.0) -> Image.Image:
    """
    Set alpha=0 for pixels connected to image edges through dark-ish regions (e.g. stadium).
    Conservative; may not remove large interior scenes. Best fix: transparent SVG export.
    """
    rgba = np.asarray(img.convert("RGBA"))
    rgb = rgba[:, :, :3].copy()
    h, w = rgb.shape[:2]

    def lum(px: np.ndarray) -> float:
        return float(px.mean())

    visited = np.zeros((h, w), dtype=bool)
    q: deque[tuple[int, int]] = deque()
    for x in range(w):
        for y in (0, h - 1):
            if lum(rgb[y, x]) < seed_lum:
                visited[y, x] = True
                q.append((y, x))
    for y in range(1, h - 1):
        for x in (0, w - 1):
            if lum(rgb[y, x]) < seed_lum and not visited[y, x]:
                visited[y, x] = True
                q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            ny, nx = y + dy, x + dx
            if ny < 0 or ny >= h or nx < 0 or nx >= w or visited[ny, nx]:
                continue
            if lum(rgb[ny, nx]) < max_lum and _color_dist_l1(rgb[y, x], rgb[ny, nx]) < 130:
                visited[ny, nx] = True
                q.append((ny, nx))
    out = rgba.copy()
    out[visited, 3] = 0
    return Image.fromarray(out, "RGBA")


def load_background_rgba(path: str) -> Image.Image:
    """Load SVG (rasterize) or PNG/JPEG; output size BADGE_W x BADGE_H."""
    ext = os.path.splitext(path)[1].lower()
    if ext == ".svg":
        return render_svg_to_rgba(path)
    im = Image.open(path).convert("RGBA")
    if im.size != (BADGE_W, BADGE_H):
        im = im.resize((BADGE_W, BADGE_H), Image.Resampling.LANCZOS)
    return im


def _default_font_candidates() -> list[str]:
    return [
        os.path.join(os.environ.get("WINDIR", "") or "", "Fonts", "arialbd.ttf"),
        os.path.join(os.environ.get("WINDIR", "") or "", "Fonts", "segoeui.ttf"),
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    ]


def _load_font(size: int, font_path: str | None) -> ImageFont.FreeTypeFont:
    paths = [font_path] if font_path else []
    paths.extend(p for p in _default_font_candidates() if p and os.path.isfile(p))
    for p in paths:
        try:
            return ImageFont.truetype(p, size)
        except OSError:
            continue
    return ImageFont.load_default()


def _color_dist_l1(a: np.ndarray, b: np.ndarray) -> int:
    """L1 RGB distance; use int16 to avoid uint8 wrap bugs."""
    return int(np.abs(a.astype(np.int16) - b.astype(np.int16)).sum())


def _color_dist_to_bg(pixel_rgb: np.ndarray, bg_color: np.ndarray) -> float:
    """L1 distance of a pixel to the sampled background color."""
    return float(np.abs(pixel_rgb.astype(np.float32) - bg_color).sum())


def _sample_bg_color(rgb: np.ndarray) -> np.ndarray:
    """
    Sample background color from the outermost pixel ring (all 4 edges),
    not just corner patches. This is more robust when:
      - corners contain subject matter / shadows / borders
      - the image is very small (corner patches would degenerate)
      - the background has slight gradients (ring gives more coverage)

    Falls back gracefully on tiny images by using whatever pixels exist.
    """
    h, w = rgb.shape[:2]

    # Outermost ring: top row, bottom row, left col, right col
    top = rgb[0, :, :3]
    bottom = rgb[h - 1, :, :3]
    left = rgb[:, 0, :3]
    right = rgb[:, w - 1, :3]

    ring = np.concatenate([top, bottom, left, right], axis=0)

    if ring.shape[0] == 0:
        return np.array([255.0, 255.0, 255.0], dtype=np.float32)

    # Median is more robust than mean to shadows, subject clipping, and JPEG edge artifacts.
    return np.median(ring, axis=0).astype(np.float32)


def _is_checker_bg_pixel(r: int, g: int, b: int) -> bool:
    """Pixels typical of white / gray / cyan checkerboard fake transparency (legacy heuristic)."""
    lum = (r + g + b) / 3
    sp = max(r, g, b) - min(r, g, b)
    if lum >= 230 and sp < 20:
        return True
    if 170 <= lum <= 245 and sp < 25:
        return True
    if 135 <= lum <= 245 and 20 <= sp <= 150 and b > r - 30 and g > r - 40:
        return True
    # Cream / warm light gray backdrops common in exports
    if 185 <= lum <= 252 and sp < 38:
        return True
    return False


def _is_light_edge_bg_seed_aggressive(r: int, g: int, b: int) -> bool:
    """Broader seed for aggressive strip: light, low-saturation pixels typical of leftover matte."""
    if _is_checker_bg_pixel(r, g, b):
        return True
    lum = (r + g + b) / 3
    sp = max(r, g, b) - min(r, g, b)
    if lum >= 168 and sp < 62:
        return True
    if lum >= 145 and sp < 22:
        return True
    return False


def _strip_background_mask(
    rgb: np.ndarray,
    *,
    aggressive: bool = False,
    bg_color: np.ndarray | None = None,
) -> np.ndarray:
    """
    Return boolean mask True = background to remove (4-connected flood from edges).

    Flood threshold is anchored to `bg_color` (sampled from the image edge ring) rather than
    generic luminance/checker heuristics. A neighbor is added only when it is close to the
    sampled background color and close to the current pixel (prevents leaking across hard edges).
    """
    h, w = rgb.shape[:2]
    if bg_color is None:
        bg_color = _sample_bg_color(rgb)

    bg_tol = 90.0 if aggressive else 55.0
    step_tol = 52 if aggressive else 36

    visited = np.zeros((h, w), dtype=bool)
    q: deque[tuple[int, int]] = deque()

    def _is_bg(r: int, g: int, b: int) -> bool:
        px = np.array([r, g, b], dtype=np.float32)
        return _color_dist_to_bg(px, bg_color) < bg_tol

    for x in range(w):
        for y_edge in (0, h - 1):
            r, g, b = int(rgb[y_edge, x, 0]), int(rgb[y_edge, x, 1]), int(rgb[y_edge, x, 2])
            if _is_bg(r, g, b) and not visited[y_edge, x]:
                visited[y_edge, x] = True
                q.append((y_edge, x))
    for y in range(1, h - 1):
        for x_edge in (0, w - 1):
            r, g, b = int(rgb[y, x_edge, 0]), int(rgb[y, x_edge, 1]), int(rgb[y, x_edge, 2])
            if _is_bg(r, g, b) and not visited[y, x_edge]:
                visited[y, x_edge] = True
                q.append((y, x_edge))

    while q:
        y, x = q.popleft()
        for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            ny, nx = y + dy, x + dx
            if ny < 0 or ny >= h or nx < 0 or nx >= w or visited[ny, nx]:
                continue
            r1, g1, b1 = int(rgb[ny, nx, 0]), int(rgb[ny, nx, 1]), int(rgb[ny, nx, 2])
            if _is_bg(r1, g1, b1) and _color_dist_l1(rgb[y, x], rgb[ny, nx]) <= step_tol:
                visited[ny, nx] = True
                q.append((ny, nx))

    return visited


def _strip_interior_transparency_passes(
    arr: np.ndarray,
    *,
    bg_color: np.ndarray | None = None,
    aggressive: bool = False,
) -> None:
    """
    In-place RGBA uint8. BFS from transparent pixels into opaque neighbors — only removes a
    neighbor if it is close to the sampled bg_color (not generic luminance/saturation).
    """
    if bg_color is None:
        return

    bg_tol = 72.0 if aggressive else 48.0
    h, w = arr.shape[:2]
    a = arr[:, :, 3]

    q: deque[tuple[int, int]] = deque()
    for y in range(h):
        for x in range(w):
            if a[y, x] == 0:
                q.append((y, x))

    while q:
        y, x = q.popleft()
        for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            ny, nx = y + dy, x + dx
            if ny < 0 or ny >= h or nx < 0 or nx >= w or a[ny, nx] == 0:
                continue
            px = arr[ny, nx, :3].astype(np.float32)
            if _color_dist_to_bg(px, bg_color) < bg_tol:
                arr[ny, nx, 3] = 0
                q.append((ny, nx))


def _global_remove_checker_pixels_on_opaque(
    arr: np.ndarray,
    *,
    bg_color: np.ndarray | None = None,
    aggressive: bool = False,
) -> None:
    """
    In-place: clear opaque pixels that closely match the sampled background color.
    Tighter tolerance than flood/interior to avoid eating same-colored subject matter.
    """
    if bg_color is None:
        return

    bg_tol = 40.0 if aggressive else 28.0
    h, w = arr.shape[:2]
    for y in range(h):
        for x in range(w):
            if arr[y, x, 3] == 0:
                continue
            px = arr[y, x, :3].astype(np.float32)
            if _color_dist_to_bg(px, bg_color) < bg_tol:
                arr[y, x, 3] = 0


def _crop_alpha_bbox(icon: Image.Image, *, alpha_threshold: int = 8, pad: int = 2) -> Image.Image:
    """Crop to bounding box of opaque-ish pixels; trims halos after strip."""
    arr = np.asarray(icon.convert("RGBA"))
    if arr.ndim != 3 or arr.shape[2] < 4:
        return icon
    a = arr[:, :, 3]
    ys, xs = np.where(a > alpha_threshold)
    if ys.size == 0:
        return icon
    y0, y1 = int(ys.min()), int(ys.max()) + 1
    x0, x1 = int(xs.min()), int(xs.max()) + 1
    p = max(0, pad)
    h, w = arr.shape[:2]
    y0 = max(0, y0 - p)
    x0 = max(0, x0 - p)
    y1 = min(h, y1 + p)
    x1 = min(w, x1 + p)
    return icon.crop((x0, y0, x1, y1))


def _remove_connected_dark_center_blob(
    icon: Image.Image,
    *,
    max_rgb: int = 56,
    min_alpha_seed: int = 12,
    max_component_frac: float = 0.45,
    center_region_frac: float = 0.48,
    top_band_frac: float = 0.46,
) -> Image.Image:
    """
    Remove opaque near-black regions used as accidental fills or strips on hand-curated icons.

    Finds every 4-connected dark component (max channel <= max_rgb) that **touches** either:
      - a top horizontal band (rows 0 .. top_band_frac * height), or
      - a central rectangle (center_region_frac of width and height).

    Strips/holes under a handle often sit in the **upper** part of the canvas and never touch the
    middle band, so they were missed when only the center rectangle was used as a seed region.
    """
    arr = np.asarray(icon.convert("RGBA"))
    h, w = arr.shape[:2]
    if h < 4 or w < 4:
        return icon

    a = arr[:, :, 3].astype(np.int16)
    rgb = arr[:, :, :3]

    def is_dark(y: int, x: int) -> bool:
        if a[y, x] < min_alpha_seed:
            return False
        return int(rgb[y, x].max()) <= max_rgb

    margin_x = int(w * (1.0 - center_region_frac) / 2.0)
    margin_y = int(h * (1.0 - center_region_frac) / 2.0)
    rx0, rx1 = margin_x, w - margin_x
    ry0, ry1 = margin_y, h - margin_y

    cap = max(1, int(max_component_frac * h * w))
    assigned = np.zeros((h, w), dtype=bool)
    out = arr.copy()

    y_top = max(1, min(h, int(h * top_band_frac)))

    def process_seed(sy: int, sx: int) -> None:
        nonlocal assigned
        if assigned[sy, sx] or not is_dark(sy, sx):
            return
        q: deque[tuple[int, int]] = deque([(sy, sx)])
        visited = np.zeros((h, w), dtype=bool)
        visited[sy, sx] = True
        comp: list[tuple[int, int]] = []
        while q:
            y, x = q.popleft()
            comp.append((y, x))
            for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                ny, nx = y + dy, x + dx
                if ny < 0 or ny >= h or nx < 0 or nx >= w or visited[ny, nx]:
                    continue
                if assigned[ny, nx] or not is_dark(ny, nx):
                    continue
                visited[ny, nx] = True
                q.append((ny, nx))
        n = len(comp)
        if n <= cap:
            for y, x in comp:
                out[y, x, 3] = 0
        assigned |= visited

    for sy in range(0, y_top):
        for sx in range(w):
            process_seed(sy, sx)

    for sy in range(ry0, ry1):
        for sx in range(rx0, rx1):
            process_seed(sy, sx)

    return Image.fromarray(out, "RGBA")


def _remove_white_connected_to_edges(
    icon: Image.Image,
    *,
    min_channel: int = 222,
) -> Image.Image:
    """
    Clear alpha for near-white pixels that are 4-connected to the image border.

    Solid white mattes become transparent; white **inside** the subject stays if it is not
    connected to the outer white through other white pixels (same as classic edge flood).
    """
    arr = np.asarray(icon.convert("RGBA")).copy()
    h, w = arr.shape[:2]
    rgb = arr[:, :, :3]

    def is_near_white(y: int, x: int) -> bool:
        if arr[y, x, 3] < 8:
            return False
        r, g, b = int(rgb[y, x, 0]), int(rgb[y, x, 1]), int(rgb[y, x, 2])
        return r >= min_channel and g >= min_channel and b >= min_channel

    visited = np.zeros((h, w), dtype=bool)
    q: deque[tuple[int, int]] = deque()

    for x in range(w):
        for y in (0, h - 1):
            if is_near_white(y, x) and not visited[y, x]:
                visited[y, x] = True
                q.append((y, x))
    for y in range(1, h - 1):
        for x in (0, w - 1):
            if is_near_white(y, x) and not visited[y, x]:
                visited[y, x] = True
                q.append((y, x))

    while q:
        y, x = q.popleft()
        for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            ny, nx = y + dy, x + dx
            if ny < 0 or ny >= h or nx < 0 or nx >= w or visited[ny, nx]:
                continue
            if not is_near_white(ny, nx):
                continue
            visited[ny, nx] = True
            q.append((ny, nx))

    arr[visited, 3] = 0
    return Image.fromarray(arr, "RGBA")


def prepare_icon_rgba(
    icon: Image.Image,
    *,
    strip_bg: bool = True,
    strip_black_center: bool = False,
    strip_white_edge: bool = False,
    strip_size: int = 384,
    aggressive_strip: bool = False,
    crop_after_strip: bool = False,
) -> Image.Image:
    """
    Convert icon to RGBA and remove baked-in background using edge-ring–sampled color.

    If strip_white_edge: only remove near-white connected to image edges (solid white matte).
    If strip_black_center: only remove connected dark blob from center (no matte strip).
    Skips edge strip if edges are already transparent. Otherwise: sample bg from outer ring (median),
    edge flood-fill, interior BFS + global cleanup anchored to that color.
    aggressive_strip: looser tolerances (see icon_compose_overrides.json).
    crop_after_strip: tight alpha bbox crop (often paired with aggressive).
    """
    icon = icon.convert("RGBA")
    if strip_white_edge:
        return _remove_white_connected_to_edges(icon)
    if strip_black_center:
        return _remove_connected_dark_center_blob(icon)

    arr = np.asarray(icon)
    h, w = arr.shape[:2]
    edge_alpha = np.concatenate([arr[0, :, 3], arr[-1, :, 3], arr[:, 0, 3], arr[:, -1, 3]])
    if not strip_bg or (edge_alpha.mean() < 25 and edge_alpha.max() < 80):
        return icon

    rgb_full = np.array(icon.convert("RGB"))
    bg_color = _sample_bg_color(rgb_full)

    rgb_small = np.array(
        Image.fromarray(rgb_full).resize((strip_size, strip_size), Image.Resampling.LANCZOS)
    )
    visited_small = _strip_background_mask(
        rgb_small, aggressive=aggressive_strip, bg_color=bg_color
    )
    vis_full = (
        np.array(
            Image.fromarray((visited_small.astype(np.uint8) * 255)).resize(
                (w, h), Image.Resampling.NEAREST
            )
        )
        > 128
    )

    out = arr.copy()
    out[vis_full, 3] = 0
    for _ in range(2):
        _strip_interior_transparency_passes(out, bg_color=bg_color, aggressive=aggressive_strip)
        _global_remove_checker_pixels_on_opaque(out, bg_color=bg_color, aggressive=aggressive_strip)

    icon = Image.fromarray(out, "RGBA")
    if crop_after_strip and aggressive_strip:
        icon = _crop_alpha_bbox(icon)
    return icon


def _badge_filename_numeric_prefix(filename: str) -> int | None:
    """Leading ### from names like `361_the_special_teams_stan.png`; else None."""
    base = os.path.basename(filename)
    head = base.split("_", 1)[0]
    if head.isdigit():
        return int(head)
    return None


def chaos_tier_visibility_splash_filename(filename: str | None) -> bool:
    """True for chaos-tier badge icons 361–389 (numeric prefix)."""
    if not filename:
        return False
    n = _badge_filename_numeric_prefix(filename)
    if n is None:
        return False
    return CHAOS_TIER_SPLASH_ID_MIN <= n <= CHAOS_TIER_SPLASH_ID_MAX


def _np_alpha_over(dst: np.ndarray, src: np.ndarray) -> np.ndarray:
    """Porter-Duff source-over-destination. Both float or uint8 HxWx4."""
    d_rgb = dst[:, :, :3].astype(np.float32)
    s_rgb = src[:, :, :3].astype(np.float32)
    da = dst[:, :, 3:4].astype(np.float32) / 255.0
    sa = src[:, :, 3:4].astype(np.float32) / 255.0
    out_a = sa + da * (1.0 - sa)
    out_a_safe = np.maximum(out_a, 1e-4)
    out_rgb = (s_rgb * sa + d_rgb * da * (1.0 - sa)) / out_a_safe
    return np.dstack(
        [
            np.clip(out_rgb, 0, 255).astype(np.uint8),
            np.clip(out_a * 255.0, 0, 255).astype(np.uint8),
        ]
    )


def _gaussian_blur_mask_u8(mask_u8: np.ndarray, radius: float) -> np.ndarray:
    """Blur a single-channel uint8 mask; returns float32 0..255. Isotropic blur → smooth rounded contours."""
    im = Image.fromarray(np.clip(mask_u8, 0, 255).astype(np.uint8), "L")
    return np.array(im.filter(ImageFilter.GaussianBlur(radius)), dtype=np.float32)


def _solid_plate_alpha_from_smooth_mask(
    m: np.ndarray,
    *,
    norm_floor: float = 0.055,
    edge_power: float = 2.4,
    opaque_alpha: float = 255.0,
) -> np.ndarray:
    """
    Turn a soft Gaussian mask into a plate: interior uses peak alpha `opaque_alpha`, outer fringe
    ramps down for smooth rounded anti-aliased edges. `m` is nonnegative; normalized by its peak.
    """
    m = np.asarray(m, dtype=np.float32)
    peak = float(m.max())
    if peak < 1e-6:
        return np.zeros_like(m, dtype=np.float32)
    n = m / peak
    t = np.clip(n / max(norm_floor, 1e-6), 0.0, 1.0)
    feather = (t**edge_power) * opaque_alpha
    return np.clip(np.where(n >= norm_floor, opaque_alpha, feather), 0, 255)


def apply_chaos_tier_icon_visibility_splash(
    icon: Image.Image,
    *,
    plate_rgb: tuple[int, int, int] = CHAOS_SPLASH_PLATE_RGB_DEFAULT,
    # Smaller blurs = splash hugs the icon more closely (still rounded — Gaussian only).
    outer_round_blur: float = 1.35,
    outer_halo_blur: float = 3.6,
    solid_norm_floor: float = 0.065,
    solid_edge_power: float = 2.2,
    # Peak alpha < 255 keeps the plate faded but still visible on the dark chaos template.
    plate_opaque_alpha: float = 120.0,
) -> Image.Image:
    """
    Rounded splash plate behind the icon: muted purple tint with a capped peak alpha (faded wash),
    tight to the silhouette; smooth alpha only on the outer boundary.
    """
    icon = icon.convert("RGBA")
    w, h = icon.size
    if w < 2 or h < 2:
        return icon

    max_r = outer_halo_blur + outer_round_blur
    pad = max(32, int(max_r * 2.9) + 18)
    cw, ch = w + 2 * pad, h + 2 * pad
    canvas = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    canvas.paste(icon, (pad, pad), icon)

    a = np.array(canvas.split()[3])
    sil_u8 = ((a > 12).astype(np.uint8)) * 255

    m_seed = _gaussian_blur_mask_u8(sil_u8, outer_round_blur)
    m_plate = _gaussian_blur_mask_u8(np.clip(m_seed, 0, 255).astype(np.uint8), outer_halo_blur)
    alpha_plate = _solid_plate_alpha_from_smooth_mask(
        m_plate,
        norm_floor=solid_norm_floor,
        edge_power=solid_edge_power,
        opaque_alpha=plate_opaque_alpha,
    )

    plate = np.zeros((ch, cw, 4), dtype=np.float32)
    plate[:, :, 0] = float(plate_rgb[0])
    plate[:, :, 1] = float(plate_rgb[1])
    plate[:, :, 2] = float(plate_rgb[2])
    plate[:, :, 3] = alpha_plate

    icon_np = np.array(canvas).astype(np.float32)
    out = np.zeros((ch, cw, 4), dtype=np.float32)
    out = _np_alpha_over(out, plate)
    out = _np_alpha_over(out, icon_np)

    return Image.fromarray(out, "RGBA")


def draw_archetype_name_on_gold_ribbon(
    img: Image.Image,
    name: str,
    template_basename: str,
    *,
    font_path: str | None = None,
    max_font_size: int = 48,
    min_font_size: int = 9,
    ribbon_fill: bool = False,
    debug_ribbon_outline: bool = False,
) -> None:
    """Draw archetype name on the ribbon. Optional solid fill for legacy PNGs with baked-in text."""
    ycf, hhf, xmf = RIBBON_LAYOUT.get(template_basename, _DEFAULT_RIBBON)
    w, h = img.size
    yc = int(h * ycf)
    hh = max(1, int(h * hhf))
    xm = int(w * xmf)
    draw = ImageDraw.Draw(img)
    arr = np.asarray(img)

    y0, y1 = max(0, yc - hh), min(h, yc + hh + 1)
    if ribbon_fill:
        x1 = min(w, xm + 24)
        patch = arr[y0:y1, xm:x1, :3]
        if patch.size == 0:
            fill_rgb = (200, 170, 120)
        else:
            med = np.median(patch.reshape(-1, 3), axis=0)
            fill_rgb = tuple(np.clip(med, 0, 255).astype(int).tolist())
        draw.rectangle([xm, y0, w - xm, y1], fill=fill_rgb + (255,))

    box_w = w - 2 * xm
    banner_h = y1 - y0
    pad_x = RIBBON_TEXT_PAD_X
    pad_y = RIBBON_TEXT_PAD_Y
    max_text_w = max(40.0, box_w - 2 * pad_x)
    usable_h = max(float(min_font_size), banner_h - 2 * pad_y)
    spacing = 1
    fill = (255, 255, 255, 255)
    stroke = (45, 30, 15, 255)
    # Prefer the largest size that still fits inside the ribbon height (after vertical inset).
    cap_by_height = max(min_font_size, int((usable_h - 2) * 0.95))
    eff_max_font = min(max_font_size, cap_by_height)

    def measure_lines(lines: list[str], fs: int) -> tuple[float, float]:
        font = _load_font(fs, font_path)
        sw = max(1, min(4, round(fs / 11)))
        max_line_w = 0.0
        total_h = 0.0
        for i, line in enumerate(lines):
            bbox = draw.textbbox((0, 0), line, font=font, stroke_width=sw)
            lw = bbox[2] - bbox[0]
            lh = bbox[3] - bbox[1]
            max_line_w = max(max_line_w, lw)
            total_h += lh
            if i < len(lines) - 1:
                total_h += spacing
        return max_line_w, total_h

    def fits(mw: float, mh: float) -> bool:
        return mw <= max_text_w + 0.5 and mh <= usable_h + 1.0

    def two_line_splits() -> list[tuple[str, str]]:
        words = name.split()
        if len(words) < 2:
            return []
        n = len(words)
        # Try breaks nearest the middle first so lines stay balanced when wrapping.
        ks = sorted(range(1, n), key=lambda k: abs(k - n / 2.0))
        return [(" ".join(words[:k]), " ".join(words[k:])) for k in ks]

    def find_best_layout() -> tuple[list[str], int]:
        splits = two_line_splits()
        for fs in range(eff_max_font, min_font_size - 1, -1):
            mw, mh = measure_lines([name], fs)
            if fits(mw, mh):
                return [name], fs
            for a, b in splits:
                lines = [a, b]
                mw2, mh2 = measure_lines(lines, fs)
                if fits(mw2, mh2):
                    return lines, fs

        words = name.split()
        if len(words) >= 2:
            k = max(1, len(words) // 2)
            lines = [" ".join(words[:k]), " ".join(words[k:])]
        else:
            raw = textwrap.wrap(name, width=14)
            lines = raw[:2] if raw else [name]
            if len(lines) < 2 and len(name) > 18:
                lines = [name[:18] + "…"]
        return lines, min_font_size

    lines, font_size = find_best_layout()
    font = _load_font(font_size, font_path)
    _, total_h = measure_lines(lines, font_size)
    y_line_top = y0 + pad_y + max(0, int((usable_h - total_h) // 2))

    for line in lines:
        stroke_w = max(1, min(4, round(font_size / 11)))
        bbox = draw.textbbox((0, 0), line, font=font, stroke_width=stroke_w)
        line_h = bbox[3] - bbox[1]
        cy = y_line_top + line_h / 2.0
        draw.text(
            (w / 2, cy),
            line,
            font=font,
            fill=fill,
            stroke_width=stroke_w,
            stroke_fill=stroke,
            anchor="mm",
        )
        y_line_top += line_h + spacing

    if debug_ribbon_outline:
        draw.rectangle(
            [xm, y0, w - xm - 1, y1 - 1],
            outline=(255, 0, 255, 255),
            width=2,
        )


# badge_background or rb_strategy → filename in backgrounds/ (prefer .svg)
BACKGROUND_MAP = {
    "best_player_available": "best_player_available.svg",
    "BPA": "best_player_available.svg",
    "hero_rb": "hero_rb.svg",
    "Hero RB": "hero_rb.svg",
    "robust_rb": "robust_rb.svg",
    "Robust RB": "robust_rb.svg",
    "zero_rb": "zero_rb.svg",
    "Zero RB": "zero_rb.svg",
    "hybrid": "hybrid.svg",
    "Hybrid": "hybrid.svg",
    "chaos_tier": "chaos.svg",
    "Chaos Tier": "chaos.svg",
}


def resolve_background_path(preferred: str) -> tuple[str | None, str]:
    """
    Return (path, source_tag). source_tag is 'svg', 'png', 'png_fallback' (svg missing),
    or 'missing'.
    """
    if os.path.isfile(preferred):
        low = preferred.lower()
        if low.endswith(".svg"):
            return preferred, "svg"
        return preferred, "png"
    if preferred.lower().endswith(".svg"):
        png = preferred[:-4] + ".png"
        if os.path.isfile(png):
            return png, "png_fallback"
    return None, "missing"


def get_background_path(entry: dict) -> tuple[str | None, str]:
    bg = entry.get("badge_background")
    key = bg if bg and bg in BACKGROUND_MAP else None
    if not key:
        strat = entry.get("rb_strategy")
        if strat and strat in BACKGROUND_MAP:
            key = strat
        else:
            return None, "missing"
    p = os.path.join(BACKGROUNDS_DIR, BACKGROUND_MAP[key])
    return resolve_background_path(p)


def explain_background_choice(entry: dict) -> str:
    """Human-readable reason for which template key was used (for --verbose)."""
    bg = entry.get("badge_background")
    if bg and bg in BACKGROUND_MAP:
        return f"badge_background={bg!r} -> {BACKGROUND_MAP[bg]}"
    strat = entry.get("rb_strategy")
    if strat and strat in BACKGROUND_MAP:
        return f"rb_strategy={strat!r} -> {BACKGROUND_MAP[strat]}"
    return "?"


def get_template_basename(entry: dict) -> str | None:
    bg = entry.get("badge_background")
    if bg and bg in BACKGROUND_MAP:
        return BACKGROUND_MAP[bg]
    strat = entry.get("rb_strategy")
    if strat and strat in BACKGROUND_MAP:
        return BACKGROUND_MAP[strat]
    return None


def composite_badge(
    icon_path: str,
    background_path: str,
    output_path: str,
    icon_scale: float = 0.52,
    icon_y_offset: int = 0,
    *,
    archetype_name: str | None = None,
    draw_name: bool = True,
    font_path: str | None = None,
    template_basename: str | None = None,
    icon_filename: str | None = None,
    strip_bg: bool = True,
    strip_size: int = 384,
    strip_badge_scene: bool = False,
    ribbon_fill: bool = False,
    debug_ribbon: bool = False,
    use_compose_overrides: bool = True,
) -> bool:
    if not os.path.isfile(icon_path):
        return False
    if not background_path or not os.path.isfile(background_path):
        return False

    agg_filenames, no_strip_filenames, black_center_filenames, white_edge_filenames, file_overrides = (
        _compose_overrides()
        if use_compose_overrides
        else (frozenset(), frozenset(), frozenset(), frozenset(), {})
    )
    base_fn = icon_filename or os.path.basename(icon_path)
    use_no_strip = use_compose_overrides and base_fn in no_strip_filenames
    use_black_center = use_compose_overrides and base_fn in black_center_filenames
    use_white_edge = use_compose_overrides and base_fn in white_edge_filenames
    effective_strip = strip_bg and not use_no_strip and not use_black_center and not use_white_edge
    use_aggressive = (
        effective_strip
        and base_fn in agg_filenames
        and use_compose_overrides
    )
    ov = file_overrides.get(base_fn, {}) if use_compose_overrides else {}
    scale_mult = float(ov.get("scale_mult", 1.0))
    y_extra = int(ov.get("y_extra", 0))
    x_extra = int(ov.get("x_extra", 0))

    icon = Image.open(icon_path)
    icon = prepare_icon_rgba(
        icon,
        strip_bg=effective_strip,
        strip_black_center=strip_bg and use_black_center,
        strip_white_edge=strip_bg and use_white_edge,
        strip_size=strip_size,
        aggressive_strip=use_aggressive,
        crop_after_strip=use_aggressive,
    )

    try:
        bg = load_background_rgba(background_path)
    except RuntimeError:
        return False
    if strip_badge_scene:
        bg = strip_badge_scene_edges(bg)
    bw, bh = bg.size
    iw, ih = icon.size

    effective_scale = icon_scale * scale_mult
    target_size = int(bw * effective_scale)
    scale = target_size / max(iw, ih)
    new_iw = int(iw * scale)
    new_ih = int(ih * scale)
    icon_resized = icon.resize((new_iw, new_ih), Image.Resampling.LANCZOS)
    if chaos_tier_visibility_splash_filename(base_fn):
        icon_resized = apply_chaos_tier_icon_visibility_splash(icon_resized)

    pw, ph = icon_resized.size
    cx = (bw - pw) // 2
    if template_basename and template_basename in ICON_VERTICAL_BAND_420:
        t420, b420 = ICON_VERTICAL_BAND_420[template_basename]
        y_off = (BADGE_H - SVG_LAYOUT_DOC_HEIGHT) // 2
        t_comp = t420 + y_off
        b_comp = b420 + y_off
        # Midpoint of inclusive band; icon center (cy + ph/2) aligns to y_mid.
        y_mid = (t_comp + b_comp) / 2.0
        cy = int(round(y_mid - ph / 2.0)) + icon_y_offset + y_extra
    else:
        cy = (bh - ph) // 2 + icon_y_offset + y_extra
    bg.paste(icon_resized, (cx + x_extra, cy), icon_resized)

    if draw_name and archetype_name and template_basename:
        draw_archetype_name_on_gold_ribbon(
            bg,
            archetype_name,
            template_basename,
            font_path=font_path,
            ribbon_fill=ribbon_fill,
            debug_ribbon_outline=debug_ribbon,
        )

    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
    bg.save(output_path, "PNG")
    return True


def main() -> None:
    parser = argparse.ArgumentParser(description="Build composed archetype badges.")
    parser.add_argument(
        "--ids",
        type=str,
        default="",
        help="Comma-separated filenames to build (e.g. 001_the_captain.png). Default: all.",
    )
    parser.add_argument(
        "--ids-file",
        type=str,
        default="",
        help=(
            "Path to a text file: comma- and/or newline-separated filenames to build. "
            "Merged with --ids if both are set."
        ),
    )
    parser.add_argument(
        "--scale",
        type=float,
        default=0.52,
        help="Icon size as fraction of badge width. Some templates override (see ICON_SCALE_BY_TEMPLATE).",
    )
    parser.add_argument(
        "--y-offset",
        type=int,
        default=0,
        help=(
            "Extra vertical shift after placement (pixels; positive = down). "
            "Band templates center the icon on (T+B)/2; this nudges from there. "
            "ICON_Y_OFFSET_BY_TEMPLATE adds per template."
        ),
    )
    parser.add_argument("--dry-run", action="store_true", help="Print actions without writing files.")
    parser.add_argument("--no-name", action="store_true", help="Do not draw archetype name on the ribbon.")
    parser.add_argument("--font", type=str, default="", help="Path to a .ttf font for ribbon text.")
    parser.add_argument(
        "--no-strip-bg",
        action="store_true",
        help="Do not remove checkerboard/light backgrounds from icons.",
    )
    parser.add_argument(
        "--strip-size",
        type=int,
        default=384,
        help="Working size for background strip (smaller = faster; default 384).",
    )
    parser.add_argument(
        "--strip-badge-scene",
        action="store_true",
        help="Remove dark pixels connected to badge edges (partial stadium removal; see docs).",
    )
    parser.add_argument(
        "--ribbon-fill",
        action="store_true",
        help="Paint a solid band behind ribbon text (for legacy PNGs with baked-in labels).",
    )
    parser.add_argument(
        "--debug-ribbon",
        action="store_true",
        help="Draw a magenta rectangle around the ribbon layout box on each composed badge (for tuning).",
    )
    parser.add_argument(
        "--print-bg-sizes",
        action="store_true",
        help="Print each background SVG's page size and scale to the composed image, then exit.",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help=(
            "For each badge: print [svg|png|png_fallback], JSON mapping (rb_strategy or "
            "badge_background), and the absolute path to the background file."
        ),
    )
    parser.add_argument(
        "--convert-ribbon",
        nargs=5,
        metavar=("SVG", "LEFT", "TOP", "RIGHT", "BOTTOM"),
        help=(
            "Print RIBBON_LAYOUT (y_center_frac, half_height_frac, x_margin_frac) from a ribbon "
            "rectangle in that SVG's user units (left top right bottom). SVG may be a basename under "
            "backgrounds/ or a full path. Then exit."
        ),
    )
    parser.add_argument(
        "--no-compose-overrides",
        action="store_true",
        help="Ignore archetype_logic/badge images/icon_compose_overrides.json (strip modes + per-file scale/y).",
    )
    args = parser.parse_args()

    if args.print_bg_sizes:
        print_background_svg_sizes()
        return

    if args.convert_ribbon:
        svg_arg, l_s, t_s, r_s, b_s = args.convert_ribbon
        path = svg_arg
        if not os.path.isfile(path):
            path = os.path.join(BACKGROUNDS_DIR, svg_arg)
        if not os.path.isfile(path):
            print(f"SVG not found: {svg_arg}")
            return
        try:
            tup = svg_ribbon_aabb_to_layout_fractions(
                path, float(l_s), float(t_s), float(r_s), float(b_s)
            )
        except Exception as e:
            print(f"Conversion failed: {e}")
            return
        print("RIBBON_LAYOUT tuple (y_center_frac, half_height_frac, x_margin_frac):")
        print(f"  {tup[0]:.12f}, {tup[1]:.12f}, {tup[2]:.12f}")
        print("Paste into build_badges.py, e.g.:")
        print(f'  "your_template.svg": ({tup[0]}, {tup[1]}, {tup[2]}),')
        return

    with open(JSON_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    combined = list(data.get("archetypes", [])) + list(data.get("chaos_archetypes", []))

    def _parse_id_list(raw: str) -> set[str]:
        out: set[str] = set()
        for line in raw.replace("\r\n", "\n").replace("\r", "\n").replace(",", "\n").split("\n"):
            t = line.strip()
            if t:
                out.add(t)
        return out

    id_set = _parse_id_list(args.ids)
    if args.ids_file:
        path = args.ids_file
        if not os.path.isfile(path):
            print(f"ids-file not found: {path}", file=sys.stderr)
            sys.exit(1)
        with open(path, encoding="utf-8") as f:
            id_set |= _parse_id_list(f.read())
    if id_set:
        by_name = {e["filename"]: e for e in combined if e.get("filename")}
        entries = [by_name[f] for f in id_set if f in by_name]
    else:
        entries = combined

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    built = 0
    skipped = 0
    png_fallback_paths: set[str] = set()

    for entry in entries:
        filename = entry.get("filename")
        if not filename:
            continue

        icon_path = os.path.join(ICONS_DIR, filename)
        background_path, bg_tag = get_background_path(entry)
        template_base = get_template_basename(entry)

        if bg_tag == "png_fallback" and background_path:
            png_fallback_paths.add(background_path)

        if args.verbose and background_path:
            print(f"  [{bg_tag}] {filename}")
            print(f"         {explain_background_choice(entry)}")
            print(f"         {background_path}")

        if not background_path:
            print(f"Skip (no background): {filename}")
            skipped += 1
            continue

        output_path = os.path.join(OUTPUT_DIR, filename)

        if args.dry_run:
            print(f"Would build: {filename} -> {output_path}")
            built += 1
            continue

        if composite_badge(
            icon_path,
            background_path,
            output_path,
            icon_scale=icon_scale_for_template(template_base, args.scale),
            icon_y_offset=icon_y_offset_for_template(template_base, args.y_offset),
            archetype_name=get_ribbon_label(entry),
            draw_name=not args.no_name,
            font_path=args.font or None,
            template_basename=template_base,
            icon_filename=filename,
            strip_bg=not args.no_strip_bg,
            strip_size=args.strip_size,
            strip_badge_scene=args.strip_badge_scene,
            ribbon_fill=args.ribbon_fill,
            debug_ribbon=args.debug_ribbon,
            use_compose_overrides=not args.no_compose_overrides,
        ):
            built += 1
            print(f"Built: {filename}")
        else:
            print(f"Skip (missing icon): {filename}")
            skipped += 1

    print(f"\nDone. Built: {built}, Skipped: {skipped}")
    print(f"Output: {OUTPUT_DIR}")
    if png_fallback_paths:
        print(
            "\nWarning: expected .svg was missing; these PNG fallbacks were used "
            "(often legacy art with a baked background):",
            file=sys.stderr,
        )
        for p in sorted(png_fallback_paths):
            print(f"  {p}", file=sys.stderr)


if __name__ == "__main__":
    main()
