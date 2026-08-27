import { newId, type Player, type Room } from './types'

const HEADER_MAP: Record<string, Room | 'SKIP' | 'IR'> = {
  QB: 'QB',
  QBS: 'QB',
  QUARTERBACK: 'QB',
  QUARTERBACKS: 'QB',
  RB: 'RB',
  RBS: 'RB',
  'RUNNING BACK': 'RB',
  'RUNNING BACKS': 'RB',
  WR: 'WR',
  WRS: 'WR',
  RECEIVER: 'WR',
  RECEIVERS: 'WR',
  'WIDE RECEIVER': 'WR',
  'WIDE RECEIVERS': 'WR',
  TE: 'TE',
  TES: 'TE',
  'TIGHT END': 'TE',
  'TIGHT ENDS': 'TE',
  K: 'DST',
  PK: 'DST',
  KICKER: 'DST',
  KICKERS: 'DST',
  DST: 'DST',
  'D/ST': 'DST',
  DEF: 'DST',
  DEFENSE: 'DST',
  'TEAM DEFENSE': 'DST',
  BN: 'BENCH',
  BE: 'BENCH',
  BENC: 'BENCH',
  BENCH: 'BENCH',
  FLEX: 'BENCH',
  OP: 'BENCH',
  SUPERFLEX: 'QB',
  SFLEX: 'QB',
  IR: 'IR',
  'INJURED RESERVE': 'IR',
}

const SLOT_HEADERS = new Set([
  'QB',
  'RB',
  'WR',
  'TE',
  'K',
  'PK',
  'DST',
  'D/ST',
  'DEF',
  'FLEX',
  'OP',
  'SUPERFLEX',
  'SFLEX',
  'BN',
  'BE',
  'BENC',
  'BENCH',
  'IR',
  'INJURED RESERVE',
  'STARTERS',
])

const PLAYER_POSITIONS = new Set(['QB', 'RB', 'WR', 'TE', 'K', 'PK', 'DST', 'D/ST', 'DEF'])
const BENCH_SLOTS = new Set(['BN', 'BE', 'BENCH'])
const COMPACT_POSITIONS = new Set([...PLAYER_POSITIONS, ...BENCH_SLOTS])

const NFL_ABBR = new Set([
  'ARI', 'ATL', 'BAL', 'BUF', 'CAR', 'CHI', 'CIN', 'CLE', 'DAL', 'DEN', 'DET',
  'GB', 'GNB', 'HOU', 'IND', 'JAC', 'JAX', 'KC', 'KCC', 'LAC', 'LAR', 'LA',
  'LV', 'LVR', 'MIA', 'MIN', 'NE', 'NO', 'NOS', 'NYG', 'NYJ', 'PHI', 'PIT',
  'SEA', 'SF', 'SFO', 'TB', 'TEN', 'WAS', 'WSH', 'WFT', 'FA',
])

const SKIP_EXACT = new Set([
  'PLAYER', 'SLOT', 'ACTION', 'STATS', 'OPP', 'LAST', 'PROJ', 'PRK', 'ADP',
  'POS', 'TEAM', 'BYE', 'STATUS', 'NEWS', 'DROP', 'TRADE', 'ADD', 'VIEW NEWS',
  'INJURED', 'ACTIVE', 'RESERVE', 'NA', 'O', 'Q', 'PUP', 'SUS', 'OUT',
  'QUESTIONABLE', 'DOUBTFUL', 'IR', 'STARTERS', 'BENCH', 'BENC', 'MOVE', 'TOTALS',
  'EMPTY', 'EDIT', 'WAIVERS', 'WATCH', 'ACQUIRING', 'WEEK', 'NFL WEEK', 'MY TEAM',
])

const INJURY_STATUS = new Set([
  'Q', 'D', 'O', 'IR', 'PUP', 'SUS', 'OUT', 'NA', 'SSPD', 'NFI', 'COVID',
  'QUESTIONABLE', 'DOUBTFUL', 'ACTIVE',
])

const GAME_TIME = /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+\d{1,2}:\d{2}\s*(AM|PM)$/i
const OPPONENT = /^@[A-Za-z]{2,3}$/
const STAT_TOKEN = /^(?:--|\u2014|[\d.,%+-]+)$/
const POSITION_TOKEN = /^(QB|RB|WR|TE|K|DST|D\/ST|DEF|BN|BE|FLEX|IR)$/i
const WEEK_LABEL = /^(?:NFL\s+)?WEEK\s*\d+/i

export type ParseResult = {
  players: Player[]
  usedHeaders: boolean
  source: 'espn' | 'simple'
}

export function positionFromRoom(room: Room): string | undefined {
  if (room === 'DST') return undefined
  if (room === 'BENCH') return 'BN'
  return room
}

export function parseManualPlayer(raw: string, fallbackRoom: Room, ir = false): Player | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const parsed = parseRosterPaste(trimmed).players[0]
  if (parsed) {
    if (parsed.ir || ir) {
      return { ...parsed, ir: true, room: 'BENCH' }
    }
    const hasPos = Boolean(parsed.position && parsed.position !== 'BN')
    if (hasPos) return parsed
    return {
      ...parsed,
      room: fallbackRoom,
      position: parsed.position ?? positionFromRoom(fallbackRoom),
    }
  }
  return {
    id: newId(),
    name: trimmed,
    room: ir ? 'BENCH' : fallbackRoom,
    position: ir ? undefined : positionFromRoom(fallbackRoom),
    ir: ir || undefined,
  }
}

export function parseRosterPaste(raw: string): ParseResult {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.replace(/\u00a0/g, ' ').trim())
    .filter(Boolean)

  const tokens = lines.flatMap((line) =>
    line.includes('\t') ? line.split('\t').map((part) => part.trim()).filter(Boolean) : [line],
  )

  if (looksLikeEspnPaste(tokens)) {
    const players = parseEspnTokens(tokens)
    if (players.length) {
      return { players: dedupePlayers(players), usedHeaders: true, source: 'espn' }
    }
  }

  return parseSimpleLines(lines)
}

export function formatTrimmedRoster(players: Player[]): string {
  return players
    .map((player) =>
      [player.name, player.position ?? player.room, player.nflTeam, player.ir ? 'IR' : '']
        .filter(Boolean)
        .join('\t'),
    )
    .join('\n')
}

function looksLikeEspnPaste(tokens: string[]): boolean {
  let doubled = 0
  let dashes = 0
  for (const token of tokens) {
    const upper = token.toUpperCase()
    if (upper === 'MOVE' || upper === 'TOTALS') return true
    if (GAME_TIME.test(token) || OPPONENT.test(token)) return true
    if (splitDoubledName(token)) doubled += 1
    if (token === '--') dashes += 1
  }
  return doubled >= 2 || dashes >= 4
}

function parseEspnTokens(tokens: string[]): Player[] {
  const players: Player[] = []
  let i = 0

  while (i < tokens.length) {
    const token = tokens[i]
    if (isIgnoredRosterLabel(token) || isTotals(token)) {
      i = isTotals(token) ? skipJunk(tokens, i + 1) : i + 1
      continue
    }

    if (isSlotHeader(token)) {
      const slot = normalizeSlot(token)
      i += 1
      if (isEmptySlot(tokens[i])) {
        i += 1
        i = skipJunk(tokens, i)
        continue
      }
      const parsed = readEspnPlayer(tokens, i, slot)
      if (parsed) {
        players.push(parsed.player)
        i = parsed.next
        continue
      }
      continue
    }

    const doubled = splitDoubledName(token)
    if (doubled) {
      const parsed = readEspnPlayer(tokens, i)
      if (parsed) {
        players.push(parsed.player)
        i = parsed.next
        continue
      }
    }

    i += 1
  }

  return players
}

function readEspnPlayer(
  tokens: string[],
  start: number,
  slot?: string,
): { player: Player; next: number } | null {
  let i = start
  while (i < tokens.length && !tokens[i]) i += 1
  if (i >= tokens.length) return null
  if (isTotals(tokens[i]) || isEmptySlot(tokens[i]) || isSlotHeader(tokens[i])) return null

  let name = splitDoubledName(tokens[i]) ?? (looksLikePlayerName(tokens[i]) ? tokens[i] : '')
  if (!name) return null
  i += 1

  if (tokens[i] && isEchoName(name, tokens[i])) i += 1
  if (tokens[i] && INJURY_STATUS.has(tokens[i].toUpperCase())) i += 1

  let nflTeam: string | undefined
  if (tokens[i] && NFL_ABBR.has(tokens[i].toUpperCase())) {
    nflTeam = tokens[i].toUpperCase()
    i += 1
  }

  let position: string | undefined
  if (tokens[i] && isPlayerPosition(tokens[i])) {
    position = normalizePosition(tokens[i])
    i += 1
  }

  i = skipJunk(tokens, i)

  name = finalizeName(name, position)
  const ir = isIrSlot(slot)
  const room = ir ? 'BENCH' : roomFromPosition(position, slot)
  return {
    player: makePlayer(name, room, false, position, nflTeam, ir),
    next: i,
  }
}

function skipJunk(tokens: string[], start: number): number {
  let i = start
  while (i < tokens.length) {
    const token = tokens[i]
    if (isSlotHeader(token) || isTotals(token) || splitDoubledName(token)) break
    i += 1
  }
  return i
}

function parseSimpleLines(lines: string[]): ParseResult {
  const players: Player[] = []
  let current: Room | 'SKIP' | 'IR' | null = null
  let usedHeaders = false

  for (const line of lines) {
    const compact = parseCompactLine(line)
    if (compact) {
      usedHeaders = true
      if (current === 'IR' || compact.ir) {
        compact.ir = true
        compact.room = 'BENCH'
      }
      players.push(compact)
      if (current !== 'IR') current = compact.room
      continue
    }

    const header = matchHeader(line)
    if (header) {
      current = header
      usedHeaders = true
      continue
    }

    const inline = matchInlinePlayer(line)
    if (inline) {
      usedHeaders = true
      players.push(inline)
      current = inline.room
      continue
    }

    if (shouldSkipLine(line)) continue
    if (current === 'SKIP') continue

    const name = cleanName(line)
    if (!name) continue

    if (current === 'IR') {
      players.push(makePlayer(name, 'BENCH', false, undefined, undefined, true))
    } else if (current) {
      players.push(makePlayer(name, current, false))
    } else {
      players.push(makePlayer(name, 'BENCH', true))
    }
  }

  return { players: dedupePlayers(players), usedHeaders, source: 'simple' }
}

function parseCompactLine(line: string): Player | null {
  const parts = tokenizePlayerLine(line)
  if (parts.length < 2) return null

  let position: string | undefined
  let team: string | undefined
  let ir = false
  const nameParts: string[] = []

  for (const part of parts) {
    if (isIrSlot(part)) {
      ir = true
      continue
    }
    if (!position && isCompactPosition(part)) {
      position = normalizePosition(part)
      continue
    }
    if (!team && NFL_ABBR.has(part.toUpperCase())) {
      team = part.toUpperCase()
      continue
    }
    nameParts.push(part)
  }

  const name = cleanName(nameParts.join(' '))
  if (!name) return null
  if (!position && !ir && !team) return null

  const bench = ir || !position || position === 'BN'
  return makePlayer(
    finalizeName(name, position),
    bench ? 'BENCH' : roomFromPosition(position),
    false,
    position,
    team,
    ir,
  )
}

function tokenizePlayerLine(line: string): string[] {
  return line
    .split(/\t+|\s*·\s*|\s*\|\s*|,\s+|\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
}

function matchHeader(line: string): Room | 'SKIP' | 'IR' | null {
  const key = line.replace(/[:.-]/g, '').trim().toUpperCase()
  if (HEADER_MAP[key]) return HEADER_MAP[key]
  return null
}

function matchInlinePlayer(line: string): Player | null {
  const parts = line.split(/\t+|\s{2,}/).map((part) => part.trim()).filter(Boolean)
  if (parts.length >= 2) {
    const headerFromFirst = matchHeader(parts[0])
    if (headerFromFirst && headerFromFirst !== 'SKIP') {
      const name = cleanName(parts.slice(1).filter((part) => !shouldSkipLine(part)).join(' '))
      if (name) {
        const ir = headerFromFirst === 'IR'
        return makePlayer(name, ir ? 'BENCH' : headerFromFirst, false, undefined, undefined, ir)
      }
    }
    const headerFromSecond = matchHeader(parts[1] ?? '')
    if (headerFromSecond && headerFromSecond !== 'SKIP' && headerFromSecond !== 'IR') {
      const name = cleanName(parts[0])
      const teamToken = parts.find((part) => NFL_ABBR.has(part.toUpperCase()))
      if (name) {
        return makePlayer(name, headerFromSecond, false, normalizePosition(parts[1]), teamToken?.toUpperCase())
      }
    }
  }

  const leading = line.match(
    /^(?:(?:\d+)[.)]\s*)?(QB|RB|WR|TE|K|DST|D\/ST|DEF|BN|FLEX|IR)\s+(.+)$/i,
  )
  if (leading) {
    const room = matchHeader(leading[1])
    const name = cleanName(leading[2])
    if (room && room !== 'SKIP' && name) {
      const ir = room === 'IR'
      return makePlayer(name, ir ? 'BENCH' : room, false, undefined, undefined, ir)
    }
  }
  return null
}

function shouldSkipLine(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed) return true
  if (isIgnoredRosterLabel(trimmed)) return true
  const upper = trimmed.toUpperCase()
  if (SKIP_EXACT.has(upper)) return true
  if (NFL_ABBR.has(upper)) return true
  if (INJURY_STATUS.has(upper)) return true
  if (GAME_TIME.test(trimmed) || OPPONENT.test(trimmed) || STAT_TOKEN.test(trimmed)) return true
  if (POSITION_TOKEN.test(upper) && !HEADER_MAP[upper]) return true
  if (/^bye\s*\d+/i.test(trimmed)) return true
  if (/^\d+[.)]$/.test(trimmed)) return true
  if (trimmed.length === 1) return true
  return false
}

function cleanName(line: string): string {
  let name = line
    .replace(/^\d+[.)]\s*/, '')
    .replace(/\s+-\s+(QB|RB|WR|TE|K|DST|D\/ST|DEF)\b/i, '')
    .replace(/\s+\((?:QB|RB|WR|TE|K)\)\s*$/i, '')
    .trim()

  name = splitDoubledName(name) ?? name

  const tokens = name.split(/\s+/)
  while (tokens.length && NFL_ABBR.has(tokens[tokens.length - 1].toUpperCase())) {
    tokens.pop()
  }
  name = tokens.join(' ').replace(/\s+/g, ' ').trim()
  if (!name || shouldSkipLine(name)) return ''
  if (matchHeader(name)) return ''
  return name
}

function splitDoubledName(value: string): string | null {
  const trimmed = value.trim()
  if (trimmed.length < 6 || trimmed.length % 2 !== 0) return null
  const half = trimmed.length / 2
  const first = trimmed.slice(0, half)
  const second = trimmed.slice(half)
  if (first !== second) return null
  if (!looksLikePlayerName(first, true)) return null
  return first
}

function looksLikePlayerName(value: string, allowShort = false): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false
  if (isIgnoredRosterLabel(trimmed)) return false
  const upper = trimmed.toUpperCase()
  if (SKIP_EXACT.has(upper) || INJURY_STATUS.has(upper)) return false
  if (NFL_ABBR.has(upper) || isSlotHeader(trimmed) || isPlayerPosition(trimmed)) return false
  if (GAME_TIME.test(trimmed) || OPPONENT.test(trimmed) || STAT_TOKEN.test(trimmed)) return false
  if (!/[A-Za-z]/.test(trimmed)) return false
  if (!allowShort && trimmed.length < 3) return false
  return true
}

function isEchoName(name: string, token: string): boolean {
  const folded = token.trim()
  if (!folded) return false
  if (folded === name) return true
  if (name.startsWith(folded) && folded.length >= 3) return true
  const withoutDst = name.replace(/\s+d\/st$/i, '')
  return withoutDst === folded
}

function isSlotHeader(value: string | undefined): boolean {
  if (!value) return false
  return SLOT_HEADERS.has(normalizeSlot(value))
}

function isPlayerPosition(value: string | undefined): boolean {
  if (!value) return false
  return PLAYER_POSITIONS.has(normalizeSlot(value))
}

function isCompactPosition(value: string | undefined): boolean {
  if (!value) return false
  return COMPACT_POSITIONS.has(normalizeSlot(value))
}

function isBenchSlot(value: string | undefined): boolean {
  if (!value) return false
  return BENCH_SLOTS.has(normalizeSlot(value))
}

function isIrSlot(value: string | undefined): boolean {
  if (!value) return false
  const key = normalizeSlot(value)
  return key === 'IR' || key === 'INJURED RESERVE' || key === 'INJUREDRESERVE'
}

function isEmptySlot(value: string | undefined): boolean {
  return (value ?? '').trim().toUpperCase() === 'EMPTY'
}

function isTotals(value: string | undefined): boolean {
  return (value ?? '').trim().toUpperCase() === 'TOTALS'
}

export function isIgnoredRosterLabel(value: string | undefined): boolean {
  if (!value) return false
  const trimmed = value.replace(/\u00a0/g, ' ').replace(/[:.-]/g, ' ').replace(/\s+/g, ' ').trim()
  if (!trimmed) return false
  if (WEEK_LABEL.test(trimmed)) return true
  const key = normalizeSlot(trimmed)
  return key === 'MYTEAM' || key === 'NFLWEEK' || key === 'FANTASY'
}

function normalizeSlot(value: string): string {
  return value.replace(/[:.-]/g, '').trim().toUpperCase()
}

function normalizePosition(value: string): string {
  const key = normalizeSlot(value)
  if (key === 'DST' || key === 'DEF') return 'D/ST'
  if (key === 'PK') return 'K'
  if (BENCH_SLOTS.has(key)) return 'BN'
  return key
}

export function roomFromNflPosition(position?: string): Room {
  return roomFromPosition(position)
}

function roomFromPosition(position?: string, slot?: string): Room {
  const key = (position || (!isBenchSlot(slot) ? slot : '') || '').toUpperCase()
  if (key === 'QB') return 'QB'
  if (key === 'RB') return 'RB'
  if (key === 'WR') return 'WR'
  if (key === 'TE') return 'TE'
  if (key === 'K' || key === 'PK' || key === 'KICKER') return 'DST'
  if (key === 'D/ST' || key === 'DST' || key === 'DEF' || key === 'DEFENSE') return 'DST'
  return 'BENCH'
}

export function coerceRoom(room: unknown, position?: string): Room {
  if (room === 'MISC') {
    return specialTeamKindFromPosition(position) ? 'DST' : 'BENCH'
  }
  if (room === 'QB' || room === 'RB' || room === 'WR' || room === 'TE' || room === 'DST' || room === 'BENCH') {
    return room
  }
  return specialTeamKindFromPosition(position) ? 'DST' : 'BENCH'
}

export function limitSpecialTeams(players: Player[]): Player[] {
  let dstCount = 0
  let kickerCount = 0
  return players.map((player) => {
    if (player.unassigned || player.room !== 'DST') return player
    const kind = specialTeamKind(player)
    if (kind === 'K') {
      kickerCount += 1
      if (kickerCount > 1) return { ...player, room: 'BENCH' }
    }
    if (kind === 'DST') {
      dstCount += 1
      if (dstCount > 1) return { ...player, room: 'BENCH' }
    }
    return player
  })
}

function specialTeamKind(player: Player): 'K' | 'DST' | null {
  return specialTeamKindFromPosition(player.position) ?? specialTeamKindFromName(player.name)
}

function specialTeamKindFromPosition(position?: string): 'K' | 'DST' | null {
  const key = (position ?? '').trim().toUpperCase()
  if (!key) return null
  if (key === 'K' || key === 'PK' || key === 'KICKER') return 'K'
  if (key === 'D/ST' || key === 'DST' || key === 'DEF' || key === 'DEFENSE') return 'DST'
  return null
}

function specialTeamKindFromName(name: string): 'K' | 'DST' | null {
  if (/d\/st|defense/i.test(name)) return 'DST'
  return null
}

function finalizeName(name: string, position?: string): string {
  const cleaned = (splitDoubledName(name) ?? name).replace(/\s+/g, ' ').trim()
  if (position === 'D/ST' && !/d\/st|defense/i.test(cleaned)) {
    return `${cleaned} D/ST`
  }
  return cleaned
}

function makePlayer(
  name: string,
  room: Room,
  unassigned: boolean,
  position?: string,
  nflTeam?: string,
  ir?: boolean,
): Player {
  return {
    id: newId(),
    name,
    room,
    position,
    nflTeam,
    unassigned: unassigned || undefined,
    ir: ir || undefined,
  }
}

function dedupePlayers(players: Player[]): Player[] {
  const seen = new Set<string>()
  const next: Player[] = []
  for (const player of players) {
    const key = player.name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    next.push(player)
  }
  return next
}
