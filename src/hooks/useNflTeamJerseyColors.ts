import type { CSSProperties } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { teamFieldToAbbr } from '@/utils/teamMapping';

const QUERY_KEY = ['nfl-teams', 'jersey-colors'] as const;

export type TeamJerseyColorsRow = {
  /** Primary (`teams.team_color`) */
  color1: string | null;
  color2: string;
  color3: string | null;
};

function isHexColor(t: string): boolean {
  return /^#[0-9A-Fa-f]{3}$/.test(t) || /^#[0-9A-Fa-f]{6}$/.test(t) || /^#[0-9A-Fa-f]{8}$/.test(t);
}

/** Normalize #RGB → #RRGGBB for comparison */
function expandHex(hex: string): string {
  const t = hex.trim();
  if (/^#[0-9A-Fa-f]{3}$/.test(t)) {
    return `#${t[1]}${t[1]}${t[2]}${t[2]}${t[3]}${t[3]}`.toLowerCase();
  }
  return t.toLowerCase();
}

/** True for #000, #000000, #000000ff, etc. */
function isBlackHex(hex: string): boolean {
  const e = expandHex(hex);
  if (e === '#000000') return true;
  if (e.length === 9 && e.startsWith('#') && e.slice(1, 7) === '000000') return true;
  return false;
}

function applyAbbrAliases(map: Record<string, TeamJerseyColorsRow>) {
  const pairs: [string, string][] = [
    ['LA', 'LAR'],
    ['JAX', 'JAC'],
    ['WAS', 'WSH'],
  ];
  for (const [a, b] of pairs) {
    if (map[a] && !map[b]) map[b] = { ...map[a] };
    if (map[b] && !map[a]) map[a] = { ...map[b] };
  }
}

async function fetchTeamJerseyColorsByAbbr(): Promise<Record<string, TeamJerseyColorsRow>> {
  const { data, error } = await supabase
    .from('teams')
    .select('team_abbr, team_color, team_color2, team_color3');
  if (error) throw error;
  const out: Record<string, TeamJerseyColorsRow> = {};
  for (const row of data ?? []) {
    const abbr = (row as { team_abbr?: string | null }).team_abbr?.trim().toUpperCase();
    const raw1 = (row as { team_color?: string | null }).team_color?.trim();
    const raw2 = (row as { team_color2?: string | null }).team_color2?.trim();
    const raw3 = (row as { team_color3?: string | null }).team_color3?.trim();
    if (!abbr || !raw2 || !isHexColor(raw2)) continue;
    const color1 = raw1 && isHexColor(raw1) ? raw1 : null;
    const color3 = raw3 && isHexColor(raw3) ? raw3 : null;
    out[abbr] = { color1, color2: raw2, color3 };
  }
  applyAbbrAliases(out);
  return out;
}

function parseHexRgb(hex: string): [number, number, number] | null {
  const t = hex.trim();
  if (/^#[0-9A-Fa-f]{3}$/.test(t)) {
    return [
      parseInt(t[1] + t[1], 16),
      parseInt(t[2] + t[2], 16),
      parseInt(t[3] + t[3], 16),
    ];
  }
  if (/^#[0-9A-Fa-f]{6}$/.test(t)) {
    return [parseInt(t.slice(1, 3), 16), parseInt(t.slice(3, 5), 16), parseInt(t.slice(5, 7), 16)];
  }
  if (/^#[0-9A-Fa-f]{8}$/.test(t)) {
    return [parseInt(t.slice(1, 3), 16), parseInt(t.slice(3, 5), 16), parseInt(t.slice(5, 7), 16)];
  }
  return null;
}

function relativeLuminance(hex: string): number {
  const rgb = parseHexRgb(hex);
  if (!rgb) return 0.45;
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function pickContrastOnSplit(left: string, right: string): string {
  const L = relativeLuminance(left) * 0.55 + relativeLuminance(right) * 0.45;
  return L > 0.52 ? '#0f172a' : '#f8fafc';
}

/**
 * Pick Six share card: **center 55%** (22.5–77.5%) is solid `teams.team_color`; **outer 22.5% on each side**
 * fades from `teams.team_color2` at the edges into primary (symmetric “bookend” gradients).
 * Text contrast uses ~55% / ~45% primary vs secondary luminance.
 * If `team_color` is missing, both ends use `team_color2` (solid).
 * Returns `undefined` when the team is unknown / FA / missing from `teams`, or `team_color2` is invalid.
 */
export function getPickSixPlayerSurfaceStyle(
  byAbbr: Record<string, TeamJerseyColorsRow> | undefined,
  team: string | null | undefined
): CSSProperties | undefined {
  const abbr = teamFieldToAbbr(team);
  if (!abbr || !byAbbr) return undefined;
  const row = byAbbr[abbr];
  if (!row) return undefined;
  const raw2 = row.color2;
  if (!raw2 || !isHexColor(raw2)) return undefined;
  const right = raw2.trim();
  const raw1 = row.color1;
  const left = raw1 && isHexColor(raw1) ? raw1.trim() : right;
  const fg = pickContrastOnSplit(left, right);
  return {
    background: `linear-gradient(90deg, ${right} 0%, ${left} 22.5%, ${left} 77.5%, ${right} 100%)`,
    color: fg,
    borderColor: fg === '#f8fafc' ? 'rgba(255,255,255,0.22)' : 'rgba(15,23,42,0.18)',
    borderWidth: 1,
    borderStyle: 'solid',
    textShadow:
      fg === '#f8fafc'
        ? '0 1px 2px rgba(0,0,0,0.35)'
        : '0 1px 0 rgba(255,255,255,0.25)',
  };
}

/**
 * Cached map of NFL team abbreviation → `teams.team_color2` / `team_color3` for jersey number fill.
 */
export function useNflTeamJerseyColors() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchTeamJerseyColorsByAbbr,
    staleTime: 1000 * 60 * 60 * 24,
  });
}

/**
 * Interior fill for SVG numbers: `team_color2`, or `team_color3` when color2 is black (avoids black-on-black fill).
 */
export function lookupJerseyNumberFill(
  byAbbr: Record<string, TeamJerseyColorsRow> | undefined,
  team: string | null | undefined
): string {
  if (!byAbbr || team == null) return '#FFFFFF';
  const raw = team.trim().toUpperCase();
  if (!raw || raw === 'FA') return '#FFFFFF';
  /** Buccaneers: white number fill (matches jersey art; DB secondary is often red/pewter). */
  if (raw === 'TB') return '#FFFFFF';
  /** Browns: white number fill on brown jerseys (not secondary / orange from DB). */
  if (raw === 'CLE') return '#FFFFFF';
  const entry = byAbbr[raw];
  if (!entry) return '#FFFFFF';
  const { color2, color3 } = entry;
  if (isBlackHex(color2)) {
    if (color3 && !isBlackHex(color3)) return color3;
    return '#FFFFFF';
  }
  return color2;
}
