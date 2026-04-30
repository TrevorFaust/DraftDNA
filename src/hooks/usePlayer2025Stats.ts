import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useScoringFormat } from '@/hooks/useScoringFormat';
import { getFantasyPointsForFormat } from '@/utils/fantasyPoints';
import type { ScoringFormat } from '@/utils/fantasyPoints';
import {
  buildDefenseFantasyGameInput,
  calculateDefenseFantasyPoints,
} from '@/utils/defenseFantasy2025';
import { canonicalTeamAbbr, resolveTeamAbbrForDisplay, teamFieldToAbbr } from '@/utils/teamMapping';
import { PLAYER_POOL_PRIOR_SEASON } from '@/constants/playerPoolSeason';

/** Season kicking totals (Player Stats page when filtering to K). From `get_player_2025_season_stats` k_* columns. */
export interface KickerSeasonTotals2025 {
  patMade: number;
  patAtt: number;
  fgMade: number;
  fgAtt: number;
  fgMade0To39: number;
  fgMade40To49: number;
  fgMade50To59: number;
  fgMade60Plus: number;
  /** Null when weekly data does not expose attempts for that bucket. */
  fgAtt0To39: number | null;
  fgAtt40To49: number | null;
  fgAtt50To59: number | null;
  fgAtt60Plus: number | null;
}

export interface Player2025Stats {
  totalFantasyPoints: number;
  positionRank: string; // e.g. "QB1", "RB9", "WR12"
  totalPassYards: number;
  totalRushYards: number;
  totalRecYards: number;
  totalPassTds: number;
  totalRushTds: number;
  totalRecTds: number;
  totalInterceptions: number;
  totalTargets: number;
  totalReceptions: number;
  totalDefSacks: number;
  totalDefInterceptions: number;
  totalDefFumbleRecoveries: number;
  totalDefTds: number;
  gamesPlayed: number;
  avgPointsPerGame: number | null; // null if no games played
  /** Populated for kickers when RPC returns k_* aggregates. */
  kickerSeason?: KickerSeasonTotals2025 | null;
}

type RawRow = {
  player_id: string;
  total_fp_standard: number | null;
  total_fp_ppr: number | null;
  total_receptions: number | null;
  total_pass_yards: number | null;
  total_rush_yards: number | null;
  total_rec_yards: number | null;
  total_pass_tds: number | null;
  total_rush_tds: number | null;
  total_rec_tds: number | null;
  total_interceptions: number | null;
  total_targets: number | null;
  games_played: number | null;
  position: string | null;
  position_rank: number | null;
  k_pat_made?: number | null;
  k_pat_att?: number | null;
  k_fg_made?: number | null;
  k_fg_att?: number | null;
  k_fg_0039?: number | null;
  k_fg_4049?: number | null;
  k_fg_5059?: number | null;
  k_fg_60?: number | null;
  k_fg_att_0039?: number | null;
  k_fg_att_4049?: number | null;
  k_fg_att_5059?: number | null;
  k_fg_att_60?: number | null;
};

function toFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = Number(value.trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function isDefensePosition(p: string | null | undefined): boolean {
  if (!p?.trim()) return false;
  const u = p.trim().toUpperCase();
  return u === 'D/ST' || u === 'DEF' || u === 'DST';
}

type DefensePlayerRow = { id: string; team: string | null; name: string; position: string };

type Games2025ScheduleRow = {
  week: number;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
};

function statsTeamAbbrKey(rawTeam: string): string {
  const abbr = teamFieldToAbbr(rawTeam) ?? rawTeam.trim().toUpperCase();
  return canonicalTeamAbbr(abbr) ?? abbr;
}

/** Fetch 2025 season fantasy totals and position rank for all players. Returns a map of playerId -> stats.
 * @param scoringFormatOverride - When provided (e.g. from Rankings bucket), use this instead of the selected league's format.
 *  Ensures PPG/total points reflect the current bucket (standard, half_ppr, ppr) when switching leagues.
 */
export function usePlayer2025Stats(scoringFormatOverride?: ScoringFormat | null): Map<string, Player2025Stats> {
  const leagueFormat = useScoringFormat();
  const scoringFormat = (scoringFormatOverride ?? leagueFormat) as ScoringFormat;
  const [rawRows, setRawRows] = useState<RawRow[]>([]);
  const [defenseBundle, setDefenseBundle] = useState<{
    players: DefensePlayerRow[];
    teamStatsRows: Record<string, unknown>[];
    gamesRows: Games2025ScheduleRow[];
  } | null>(null);

  useEffect(() => {
    (async () => {
      const [rpcRes, tsRes, gamesRes, plRes] = await Promise.all([
        (supabase.rpc as any)('get_player_2025_season_stats'),
        (supabase as any).from('team_stats_2025').select('*').lte('week', 18),
        supabase
          .from('games_2025')
          .select('week, home_team, away_team, home_score, away_score')
          .eq('season', 2025)
          .eq('game_type', 'REG')
          .lte('week', 18),
        supabase
          .from('players')
          .select('id, team, name, position')
          .eq('season', PLAYER_POOL_PRIOR_SEASON)
          .in('position', ['D/ST', 'DEF', 'DST']),
      ]);

      if (rpcRes.error) {
        console.warn('Failed to fetch player 2025 season stats:', rpcRes.error);
      } else {
        setRawRows(Array.isArray(rpcRes.data) ? rpcRes.data : []);
      }

      let playersRes = plRes;
      if (plRes.error) {
        const fallback = await supabase
          .from('players')
          .select('id, team, name, position')
          .eq('season', PLAYER_POOL_PRIOR_SEASON)
          .eq('position', 'D/ST');
        if (!fallback.error) {
          playersRes = fallback as typeof plRes;
        }
      }

      if (tsRes.error || gamesRes.error || playersRes.error) {
        if (tsRes.error) console.warn('Failed to fetch team_stats_2025 for defense PPG:', tsRes.error);
        if (gamesRes.error) console.warn('Failed to fetch games_2025 for defense PPG:', gamesRes.error);
        if (playersRes.error) console.warn('Failed to fetch D/ST players for PPG:', playersRes.error);
        setDefenseBundle(null);
        return;
      }

      const players = (playersRes.data ?? [])
        .filter((p: any) => p?.id && isDefensePosition(p.position))
        .map((p: any) => ({
          id: String(p.id),
          team: p.team ?? null,
          name: String(p.name ?? ''),
          position: String(p.position ?? ''),
        })) as DefensePlayerRow[];

      setDefenseBundle({
        players,
        teamStatsRows: (tsRes.data ?? []) as Record<string, unknown>[],
        gamesRows: (gamesRes.data ?? []) as Games2025ScheduleRow[],
      });
    })();
  }, []);

  return useMemo(() => {
    const map = new Map<string, Player2025Stats>();
    for (const row of rawRows) {
      const playerId = row.player_id != null ? String(row.player_id) : null;
      if (!playerId) continue;

      const totalFp = getFantasyPointsForFormat(
        scoringFormat,
        row.total_fp_standard ?? null,
        row.total_fp_ppr ?? null,
        Number(row.total_receptions) ?? null
      );
      if (totalFp == null) continue;

      const pos = (row.position || '').replace(/[^A-Z0-9/]/gi, '') || '?';
      const posRank = row.position_rank != null ? row.position_rank : 0;
      const positionRank = `${pos}${posRank}`;

      const posNorm = String(row.position ?? '')
        .trim()
        .toUpperCase();
      const kickerSeason: KickerSeasonTotals2025 | null =
        posNorm === 'K'
          ? {
              patMade: Number(row.k_pat_made) || 0,
              patAtt: Number(row.k_pat_att) || 0,
              fgMade: Number(row.k_fg_made) || 0,
              fgAtt: Number(row.k_fg_att) || 0,
              fgMade0To39: Number(row.k_fg_0039) || 0,
              fgMade40To49: Number(row.k_fg_4049) || 0,
              fgMade50To59: Number(row.k_fg_5059) || 0,
              fgMade60Plus: Number(row.k_fg_60) || 0,
              fgAtt0To39: toFiniteNumber(row.k_fg_att_0039),
              fgAtt40To49: toFiniteNumber(row.k_fg_att_4049),
              fgAtt50To59: toFiniteNumber(row.k_fg_att_5059),
              fgAtt60Plus: toFiniteNumber(row.k_fg_att_60),
            }
          : null;

      map.set(playerId, {
        totalFantasyPoints: totalFp,
        positionRank,
        totalPassYards: Number(row.total_pass_yards) || 0,
        totalRushYards: Number(row.total_rush_yards) || 0,
        totalRecYards: Number(row.total_rec_yards) || 0,
        totalPassTds: Number(row.total_pass_tds) || 0,
        totalRushTds: Number(row.total_rush_tds) || 0,
        totalRecTds: Number(row.total_rec_tds) || 0,
        totalInterceptions: Number(row.total_interceptions) || 0,
        totalTargets: Number(row.total_targets) || 0,
        totalReceptions: Number(row.total_receptions) || 0,
        totalDefSacks: 0,
        totalDefInterceptions: 0,
        totalDefFumbleRecoveries: 0,
        totalDefTds: 0,
        gamesPlayed: Number(row.games_played) || 0,
        avgPointsPerGame: (() => {
          const gp = Number(row.games_played) || 0;
          return gp > 0 ? totalFp / gp : null;
        })(),
        kickerSeason,
      });
    }

    /** D/ST: offense RPC has no defense; mirror PlayerDetailDialog weekly scoring (DB `fantasy_points` often null). */
    if (defenseBundle?.players?.length && defenseBundle.teamStatsRows?.length && defenseBundle.gamesRows?.length) {
      const opponentStatsByTeamWeek = new Map<string, Record<string, unknown>>();
      for (const row of defenseBundle.teamStatsRows) {
        const rawTeam = row.team != null ? String(row.team) : '';
        const teamKey = statsTeamAbbrKey(rawTeam);
        const wk = toFiniteNumber(row.week);
        if (!teamKey || wk == null) continue;
        opponentStatsByTeamWeek.set(`${teamKey}__${wk}`, row as Record<string, unknown>);
      }

      const teamGamesByAbbr = new Map<string, Map<number, { opponent: string; pointsAllowed: number | null }>>();
      for (const g of defenseBundle.gamesRows) {
        const wk = g.week;
        if (typeof wk !== 'number') continue;
        const homeKey = statsTeamAbbrKey(g.home_team);
        const awayKey = statsTeamAbbrKey(g.away_team);
        if (homeKey) {
          const m = teamGamesByAbbr.get(homeKey) ?? new Map();
          m.set(wk, {
            opponent: g.away_team,
            pointsAllowed: toFiniteNumber(g.away_score),
          });
          teamGamesByAbbr.set(homeKey, m);
        }
        if (awayKey) {
          const m = teamGamesByAbbr.get(awayKey) ?? new Map();
          m.set(wk, {
            opponent: g.home_team,
            pointsAllowed: toFiniteNumber(g.home_score),
          });
          teamGamesByAbbr.set(awayKey, m);
        }
      }

      const statsByTeamWeek = new Map<string, Map<number, Record<string, unknown>>>();
      for (const row of defenseBundle.teamStatsRows) {
        const rawTeam = row.team != null ? String(row.team) : '';
        const teamKey = statsTeamAbbrKey(rawTeam);
        const wk = toFiniteNumber(row.week);
        if (!teamKey || wk == null) continue;
        const inner = statsByTeamWeek.get(teamKey) ?? new Map();
        inner.set(wk, row as Record<string, unknown>);
        statsByTeamWeek.set(teamKey, inner);
      }

      const defenseTotalsByTeam = new Map<string, {
        teamKey: string;
        totalFp: number;
        gamesPlayed: number;
        sacks: number;
        interceptions: number;
        fumbleRecoveries: number;
        tds: number;
      }>();
      for (const p of defenseBundle.players) {
        const abbr = resolveTeamAbbrForDisplay(p.team, p.position, p.name);
        if (!abbr || abbr === 'FA') continue;
        const teamKey = canonicalTeamAbbr(abbr) ?? abbr;
        if (defenseTotalsByTeam.has(teamKey)) continue;
        const teamGames = teamGamesByAbbr.get(teamKey);
        const ownByWeek = statsByTeamWeek.get(teamKey);
        if (!teamGames?.size) continue;

        let totalFp = 0;
        let gamesPlayed = 0;
        let sacks = 0;
        let interceptions = 0;
        let fumbleRecoveries = 0;
        let tds = 0;
        for (let week = 1; week <= 18; week++) {
          const game = teamGames.get(week);
          const s = ownByWeek?.get(week);
          const oppAbbr = game?.opponent ? statsTeamAbbrKey(game.opponent) : '';
          const opponentStats =
            oppAbbr && game?.opponent
              ? opponentStatsByTeamWeek.get(`${oppAbbr}__${week}`) ??
                opponentStatsByTeamWeek.get(`${game.opponent}__${week}`)
              : undefined;

          const input = buildDefenseFantasyGameInput(week, teamKey, game, s, opponentStats);
          if (input == null) continue;
          const wkFp = calculateDefenseFantasyPoints(input);
          if (wkFp == null) continue;
          totalFp += wkFp;
          gamesPlayed += 1;
          sacks += input.def_sacks ?? 0;
          interceptions += input.def_interceptions ?? 0;
          fumbleRecoveries +=
            input.fumble_recovery_opp != null
              ? input.fumble_recovery_opp
              : (input.def_fumbles ?? 0) + (input.opponent_sack_fumble_lost ?? 0);
          tds +=
            (input.def_tds ?? 0) +
            (input.def_fumble_recovery_tds ?? 0) +
            (input.def_special_teams_tds ?? 0);
        }

        if (gamesPlayed <= 0) continue;
        defenseTotalsByTeam.set(teamKey, {
          teamKey,
          totalFp,
          gamesPlayed,
          sacks,
          interceptions,
          fumbleRecoveries,
          tds,
        });
      }

      const rankedTeams = Array.from(defenseTotalsByTeam.values()).sort((a, b) => b.totalFp - a.totalFp);
      const rankByTeamKey = new Map<string, number>();
      rankedTeams.forEach((d, i) => {
        rankByTeamKey.set(d.teamKey, i + 1);
      });

      for (const p of defenseBundle.players) {
        const abbr = resolveTeamAbbrForDisplay(p.team, p.position, p.name);
        if (!abbr || abbr === 'FA') continue;
        const teamKey = canonicalTeamAbbr(abbr) ?? abbr;
        const d = defenseTotalsByTeam.get(teamKey);
        const posRank = rankByTeamKey.get(teamKey);
        if (!d || !posRank) continue;

        const syntheticIdFromName = `defense-${p.name.replace(/\s/g, '-').toLowerCase()}`;
        const defenseStats: Player2025Stats = {
          totalFantasyPoints: d.totalFp,
          positionRank: `D/ST${posRank}`,
          totalPassYards: 0,
          totalRushYards: 0,
          totalRecYards: 0,
          totalPassTds: 0,
          totalRushTds: 0,
          totalRecTds: 0,
          totalInterceptions: 0,
          totalTargets: 0,
          totalReceptions: 0,
          totalDefSacks: d.sacks,
          totalDefInterceptions: d.interceptions,
          totalDefFumbleRecoveries: d.fumbleRecoveries,
          totalDefTds: d.tds,
          gamesPlayed: d.gamesPlayed,
          avgPointsPerGame: d.gamesPlayed > 0 ? d.totalFp / d.gamesPlayed : null,
          kickerSeason: null,
        };
        map.set(p.id, defenseStats);
        map.set(syntheticIdFromName, defenseStats);
        map.set(`defense-${p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, defenseStats);
        map.set(`defense-${teamKey.toLowerCase()}`, defenseStats);
      }
    }

    return map;
  }, [rawRows, scoringFormat, defenseBundle]);
}
