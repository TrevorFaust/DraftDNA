import { newId, ROOMS, TEAM_COUNT, type League, type Room, type RoomMode, type Team } from './types'
import { coerceRoom, isIgnoredRosterLabel, limitSpecialTeams } from './parser'
import { completeOrder, defaultWeights, ordinalPoints } from './scoring'

export const LEGACY_STORAGE_KEY = 'fantasy-ranker-v1'
export const GUEST_STORAGE_KEY = 'fantasy-ranker-v1:guest'
export const MIN_TEAM_COUNT = 4
export const MAX_TEAM_COUNT = 32

export type LeagueSeed = {
  teamCount: number
  names: string[]
}

export function clampTeamCount(value: unknown, fallback = TEAM_COUNT): number {
  const n = typeof value === 'number' ? value : parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(n)) return fallback
  return Math.min(MAX_TEAM_COUNT, Math.max(MIN_TEAM_COUNT, Math.round(n)))
}

export function storageKeyForLeague(leagueId: string | null, userId?: string | null): string {
  if (!leagueId) return GUEST_STORAGE_KEY
  return userId ? `${LEGACY_STORAGE_KEY}:${leagueId}:${userId}` : `${LEGACY_STORAGE_KEY}:${leagueId}`
}

/** Copy rosters from a commissioner board, but start room ranks fresh. */
export function seedPersonalBoard(source: League | null, seed: LeagueSeed): League {
  const next = createEmptyLeague(seed.teamCount, seed.names)
  if (!source) return next
  const aligned = alignLeagueToSeed(source, seed)
  return {
    ...next,
    teams: next.teams.map((team, index) => ({
      ...team,
      name: aligned.teams[index]?.name ?? team.name,
      players: aligned.teams[index]?.players ?? [],
    })),
  }
}

export function createEmptyLeague(teamCount = TEAM_COUNT, names: string[] = []): League {
  const count = clampTeamCount(teamCount)
  const teams: Team[] = Array.from({ length: count }, (_, i) => ({
    id: newId(),
    name: names[i]?.trim() || `Team ${i + 1}`,
    players: [],
    gutBump: 0,
  }))
  const ids = teams.map((team) => team.id)
  const customScores = Object.fromEntries(
    ROOMS.map((room) => [
      room,
      Object.fromEntries(ids.map((id, index) => [id, ordinalPoints(index, teams.length)])),
    ]),
  ) as League['customScores']

  return {
    teams,
    weights: defaultWeights(),
    roomMode: Object.fromEntries(ROOMS.map((room) => [room, 'ordinal'])) as Record<Room, RoomMode>,
    ordinalRanks: Object.fromEntries(ROOMS.map((room) => [room, [...ids]])) as League['ordinalRanks'],
    customScores,
  }
}

function migrateLegacyBoard(key: string) {
  if (key === LEGACY_STORAGE_KEY) return
  const legacy = localStorage.getItem(LEGACY_STORAGE_KEY)
  if (!legacy) return
  localStorage.setItem(key, legacy)
  localStorage.removeItem(LEGACY_STORAGE_KEY)
}

function migrateSharedLeagueKey(key: string) {
  const match = key.match(/^(fantasy-ranker-v1:[^:]+):[^:]+$/)
  if (!match) return
  const shared = match[1]
  if (localStorage.getItem(key) || !localStorage.getItem(shared)) return
  localStorage.setItem(key, localStorage.getItem(shared) as string)
}

export function loadLeague(key: string, seed?: LeagueSeed): League {
  const fallback = seed ?? { teamCount: TEAM_COUNT, names: [] }
  try {
    migrateSharedLeagueKey(key)
    const raw = localStorage.getItem(key)
    if (raw) {
      const parsed = sanitizeLeague(JSON.parse(raw))
      if (parsed) return alignLeagueToSeed(parsed, fallback)
    }
    migrateLegacyBoard(key)
    const migrated = localStorage.getItem(key)
    if (migrated) {
      const parsed = sanitizeLeague(JSON.parse(migrated))
      if (parsed) return alignLeagueToSeed(parsed, fallback)
    }
  } catch {
    // Fall through to a fresh board.
  }
  return createEmptyLeague(fallback.teamCount, fallback.names)
}

export function saveLeague(key: string, league: League): void {
  localStorage.setItem(key, JSON.stringify(league))
}

export function sanitizeLeague(input: unknown): League | null {
  if (!input || typeof input !== 'object') return null
  const data = input as Partial<League>
  if (!Array.isArray(data.teams) || data.teams.length === 0) return null

  const teams: Team[] = data.teams.map((team, index) => ({
    id: typeof team?.id === 'string' ? team.id : newId(),
    name: typeof team?.name === 'string' && team.name.trim() ? team.name.trim() : `Team ${index + 1}`,
    gutBump: clamp(Number(team?.gutBump) || 0, -5, 5),
    players: Array.isArray(team?.players)
      ? limitSpecialTeams(
          team.players
            .filter((player) =>
              player &&
              typeof player.name === 'string' &&
              player.name.trim() &&
              !isIgnoredRosterLabel(player.name),
            )
            .map((player) => ({
              id: typeof player.id === 'string' ? player.id : newId(),
              name: player.name.trim(),
              room: coerceRoom(player.room, typeof player.position === 'string' ? player.position : undefined),
              position: typeof player.position === 'string' && player.position.trim()
                ? player.position.trim()
                : undefined,
              nflTeam: typeof player.nflTeam === 'string' && player.nflTeam.trim()
                ? player.nflTeam.trim().toUpperCase()
                : undefined,
              unassigned: player.unassigned ? true : undefined,
              ir: player.ir ? true : undefined,
              lineupSlot:
                typeof player.lineupSlot === 'string' && player.lineupSlot.trim()
                  ? player.lineupSlot.trim()
                  : undefined,
            })),
        )
      : [],
  }))

  const weights = defaultWeights()
  const rawWeights = data.weights as Record<string, number> | undefined
  if (rawWeights && typeof rawWeights.MISC === 'number' && rawWeights.DST == null && rawWeights.BENCH == null) {
    const misc = Math.max(0, rawWeights.MISC)
    weights.DST = Math.round(misc * 0.8)
    weights.BENCH = misc - weights.DST
  }
  if (rawWeights) {
    for (const room of ROOMS) {
      if (typeof rawWeights[room] === 'number') weights[room] = rawWeights[room]
    }
  }

  const roomMode = Object.fromEntries(ROOMS.map((room) => [room, 'ordinal'])) as Record<Room, RoomMode>
  const rawMode = data.roomMode as Record<string, RoomMode> | undefined
  if (rawMode) {
    for (const room of ROOMS) {
      if (rawMode[room] === 'custom' || rawMode[room] === 'ordinal') {
        roomMode[room] = rawMode[room]
      }
    }
    if (!rawMode.BENCH && (rawMode.MISC === 'custom' || rawMode.MISC === 'ordinal')) {
      roomMode.BENCH = rawMode.MISC
    }
  }

  const rawRanks = data.ordinalRanks as Record<string, string[]> | undefined
  const ordinalRanks = {
    QB: completeOrder(rawRanks?.QB, teams),
    RB: completeOrder(rawRanks?.RB, teams),
    WR: completeOrder(rawRanks?.WR, teams),
    TE: completeOrder(rawRanks?.TE, teams),
    DST: completeOrder(rawRanks?.DST, teams),
    BENCH: completeOrder(rawRanks?.BENCH ?? rawRanks?.MISC, teams),
  }

  const rawScores = data.customScores as Record<string, Record<string, number>> | undefined
  const customScores = Object.fromEntries(
    ROOMS.map((room) => {
      const source = rawScores?.[room] ?? (room === 'BENCH' ? rawScores?.MISC : undefined) ?? {}
      const next: Record<string, number> = {}
      teams.forEach((team, index) => {
        const value = source[team.id]
        next[team.id] = typeof value === 'number' && Number.isFinite(value)
          ? value
          : ordinalPoints(index, teams.length)
      })
      return [room, next]
    }),
  ) as League['customScores']

  return { teams, weights, roomMode, ordinalRanks, customScores }
}

export function alignLeagueToSeed(league: League, seed: LeagueSeed): League {
  const count = clampTeamCount(seed.teamCount)
  if (league.teams.length === count) return league

  const names = seed.names ?? []
  const teams =
    league.teams.length > count
      ? league.teams.slice(0, count)
      : [
          ...league.teams,
          ...Array.from({ length: count - league.teams.length }, (_, offset) => {
            const index = league.teams.length + offset
            return {
              id: newId(),
              name: names[index]?.trim() || `Team ${index + 1}`,
              players: [] as Team['players'],
              gutBump: 0,
            }
          }),
        ]

  const ordinalRanks = {
    QB: completeOrder(league.ordinalRanks.QB, teams),
    RB: completeOrder(league.ordinalRanks.RB, teams),
    WR: completeOrder(league.ordinalRanks.WR, teams),
    TE: completeOrder(league.ordinalRanks.TE, teams),
    DST: completeOrder(league.ordinalRanks.DST, teams),
    BENCH: completeOrder(league.ordinalRanks.BENCH, teams),
  }

  const customScores = Object.fromEntries(
    ROOMS.map((room) => {
      const source = league.customScores[room] ?? {}
      const next: Record<string, number> = {}
      teams.forEach((team, index) => {
        const value = source[team.id]
        next[team.id] =
          typeof value === 'number' && Number.isFinite(value)
            ? value
            : ordinalPoints(index, teams.length)
      })
      return [room, next]
    }),
  ) as League['customScores']

  return { ...league, teams, ordinalRanks, customScores }
}

/** Shared league rosters overlay personal boards by team index. */
export function overlaySharedRosters(league: League, rosters: Team['players'][] | null | undefined): League {
  if (!rosters?.length) return league
  return {
    ...league,
    teams: league.teams.map((team, index) => {
      const players = rosters[index]
      if (!Array.isArray(players)) return team
      return { ...team, players }
    }),
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}
