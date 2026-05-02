/**
 * Build baseline_community_rankings + baseline_rookies from rankings/*.csv (4-line-per-player format),
 * then emit per-bucket CSVs + split Supabase migration SQL files (plus optional monolith if BASELINE_MIGRATION_MONOLITH=1).
 * Season half_ppr + superflex and standard + superflex: no source CSV — merged from PPR season SF (QB slots) + half/standard season 1QB (non-QB order).
 *
 * Requires (same as export-ranking-template-csv.ts):
 *   VITE_SUPABASE_URL or SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage:
 *   npx tsx scripts/build-baseline-migration-from-rankings.ts
 *
 * Optional env:
 *   BASELINE_RANKINGS_DIR=rankings          (default under project root)
 *   BASELINE_OUT_DIR=rankings/generated     (CSVs)
 *   BASELINE_MIGRATION_DIR=supabase/migrations   (split migration files; avoids SQL Editor size limits)
 *   BASELINE_MIGRATION_SEQ=20260430220100          (first filename timestamp; +1 per file)
 *   BASELINE_MIGRATION_MONOLITH=1             (also write one combined SQL to BASELINE_MIGRATION_OUT)
 */
import { createClient } from '@supabase/supabase-js'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { NFL_DEFENSE_TEAM_NAMES } from '../src/constants/nflDefenses'
import {
  PLAYER_POOL_CURRENT_SEASON,
  PLAYER_POOL_PRIOR_SEASON,
} from '../src/constants/playerPoolSeason'
import { deduplicatePlayersByIdentity, mergePlayerPoolAcrossSeasons } from '../src/utils/playerDeduplication'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))

type ScoringFormat = 'ppr' | 'half_ppr' | 'standard'

type PoolPlayer = {
  id: string
  name: string
  position: string | null
  team: string | null
  season: number | null
  adp: number | null
  espn_id?: string | null
  sleeper_id?: string | null
}

type StatRow = {
  player_id: string
  total_fp_standard: number | null
  total_fp_ppr: number | null
  games_played: number | null
}

type ParsedRow = { rank: number; nameShort: string; position: string; teamAbbr: string }

const SUFFIXES = [' III', ' II', ' IV', ' V', ' Jr.', ' Sr.', ' Jr', ' Sr'] as const

const MIXON_ANCHOR_RANK = 250
const MIXON_TEMPLATE_SORT = 91

/** sort_index from data/ranking_template.csv — spacing preserved vs Mixon (91). */
const FORCED_TEMPLATE_SORT: Record<string, number> = {
  'Joe Mixon': 91,
  'Garrett Nussmeier': 170,
  'Taylen Green': 208,
  'Riley Nowakowski': 243,
  'Cole Payton': 244,
  'Austin Ekeler': 301,
  'Nick Chubb': 347,
  'Gardner Minshew': 435,
}

const SEASON_SCORING_FILES: { file: string; scoring: ScoringFormat; isSuperflex: boolean }[] = [
  { file: '1_2PPR,Season,NoSF - 1_2_RE_1QB.csv', scoring: 'half_ppr', isSuperflex: false },
  { file: 'Full,Season,NoSF - Full_RE_1QB.csv', scoring: 'ppr', isSuperflex: false },
  { file: 'Full,Season,SF - Full_RE_2QB.csv', scoring: 'ppr', isSuperflex: true },
  { file: 'No,Season,NoSF - No_RE_1QB.csv', scoring: 'standard', isSuperflex: false },
]

const DYNASTY_STARTUP_FILES: { file: string; isSuperflex: boolean }[] = [
  { file: 'Start,1QB - 1QB Startup.csv', isSuperflex: false },
  { file: 'Start,2QB - 2QB Startup.csv', isSuperflex: true },
]

const ROOKIE_FILES: { file: string; isSuperflex: boolean }[] = [
  { file: 'Rookies,1QB - Rookies.csv', isSuperflex: false },
  { file: 'Rookies,2QB - Rookie 2QB.csv', isSuperflex: true },
]

const DEFENSE_ABBR_TO_FULL_NAME: Record<string, string> = {
  ARI: 'Arizona Cardinals',
  ATL: 'Atlanta Falcons',
  BAL: 'Baltimore Ravens',
  BUF: 'Buffalo Bills',
  CAR: 'Carolina Panthers',
  CHI: 'Chicago Bears',
  CIN: 'Cincinnati Bengals',
  CLE: 'Cleveland Browns',
  DAL: 'Dallas Cowboys',
  DEN: 'Denver Broncos',
  DET: 'Detroit Lions',
  GB: 'Green Bay Packers',
  HOU: 'Houston Texans',
  IND: 'Indianapolis Colts',
  JAX: 'Jacksonville Jaguars',
  KC: 'Kansas City Chiefs',
  LV: 'Las Vegas Raiders',
  LAC: 'Los Angeles Chargers',
  LAR: 'Los Angeles Rams',
  MIA: 'Miami Dolphins',
  MIN: 'Minnesota Vikings',
  NE: 'New England Patriots',
  NO: 'New Orleans Saints',
  NYG: 'New York Giants',
  NYJ: 'New York Jets',
  PHI: 'Philadelphia Eagles',
  PIT: 'Pittsburgh Steelers',
  SF: 'San Francisco 49ers',
  SEA: 'Seattle Seahawks',
  TB: 'Tampa Bay Buccaneers',
  TEN: 'Tennessee Titans',
  WAS: 'Washington Commanders',
}

const SCORINGS_FOR_DYNASTY_DUP: ScoringFormat[] = ['ppr', 'half_ppr', 'standard']

function findProjectRoot(): string {
  let dir = resolve(process.cwd())
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(dir, 'package.json'))) return dir
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  dir = resolve(SCRIPT_DIR)
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(dir, 'package.json'))) return dir
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return process.cwd()
}

const PROJECT_ROOT = findProjectRoot()

function loadEnvFile(filename: string, overrideExisting: boolean) {
  const p = join(PROJECT_ROOT, filename)
  if (!existsSync(p)) return
  let raw = readFileSync(p, 'utf8')
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1)
  for (const line of raw.split(/\r?\n/)) {
    const s = line.trim()
    if (!s || s.startsWith('#')) continue
    const eq = s.indexOf('=')
    if (eq <= 0) continue
    const key = s.slice(0, eq).replace(/^export\s+/i, '').trim()
    let val = s.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (overrideExisting || process.env[key] == null || process.env[key] === '') {
      process.env[key] = val
    }
  }
}

function loadDotEnv() {
  loadEnvFile('.env', false)
  loadEnvFile('.env.local', true)
}

function isUuidLike(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
}

function stripSuffix(last: string): string {
  let s = last.trim()
  for (const suf of SUFFIXES) {
    if (s.endsWith(suf)) s = s.slice(0, -suf.length).trim()
  }
  return s
}

function normLast(s: string): string {
  return stripSuffix(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

function normPos(pos: string): string {
  const p = pos.trim().toUpperCase()
  if (p === 'D/ST' || p === 'DST' || p === 'DEF') return 'DST'
  return p
}

/** First segment of `players.position` so `WR, TE` matches CSV `WR`. */
function primaryFantasyPosition(raw: string | null | undefined): string {
  const segment = (raw ?? '').trim().split(/[,/]/)[0]?.trim() ?? ''
  return segment ? normPos(segment) : ''
}

function isDefensePosition(raw: string | null | undefined): boolean {
  return primaryFantasyPosition(raw) === 'DST'
}

/** DB may store team defenses as `D/ST`, `DST`, or `DEF` depending on import pipeline. */
const DB_DST_POSITIONS = ['D/ST', 'DST', 'DEF'] as const

/** Strip leading `"` and trailing `",` / `,` from a single rankings CSV name cell. */
function cleanQuotedCsvCell(raw: string): string {
  let s = raw.trim().replace(/[\u201c\u201d]/g, '"')
  // Excel / bad exports: leading apostrophe before a quoted cell (`'"G. Pickens,"'`)
  s = s.replace(/^['"]+/g, '')
  if (s.startsWith('"')) s = s.slice(1)
  s = s.replace(/"\s*,?\s*$/g, '').replace(/,\s*$/g, '').replace(/['"]+$/g, '').trim()
  s = s.replace(/,\s*$/g, '').trim()
  return s
}

/** CSV short names that do not match DB `players.name` initials; used when normal matching fails. */
/** Baseline-only corrections when `players.team` is stale vs real-world rosters. */
const POOL_TEAM_OVERRIDES_BY_PLAYER_ID: Record<string, string> = {
  '703590dc-9a76-41f0-8b1f-697021542cb6': 'NYJ',
}

function applyPoolTeamOverrides(pool: PoolPlayer[]): void {
  for (const p of pool) {
    const t = POOL_TEAM_OVERRIDES_BY_PLAYER_ID[p.id]
    if (t) p.team = t
  }
}

const CSV_NAME_OVERRIDES: Array<{ test: (row: ParsedRow) => boolean; poolName: string }> = [
  {
    test: (row) =>
      normPos(row.position) === 'WR' &&
      row.teamAbbr.toUpperCase() === 'PHI' &&
      cleanQuotedCsvCell(row.nameShort).toLowerCase().includes('m. brown'),
    poolName: 'Hollywood Brown',
  },
  {
    test: (row) =>
      normPos(row.position) === 'K' && cleanQuotedCsvCell(row.nameShort).toLowerCase().includes('c. york'),
    poolName: 'Cade York',
  },
  {
    test: (row) =>
      normPos(row.position) === 'WR' &&
      row.teamAbbr.toUpperCase() === 'DAL' &&
      cleanQuotedCsvCell(row.nameShort).toLowerCase().includes('g. pickens'),
    poolName: 'George Pickens',
  },
  {
    test: (row) =>
      normPos(row.position) === 'WR' &&
      row.teamAbbr.toUpperCase() === 'PIT' &&
      cleanQuotedCsvCell(row.nameShort).toLowerCase().includes('d. metcalf'),
    poolName: 'DK Metcalf',
  },
  {
    test: (row) =>
      normPos(row.position) === 'RB' &&
      row.teamAbbr.toUpperCase() === 'TB' &&
      cleanQuotedCsvCell(row.nameShort).toLowerCase().includes('k. gainwell'),
    poolName: 'Kenneth Gainwell',
  },
  {
    test: (row) =>
      normPos(row.position) === 'RB' &&
      row.teamAbbr.toUpperCase() === 'CIN' &&
      cleanQuotedCsvCell(row.nameShort).toLowerCase().includes('s. perine'),
    poolName: 'Samaje Perine',
  },
  {
    test: (row) =>
      normPos(row.position) === 'K' &&
      row.teamAbbr.toUpperCase() === 'SF' &&
      cleanQuotedCsvCell(row.nameShort).toLowerCase().includes('e. pineiro'),
    poolName: 'Eddy Pineiro',
  },
  {
    test: (row) =>
      normPos(row.position) === 'QB' &&
      row.teamAbbr.toUpperCase() === 'NYJ' &&
      cleanQuotedCsvCell(row.nameShort).toLowerCase().includes('g. smith'),
    poolName: 'Geno Smith',
  },
  {
    test: (row) =>
      normPos(row.position) === 'WR' &&
      row.teamAbbr.toUpperCase() === 'ATL' &&
      cleanQuotedCsvCell(row.nameShort).toLowerCase().includes('j. dotson'),
    poolName: 'Jahan Dotson',
  },
  {
    test: (row) =>
      normPos(row.position) === 'WR' &&
      row.teamAbbr.toUpperCase() === 'MIA' &&
      cleanQuotedCsvCell(row.nameShort).toLowerCase().includes('t. atwell'),
    poolName: 'Tutu Atwell',
  },
  {
    test: (row) =>
      normPos(row.position) === 'QB' &&
      row.teamAbbr.toUpperCase() === 'LAC' &&
      cleanQuotedCsvCell(row.nameShort).toLowerCase().includes('t. lance'),
    poolName: 'Trey Lance',
  },
]

function parseShortName(raw: string): { initial: string; rest: string } | null {
  const s = cleanQuotedCsvCell(raw)
  const dot = s.indexOf('.')
  if (dot <= 0) return null
  const initial = s.slice(0, dot).trim()
  const rest = s.slice(dot + 1).trim()
  if (!initial || !rest) return null
  return { initial: initial[0]!.toLowerCase(), rest }
}

function fullNameToKey(full: string): { initial: string; lastNorm: string } | null {
  const parts = full.trim().split(/\s+/)
  if (parts.length < 2) return null
  return { initial: (parts[0]![0] ?? 'x').toLowerCase(), lastNorm: normLast(parts.slice(1).join(' ')) }
}

function parseFourLineCsv(absPath: string): ParsedRow[] {
  const lines = readFileSync(absPath, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)
  const out: ParsedRow[] = []
  for (let i = 0; i + 3 < lines.length; i += 4) {
    const rankStr = lines[i]!.trim().replace(/^"/, '').replace(/"$/, '')
    const nameLine = lines[i + 1]!.trim()
    const posLine = lines[i + 2]!.trim()
    const teamLine = lines[i + 3]!.trim()
    if (!/^\d+$/.test(rankStr)) {
      i -= 3
      continue
    }
    const m = /^\(([A-Z]{2,3})-null\)$/.exec(teamLine)
    const teamAbbr = m ? m[1]! : teamLine
    out.push({
      rank: Number(rankStr),
      nameShort: nameLine,
      position: posLine,
      teamAbbr,
    })
  }
  return out
}

function defenseAbbrToPoolId(pool: PoolPlayer[], abbr: string): string | null {
  const u = abbr.toUpperCase()
  const dst = pool.filter((p) => primaryFantasyPosition(p.position) === 'DST')
  const byTeam = dst.find((p) => (p.team ?? '').toUpperCase() === u)
  if (byTeam) return byTeam.id
  return null
}

/** Map in-memory `defense-*` ids to real `players.id` (uuid) when the merge pool only has synthetic D/ST rows. */
async function resolveDefenseSyntheticIds(
  supabase: ReturnType<typeof createClient>,
  pool: PoolPlayer[]
): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  const seenName = new Set<string>()
  for (const p of pool) {
    if (!p.id.startsWith('defense-') || isUuidLike(p.id)) continue
    if (primaryFantasyPosition(p.position) !== 'DST') continue
    const key = p.name.trim().toLowerCase()
    if (seenName.has(key)) continue
    seenName.add(key)
    const { data, error } = await supabase
      .from('players')
      .select('id')
      .eq('name', p.name)
      .in('position', [...DB_DST_POSITIONS])
      .in('season', [2024, PLAYER_POOL_PRIOR_SEASON, PLAYER_POOL_CURRENT_SEASON])
      .order('season', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) {
      console.warn(`Could not resolve defense uuid for ${p.name}:`, error.message)
      continue
    }
    if (data?.id && isUuidLike(String(data.id))) {
      out.set(p.id, String(data.id))
    }
  }
  return out
}

function pickPlayerForRow(
  row: ParsedRow,
  pool: PoolPlayer[],
  usedInFile: Set<string>,
  defenseByAbbr: Map<string, string>
): string | null {
  const pos = normPos(row.position)
  if (pos === 'DST') {
    const raw = cleanQuotedCsvCell(row.nameShort)
    const base = raw.replace(/\s+DST$/i, '').trim()
    const isDst = (p: PoolPlayer) => primaryFantasyPosition(p.position) === 'DST'
    const byName = pool.find(
      (p) =>
        isDst(p) &&
        p.name.replace(/\s+/g, ' ').trim().toLowerCase() === base.replace(/\s+/g, ' ').trim().toLowerCase()
    )
    if (byName?.id) return byName.id
    const cleanedLower = raw.toLowerCase().replace(/\s+/g, ' ')
    for (const full of NFL_DEFENSE_TEAM_NAMES) {
      if (!cleanedLower.includes(full.toLowerCase())) continue
      const hit = pool.find((p) => isDst(p) && p.name.trim() === full)
      if (hit?.id) return hit.id
    }
    const fullNm = DEFENSE_ABBR_TO_FULL_NAME[row.teamAbbr.toUpperCase()]
    if (fullNm) {
      const byAbbr = pool.find((p) => isDst(p) && p.name.trim() === fullNm)
      if (byAbbr?.id) return byAbbr.id
    }
    const id = defenseByAbbr.get(row.teamAbbr.toUpperCase()) ?? defenseAbbrToPoolId(pool, row.teamAbbr)
    return id ?? null
  }
  const short = parseShortName(row.nameShort)
  if (!short) return null
  const csvTeam = row.teamAbbr.toUpperCase()

  for (const o of CSV_NAME_OVERRIDES) {
    if (!o.test(row)) continue
    const hit = pool.find((p) => primaryFantasyPosition(p.position) === pos && p.name === o.poolName)
    if (hit?.id && !usedInFile.has(hit.id)) return hit.id
  }

  let candidates = pool.filter((p) => {
    const pPos = primaryFantasyPosition(p.position)
    if (pos !== 'DST' && pPos === 'DST') return false
    if (pos !== 'K' && pPos === 'K') return false
    if (pPos !== pos) return false
    const fk = fullNameToKey(p.name)
    if (!fk) return false
    return fk.initial === short.initial && fk.lastNorm === normLast(short.rest)
  })

  if (candidates.length === 0) return null

  const sorted = [...candidates].sort((a, b) => (Number(a.adp) || 9999) - (Number(b.adp) || 9999))

  const teamMatch = sorted.filter((c) => (c.team ?? '').toUpperCase() === csvTeam && !usedInFile.has(c.id))
  const pickFrom = teamMatch.length > 0 ? teamMatch : sorted.filter((c) => !usedInFile.has(c.id))
  const picked = pickFrom[0]
  return picked?.id ?? null
}

function buildDefenseAbbrMap(pool: PoolPlayer[]): Map<string, string> {
  const m = new Map<string, string>()
  for (const p of pool) {
    if (primaryFantasyPosition(p.position) !== 'DST' || !p.team) continue
    m.set(p.team.toUpperCase(), p.id)
  }
  return m
}

function ppgForScoring(s: StatRow | undefined, scoring: ScoringFormat): number | null {
  if (!s) return null
  const g = Number(s.games_played) || 0
  if (g <= 0) return null
  const std = Number(s.total_fp_standard) || 0
  const ppr = Number(s.total_fp_ppr) || 0
  if (scoring === 'standard') return std / g
  if (scoring === 'ppr') return ppr / g
  return (std + ppr) / 2 / g
}

function isFaTeam(team: string | null | undefined): boolean {
  if (team == null) return true
  const t = team.trim()
  if (!t) return true
  return t.toUpperCase() === 'FA'
}

/** Map synthetic `defense-*` ids to real `players.id` UUID when the pool deduped defenses. */
function canonicalPlayerId(
  pool: PoolPlayer[],
  id: string,
  defenseSynth?: Map<string, string>
): string | null {
  if (isUuidLike(id)) return id
  const mapped = defenseSynth?.get(id)
  if (mapped && isUuidLike(mapped)) return mapped
  const direct = pool.find((p) => p.id === id)
  if (direct && isUuidLike(direct.id)) return direct.id
  if (id.startsWith('defense-')) {
    const slug = id.slice('defense-'.length).toLowerCase()
    const fullName = NFL_DEFENSE_TEAM_NAMES.find((n) => n.replace(/\s/g, '-').toLowerCase() === slug)
    if (fullName) {
      const row = pool.find((p) => primaryFantasyPosition(p.position) === 'DST' && p.name === fullName && isUuidLike(p.id))
      if (row) return row.id
    }
  }
  const poolRow = pool.find((p) => p.id === id)
  if (poolRow) return poolRow.id
  return null
}

function poolRowByCanonicalId(
  pool: PoolPlayer[],
  id: string,
  defenseSynth?: Map<string, string>
): PoolPlayer | undefined {
  return pool.find((x) => x.id === id || canonicalPlayerId(pool, x.id, defenseSynth) === id)
}

function resolveRankedIds(pool: PoolPlayer[], ids: string[], defenseSynth?: Map<string, string>): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const id of ids) {
    const cid = canonicalPlayerId(pool, id, defenseSynth)
    if (!cid || seen.has(cid)) continue
    seen.add(cid)
    out.push(cid)
  }
  return out
}

function isQuarterbackPool(
  pool: PoolPlayer[],
  playerId: string,
  defenseSynth?: Map<string, string>
): boolean {
  const p = poolRowByCanonicalId(pool, playerId, defenseSynth)
  return primaryFantasyPosition(p?.position) === 'QB'
}

/**
 * Build season superflex baselines when no dedicated CSV exists:
 * Walk Full PPR season superflex order as QB vs non-QB *slots* (superflex QB valuation).
 * Use template player id when the slot is QB; otherwise take the next non-QB from the
 * base list (half_ppr or standard season 1QB).
 */
function mergeSeasonSuperflexOverlay(
  templateRankedIds: string[],
  baseRankedIds: string[],
  pool: PoolPlayer[],
  defenseSynth?: Map<string, string>
): string[] {
  const nonqbBase = baseRankedIds.filter((id) => !isQuarterbackPool(pool, id, defenseSynth))
  let nonIdx = 0
  const out: string[] = []
  for (const tid of templateRankedIds) {
    if (isQuarterbackPool(pool, tid, defenseSynth)) {
      out.push(tid)
    } else {
      const next = nonqbBase[nonIdx++]
      if (next) out.push(next)
    }
  }
  if (nonIdx !== nonqbBase.length) {
    console.warn(
      `mergeSeasonSuperflexOverlay: non-QB count mismatch — base has ${nonqbBase.length} non-QBs, consumed ${nonIdx}`
    )
  }
  return resolveRankedIds(pool, out, defenseSynth)
}

function forcedSlot1Based(playerName: string): number {
  const t = FORCED_TEMPLATE_SORT[playerName]
  if (t == null) return 9999
  if (playerName === 'Joe Mixon') return MIXON_ANCHOR_RANK
  const s = MIXON_ANCHOR_RANK + (t - MIXON_TEMPLATE_SORT)
  return Math.min(500, Math.max(251, s))
}

function mergeForcedIntoHead(csvIds: string[], forcedIds: { id: string; slot: number }[]): string[] {
  const forcedSet = new Set(forcedIds.map((f) => f.id))
  const body = csvIds.filter((id) => !forcedSet.has(id))
  const sortedForced = [...forcedIds].sort((a, b) => a.slot - b.slot || a.id.localeCompare(b.id))
  for (const f of sortedForced) {
    const idx = Math.min(Math.max(0, f.slot - 1), body.length)
    body.splice(idx, 0, f.id)
  }
  return body
}

function resolveForcedPlayerIds(pool: PoolPlayer[]): Map<string, string> {
  const byName = new Map<string, string>()
  for (const p of pool) {
    if (!isUuidLike(p.id)) continue
    const key = p.name.trim().toLowerCase()
    if (!byName.has(key)) byName.set(key, p.id)
  }
  const out = new Map<string, string>()
  for (const name of Object.keys(FORCED_TEMPLATE_SORT)) {
    const id = byName.get(name.trim().toLowerCase())
    if (id) out.set(name, id)
  }
  return out
}

function buildRankedCommunityList(args: {
  rows: ParsedRow[]
  pool: PoolPlayer[]
  statsByPlayer: Map<string, StatRow>
  scoring: ScoringFormat
  defenseSynth?: Map<string, string>
}): { rankedIds: string[]; unmapped: ParsedRow[] } {
  const { rows, pool, statsByPlayer, scoring, defenseSynth } = args
  const defenseByAbbr = buildDefenseAbbrMap(pool)
  const used = new Set<string>()
  const csvIds: string[] = []
  const seen = new Set<string>()
  const unmapped: ParsedRow[] = []

  for (const row of rows) {
    const rawId = pickPlayerForRow(row, pool, used, defenseByAbbr)
    const id = rawId ? canonicalPlayerId(pool, rawId, defenseSynth) : null
    if (!id) {
      unmapped.push(row)
      continue
    }
    used.add(id)
    if (seen.has(id)) continue
    seen.add(id)
    csvIds.push(id)
  }

  const forcedNameToId = resolveForcedPlayerIds(pool)
  const forced: { id: string; slot: number }[] = []
  for (const name of Object.keys(FORCED_TEMPLATE_SORT)) {
    const id = forcedNameToId.get(name)
    if (!id) continue
    forced.push({ id, slot: forcedSlot1Based(name) })
  }

  const head = mergeForcedIntoHead(csvIds, forced)
  const headSet = new Set(head)

  const rest = pool
    .map((p) => {
      const cid = canonicalPlayerId(pool, p.id, defenseSynth) ?? (isUuidLike(p.id) ? p.id : null)
      return { p, cid }
    })
    .filter((x): x is { p: PoolPlayer; cid: string } => x.cid != null && isUuidLike(x.cid) && !headSet.has(x.cid))
    .map(({ p, cid }) => {
      const st = statsByPlayer.get(cid)
      const ppg = ppgForScoring(st, scoring)
      const games = Number(st?.games_played) || 0
      const hasPpg = ppg != null && ppg > 0 && games > 0
      return { p, cid, ppg, hasPpg, adp: Number(p.adp) || 9999 }
    })

  const withPpg = rest.filter((x) => x.hasPpg).sort((a, b) => (b.ppg ?? 0) - (a.ppg ?? 0))
  const noPpg = rest.filter((x) => !x.hasPpg).sort((a, b) => a.adp - b.adp)

  const rosterWithPpg = withPpg.filter((x) => !isFaTeam(x.p.team))
  const faWithPpg = withPpg.filter((x) => isFaTeam(x.p.team))
  const rosterNoPpg = noPpg.filter((x) => !isFaTeam(x.p.team))
  const faNoPpg = noPpg.filter((x) => isFaTeam(x.p.team))

  const tailIds = [
    ...rosterWithPpg.map((x) => x.cid),
    ...faWithPpg.map((x) => x.cid),
    ...rosterNoPpg.map((x) => x.cid),
    ...faNoPpg.map((x) => x.cid),
  ]

  return { rankedIds: resolveRankedIds(pool, [...head, ...tailIds], defenseSynth), unmapped }
}

function buildRookieBaselineRows(
  rows: ParsedRow[],
  pool: PoolPlayer[],
  defenseSynth?: Map<string, string>
): { name: string; position: string; rank: number }[] {
  const defenseByAbbr = buildDefenseAbbrMap(pool)
  const used = new Set<string>()
  const out: { name: string; position: string; rank: number }[] = []
  for (const row of rows) {
    const pos = normPos(row.position)
    if (pos === 'DST' || pos === 'K') continue
    const rawId = pickPlayerForRow(row, pool, used, defenseByAbbr)
    const id = rawId ? canonicalPlayerId(pool, rawId, defenseSynth) : null
    if (!id) continue
    used.add(id)
    const p = poolRowByCanonicalId(pool, id, defenseSynth)
    if (!p) continue
    out.push({
      name: p.name,
      position: (p.position ?? '').toUpperCase(),
      rank: row.rank,
    })
  }
  return out
}

function sqlStr(s: string): string {
  return "'" + s.replace(/'/g, "''") + "'"
}

/** Match `resolveDefenseSyntheticIds` — D/ST rows may only exist for 2024 in `players`. */
const DST_PLAYER_SEASONS_SQL = '(2024, 2025, 2026)'

/** SQL expression for `player_id`: literal uuid, or subquery for D/ST when the merge pool only has `defense-*` ids. */
function sqlPlayerIdExpr(id: string, pool: PoolPlayer[]): string {
  if (isUuidLike(id)) return `'${id}'::uuid`
  const row = pool.find((p) => p.id === id)
  if (row && primaryFantasyPosition(row.position) === 'DST' && row.name) {
    const n = sqlStr(row.name)
    return `(SELECT p2.id FROM public.players p2 WHERE p2.position IN ('D/ST', 'DST', 'DEF') AND p2.name = ${n} AND p2.season IN ${DST_PLAYER_SEASONS_SQL} ORDER BY p2.season DESC NULLS LAST LIMIT 1)`
  }
  throw new Error(`Cannot emit SQL for player id ${id} (expected uuid or defense-* with known name)`)
}

function csvEscape(s: string): string {
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

/** Merge 2025/2026 like the app, then add 2024-only rows (e.g. vets not yet duplicated into 2025). */
function mergeRankingsSourceRows(rows: PoolPlayer[]): PoolPlayer[] {
  const without2024 = rows.filter((r) => Number(r.season) !== 2024)
  const merged2526 = mergePlayerPoolAcrossSeasons(
    without2024,
    PLAYER_POOL_PRIOR_SEASON,
    PLAYER_POOL_CURRENT_SEASON
  )
  const from2024 = rows.filter((r) => Number(r.season) === 2024)
  const espnSeen = new Set(merged2526.map((p) => p.espn_id).filter((id): id is string => !!id).map(String))
  const supplemental = from2024.filter((p) => {
    const e = p.espn_id ? String(p.espn_id) : null
    if (e && espnSeen.has(e)) return false
    return true
  })
  return [...merged2526, ...supplemental]
}

function buildRankingsPlayerPool(rows: PoolPlayer[]): PoolPlayer[] {
  const defenseNamesList = [...NFL_DEFENSE_TEAM_NAMES]
  const canonicalDefenseSet = new Set(NFL_DEFENSE_TEAM_NAMES)

  let allPlayersData = mergeRankingsSourceRows(rows)

  const existingDefenseNames = new Set(
    allPlayersData.filter((p) => isDefensePosition(p.position)).map((p) => p.name)
  )

  const missingDefenses = defenseNamesList.filter((teamName) => !existingDefenseNames.has(teamName))
  if (missingDefenses.length > 0) {
    const defenseInserts = missingDefenses.map((teamName, index) => {
      const adp = 150 + Math.floor((index / missingDefenses.length) * 50)
      return {
        id: `defense-${teamName.replace(/\s/g, '-').toLowerCase()}`,
        name: teamName,
        position: 'D/ST' as const,
        team: null as string | null,
        season: PLAYER_POOL_PRIOR_SEASON,
        adp,
        bye_week: null as number | null,
      } as PoolPlayer
    })
    allPlayersData = [...allPlayersData, ...defenseInserts]
  }

  const nonDefensePlayers = allPlayersData.filter((p) => !isDefensePosition(p.position))
  const allDefensePlayers = allPlayersData.filter(
    (p) => isDefensePosition(p.position) && canonicalDefenseSet.has(p.name)
  )

  const uniqueDefenseMap = new Map<string, PoolPlayer>()
  for (const defense of allDefensePlayers) {
    if (!uniqueDefenseMap.has(defense.name)) uniqueDefenseMap.set(defense.name, defense)
  }
  let defensePlayers = Array.from(uniqueDefenseMap.values())
  defensePlayers = defensePlayers.sort((a, b) => a.name.localeCompare(b.name))
  defensePlayers = defensePlayers.map((defense, index) => {
    const adp = 150 + Math.floor((index / Math.max(defensePlayers.length, 1)) * 50)
    if (Number(defense.adp) >= 200 || Number(defense.adp) < 150) {
      return { ...defense, adp }
    }
    return defense
  })

  const merged = [...nonDefensePlayers, ...defensePlayers].sort((a, b) => {
    const adpA = Number(a.adp) || 999
    const adpB = Number(b.adp) || 999
    return adpA - adpB
  })

  return deduplicatePlayersByIdentity(merged)
}

async function fetchAllPlayers(supabase: ReturnType<typeof createClient>): Promise<PoolPlayer[]> {
  const out: PoolPlayer[] = []
  const PAGE = 1000
  let from = 0
  let more = true
  while (more) {
    const { data, error } = await supabase
      .from('players')
      .select('id, name, position, team, season, adp, espn_id, sleeper_id')
      .in('season', [2024, PLAYER_POOL_PRIOR_SEASON, PLAYER_POOL_CURRENT_SEASON])
      .order('adp', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw error
    if (data?.length) {
      out.push(...(data as PoolPlayer[]))
      from += PAGE
      more = data.length === PAGE
    } else {
      more = false
    }
  }
  return out
}

/** Paginate a simple `select` (no join). */
async function paginateTable(
  supabase: ReturnType<typeof createClient>,
  table: string,
  columns: string
): Promise<Record<string, unknown>[]> {
  const PAGE = 1000
  let from = 0
  const out: Record<string, unknown>[] = []
  let more = true
  while (more) {
    const { data, error } = await supabase.from(table).select(columns).range(from, from + PAGE - 1)
    if (error) throw error
    if (data?.length) {
      out.push(...(data as Record<string, unknown>[]))
      from += PAGE
      more = data.length === PAGE
    } else {
      more = false
    }
  }
  return out
}

async function paginatePlayersWithEspnForStatsMap(
  supabase: ReturnType<typeof createClient>
): Promise<Record<string, unknown>[]> {
  const PAGE = 1000
  let from = 0
  const out: Record<string, unknown>[] = []
  let more = true
  while (more) {
    const { data, error } = await supabase
      .from('players')
      .select('id, espn_id, season')
      .in('season', [2024, 2025, 2026])
      .not('espn_id', 'is', null)
      .range(from, from + PAGE - 1)
    if (error) throw error
    if (data?.length) {
      out.push(...(data as Record<string, unknown>[]))
      from += PAGE
      more = data.length === PAGE
    } else {
      more = false
    }
  }
  return out
}

async function warnMissingDstRowsInDb(supabase: ReturnType<typeof createClient>): Promise<void> {
  const missing: string[] = []
  for (const name of NFL_DEFENSE_TEAM_NAMES) {
    const { data, error } = await supabase
      .from('players')
      .select('id')
      .in('position', [...DB_DST_POSITIONS])
      .eq('name', name)
      .in('season', [2024, 2025, 2026])
      .limit(1)
      .maybeSingle()
    if (error) continue
    if (!data?.id) missing.push(name)
  }
  if (missing.length) {
    console.warn(
      `No D/ST row in players (2024–2026) for: ${missing.join(
        '; '
      )}. Baseline SQL subqueries return NULL for those teams until rows exist.`
    )
  }
}

/**
 * If `get_player_2025_season_stats` times out, aggregate `weekly_stats_2025` by week (smaller queries)
 * and map gsis_id → `players.id` the same way the RPC does (depth_charts, rosters, players_info + espn).
 */
async function fetch2025StatsWeeklyFallback(
  supabase: ReturnType<typeof createClient>
): Promise<Map<string, StatRow>> {
  const gsisToEspn = new Map<string, string>()
  for (const t of ['depth_charts_2025', 'rosters_2025'] as const) {
    const rows = await paginateTable(supabase, t, 'gsis_id, espn_id')
    for (const r of rows) {
      const g = r.gsis_id != null ? String(r.gsis_id) : ''
      const e = r.espn_id != null ? String(r.espn_id) : ''
      if (g && e) gsisToEspn.set(g, e)
    }
  }
  const piRows = await paginateTable(supabase, 'players_info', 'gsis_id, espn_id')
  for (const r of piRows) {
    const g = r.gsis_id != null ? String(r.gsis_id) : ''
    const e = r.espn_id != null ? String(r.espn_id) : ''
    if (g && e && !gsisToEspn.has(g)) gsisToEspn.set(g, e)
  }

  const playerRows = await paginatePlayersWithEspnForStatsMap(supabase)
  const espnToPlayerId = new Map<string, string>()
  const byEspn = new Map<string, { id: string; season: number }[]>()
  for (const r of playerRows) {
    const e = r.espn_id != null ? String(r.espn_id) : ''
    if (!e) continue
    const id = String(r.id)
    const season = Number(r.season) || 0
    const list = byEspn.get(e) ?? []
    list.push({ id, season })
    byEspn.set(e, list)
  }
  for (const [e, list] of byEspn) {
    list.sort((a, b) => b.season - a.season)
    espnToPlayerId.set(e, list[0]!.id)
  }

  const byGsis = new Map<string, { std: number; ppr: number; g: number }>()
  for (let week = 1; week <= 18; week++) {
    let from = 0
    const PAGE = 1000
    let more = true
    while (more) {
      const { data, error } = await supabase
        .from('weekly_stats_2025')
        .select('player_id, fantasy_points, fantasy_points_ppr')
        .eq('season', 2025)
        .eq('week', week)
        .range(from, from + PAGE - 1)
      if (error) throw error
      if (data?.length) {
        for (const row of data as { player_id: string; fantasy_points: unknown; fantasy_points_ppr: unknown }[]) {
          const gid = String(row.player_id)
          const m = byGsis.get(gid) ?? { std: 0, ppr: 0, g: 0 }
          m.std += Number(row.fantasy_points) || 0
          m.ppr += Number(row.fantasy_points_ppr ?? row.fantasy_points) || 0
          m.g += 1
          byGsis.set(gid, m)
        }
        from += PAGE
        more = data.length === PAGE
      } else {
        more = false
      }
    }
  }

  const out = new Map<string, StatRow>()
  for (const [gsis, agg] of byGsis) {
    const espn = gsisToEspn.get(gsis)
    if (!espn) continue
    const player_id = espnToPlayerId.get(espn)
    if (!player_id) continue
    out.set(player_id, {
      player_id,
      total_fp_standard: agg.std,
      total_fp_ppr: agg.ppr,
      games_played: agg.g,
    })
  }
  return out
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

/** Prefer resolved DB UUIDs for D/ST so INSERT uses literals; dedupe if two synthetics map to one uuid. */
function rankedIdsForBaselineExport(ids: string[], defenseSynth: Map<string, string>): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const id of ids) {
    const u = defenseSynth.get(id)
    const next = u && isUuidLike(u) ? u : id
    if (seen.has(next)) continue
    seen.add(next)
    out.push(next)
  }
  return out
}

async function main() {
  loadDotEnv()
  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing VITE_SUPABASE_URL/SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }

  const rankingsDir = resolve(PROJECT_ROOT, process.env.BASELINE_RANKINGS_DIR?.trim() || 'rankings')
  const outDir = resolve(PROJECT_ROOT, process.env.BASELINE_OUT_DIR?.trim() || join('rankings', 'generated'))
  const migrationDir = resolve(PROJECT_ROOT, process.env.BASELINE_MIGRATION_DIR?.trim() || join('supabase', 'migrations'))
  const migrationSeqStart = parseInt(process.env.BASELINE_MIGRATION_SEQ?.trim() || '20260430220100', 10)
  const migrationOut = resolve(
    PROJECT_ROOT,
    process.env.BASELINE_MIGRATION_OUT?.trim() ||
      join('supabase', 'migrations', '20260430220000_rebuild_baselines_from_rankings_csv_monolith.sql')
  )

  mkdirSync(outDir, { recursive: true })
  mkdirSync(migrationDir, { recursive: true })

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    global: {
      fetch: (url, init = {}) => {
        const ms = Number(process.env.SUPABASE_FETCH_TIMEOUT_MS ?? 180000)
        const ctrl = new AbortController()
        const t = setTimeout(() => ctrl.abort(), ms)
        return fetch(url, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(t))
      },
    },
  })
  const rawPlayers = await fetchAllPlayers(supabase)
  const pool = buildRankingsPlayerPool(rawPlayers)
  applyPoolTeamOverrides(pool)
  const dstInPool = pool.filter((p) => primaryFantasyPosition(p.position) === 'DST').length
  if (dstInPool < 32) {
    console.warn(`Expected 32 D/ST rows in pool; got ${dstInPool}. Defense rows from CSV may not map.`)
  }
  const statsByPlayer = new Map<string, StatRow>()
  const { data: statRows, error: statErr } = await supabase.rpc('get_player_2025_season_stats')
  if (!statErr && statRows && statRows.length > 0) {
    for (const r of statRows as StatRow[]) {
      statsByPlayer.set(r.player_id, r)
    }
  } else {
    if (statErr) {
      console.warn('get_player_2025_season_stats failed:', statErr.message)
    } else {
      console.warn('get_player_2025_season_stats returned no rows.')
    }
    try {
      const fb = await fetch2025StatsWeeklyFallback(supabase)
      for (const [id, row] of fb) {
        statsByPlayer.set(id, row)
      }
      console.warn(
        `Using weekly_stats_2025 fallback: ${statsByPlayer.size} players with 2025 fantasy totals (PPG tails).`
      )
    } catch (e) {
      console.warn('weekly_stats fallback failed; tail order is roster vs FA + ADP only (no 2025 PPG).', e)
    }
  }

  const defenseSynth = await resolveDefenseSyntheticIds(supabase, pool)
  if (defenseSynth.size > 0) {
    console.warn(`Resolved ${defenseSynth.size} synthetic defense-* ids to database UUIDs for baseline inserts.`)
  }
  await warnMissingDstRowsInDb(supabase)

  const sqlMonolith: string[] = []
  sqlMonolith.push('-- Rebuild baselines from rankings/*.csv (generated by scripts/build-baseline-migration-from-rankings.ts)')
  sqlMonolith.push(
    '-- Apply split files in supabase/migrations if the SQL Editor rejects large scripts; or use psql -f. Stats: RPC or weekly_stats fallback for PPG tails.'
  )
  sqlMonolith.push('BEGIN;')
  sqlMonolith.push('')

  type CommunityBucket = { scoring: ScoringFormat; league_type: 'season' | 'dynasty'; is_superflex: boolean }
  const communityBuckets = new Map<string, string[]>()

  function bucketKey(b: CommunityBucket) {
    return `${b.scoring}|${b.league_type}|${b.is_superflex}`
  }

  function setCommunityBucket(b: CommunityBucket, rankedIds: string[]) {
    communityBuckets.set(bucketKey(b), rankedIds)
  }

  for (const spec of SEASON_SCORING_FILES) {
    const path = join(rankingsDir, spec.file)
    if (!existsSync(path)) throw new Error(`Missing rankings file: ${path}`)
    const rows = parseFourLineCsv(path)
    const { rankedIds, unmapped } = buildRankedCommunityList({
      rows,
      pool,
      statsByPlayer,
      scoring: spec.scoring,
      defenseSynth,
    })
    if (unmapped.length) {
      console.warn(
        `Unmapped rows (${spec.file}): ${unmapped.length}`,
        unmapped.slice(0, 8).map((r) => ({ ...r, nameClean: cleanQuotedCsvCell(r.nameShort) }))
      )
    }
    const exportedIds = rankedIdsForBaselineExport(rankedIds, defenseSynth)
    const b: CommunityBucket = {
      scoring: spec.scoring,
      league_type: 'season',
      is_superflex: spec.isSuperflex,
    }
    setCommunityBucket(b, exportedIds)

    const csvLines = ['rank,player_id,name,position,team_db']
    for (let i = 0; i < exportedIds.length; i++) {
      const id = exportedIds[i]!
      const p = poolRowByCanonicalId(pool, id, defenseSynth)
      if (!p) continue
      csvLines.push(
        [i + 1, id, csvEscape(p.name), p.position ?? '', p.team ?? ''].join(',')
      )
    }
    writeFileSync(
      join(outDir, `${spec.scoring}_season_${spec.isSuperflex ? 'superflex' : '1qb'}.csv`),
      csvLines.join('\n'),
      'utf8'
    )
  }

  const pprSeasonSf = communityBuckets.get(bucketKey({ scoring: 'ppr', league_type: 'season', is_superflex: true }))
  const halfSeason1qb = communityBuckets.get(bucketKey({ scoring: 'half_ppr', league_type: 'season', is_superflex: false }))
  const standardSeason1qb = communityBuckets.get(bucketKey({ scoring: 'standard', league_type: 'season', is_superflex: false }))

  if (pprSeasonSf?.length && halfSeason1qb?.length) {
    const merged = mergeSeasonSuperflexOverlay(pprSeasonSf, halfSeason1qb, pool, defenseSynth)
    const exported = rankedIdsForBaselineExport(merged, defenseSynth)
    setCommunityBucket({ scoring: 'half_ppr', league_type: 'season', is_superflex: true }, exported)
    const lines = ['rank,player_id,name,position,team_db']
    for (let i = 0; i < exported.length; i++) {
      const id = exported[i]!
      const p = poolRowByCanonicalId(pool, id, defenseSynth)
      if (!p) continue
      lines.push([i + 1, id, csvEscape(p.name), p.position ?? '', p.team ?? ''].join(','))
    }
    writeFileSync(join(outDir, 'half_ppr_season_superflex.csv'), lines.join('\n'), 'utf8')
    console.log(
      'Built half_ppr season superflex (PPR SF QB slots + half_ppr 1QB non-QBs):',
      exported.length,
      'players'
    )
  } else {
    console.warn('Skipped half_ppr season superflex: need PPR season SF and half_ppr season 1QB baselines.')
  }

  if (pprSeasonSf?.length && standardSeason1qb?.length) {
    const merged = mergeSeasonSuperflexOverlay(pprSeasonSf, standardSeason1qb, pool, defenseSynth)
    const exported = rankedIdsForBaselineExport(merged, defenseSynth)
    setCommunityBucket({ scoring: 'standard', league_type: 'season', is_superflex: true }, exported)
    const lines = ['rank,player_id,name,position,team_db']
    for (let i = 0; i < exported.length; i++) {
      const id = exported[i]!
      const p = poolRowByCanonicalId(pool, id, defenseSynth)
      if (!p) continue
      lines.push([i + 1, id, csvEscape(p.name), p.position ?? '', p.team ?? ''].join(','))
    }
    writeFileSync(join(outDir, 'standard_season_superflex.csv'), lines.join('\n'), 'utf8')
    console.log(
      'Built standard season superflex (PPR SF QB slots + standard 1QB non-QBs):',
      exported.length,
      'players'
    )
  } else {
    console.warn('Skipped standard season superflex: need PPR season SF and standard season 1QB baselines.')
  }

  for (const spec of DYNASTY_STARTUP_FILES) {
    const path = join(rankingsDir, spec.file)
    if (!existsSync(path)) throw new Error(`Missing rankings file: ${path}`)
    const rows = parseFourLineCsv(path)
    for (const scoring of SCORINGS_FOR_DYNASTY_DUP) {
      const { rankedIds, unmapped } = buildRankedCommunityList({
        rows,
        pool,
        statsByPlayer,
        scoring,
        defenseSynth,
      })
      if (unmapped.length) {
        console.warn(`Unmapped (${spec.file} / ${scoring}): ${unmapped.length}`)
      }
      setCommunityBucket(
        { scoring, league_type: 'dynasty', is_superflex: spec.isSuperflex },
        rankedIdsForBaselineExport(rankedIds, defenseSynth)
      )
    }
    const { rankedIds: pprIds } = buildRankedCommunityList({
      rows,
      pool,
      statsByPlayer,
      scoring: 'ppr',
      defenseSynth,
    })
    const exportedPpr = rankedIdsForBaselineExport(pprIds, defenseSynth)
    const csvLines = ['rank,player_id,name,position,team_db']
    for (let i = 0; i < exportedPpr.length; i++) {
      const id = exportedPpr[i]!
      const p = poolRowByCanonicalId(pool, id, defenseSynth)
      if (!p) continue
      csvLines.push([i + 1, id, csvEscape(p.name), p.position ?? '', p.team ?? ''].join(','))
    }
    writeFileSync(
      join(outDir, `dynasty_startup_${spec.isSuperflex ? 'superflex' : '1qb'}_ppr.csv`),
      csvLines.join('\n'),
      'utf8'
    )
  }

  const rookieSqlChunks: string[] = []
  for (const rf of ROOKIE_FILES) {
    const path = join(rankingsDir, rf.file)
    if (!existsSync(path)) throw new Error(`Missing rankings file: ${path}`)
    const rows = parseFourLineCsv(path)
    const rbRows = buildRookieBaselineRows(rows, pool, defenseSynth)
    rookieSqlChunks.push(
      `DELETE FROM public.baseline_rookies WHERE league_type = 'dynasty' AND is_superflex = ${rf.isSuperflex} AND scoring_format IN ('ppr', 'half_ppr', 'standard', 'any');`
    )
    const valueLines = rbRows.map(
      (r) =>
        `(${sqlStr(r.name)}, ${sqlStr(r.position)}, ${r.rank}::numeric, scoring_fmt, 'dynasty', ${rf.isSuperflex})`
    )
    for (const sfmt of SCORINGS_FOR_DYNASTY_DUP) {
      const body = valueLines.map((line) => line.replace('scoring_fmt', sqlStr(sfmt))).join(',\n')
      rookieSqlChunks.push(
        `INSERT INTO public.baseline_rookies (name, position, rank, scoring_format, league_type, is_superflex)\nVALUES\n${body};`
      )
    }
    const csvOut = ['rank,name,position', ...rbRows.map((r) => [r.rank, csvEscape(r.name), r.position].join(','))]
    writeFileSync(join(outDir, `rookies_dynasty_${rf.isSuperflex ? 'superflex' : '1qb'}.csv`), csvOut.join('\n'), 'utf8')
  }

  function communityBucketSlug(k: string): string {
    const [scoring, league_type, sf] = k.split('|')
    const qb = sf === 'true' ? 'superflex' : '1qb'
    return `${league_type}_${scoring}_${qb}`
  }

  let seq = migrationSeqStart
  const sortedCommunityKeys = [...communityBuckets.keys()].sort()

  for (const k of sortedCommunityKeys) {
    const rankedIds = communityBuckets.get(k)!
    const [scoring, league_type, sf] = k.split('|')
    const isSuperflex = sf === 'true'
    const lines: string[] = [
      '-- Rebuild baselines from rankings/*.csv (generated by scripts/build-baseline-migration-from-rankings.ts)',
      `BEGIN;`,
      `DELETE FROM public.baseline_community_rankings WHERE scoring_format = ${sqlStr(scoring)} AND league_type = ${sqlStr(league_type)} AND is_superflex = ${isSuperflex};`,
    ]
    const values = rankedIds.map(
      (id, i) =>
        `(${sqlStr(scoring)}, ${sqlStr(league_type)}, ${isSuperflex}, ${sqlPlayerIdExpr(id, pool)}, ${i + 1}::numeric)`
    )
    for (const part of chunk(values, 400)) {
      lines.push(
        `INSERT INTO public.baseline_community_rankings (scoring_format, league_type, is_superflex, player_id, rank) VALUES\n${part.join(',\n')};`
      )
    }
    lines.push('COMMIT;')
    const name = `${seq}_rebuild_baselines_from_rankings_${communityBucketSlug(k)}.sql`
    seq += 1
    writeFileSync(join(migrationDir, name), lines.join('\n'), 'utf8')

    sqlMonolith.push(
      `DELETE FROM public.baseline_community_rankings WHERE scoring_format = ${sqlStr(scoring)} AND league_type = ${sqlStr(league_type)} AND is_superflex = ${isSuperflex};`
    )
    for (const part of chunk(values, 400)) {
      sqlMonolith.push(
        `INSERT INTO public.baseline_community_rankings (scoring_format, league_type, is_superflex, player_id, rank) VALUES\n${part.join(',\n')};`
      )
    }
    sqlMonolith.push('')
  }

  const rookieLines = [
    '-- Rebuild baseline_rookies from rankings/*.csv (generated by scripts/build-baseline-migration-from-rankings.ts)',
    'BEGIN;',
    ...rookieSqlChunks,
    'COMMIT;',
  ]
  writeFileSync(join(migrationDir, `${seq}_rebuild_baselines_from_rankings_rookies.sql`), rookieLines.join('\n'), 'utf8')

  sqlMonolith.push(...rookieSqlChunks)
  sqlMonolith.push('')
  sqlMonolith.push('COMMIT;')

  if (process.env.BASELINE_MIGRATION_MONOLITH === '1') {
    writeFileSync(migrationOut, sqlMonolith.join('\n'), 'utf8')
    console.log(`Wrote monolith migration: ${migrationOut}`)
  }

  console.log(`Wrote split migrations under: ${migrationDir} (starting ${migrationSeqStart})`)
  console.log(`Wrote CSVs under: ${outDir}`)
  console.log(`Community buckets: ${communityBuckets.size}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
