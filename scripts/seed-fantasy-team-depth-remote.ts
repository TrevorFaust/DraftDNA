/**
 * Upsert fantasy_team_depth rows to linked Supabase (service role).
 * Run: npx tsx scripts/seed-fantasy-team-depth-remote.ts
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';

const SEASON = 2026;
const root = join(import.meta.dirname ?? __dirname, '..');

const TEAM_FULL_NAMES = [
  'Buffalo Bills', 'Miami Dolphins', 'New England Patriots', 'New York Jets',
  'Baltimore Ravens', 'Cincinnati Bengals', 'Cleveland Browns', 'Pittsburgh Steelers',
  'Houston Texans', 'Indianapolis Colts', 'Jacksonville Jaguars', 'Tennessee Titans',
  'Denver Broncos', 'Kansas City Chiefs', 'Las Vegas Raiders', 'Los Angeles Chargers',
  'Dallas Cowboys', 'New York Giants', 'Philadelphia Eagles', 'Washington Commanders',
  'Chicago Bears', 'Detroit Lions', 'Green Bay Packers', 'Minnesota Vikings',
  'Atlanta Falcons', 'Carolina Panthers', 'New Orleans Saints', 'Tampa Bay Buccaneers',
  'Arizona Cardinals', 'Los Angeles Rams', 'San Francisco 49ers', 'Seattle Seahawks',
] as const;

const FULL_TO_ABBR: Record<string, string> = {
  'Buffalo Bills': 'BUF', 'Miami Dolphins': 'MIA', 'New England Patriots': 'NE',
  'New York Jets': 'NYJ', 'Baltimore Ravens': 'BAL', 'Cincinnati Bengals': 'CIN',
  'Cleveland Browns': 'CLE', 'Pittsburgh Steelers': 'PIT', 'Houston Texans': 'HOU',
  'Indianapolis Colts': 'IND', 'Jacksonville Jaguars': 'JAX', 'Tennessee Titans': 'TEN',
  'Denver Broncos': 'DEN', 'Kansas City Chiefs': 'KC', 'Las Vegas Raiders': 'LV',
  'Los Angeles Chargers': 'LAC', 'Dallas Cowboys': 'DAL', 'New York Giants': 'NYG',
  'Philadelphia Eagles': 'PHI', 'Washington Commanders': 'WAS', 'Chicago Bears': 'CHI',
  'Detroit Lions': 'DET', 'Green Bay Packers': 'GB', 'Minnesota Vikings': 'MIN',
  'Atlanta Falcons': 'ATL', 'Carolina Panthers': 'CAR', 'New Orleans Saints': 'NO',
  'Tampa Bay Buccaneers': 'TB', 'Arizona Cardinals': 'ARI', 'Los Angeles Rams': 'LAR',
  'San Francisco 49ers': 'SF', 'Seattle Seahawks': 'SEA',
};

function loadEnv(): void {
  const envPath = join(root, '.env');
  const raw = readFileSync(envPath, 'utf8');
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

function parseRows(): Array<{
  season: number;
  team_abbr: string;
  position: string;
  depth_rank: number;
  player_name: string;
}> {
  const tsv = readFileSync(join(root, 'data', 'fantasy_team_depth_2026.tsv'), 'utf8');
  const lines = tsv.split(/\r?\n/).filter((l) => l.trim());
  const out: Array<{
    season: number;
    team_abbr: string;
    position: string;
    depth_rank: number;
    player_name: string;
  }> = [];

  for (let r = 1; r < lines.length; r++) {
    const cols = lines[r].split('\t');
    const m = (cols[0] ?? '').trim().match(/^(QB|RB|WR|TE)(\d+)$/i);
    if (!m) continue;
    const position = m[1].toUpperCase();
    const depth_rank = parseInt(m[2], 10);
    for (let c = 1; c < cols.length && c <= 32; c++) {
      const player_name = cols[c]?.trim();
      if (!player_name) continue;
      const teamAbbr = FULL_TO_ABBR[TEAM_FULL_NAMES[c - 1]];
      if (!teamAbbr) throw new Error(`Missing abbr for col ${c}`);
      out.push({ season: SEASON, team_abbr: teamAbbr, position, depth_rank, player_name });
    }
  }
  return out;
}

async function main(): Promise<void> {
  loadEnv();
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');

  const supabase = createClient(url, key);
  const rows = parseRows();

  const { error: delErr } = await supabase
    .from('fantasy_team_depth')
    .delete()
    .eq('season', SEASON);
  if (delErr) throw delErr;

  const batchSize = 100;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase.from('fantasy_team_depth').insert(batch);
    if (error) throw error;
    console.log(`Inserted ${Math.min(i + batchSize, rows.length)} / ${rows.length}`);
  }

  const { count, error: countErr } = await supabase
    .from('fantasy_team_depth')
    .select('*', { count: 'exact', head: true })
    .eq('season', SEASON);
  if (countErr) throw countErr;
  console.log(`Done. season=${SEASON} row count=${count}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
