import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const QUERY_KEY = ['nfl-teams', 'jersey-colors'] as const;

export type TeamJerseyColorsRow = {
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
    .select('team_abbr, team_color2, team_color3');
  if (error) throw error;
  const out: Record<string, TeamJerseyColorsRow> = {};
  for (const row of data ?? []) {
    const abbr = (row as { team_abbr?: string | null }).team_abbr?.trim().toUpperCase();
    const raw2 = (row as { team_color2?: string | null }).team_color2?.trim();
    const raw3 = (row as { team_color3?: string | null }).team_color3?.trim();
    if (!abbr || !raw2 || !isHexColor(raw2)) continue;
    const color3 = raw3 && isHexColor(raw3) ? raw3 : null;
    out[abbr] = { color2: raw2, color3 };
  }
  applyAbbrAliases(out);
  return out;
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
