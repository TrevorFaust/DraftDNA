import { newsletterDb } from '@/lib/newsletter/db';

/** NFL roster position groups treated as defensive for DROY. */
export const DEFENSIVE_ROOKIE_ROSTER_POSITIONS = [
  'DL',
  'DE',
  'DT',
  'NT',
  'LB',
  'OLB',
  'ILB',
  'MLB',
  'DB',
  'CB',
  'S',
  'FS',
  'SS',
  'EDGE',
] as const;

export type DefensiveRookie = {
  /** Stable id for award picks (gsis when available). */
  id: string;
  name: string;
  position: string;
  team: string | null;
  status: string | null;
};

function normalizeDisplayPosition(pos: string): string {
  const p = (pos || '').toUpperCase();
  if (p === 'DE' || p === 'EDGE') return 'EDGE';
  if (p === 'DT' || p === 'NT' || p === 'DL') return 'DL';
  if (p === 'OLB' || p === 'ILB' || p === 'MLB') return 'LB';
  if (p === 'CB') return 'CB';
  if (p === 'FS' || p === 'SS' || p === 'S') return 'S';
  if (p === 'DB') return 'DB';
  return p || 'DEF';
}

/**
 * 2026 defensive rookies for Season Predictions DROY only.
 * Sourced from `rosters_2026` — never used by mock draft / baseline_rookies.
 */
export async function fetchDefensiveRookies2026(): Promise<DefensiveRookie[]> {
  const { data, error } = await newsletterDb
    .from('rosters_2026')
    .select('gsis_id, full_name, position, team_abbr, status, years_exp, rookie_year')
    .in('position', [...DEFENSIVE_ROOKIE_ROSTER_POSITIONS])
    .in('status', ['ACT', 'RES'])
    .or('years_exp.eq.0,rookie_year.eq.2026')
    .order('full_name', { ascending: true })
    .limit(500);

  if (error || !data) {
    console.error('Error loading defensive rookies:', error);
    return [];
  }

  const seen = new Set<string>();
  const out: DefensiveRookie[] = [];
  for (const row of data as {
    gsis_id?: string | null;
    full_name?: string | null;
    position?: string | null;
    team_abbr?: string | null;
    status?: string | null;
  }[]) {
    const name = row.full_name?.trim();
    if (!name) continue;
    const id = row.gsis_id?.trim() || `droy:${name.toLowerCase()}`;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      name,
      position: normalizeDisplayPosition(row.position || 'DEF'),
      team: row.team_abbr?.trim().toUpperCase() || null,
      status: row.status ?? null,
    });
  }
  return out;
}
