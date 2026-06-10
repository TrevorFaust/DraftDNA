/**
 * Build supabase/migrations/*_nfl_team_context_2025.sql from oline/SOS constants
 * + 2025 games/team_stats aggregation.
 *
 * Run: npx tsx scripts/generate-nfl-team-context-2025-migration.ts
 */
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';
import { NFL_OLINE_TEAM_2025 } from '../src/constants/nflOlineTeamRanks2025';
import {
  NFL_2026_SOS_OPP_WIN_PCT,
  NFL_2026_SOS_RANK,
} from '../src/constants/nfl2026StrengthOfSchedule';
import { TEAM_ABBREV_TO_FULL_NAME, canonicalTeamAbbr } from '../src/utils/teamMapping';
import { computeNfl2025TeamSeasonFromRows } from '../src/utils/nflTeamContext2025Compute';

const root = join(import.meta.dirname ?? __dirname, '..');
const MIGRATION_PATH = join(root, 'supabase/migrations/20260603120000_nfl_team_context_2025.sql');

function loadEnv(): void {
  const raw = readFileSync(join(root, '.env'), 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

function sqlNum(n: number | null | undefined, decimals?: number): string {
  if (n == null || !Number.isFinite(n)) return 'NULL';
  if (decimals != null) return n.toFixed(decimals);
  return String(n);
}

function sqlEscape(s: string): string {
  return s.replace(/'/g, "''");
}

async function main() {
  loadEnv();
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('Missing VITE_SUPABASE_URL or Supabase key in .env');

  const supabase = createClient(url, key);

  const [gamesRes, statsRes] = await Promise.all([
    supabase
      .from('games_2025')
      .select('week, home_team, away_team, home_score, away_score')
      .eq('season', 2025)
      .eq('game_type', 'REG')
      .lte('week', 18),
    supabase
      .from('team_stats_2025')
      .select('team, week, passing_yards, rushing_yards, total_yards')
      .lte('week', 18),
  ]);

  if (gamesRes.error) throw gamesRes.error;
  if (statsRes.error) throw statsRes.error;

  const seasonByTeam = computeNfl2025TeamSeasonFromRows(
    gamesRes.data ?? [],
    statsRes.data ?? []
  );

  const teams = [...new Set(Object.keys(TEAM_ABBREV_TO_FULL_NAME).map((a) => canonicalTeamAbbr(a)!))].sort();
  const valueRows: string[] = [];

  for (const abbr of teams) {
    const ol = NFL_OLINE_TEAM_2025[abbr];
    const season = seasonByTeam.get(abbr);
    const sosRank = NFL_2026_SOS_RANK[abbr] ?? null;
    const sosPct = NFL_2026_SOS_OPP_WIN_PCT[abbr] ?? null;

    if (!ol) {
      console.warn(`Missing O-line row for ${abbr}`);
      continue;
    }

    valueRows.push(
      `  ('${abbr}', ${ol.unitOverallRank}, ${ol.passOverallRank}, ${ol.runOverallRank}, ` +
        `${sqlNum(ol.pressurePct, 1)}, ${sqlNum(ol.pressureRoe, 2)}, ${sqlNum(ol.passBlockPff, 1)}, ${ol.passBlockWinRatePct}, ` +
        `${sqlNum(ol.adjYbcoPerAtt, 2)}, ${sqlNum(ol.runBlockPff, 1)}, ${ol.runBlockWinRatePct}, ` +
        `${sqlNum(season?.offPpg, 3)}, ${sqlNum(season?.offPassYpg, 2)}, ${sqlNum(season?.offRushYpg, 2)}, ` +
        `${sqlNum(season?.defPpg, 3)}, ${sqlNum(season?.defYpg, 2)}, ${season?.games ?? 'NULL'}, ` +
        `${season?.offPpgRank ?? 'NULL'}, ${season?.offPassYpgRank ?? 'NULL'}, ${season?.offRushYpgRank ?? 'NULL'}, ` +
        `${season?.defPpgAllowedRank ?? 'NULL'}, ${season?.defYpgAllowedRank ?? 'NULL'}, ` +
        `${sosRank ?? 'NULL'}, ${sosPct != null ? sqlNum(sosPct, 3) : 'NULL'})`
    );
  }

  const sql = `-- Frozen 2025 team context: O-line, offense/defense ranks, 2026 SOS.
-- Regenerate: npx tsx scripts/generate-nfl-team-context-2025-migration.ts

CREATE TABLE IF NOT EXISTS public.nfl_team_context_2025 (
  team_abbr text PRIMARY KEY,
  oline_unit_rank smallint NOT NULL,
  oline_pass_rank smallint NOT NULL,
  oline_run_rank smallint NOT NULL,
  oline_pressure_pct numeric(5,2) NOT NULL,
  oline_pressure_roe numeric(6,2) NOT NULL,
  oline_pass_block_pff numeric(5,2) NOT NULL,
  oline_pass_block_win_rate_pct smallint NOT NULL,
  oline_adj_ybco_per_att numeric(5,2) NOT NULL,
  oline_run_block_pff numeric(5,2) NOT NULL,
  oline_run_block_win_rate_pct smallint NOT NULL,
  off_ppg numeric(6,3),
  off_pass_ypg numeric(7,2),
  off_rush_ypg numeric(7,2),
  def_ppg_allowed numeric(6,3),
  def_ypg_allowed numeric(7,2),
  games_played smallint,
  off_ppg_rank smallint,
  off_pass_ypg_rank smallint,
  off_rush_ypg_rank smallint,
  def_ppg_allowed_rank smallint,
  def_ypg_allowed_rank smallint,
  sos_2026_rank smallint,
  sos_2026_opp_win_pct numeric(5,3),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.nfl_team_context_2025 IS
  'Static per-team context for 2025 (O-line, off/def ranks) and 2026 SOS. One row per NFL team; join via player team abbr.';

CREATE INDEX IF NOT EXISTS idx_nfl_team_context_2025_team
  ON public.nfl_team_context_2025 (team_abbr);

ALTER TABLE public.nfl_team_context_2025 ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "nfl_team_context_2025 read access" ON public.nfl_team_context_2025;
CREATE POLICY "nfl_team_context_2025 read access"
ON public.nfl_team_context_2025
FOR SELECT
TO anon, authenticated
USING (true);

DELETE FROM public.nfl_team_context_2025;

INSERT INTO public.nfl_team_context_2025 (
  team_abbr,
  oline_unit_rank, oline_pass_rank, oline_run_rank,
  oline_pressure_pct, oline_pressure_roe, oline_pass_block_pff, oline_pass_block_win_rate_pct,
  oline_adj_ybco_per_att, oline_run_block_pff, oline_run_block_win_rate_pct,
  off_ppg, off_pass_ypg, off_rush_ypg, def_ppg_allowed, def_ypg_allowed, games_played,
  off_ppg_rank, off_pass_ypg_rank, off_rush_ypg_rank, def_ppg_allowed_rank, def_ypg_allowed_rank,
  sos_2026_rank, sos_2026_opp_win_pct
) VALUES
${valueRows.join(',\n')};
`;

  writeFileSync(MIGRATION_PATH, sql, 'utf8');
  console.log(`Wrote ${valueRows.length} teams → ${MIGRATION_PATH}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
