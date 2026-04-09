/**
 * Recolors `empty_football_jersey.svg` paths by `inkscape:label`.
 *
 * At runtime, colors always come from the DB via JerseyIcon: `team_color` (primary),
 * `team_color2` (secondary), `team_color3` (tertiary). There are no baked-in team hexes.
 *
 * Inkscape’s `primary_color` / `secondary_color` labels are swapped vs our DB meaning: the
 * large jersey body paths are labeled `secondary_color`, and accent panels `primary_color`.
 * We map `secondary_color` → `team_color` and `primary_color` → `team_color2` so the body
 * uses the team’s primary and accents use the secondary.
 *
 * Derived shades apply fixed HSL *deltas* that were calibrated once from a reference design
 * (so shadows/edges behave like that artwork); those deltas are applied to whatever
 * primary/tertiary the player’s team has in the database.
 */

const INKSCAPE_NS = 'http://www.inkscape.org/namespaces/inkscape';

const FIXED_FILL: Record<string, string> = {
  white_stripe: '#f2ecd3',
  base_grey: '#a0a3a5',
  grey_shade: '#5b5960',
  black_outline_shade: '#314a5e',
  blackoutline2: '#203144',
};

const DERIVED_SHADE: Record<
  string,
  { source: 'primary' | 'tertiary'; dH: number; dS: number; dL: number }
> = {
  shadows1: { source: 'primary', dH: 4.08, dS: -47.56, dL: 9.22 },
  primary_shade: { source: 'primary', dH: -13.13, dS: -18.49, dL: -5.69 },
  outline_shade: { source: 'primary', dH: -17.576, dS: -47.57, dL: -14.71 },
  maroon_outline: { source: 'primary', dH: -32.776, dS: -55.06, dL: -38.43 },
  tirtiary_shade: { source: 'tertiary', dH: 3.08, dS: -10.12, dL: -10.98 },
};

function clamp(n: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, n));
}

function clampByte(n: number): number {
  return clamp(Math.round(n), 0, 255);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let h = hex.replace('#', '').toLowerCase();
  if (h.length === 8) h = h.slice(0, 6);
  if (h.length === 3) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  }
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  return (
    '#' +
    [r, g, b]
      .map((x) => clampByte(x).toString(16).padStart(2, '0'))
      .join('')
  );
}

/** H,S,L with H in [0,360), S and L in [0,100]. */
function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      default:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hue2rgb(p: number, q: number, t: number): number {
  let tt = t;
  if (tt < 0) tt += 1;
  if (tt > 1) tt -= 1;
  if (tt < 1 / 6) return p + (q - p) * 6 * tt;
  if (tt < 1 / 2) return q;
  if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
  return p;
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  h = ((h % 360) + 360) % 360;
  s = clamp(s, 0, 100) / 100;
  l = clamp(l, 0, 100) / 100;
  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hn = h / 360;
  return {
    r: Math.round(hue2rgb(p, q, hn + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, hn) * 255),
    b: Math.round(hue2rgb(p, q, hn - 1 / 3) * 255),
  };
}

function applyHslDeltaFromBase(hex: string, dH: number, dS: number, dL: number): string {
  const { r, g, b } = hexToRgb(hex);
  const { h, s, l } = rgbToHsl(r, g, b);
  const nh = ((h + dH) % 360 + 360) % 360;
  const ns = clamp(s + dS, 0, 100);
  const nl = clamp(l + dL, 0, 100);
  const out = hslToRgb(nh, ns, nl);
  return rgbToHex(out.r, out.g, out.b);
}

function getInkscapeLabel(el: Element): string | null {
  const byNs = el.getAttributeNS(INKSCAPE_NS, 'label');
  if (byNs) return byNs;
  const legacy = el.getAttribute('inkscape:label');
  if (legacy) return legacy;
  return null;
}

function setPathFill(el: Element, color: string): void {
  let style = el.getAttribute('style') || '';
  if (/fill\s*:/i.test(style)) {
    style = style.replace(/fill\s*:\s*#[0-9a-fA-F]{3,8}/i, `fill:${color}`);
  } else {
    style = style ? `${style};fill:${color}` : `fill:${color}`;
  }
  el.setAttribute('style', style);
}

function resolveLabelColor(
  label: string,
  primary: string,
  secondary: string,
  tertiary: string
): string | null {
  const derived = DERIVED_SHADE[label];
  if (derived) {
    const base = derived.source === 'primary' ? primary : tertiary;
    return applyHslDeltaFromBase(base, derived.dH, derived.dS, derived.dL);
  }

  switch (label) {
    case 'secondary_color':
      return primary;
    case 'primary_color':
      return secondary;
    case 'tirciary_color':
      return tertiary;
    case 'white_stripe':
    case 'base_grey':
    case 'grey_shade':
    case 'black_outline_shade':
    case 'blackoutline2':
      return FIXED_FILL[label] ?? null;
    default:
      return null;
  }
}

export function recolorJerseyByInkscapeLabels(
  svgMarkup: string,
  primary: string,
  secondary: string,
  tertiary: string
): string {
  if (typeof DOMParser === 'undefined' || typeof XMLSerializer === 'undefined') {
    return svgMarkup;
  }

  const doc = new DOMParser().parseFromString(svgMarkup, 'image/svg+xml');
  const parseErr = doc.querySelector('parsererror');
  if (parseErr) {
    console.warn('[jerseyRecolorByLabel] SVG parse failed, using raw markup');
    return svgMarkup;
  }

  const paths = doc.querySelectorAll('path');
  paths.forEach((path) => {
    const label = getInkscapeLabel(path);
    if (!label) return;
    const color = resolveLabelColor(label, primary, secondary, tertiary);
    if (color) setPathFill(path, color);
  });

  const root = doc.documentElement;
  return new XMLSerializer().serializeToString(root);
}

export function parseSvgViewBox(svg: string): string {
  const m = svg.match(/viewBox="([^"]+)"/i);
  return m ? m[1].trim() : '0 0 383 384';
}
