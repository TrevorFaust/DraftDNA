import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  completeOrder,
  normalizeWeights,
  scoreLeague,
} from './scoring'
import { loadLeague, sanitizeLeague, saveLeague, alignLeagueToSeed, overlaySharedRosters, type LeagueSeed } from './storage'
import { applyLineupRoster, capBenchAndIr, swapLineupSlots, type LineupSlotKey } from './lineupRooms'
import { parseManualPlayer } from './parser'
import { fetchLeagueRankings, fetchSharedRankerRosters, saveLeagueRankings, saveSharedRankerRosters } from './remote'
import {
  ROOMS,
  type League,
  type Player,
  type Room,
  type ScoredTeam,
} from './types'
import type { PositionLimitsLike } from '@/utils/rosterSlots'
import { supabase } from '@/integrations/supabase/client'

export type RankerOptions = {
  canEdit: boolean
  canManageRosters?: boolean
  canEditLineup?: boolean
  /** 0-based board index, `all` for guest/commissioner, `null` until a member claims a seat. */
  lineupTeamIndex?: number | 'all' | null
  leagueId?: string | null
  userId?: string | null
  ownerId?: string | null
  lineupLimits?: PositionLimitsLike | null
  isSuperflex?: boolean
}

function withLineupRooms(
  league: League,
  limits: PositionLimitsLike | null | undefined,
  isSuperflex: boolean,
): League {
  return {
    ...league,
    teams: league.teams.map((team) => ({
      ...team,
      players: applyLineupRoster(team.players, limits, isSuperflex).players,
    })),
  }
}

export function useLeague(storageKey: string, seed: LeagueSeed, options: RankerOptions) {
  const seedRef = useRef(seed)
  seedRef.current = seed
  const keyRef = useRef(storageKey)
  const optionsRef = useRef(options)
  optionsRef.current = options
  const skipRemoteSave = useRef(true)
  const skipSharedSave = useRef(true)
  const lastLineupKey = useRef<string | null>(null)
  const [league, setLeague] = useState<League>(() => loadLeague(storageKey, seed))
  const [hydrated, setHydrated] = useState(!options.leagueId)
  const shaped = useMemo(() => sanitizeLeague(league) ?? league, [league])
  const lineupKey = `${JSON.stringify(options.lineupLimits ?? null)}|${Boolean(options.isSuperflex)}`

  useEffect(() => {
    if (ROOMS.some((room) => typeof league.weights?.[room] !== 'number')) {
      setLeague(shaped)
    }
  }, [league, shaped])

  useEffect(() => {
    if (keyRef.current !== storageKey) {
      keyRef.current = storageKey
      skipRemoteSave.current = true
      skipSharedSave.current = true
      lastLineupKey.current = null
      setHydrated(!optionsRef.current.leagueId)
      setLeague(loadLeague(storageKey, seedRef.current))
      return
    }
    saveLeague(storageKey, shaped)
  }, [shaped, storageKey])

  useEffect(() => {
    const leagueId = options.leagueId
    const userId = options.userId
    if (!leagueId || !userId) {
      skipRemoteSave.current = false
      setHydrated(true)
      return
    }
    let cancelled = false
    skipRemoteSave.current = true
    skipSharedSave.current = true
    setHydrated(false)
    void (async () => {
      const [result, shared] = await Promise.all([
        fetchLeagueRankings({
          leagueId,
          userId,
          ownerId: optionsRef.current.ownerId,
          seed: seedRef.current,
        }),
        fetchSharedRankerRosters(leagueId),
      ])
      if (cancelled) return
      if (!result.ok) {
        skipRemoteSave.current = true
        skipSharedSave.current = true
        setHydrated(true)
        return
      }
      if (result.league) {
        const aligned = alignLeagueToSeed(result.league, seedRef.current)
        setLeague(shared?.some((roster) => roster.length) ? overlaySharedRosters(aligned, shared) : aligned)
      } else if (shared?.some((roster) => roster.length)) {
        setLeague((prev) => overlaySharedRosters(prev, shared))
      }
      skipRemoteSave.current = false
      skipSharedSave.current = false
      setHydrated(true)
    })()
    return () => {
      cancelled = true
    }
  }, [options.leagueId, options.userId, storageKey])

  useEffect(() => {
    if (!hydrated) return
    setLeague((prev) => {
      const next = alignLeagueToSeed(prev, seedRef.current)
      return next === prev ? prev : next
    })
  }, [hydrated, seed.teamCount])

  useEffect(() => {
    if (!options.canEdit || !hydrated) return
    if (lastLineupKey.current === lineupKey) return
    lastLineupKey.current = lineupKey
    setLeague((prev) => withLineupRooms(prev, options.lineupLimits, Boolean(options.isSuperflex)))
  }, [hydrated, lineupKey, options.canEdit, options.isSuperflex, options.lineupLimits])

  useEffect(() => {
    const { canEdit, leagueId, userId } = optionsRef.current
    if (!canEdit || !leagueId || !userId || skipRemoteSave.current || !hydrated) return
    const timer = window.setTimeout(() => {
      void saveLeagueRankings(leagueId, shaped, userId)
    }, 800)
    return () => window.clearTimeout(timer)
  }, [shaped, hydrated])

  const rosterSignature = useMemo(
    () => JSON.stringify(shaped.teams.map((team) => team.players)),
    [shaped.teams],
  )

  useEffect(() => {
    const { canEditLineup, canManageRosters, leagueId, userId } = optionsRef.current
    if (!leagueId || !userId || skipSharedSave.current || !hydrated) return
    if (!canEditLineup && !canManageRosters) return
    const timer = window.setTimeout(() => {
      void saveSharedRankerRosters(
        leagueId,
        shaped.teams.map((team) => team.players),
        userId,
      )
    }, 800)
    return () => window.clearTimeout(timer)
  }, [hydrated, rosterSignature, shaped.teams])

  useEffect(() => {
    const leagueId = options.leagueId
    const userId = options.userId
    if (!leagueId || !userId) return
    const channel = supabase
      .channel(`ranker-rosters-${leagueId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'league_ranker_rosters',
          filter: `league_id=eq.${leagueId}`,
        },
        (payload) => {
          const next = payload.new as { payload?: { teams?: unknown }; updated_by?: string } | null
          if (!next?.payload || next.updated_by === userId) return
          const dummy = sanitizeLeague({
            teams: Array.isArray(next.payload.teams)
              ? next.payload.teams.map((players, index) => ({
                  id: `roster-${index}`,
                  name: `Team ${index + 1}`,
                  gutBump: 0,
                  players: Array.isArray(players) ? players : [],
                }))
              : [],
          })
          if (!dummy) return
          skipSharedSave.current = true
          setLeague((prev) => overlaySharedRosters(prev, dummy.teams.map((team) => team.players)))
          window.setTimeout(() => {
            skipSharedSave.current = false
          }, 50)
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [options.leagueId, options.userId])

  const displayLeague = useMemo(() => {
    if (options.canEdit) return shaped
    return withLineupRooms(shaped, options.lineupLimits, Boolean(options.isSuperflex))
  }, [options.canEdit, options.isSuperflex, options.lineupLimits, shaped])

  const board = useMemo(() => scoreLeague(displayLeague), [displayLeague])

  const applyIfEditable = useCallback((fn: (prev: League) => League) => {
    if (!optionsRef.current.canEdit) return
    setLeague(fn)
  }, [])

  const applyIfRoster = useCallback((fn: (prev: League) => League) => {
    const { canManageRosters, canEdit } = optionsRef.current
    if (!(canManageRosters ?? canEdit)) return
    setLeague(fn)
  }, [])

  const renameTeam = useCallback((id: string, name: string) => {
    applyIfRoster((prev) => ({
      ...prev,
      teams: prev.teams.map((team) => (team.id === id ? { ...team, name } : team)),
    }))
  }, [applyIfRoster])

  const setGutBump = useCallback((id: string, value: number) => {
    const gutBump = Math.min(5, Math.max(-5, Math.round(value * 10) / 10))
    applyIfEditable((prev) => ({
      ...prev,
      teams: prev.teams.map((team) => (team.id === id ? { ...team, gutBump } : team)),
    }))
  }, [applyIfEditable])

  const setRoster = useCallback((id: string, players: Player[], mode: 'replace' | 'append') => {
    const { lineupLimits, isSuperflex } = optionsRef.current
    applyIfRoster((prev) => ({
      ...prev,
      teams: prev.teams.map((team) => {
        if (team.id !== id) return team
        const merged = mode === 'append' ? [...team.players, ...players] : players
        return {
          ...team,
          players: applyLineupRoster(merged, lineupLimits, Boolean(isSuperflex)).players,
        }
      }),
    }))
  }, [applyIfRoster])

  const swapLineup = useCallback((teamId: string, from: LineupSlotKey, to: LineupSlotKey) => {
    const { canEditLineup, canEdit, canManageRosters, lineupTeamIndex, lineupLimits, isSuperflex } =
      optionsRef.current
    if (!(canEditLineup ?? canEdit)) return
    setLeague((prev) => {
      const index = prev.teams.findIndex((team) => team.id === teamId)
      if (index < 0) return prev
      const allowed =
        Boolean(canManageRosters) ||
        lineupTeamIndex === 'all' ||
        (typeof lineupTeamIndex === 'number' && index === lineupTeamIndex)
      if (!allowed) return prev
      return {
        ...prev,
        teams: prev.teams.map((team) => {
          if (team.id !== teamId) return team
          const nextPlayers = swapLineupSlots(team.players, from, to, lineupLimits, Boolean(isSuperflex))
          return nextPlayers ? { ...team, players: nextPlayers } : team
        }),
      }
    })
  }, [])

  const updatePlayer = useCallback((teamId: string, player: Player) => {
    const { lineupLimits } = optionsRef.current
    applyIfRoster((prev) => ({
      ...prev,
      teams: prev.teams.map((team) => {
        if (team.id !== teamId) return team
        const nextPlayers = team.players.map((item) => (item.id === player.id ? player : item))
        const { dropped } = capBenchAndIr(nextPlayers, lineupLimits)
        if (dropped.length) return team
        return { ...team, players: nextPlayers }
      }),
    }))
  }, [applyIfRoster])

  const removePlayer = useCallback((teamId: string, playerId: string) => {
    const { lineupLimits, isSuperflex } = optionsRef.current
    applyIfRoster((prev) => ({
      ...prev,
      teams: prev.teams.map((team) =>
        team.id === teamId
          ? {
              ...team,
              players: applyLineupRoster(
                team.players.filter((player) => player.id !== playerId),
                lineupLimits,
                Boolean(isSuperflex),
              ).players,
            }
          : team,
      ),
    }))
  }, [applyIfRoster])

  const addPlayer = useCallback((teamId: string, name: string, room: Room) => {
    const incoming = parseManualPlayer(name, room)
    if (!incoming) return
    const { lineupLimits, isSuperflex } = optionsRef.current
    applyIfRoster((prev) => ({
      ...prev,
      teams: prev.teams.map((team) =>
        team.id === teamId
          ? {
              ...team,
              players: applyLineupRoster(
                [...team.players, incoming],
                lineupLimits,
                Boolean(isSuperflex),
              ).players,
            }
          : team,
      ),
    }))
  }, [applyIfRoster])

  const setOrdinalOrder = useCallback((room: Room, ids: string[]) => {
    applyIfEditable((prev) => ({
      ...prev,
      ordinalRanks: {
        ...prev.ordinalRanks,
        [room]: completeOrder(ids, prev.teams),
      },
    }))
  }, [applyIfEditable])

  const setWeights = useCallback((weights: League['weights']) => {
    const next = normalizeWeights(weights)
    if (!next) return false
    applyIfEditable((prev) => ({ ...prev, weights: next }))
    return true
  }, [applyIfEditable])

  const resetTeam = useCallback((id: string) => {
    applyIfRoster((prev) => ({
      ...prev,
      teams: prev.teams.map((team) =>
        team.id === id ? { ...team, players: [], gutBump: 0 } : team,
      ),
    }))
  }, [applyIfRoster])

  return {
    league: displayLeague,
    board,
    hydrated,
    renameTeam,
    setGutBump,
    setRoster,
    swapLineup,
    updatePlayer,
    removePlayer,
    addPlayer,
    setOrdinalOrder,
    setWeights,
    resetTeam,
  }
}

export type LeagueApi = ReturnType<typeof useLeague> & { board: ScoredTeam[] }
