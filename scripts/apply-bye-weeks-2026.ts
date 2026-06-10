/**
 * Set players.bye_week from NFL_TEAM_BYE_WEEK_2026 for all rows on a team.
 * Run: npx tsx scripts/apply-bye-weeks-2026.ts
 */
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import { NFL_TEAM_BYE_WEEK_2026 } from '../src/constants/nflTeamByeWeek2026';
import { canonicalTeamAbbr, teamFieldToAbbr } from '../src/utils/teamMapping';
import {
  PLAYER_POOL_CURRENT_SEASON,
  PLAYER_POOL_PRIOR_SEASON,
} from '../src/constants/playerPoolSeason';

function loadEnv(): void {
  const raw = readFileSync('.env', 'utf8');
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

async function main(): Promise<void> {
  loadEnv();
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env');

  const supabase = createClient(url, key);
  let all: Array<{ id: string; team: string | null; position: string }> = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('players')
      .select('id, team, position')
      .in('season', [PLAYER_POOL_PRIOR_SEASON, PLAYER_POOL_CURRENT_SEASON])
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data?.length) break;
    all = all.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  let updated = 0;
  let skipped = 0;
  for (const row of all) {
    const pos = row.position?.trim().toUpperCase() ?? '';
    if (pos === 'D/ST' || pos === 'DEF' || pos === 'DST' || pos === 'K') {
      skipped++;
      continue;
    }
    const abbr = canonicalTeamAbbr(teamFieldToAbbr(row.team));
    if (!abbr) {
      skipped++;
      continue;
    }
    const bye = NFL_TEAM_BYE_WEEK_2026[abbr];
    if (bye == null) {
      console.warn(`No bye week for team ${abbr} (${row.team})`);
      skipped++;
      continue;
    }
    const { error } = await supabase.from('players').update({ bye_week: bye }).eq('id', row.id);
    if (error) throw error;
    updated++;
  }

  console.log(`Updated bye_week on ${updated} player rows (${skipped} skipped).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
