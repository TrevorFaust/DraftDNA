import {
  buildStartingSlots,
  getBenchCount,
  getIrCount,
  normalizeRosterPos,
  type PositionLimitsLike,
} from '@/utils/rosterSlots'
import type { Player, Room } from './types'

function playerNflPos(player: Player): string | null {
  const pos = (player.position ?? '').toUpperCase()
  if (pos === 'BN' || pos === 'BE' || pos === 'BENCH') return null
  if (pos === 'K' || pos === 'PK' || pos === 'KICKER') return 'K'
  if (pos === 'D/ST' || pos === 'DST' || pos === 'DEF' || pos === 'DEFENSE') return 'DEF'
  if (/d\/st|defense/i.test(player.name)) return 'DEF'
  const normalized = normalizeRosterPos(pos || player.room)
  if (normalized === 'QB' || normalized === 'RB' || normalized === 'WR' || normalized === 'TE') {
    return normalized
  }
  if (normalized === 'K') return 'K'
  if (normalized === 'DEF') return 'DEF'
  return null
}

function playerLineupPos(player: Player): string | null {
  if (player.ir) return null
  return playerNflPos(player)
}

function roomForFilledSlot(slotLabel: string, player: Player): Room {
  if (slotLabel.startsWith('QB')) return 'QB'
  if (slotLabel.startsWith('RB')) return 'RB'
  if (slotLabel.startsWith('WR')) return 'WR'
  if (slotLabel.startsWith('TE')) return 'TE'
  if (slotLabel.startsWith('DEF') || slotLabel === 'K' || slotLabel.startsWith('K')) return 'DST'

  const pos = playerNflPos(player)
  if (pos === 'QB') return 'QB'
  if (pos === 'RB') return 'RB'
  if (pos === 'WR') return 'WR'
  if (pos === 'TE') return 'TE'
  if (pos === 'K' || pos === 'DEF') return 'DST'
  return 'BENCH'
}

export type LineupSlotKey =
  | { kind: 'starter'; index: number }
  | { kind: 'bench'; index: number }
  | { kind: 'ir'; index: number }

export function encodeLineupSlot(slot: LineupSlotKey): string {
  if (slot.kind === 'starter') return `s:${slot.index}`
  if (slot.kind === 'bench') return `b:${slot.index}`
  return `i:${slot.index}`
}

export function parseLineupSlot(value?: string): LineupSlotKey | null {
  if (!value) return null
  const match = /^(s|b|i):(\d+)$/.exec(value.trim())
  if (!match) return null
  const index = Number(match[2])
  if (!Number.isInteger(index) || index < 0) return null
  if (match[1] === 's') return { kind: 'starter', index }
  if (match[1] === 'b') return { kind: 'bench', index }
  return { kind: 'ir', index }
}

function sameSlot(a: LineupSlotKey, b: LineupSlotKey): boolean {
  return a.kind === b.kind && a.index === b.index
}

export type RankerLineupRow = { label: string; player: Player | null }

export type RankerLineupFill = {
  starters: RankerLineupRow[]
  bench: RankerLineupRow[]
  ir: RankerLineupRow[]
}

function rowAt(fill: RankerLineupFill, slot: LineupSlotKey): RankerLineupRow | null {
  if (slot.kind === 'starter') return fill.starters[slot.index] ?? null
  if (slot.kind === 'bench') return fill.bench[slot.index] ?? null
  return fill.ir[slot.index] ?? null
}

function walkSlots(fill: RankerLineupFill): LineupSlotKey[] {
  return [
    ...fill.starters.map((_, index) => ({ kind: 'starter' as const, index })),
    ...fill.bench.map((_, index) => ({ kind: 'bench' as const, index })),
    ...fill.ir.map((_, index) => ({ kind: 'ir' as const, index })),
  ]
}

function flexQbLocked(
  fill: RankerLineupFill,
  slots: ReturnType<typeof buildStartingSlots>,
  destIndex: number,
  playerId: string,
): boolean {
  return fill.starters.some((row, index) => {
    if (index === destIndex || slots[index]?.label !== 'FLEX' || !row.player) return false
    if (row.player.id === playerId) return false
    return playerNflPos(row.player) === 'QB'
  })
}

function slotAcceptsPlayer(
  dest: LineupSlotKey,
  player: Player,
  fill: RankerLineupFill,
  limits: PositionLimitsLike | null | undefined,
  isSuperflex: boolean,
): boolean {
  if (dest.kind === 'bench' || dest.kind === 'ir') return true
  const slots = buildStartingSlots(limits, isSuperflex)
  const slot = slots[dest.index]
  if (!slot) return false
  const pos = playerNflPos(player)
  if (!pos) return false
  let positions = slot.positions
  if (slot.label === 'FLEX' && isSuperflex && flexQbLocked(fill, slots, dest.index, player.id)) {
    positions = ['RB', 'WR', 'TE']
  }
  return positions.some((slotPos) => normalizeRosterPos(slotPos) === pos)
}

function playersFromFill(
  fill: RankerLineupFill,
  limits: PositionLimitsLike | null | undefined,
  isSuperflex: boolean,
): Player[] {
  const slots = buildStartingSlots(limits, isSuperflex)
  const next: Player[] = []
  fill.starters.forEach((row, index) => {
    if (!row.player) return
    next.push({
      ...row.player,
      room: roomForFilledSlot(slots[index]?.label ?? row.label, row.player),
      ir: undefined,
      unassigned: undefined,
      lineupSlot: encodeLineupSlot({ kind: 'starter', index }),
    })
  })
  fill.bench.forEach((row, index) => {
    if (!row.player) return
    next.push({
      ...row.player,
      room: 'BENCH',
      ir: undefined,
      unassigned: undefined,
      lineupSlot: encodeLineupSlot({ kind: 'bench', index }),
    })
  })
  fill.ir.forEach((row, index) => {
    if (!row.player) return
    next.push({
      ...row.player,
      room: 'BENCH',
      ir: true,
      unassigned: undefined,
      lineupSlot: encodeLineupSlot({ kind: 'ir', index }),
    })
  })
  return next
}

/** Fill league lineup slots. Explicit lineupSlot wins; leftover seats fill like a draft roster. */
export function fillRankerLineup(
  players: Player[],
  limits?: PositionLimitsLike | null,
  isSuperflex = false,
): RankerLineupFill {
  const slots = buildStartingSlots(limits, isSuperflex)
  const benchMax = getBenchCount(limits)
  const irMax = getIrCount(limits)
  const usable = players.filter((player) => !player.unassigned)
  const assigned = new Set<string>()

  const starters: RankerLineupRow[] = slots.map((slot) => ({ label: slot.label, player: null }))
  const bench: RankerLineupRow[] = Array.from({ length: benchMax }, () => ({ label: 'BN', player: null }))
  const ir: RankerLineupRow[] = Array.from({ length: irMax }, () => ({ label: 'IR', player: null }))

  const place = (player: Player, dest: LineupSlotKey) => {
    if (assigned.has(player.id)) return false
    if (dest.kind === 'starter') {
      const row = starters[dest.index]
      if (!row || row.player) return false
      row.player = player
      assigned.add(player.id)
      return true
    }
    if (dest.kind === 'bench') {
      const row = bench[dest.index]
      if (!row || row.player) return false
      row.player = player
      assigned.add(player.id)
      return true
    }
    const row = ir[dest.index]
    if (!row || row.player) return false
    row.player = player
    assigned.add(player.id)
    return true
  }

  for (const player of usable) {
    const dest = parseLineupSlot(player.lineupSlot)
    if (dest) place(player, dest)
  }

  for (const player of usable) {
    if (assigned.has(player.id) || !player.ir) continue
    const hole = ir.findIndex((row) => !row.player)
    if (hole >= 0) place(player, { kind: 'ir', index: hole })
  }

  let qbPlacedInFlex = starters.some(
    (row, index) => slots[index]?.label === 'FLEX' && row.player && playerNflPos(row.player) === 'QB',
  )

  for (let index = 0; index < slots.length; index += 1) {
    if (starters[index].player) continue
    const slot = slots[index]
    const isFlex = slot.label === 'FLEX'
    const effectivePositions =
      isFlex && isSuperflex && qbPlacedInFlex ? ['RB', 'WR', 'TE'] : slot.positions
    const player = usable.find((item) => {
      if (assigned.has(item.id) || item.ir) return false
      const locked = parseLineupSlot(item.lineupSlot)
      if (locked?.kind === 'bench' || locked?.kind === 'ir') return false
      const pos = playerLineupPos(item)
      if (!pos) return false
      return effectivePositions.some((slotPos) => normalizeRosterPos(slotPos) === pos)
    })
    if (!player) continue
    place(player, { kind: 'starter', index })
    if (isFlex && playerNflPos(player) === 'QB') qbPlacedInFlex = true
  }

  for (const player of usable) {
    if (assigned.has(player.id)) continue
    const hole = bench.findIndex((row) => !row.player)
    if (hole >= 0) place(player, { kind: 'bench', index: hole })
  }

  return { starters, bench, ir }
}

/** Place starters into ranking rooms using the league lineup tab, leftover to bench. */
export function assignRoomsFromLineup(
  players: Player[],
  limits?: PositionLimitsLike | null,
  isSuperflex = false,
): Player[] {
  if (!players.length) return players
  return playersFromFill(fillRankerLineup(players, limits, isSuperflex), limits, isSuperflex)
}

export type LineupSwapTarget = {
  slot: LineupSlotKey
  player: Player
  label: string
}

export function lineupSwapTargets(
  players: Player[],
  dest: LineupSlotKey,
  limits?: PositionLimitsLike | null,
  isSuperflex = false,
): LineupSwapTarget[] {
  const fill = fillRankerLineup(players, limits, isSuperflex)
  const destRow = rowAt(fill, dest)
  if (!destRow) return []
  const destPlayer = destRow.player
  const targets: LineupSwapTarget[] = []
  for (const slot of walkSlots(fill)) {
    if (sameSlot(slot, dest)) continue
    const row = rowAt(fill, slot)
    if (!row?.player) continue
    if (!slotAcceptsPlayer(dest, row.player, fill, limits, isSuperflex)) continue
    if (destPlayer && !slotAcceptsPlayer(slot, destPlayer, fill, limits, isSuperflex)) continue
    targets.push({ slot, player: row.player, label: row.label })
  }
  return targets
}

export function swapLineupSlots(
  players: Player[],
  from: LineupSlotKey,
  to: LineupSlotKey,
  limits?: PositionLimitsLike | null,
  isSuperflex = false,
): Player[] | null {
  if (sameSlot(from, to)) return null
  const fill = fillRankerLineup(players, limits, isSuperflex)
  const fromRow = rowAt(fill, from)
  const toRow = rowAt(fill, to)
  if (!fromRow || !toRow) return null
  const a = fromRow.player
  const b = toRow.player
  if (!a && !b) return null
  if (a && !slotAcceptsPlayer(to, a, fill, limits, isSuperflex)) return null
  if (b && !slotAcceptsPlayer(from, b, fill, limits, isSuperflex)) return null
  fromRow.player = b
  toRow.player = a
  return playersFromFill(fill, limits, isSuperflex)
}

export function benchSlotUsage(players: Player[]): { healthy: number; ir: number } {
  let healthy = 0
  let ir = 0
  for (const player of players) {
    if (player.unassigned || player.room !== 'BENCH') continue
    if (player.ir) ir += 1
    else healthy += 1
  }
  return { healthy, ir }
}

export function formatBenchCapLabel(limits?: PositionLimitsLike | null): string {
  const bench = getBenchCount(limits)
  const ir = getIrCount(limits)
  return ir > 0 ? `${bench} bench + ${ir} IR` : `${bench} bench`
}

/** Keep bench at BENCH slots and IR at IR slots. Extra IR still ranks on the bench if IR is 0. */
export function capBenchAndIr(
  players: Player[],
  limits?: PositionLimitsLike | null,
): { players: Player[]; dropped: Player[] } {
  const benchMax = getBenchCount(limits)
  const irMax = getIrCount(limits)
  const kept: Player[] = []
  const dropped: Player[] = []
  let benchUsed = 0
  let irUsed = 0

  for (const player of players) {
    if (player.unassigned || player.room !== 'BENCH') {
      kept.push(player)
      continue
    }
    if (player.ir) {
      if (irMax > 0 && irUsed < irMax) {
        irUsed += 1
        kept.push(player)
        continue
      }
      if (benchUsed < benchMax) {
        benchUsed += 1
        kept.push(player)
        continue
      }
      dropped.push(player)
      continue
    }
    if (benchUsed < benchMax) {
      benchUsed += 1
      kept.push(player)
      continue
    }
    dropped.push(player)
  }

  return { players: kept, dropped }
}

export function applyLineupRoster(
  players: Player[],
  limits?: PositionLimitsLike | null,
  isSuperflex = false,
): { players: Player[]; dropped: Player[] } {
  return capBenchAndIr(assignRoomsFromLineup(players, limits, isSuperflex), limits)
}
