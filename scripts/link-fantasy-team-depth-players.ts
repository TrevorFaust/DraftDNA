/**
 * Link fantasy_team_depth.player_id to players; print unmatched rows.
 * Run: npx tsx scripts/link-fantasy-team-depth-players.ts
 */
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';
import { playerNameMatchKeys } from '../src/utils/playerNameMatch';
import { canonicalTeamAbbr, teamFieldToAbbr } from '../src/utils/teamMapping';
import { mergePlayerPoolAcrossSeasons } from '../src/utils/playerDeduplication';
import {
  PLAYER_POOL_CURRENT_SEASON,
  PLAYER_POOL_PRIOR_SEASON,
} from '../src/constants/playerPoolSeason';
import { FANTASY_DEPTH_SEASON } from '../src/constants/fantasyDepthSeason';

const root = join(import.meta.dirname ?? __dirname, '..');

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

type PlayerRow = {
  id: string;
  name: string;
  position: string;
  team: string | null;
  adp: number;
  season: number | null;
};

async function main(): Promise<void> {
  loadEnv();
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env');

  const supabase = createClient(url, key);

  let allPlayers: PlayerRow[] = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('players')
      .select('id, name, position, team, adp, season')
      .in('season', [PLAYER_POOL_PRIOR_SEASON, PLAYER_POOL_CURRENT_SEASON])
      .in('position', ['QB', 'RB', 'WR', 'TE'])
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data?.length) break;
    allPlayers = allPlayers.concat(data as PlayerRow[]);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  const merged = mergePlayerPoolAcrossSeasons(
    allPlayers,
    PLAYER_POOL_PRIOR_SEASON,
    PLAYER_POOL_CURRENT_SEASON
  ) as PlayerRow[];

  type Bucket = { id: string; adp: number };
  const byTeamPosName = new Map<string, Bucket>();
  const byPosName = new Map<string, Bucket[]>();

  for (const p of merged) {
    const pos = p.position?.trim().toUpperCase();
    if (!pos || !['QB', 'RB', 'WR', 'TE'].includes(pos)) continue;
    const team = canonicalTeamAbbr(teamFieldToAbbr(p.team)) ?? teamFieldToAbbr(p.team);
    const adp = Number(p.adp) || 9999;
    for (const nk of playerNameMatchKeys(p.name)) {
      if (team) {
        const k = `${team}|${pos}|${nk}`;
        const prev = byTeamPosName.get(k);
        if (!prev || adp < prev.adp) byTeamPosName.set(k, { id: p.id, adp });
      }
      const k2 = `${pos}|${nk}`;
      const list = byPosName.get(k2) ?? [];
      list.push({ id: p.id, adp });
      byPosName.set(k2, list);
    }
  }

  for (const [, list] of byPosName) {
    list.sort((a, b) => a.adp - b.adp);
  }

  const { data: depthRows, error: depthErr } = await supabase
    .from('fantasy_team_depth')
    .select('id, team_abbr, position, depth_rank, player_name, player_id')
    .eq('season', FANTASY_DEPTH_SEASON);
  if (depthErr) throw depthErr;

  const unmatched: Array<{
    team_abbr: string;
    position: string;
    depth_rank: number;
    player_name: string;
    note?: string;
  }> = [];
  let linked = 0;

  for (const row of depthRows ?? []) {
    const pos = row.position.trim().toUpperCase();
    const team = row.team_abbr.trim().toUpperCase();
    let playerId: string | null = null;

    for (const nk of playerNameMatchKeys(row.player_name)) {
      const hit = byTeamPosName.get(`${team}|${pos}|${nk}`);
      if (hit) {
        playerId = hit.id;
        break;
      }
    }

    if (!playerId) {
      for (const nk of playerNameMatchKeys(row.player_name)) {
        const cands = byPosName.get(`${pos}|${nk}`);
        if (cands?.length === 1) {
          playerId = cands[0].id;
          break;
        }
        if (cands && cands.length > 1) {
          unmatched.push({
            team_abbr: team,
            position: pos,
            depth_rank: row.depth_rank,
            player_name: row.player_name,
            note: `ambiguous (${cands.length} players, same name)`,
          });
          playerId = '__ambiguous__';
          break;
        }
      }
    }

    if (playerId === '__ambiguous__') continue;

    if (!playerId) {
      unmatched.push({
        team_abbr: team,
        position: pos,
        depth_rank: row.depth_rank,
        player_name: row.player_name,
      });
      continue;
    }

    if (row.player_id === playerId) {
      linked++;
      continue;
    }

    const { error: upErr } = await supabase
      .from('fantasy_team_depth')
      .update({ player_id: playerId })
      .eq('id', row.id);
    if (upErr) throw upErr;
    linked++;
  }

  const outPath = join(root, 'data', 'fantasy_team_depth_unmatched.json');
  writeFileSync(outPath, JSON.stringify(unmatched, null, 2), 'utf8');

  console.log(`Linked ${linked} / ${depthRows?.length ?? 0} depth rows`);
  console.log(`Unmatched: ${unmatched.length} (see ${outPath})`);
  if (unmatched.length > 0) {
    console.log('\nUnmatched players:');
    for (const u of unmatched) {
      console.log(
        `  ${u.team_abbr} ${u.position}${u.depth_rank} ${u.player_name}${u.note ? ` — ${u.note}` : ''}`
      );
    }
  }

  // WR2+ with top-24 positional ADP (priced like WR1 territory)
  const { data: linkedDepth } = await supabase
    .from('fantasy_team_depth')
    .select('team_abbr, position, depth_rank, player_name, player_id')
    .eq('season', FANTASY_DEPTH_SEASON)
    .eq('position', 'WR')
    .gte('depth_rank', 2)
    .not('player_id', 'is', null);

  const wrAdpRank = new Map<string, number>();
  const wrs = merged
    .filter((p) => p.position === 'WR')
    .sort((a, b) => (Number(a.adp) || 9999) - (Number(b.adp) || 9999));
  wrs.forEach((p, i) => wrAdpRank.set(p.id, i + 1));

  const premiumWr2: Array<{ name: string; team: string; depth: number; wrAdp: number }> = [];
  for (const d of linkedDepth ?? []) {
    if (!d.player_id) continue;
    const adpR = wrAdpRank.get(d.player_id);
    if (adpR != null && adpR <= 36) {
      premiumWr2.push({
        name: d.player_name,
        team: d.team_abbr,
        depth: d.depth_rank,
        wrAdp: adpR,
      });
    }
  }
  premiumWr2.sort((a, b) => a.wrAdp - b.wrAdp);
  console.log('\nWR2+ with top-36 WR ADP (community prices them like WR1s):');
  for (const p of premiumWr2) {
    console.log(`  ${p.name} (${p.team} WR${p.depth}) — WR${p.wrAdp} ADP`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
