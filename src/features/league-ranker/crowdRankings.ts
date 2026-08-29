import { completeOrder, normalizeWeights, scoreLeague } from './scoring'
import { sanitizeLeague } from './storage'
import { ROOMS, type League, type Room, type ScoredTeam } from './types'

export type CrowdVote = {
  team_number: number | null
  payload: unknown
}

export type CrowdRankingsResult = {
  contributorCount: number
  /** Average overall board place per team index (self-rank excluded). */
  overallAvgByIndex: number[]
  ordinalRanksByIndex: Record<Room, number[]>
  roomPlacesByIndex: Record<Room, number[]>
  averageWeights: League['weights']
}

function emptyIndexArray(length: number, fill = 0): number[] {
  return Array.from({ length }, () => fill)
}

function emptyRoomRecord(value: number): Record<Room, number> {
  return Object.fromEntries(ROOMS.map((room) => [room, value])) as Record<Room, number>
}

function placeForTeamIndex(league: League, room: Room, teamIndex: number): number | null {
  const teamId = league.teams[teamIndex]?.id
  if (!teamId) return null
  const order = completeOrder(league.ordinalRanks[room], league.teams)
  const index = order.indexOf(teamId)
  return index >= 0 ? index + 1 : null
}

export function aggregateCrowdRankings(
  votes: CrowdVote[],
  teamCount: number,
): CrowdRankingsResult | null {
  if (!votes.length || teamCount < 1) return null

  const sums = Object.fromEntries(
    ROOMS.map((room) => [room, emptyIndexArray(teamCount, 0)]),
  ) as Record<Room, number[]>
  const counts = Object.fromEntries(
    ROOMS.map((room) => [room, emptyIndexArray(teamCount, 0)]),
  ) as Record<Room, number[]>
  const overallSums = emptyIndexArray(teamCount, 0)
  const overallCounts = emptyIndexArray(teamCount, 0)
  const weightSums = Object.fromEntries(ROOMS.map((room) => [room, 0])) as Record<Room, number>
  let weightVotes = 0
  let contributors = 0

  for (const vote of votes) {
    const league = sanitizeLeague(vote.payload)
    if (!league || league.teams.length < teamCount) continue

    contributors += 1
    weightVotes += 1
    for (const room of ROOMS) {
      weightSums[room] += league.weights[room] ?? 0
    }

    const memberTeam = vote.team_number
    const personalBoard = scoreLeague(league)
    const overallById = Object.fromEntries(
      personalBoard.map((row) => [row.team.id, row.rank]),
    )

    for (let teamIndex = 0; teamIndex < teamCount; teamIndex += 1) {
      if (memberTeam != null && memberTeam === teamIndex + 1) continue

      const teamId = league.teams[teamIndex]?.id
      const overall = teamId ? overallById[teamId] : undefined
      if (overall != null) {
        overallSums[teamIndex] += overall
        overallCounts[teamIndex] += 1
      }

      for (const room of ROOMS) {
        const place = placeForTeamIndex(league, room, teamIndex)
        if (place == null) continue
        sums[room][teamIndex] += place
        counts[room][teamIndex] += 1
      }
    }
  }

  if (contributors === 0) return null

  const overallAvgByIndex = Array.from({ length: teamCount }, (_, teamIndex) => {
    const count = overallCounts[teamIndex]
    if (count <= 0) return teamIndex + 1
    return Math.round((overallSums[teamIndex] / count) * 100) / 100
  })

  const roomPlacesByIndex = Object.fromEntries(
    ROOMS.map((room) => [
      room,
      Array.from({ length: teamCount }, (_, teamIndex) => {
        const count = counts[room][teamIndex]
        if (count <= 0) return teamIndex + 1
        return Math.round((sums[room][teamIndex] / count) * 100) / 100
      }),
    ]),
  ) as Record<Room, number[]>

  const ordinalRanksByIndex = Object.fromEntries(
    ROOMS.map((room) => {
      const indices = Array.from({ length: teamCount }, (_, index) => index)
      indices.sort((a, b) => {
        const avgA = roomPlacesByIndex[room][a]
        const avgB = roomPlacesByIndex[room][b]
        if (avgA !== avgB) return avgA - avgB
        return a - b
      })
      return [room, indices]
    }),
  ) as Record<Room, number[]>

  const rawWeights = Object.fromEntries(
    ROOMS.map((room) => [
      room,
      weightVotes > 0 ? Math.round(weightSums[room] / weightVotes) : 0,
    ]),
  ) as League['weights']
  const averageWeights = normalizeWeights(rawWeights) ?? rawWeights

  return {
    contributorCount: contributors,
    overallAvgByIndex,
    ordinalRanksByIndex,
    roomPlacesByIndex,
    averageWeights,
  }
}

export function buildCrowdLeague(baseLeague: League, crowd: CrowdRankingsResult): League {
  const ordinalRanks = Object.fromEntries(
    ROOMS.map((room) => [
      room,
      crowd.ordinalRanksByIndex[room].map((index) => baseLeague.teams[index]?.id).filter(Boolean),
    ]),
  ) as Record<Room, string[]>

  return {
    ...baseLeague,
    teams: baseLeague.teams.map((team) => ({ ...team, gutBump: 0 })),
    weights: crowd.averageWeights,
    ordinalRanks: Object.fromEntries(
      ROOMS.map((room) => [room, completeOrder(ordinalRanks[room], baseLeague.teams)]),
    ) as Record<Room, string[]>,
  }
}

/** Board ordered by average overall place across members (self-rank excluded). */
export function scoreCrowdBoard(baseLeague: League, crowd: CrowdRankingsResult): ScoredTeam[] {
  const roomPlaceByIndex = Object.fromEntries(
    ROOMS.map((room) => {
      const places = emptyIndexArray(baseLeague.teams.length, 1)
      crowd.ordinalRanksByIndex[room].forEach((teamIndex, placeIndex) => {
        places[teamIndex] = placeIndex + 1
      })
      return [room, places]
    }),
  ) as Record<Room, number[]>

  const scored: ScoredTeam[] = baseLeague.teams.map((team, index) => {
    const roomPlace = Object.fromEntries(
      ROOMS.map((room) => [room, roomPlaceByIndex[room][index] ?? index + 1]),
    ) as Record<Room, number>
    const roomPoints = Object.fromEntries(
      ROOMS.map((room) => [room, crowd.roomPlacesByIndex[room][index] ?? index + 1]),
    ) as Record<Room, number>

    return {
      team: { ...team, gutBump: 0 },
      total: crowd.overallAvgByIndex[index] ?? index + 1,
      roomPoints,
      roomPlace,
      weighted: emptyRoomRecord(0),
      rank: 1,
      tied: false,
    }
  })

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
