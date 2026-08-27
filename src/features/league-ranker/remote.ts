import type { Json } from '@/integrations/supabase/types'
import { supabase } from '@/integrations/supabase/client'
import { sanitizeLeague, seedPersonalBoard, type LeagueSeed } from './storage'
import type { League, Player } from './types'

export type RankingsFetch =
  | { ok: true; league: League | null }
  | { ok: false }

const RANKER_ROSTERS = 'league_ranker_rosters'

function sanitizeRosterLists(input: unknown): Player[][] | null {
  if (!Array.isArray(input) || !input.length) return null
  const dummy = sanitizeLeague({
    teams: input.map((players, index) => ({
      id: `roster-${index}`,
      name: `Team ${index + 1}`,
      gutBump: 0,
      players: Array.isArray(players) ? players : [],
    })),
  })
  return dummy?.teams.map((team) => team.players) ?? null
}

async function selectPayload(leagueId: string, userId: string): Promise<RankingsFetch> {
  const { data, error } = await supabase
    .from('league_team_rankings')
    .select('payload')
    .eq('league_id', leagueId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) return { ok: false }
  if (!data?.payload) return { ok: true, league: null }
  return { ok: true, league: sanitizeLeague(data.payload) }
}

export async function fetchLeagueRankings(params: {
  leagueId: string
  userId: string
  ownerId?: string | null
  seed: LeagueSeed
}): Promise<RankingsFetch> {
  const own = await selectPayload(params.leagueId, params.userId)
  if (!own.ok) return own
  if (own.league) return own

  const ownerId = params.ownerId
  if (!ownerId || ownerId === params.userId) {
    return { ok: true, league: null }
  }

  const owner = await selectPayload(params.leagueId, ownerId)
  if (!owner.ok) return owner
  return { ok: true, league: seedPersonalBoard(owner.league, params.seed) }
}

export async function saveLeagueRankings(
  leagueId: string,
  payload: League,
  userId: string,
): Promise<boolean> {
  const { error } = await supabase.from('league_team_rankings').upsert(
    {
      league_id: leagueId,
      user_id: userId,
      payload: JSON.parse(JSON.stringify(payload)) as Json,
      updated_at: new Date().toISOString(),
      updated_by: userId,
    },
    { onConflict: 'league_id,user_id' },
  )
  return !error
}

export async function fetchSharedRankerRosters(leagueId: string): Promise<Player[][] | null> {
  const { data, error } = await supabase
    .from(RANKER_ROSTERS as never)
    .select('payload')
    .eq('league_id', leagueId)
    .maybeSingle()

  if (error || !data || typeof data !== 'object' || !('payload' in data)) return null
  const payload = (data as { payload?: unknown }).payload
  if (!payload || typeof payload !== 'object') return null
  return sanitizeRosterLists((payload as { teams?: unknown }).teams)
}

export async function saveSharedRankerRosters(
  leagueId: string,
  teams: Player[][],
  _userId: string,
): Promise<boolean> {
  const { error } = await supabase.rpc('league_save_ranker_rosters' as never, {
    p_league_id: leagueId,
    p_teams: JSON.parse(JSON.stringify(teams)),
  })
  return !error
}
