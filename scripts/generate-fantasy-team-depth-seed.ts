/**
 * Parse data/fantasy_team_depth_2026.tsv → SQL INSERTs for fantasy_team_depth.
 * Run: npx tsx scripts/generate-fantasy-team-depth-seed.ts
 */
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const TEAM_FULL_NAMES = [
  'Buffalo Bills',
  'Miami Dolphins',
  'New England Patriots',
  'New York Jets',
  'Baltimore Ravens',
  'Cincinnati Bengals',
  'Cleveland Browns',
  'Pittsburgh Steelers',
  'Houston Texans',
  'Indianapolis Colts',
  'Jacksonville Jaguars',
  'Tennessee Titans',
  'Denver Broncos',
  'Kansas City Chiefs',
  'Las Vegas Raiders',
  'Los Angeles Chargers',
  'Dallas Cowboys',
  'New York Giants',
  'Philadelphia Eagles',
  'Washington Commanders',
  'Chicago Bears',
  'Detroit Lions',
  'Green Bay Packers',
  'Minnesota Vikings',
  'Atlanta Falcons',
  'Carolina Panthers',
  'New Orleans Saints',
  'Tampa Bay Buccaneers',
  'Arizona Cardinals',
  'Los Angeles Rams',
  'San Francisco 49ers',
  'Seattle Seahawks',
] as const;

const FULL_TO_ABBR: Record<string, string> = {
  'Buffalo Bills': 'BUF',
  'Miami Dolphins': 'MIA',
  'New England Patriots': 'NE',
  'New York Jets': 'NYJ',
  'Baltimore Ravens': 'BAL',
  'Cincinnati Bengals': 'CIN',
  'Cleveland Browns': 'CLE',
  'Pittsburgh Steelers': 'PIT',
  'Houston Texans': 'HOU',
  'Indianapolis Colts': 'IND',
  'Jacksonville Jaguars': 'JAX',
  'Tennessee Titans': 'TEN',
  'Denver Broncos': 'DEN',
  'Kansas City Chiefs': 'KC',
  'Las Vegas Raiders': 'LV',
  'Los Angeles Chargers': 'LAC',
  'Dallas Cowboys': 'DAL',
  'New York Giants': 'NYG',
  'Philadelphia Eagles': 'PHI',
  'Washington Commanders': 'WAS',
  'Chicago Bears': 'CHI',
  'Detroit Lions': 'DET',
  'Green Bay Packers': 'GB',
  'Minnesota Vikings': 'MIN',
  'Atlanta Falcons': 'ATL',
  'Carolina Panthers': 'CAR',
  'New Orleans Saints': 'NO',
  'Tampa Bay Buccaneers': 'TB',
  'Arizona Cardinals': 'ARI',
  'Los Angeles Rams': 'LAR',
  'San Francisco 49ers': 'SF',
  'Seattle Seahawks': 'SEA',
};

const SEASON = 2026;

function parseSlot(label: string): { position: string; depth_rank: number } | null {
  const m = label.trim().match(/^(QB|RB|WR|TE)(\d+)$/i);
  if (!m) return null;
  return { position: m[1].toUpperCase(), depth_rank: parseInt(m[2], 10) };
}

function sqlEscape(s: string): string {
  return s.replace(/'/g, "''");
}

const root = join(import.meta.dirname ?? __dirname, '..');
const tsvPath = join(root, 'data', 'fantasy_team_depth_2026.tsv');
const raw = readFileSync(tsvPath, 'utf8');
const lines = raw.split(/\r?\n/).filter((l) => l.trim());

const header = lines[0].split('\t');
if (header[0] !== 'Position') throw new Error('Expected Position column');

for (let i = 1; i < header.length; i++) {
  const name = header[i]?.trim();
  if (name !== TEAM_FULL_NAMES[i - 1]) {
    console.warn(`Header mismatch col ${i}: got "${name}", expected "${TEAM_FULL_NAMES[i - 1]}"`);
  }
}

const rows: string[] = [];
let skipped = 0;

for (let r = 1; r < lines.length; r++) {
  const cols = lines[r].split('\t');
  const slot = parseSlot(cols[0] ?? '');
  if (!slot) continue;

  for (let c = 1; c < cols.length && c <= 32; c++) {
    const playerName = cols[c]?.trim();
    if (!playerName) {
      skipped++;
      continue;
    }
    const teamFull = TEAM_FULL_NAMES[c - 1];
    const teamAbbr = FULL_TO_ABBR[teamFull];
    if (!teamAbbr) throw new Error(`No abbr for ${teamFull}`);

    rows.push(
      `(${SEASON}, '${teamAbbr}', '${slot.position}', ${slot.depth_rank}, '${sqlEscape(playerName)}')`
    );
  }
}

const ddl = `-- Fantasy-relevant NFL team depth (manual offseason chart)
-- Regenerate seed: npx tsx scripts/generate-fantasy-team-depth-seed.ts

CREATE TABLE IF NOT EXISTS public.fantasy_team_depth (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season integer NOT NULL,
  team_abbr text NOT NULL,
  position text NOT NULL CHECK (position IN ('QB', 'RB', 'WR', 'TE')),
  depth_rank smallint NOT NULL CHECK (depth_rank >= 1 AND depth_rank <= 6),
  player_name text NOT NULL,
  player_id uuid REFERENCES public.players (id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'manual_offseason',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fantasy_team_depth_slot_unique UNIQUE (season, team_abbr, position, depth_rank)
);

COMMENT ON TABLE public.fantasy_team_depth IS
  'Curated fantasy depth chart: QB/RB/WR/TE priority per NFL team (QB1–4, RB1–4, WR1–6, TE1–3).';

CREATE INDEX IF NOT EXISTS idx_fantasy_team_depth_season_team
  ON public.fantasy_team_depth (season, team_abbr);

CREATE INDEX IF NOT EXISTS idx_fantasy_team_depth_player_name
  ON public.fantasy_team_depth (season, lower(player_name));

CREATE OR REPLACE FUNCTION public.set_updated_at_fantasy_team_depth()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fantasy_team_depth_updated_at ON public.fantasy_team_depth;
CREATE TRIGGER trg_fantasy_team_depth_updated_at
BEFORE UPDATE ON public.fantasy_team_depth
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at_fantasy_team_depth();

ALTER TABLE public.fantasy_team_depth ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fantasy_team_depth read access" ON public.fantasy_team_depth;
CREATE POLICY "fantasy_team_depth read access"
ON public.fantasy_team_depth
FOR SELECT
USING (true);

-- Replace chart for this season on re-seed
DELETE FROM public.fantasy_team_depth WHERE season = ${SEASON};

INSERT INTO public.fantasy_team_depth (season, team_abbr, position, depth_rank, player_name)
VALUES
`;

const chunkSize = 80;
const insertParts: string[] = [];
for (let i = 0; i < rows.length; i += chunkSize) {
  const chunk = rows.slice(i, i + chunkSize).join(',\n');
  insertParts.push(chunk + (i + chunkSize < rows.length ? ',' : ';'));
}

const outPath = join(root, 'supabase', 'migrations', '20260524120000_fantasy_team_depth_chart.sql');
const sql = ddl + insertParts.join('\n') + '\n';
writeFileSync(outPath, sql, 'utf8');

console.log(`Wrote ${outPath}`);
console.log(`Rows: ${rows.length}, empty slots skipped: ${skipped}`);
