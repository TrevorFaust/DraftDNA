import {
  DEFAULT_WEIGHTS,
  ROOMS,
  TEAM_COUNT,
  type League,
  type Room,
  type ScoredTeam,
  type Team,
} from './types'

export function ordinalPoints(placeIndex: number, _teamCount = TEAM_COUNT): number {
  return placeIndex + 1
}

export function formatPlace(place: number): string {
  const j = place % 10
  const k = place % 100
  if (k > 10 && k < 14) return `${place}th`
  if (j === 1) return `${place}st`
  if (j === 2) return `${place}nd`
  if (j === 3) return `${place}rd`
  return `${place}th`
}

export function clampRoomWeight(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, Math.round(value)))
}

export function sumWeights(weights: Record<Room, number>): number {
  return ROOMS.reduce((sum, room) => sum + clampRoomWeight(weights[room] ?? 0), 0)
}

export function normalizeWeights(
  weights: Record<Room, number>,
): Record<Room, number> | null {
  const next = Object.fromEntries(
    ROOMS.map((room) => [room, clampRoomWeight(weights[room] ?? 0)]),
  ) as Record<Room, number>
  if (sumWeights(next) !== 100) return null
  return next
}

function competitionPlaces(values: number[]): number[] {
  const indexed = values.map((value, index) => ({ value, index }))
  indexed.sort((a, b) => a.value - b.value)
  const places = Array.from({ length: values.length }, () => 1)
  let place = 1
  for (let i = 0; i < indexed.length; i++) {
    if (i > 0 && indexed[i].value > indexed[i - 1].value) {
      place = i + 1
    }
    places[indexed[i].index] = place
  }
  return places
}

export function scoreLeague(league: League): ScoredTeam[] {
  const { teams, weights, ordinalRanks } = league
  const roomPoints = Object.fromEntries(teams.map((team) => [team.id, emptyRoomRecord(0)])) as Record<
    string,
    Record<Room, number>
  >

  for (const room of ROOMS) {
    const order = completeOrder(ordinalRanks[room], teams)
    order.forEach((teamId, index) => {
      if (roomPoints[teamId]) {
        roomPoints[teamId][room] = ordinalPoints(index, teams.length)
      }
    })
  }

  const scored: ScoredTeam[] = teams.map((team) => {
    const points = roomPoints[team.id]
    const weighted = emptyRoomRecord(0)
    let total = 0
    for (const room of ROOMS) {
      const slice = points[room] * ((weights[room] ?? 0) / 100)
      weighted[room] = slice
      total += slice
    }
    total -= team.gutBump
    return {
      team,
      total: round2(total),
      roomPoints: points,
      roomPlace: emptyRoomRecord(1),
      weighted,
      rank: 1,
      tied: false,
    }
  })

  for (const room of ROOMS) {
    const places = competitionPlaces(scored.map((row) => row.roomPoints[room]))
    scored.forEach((row, i) => {
      row.roomPlace[room] = places[i]
    })
  }

  scored.sort((a, b) => {
    if (a.total !== b.total) return a.total - b.total
    if (a.roomPoints.RB !== b.roomPoints.RB) return a.roomPoints.RB - b.roomPoints.RB
    return a.team.name.localeCompare(b.team.name)
  })

  scored.forEach((row, i) => {
    row.rank = i + 1
    row.tied = scored.some((other) => other.team.id !== row.team.id && other.total === row.total)
  })

  return scored
}

export function completeOrder(order: string[] | undefined, teams: Team[]): string[] {
  const seen = new Set<string>()
  const next: string[] = []
  for (const id of order ?? []) {
    if (teams.some((team) => team.id === id) && !seen.has(id)) {
      next.push(id)
      seen.add(id)
    }
  }
  for (const team of teams) {
    if (!seen.has(team.id)) next.push(team.id)
  }
  return next
}

function emptyRoomRecord(value: number): Record<Room, number> {
  return Object.fromEntries(ROOMS.map((room) => [room, value])) as Record<Room, number>
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function defaultWeights(): Record<Room, number> {
  return { ...DEFAULT_WEIGHTS }
}
