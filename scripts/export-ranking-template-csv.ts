/**
 * Export the same merged player pool as Rankings (2025 + 2026 merge, D/ST fill, identity dedupe)
 * to a CSV with empty columns for you to fill ranks 1..N for each baseline bucket.
 *
 * Usage:
 *   npx tsx scripts/export-ranking-template-csv.ts
 *
 * Env (same as other scripts):
 *   VITE_SUPABASE_URL or SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Optional:
 *   RANKING_TEMPLATE_OUT=path/to/file.csv   (must end in .csv; default: <project>/data/ranking_template.csv)
 *
 * Output is always a .csv file under the project `data/` folder — not the .ts script in `scripts/`.
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
const PAGE_SIZE = 1000

const RANK_FORMAT_HEADERS = [
  { header: 'your_rank_ppr_season_superflex', scoring_format: 'ppr', league_type: 'season', is_superflex: true },
  { header: 'your_rank_ppr_season_1qb', scoring_format: 'ppr', league_type: 'season', is_superflex: false },
  { header: 'your_rank_ppr_dynasty_superflex', scoring_format: 'ppr', league_type: 'dynasty', is_superflex: true },
  { header: 'your_rank_ppr_dynasty_1qb', scoring_format: 'ppr', league_type: 'dynasty', is_superflex: false },
  { header: 'your_rank_half_ppr_season_superflex', scoring_format: 'half_ppr', league_type: 'season', is_superflex: true },
  { header: 'your_rank_half_ppr_season_1qb', scoring_format: 'half_ppr', league_type: 'season', is_superflex: false },
  { header: 'your_rank_half_ppr_dynasty_superflex', scoring_format: 'half_ppr', league_type: 'dynasty', is_superflex: true },
  { header: 'your_rank_half_ppr_dynasty_1qb', scoring_format: 'half_ppr', league_type: 'dynasty', is_superflex: false },
  { header: 'your_rank_standard_season_superflex', scoring_format: 'standard', league_type: 'season', is_superflex: true },
  { header: 'your_rank_standard_season_1qb', scoring_format: 'standard', league_type: 'season', is_superflex: false },
  { header: 'your_rank_standard_dynasty_superflex', scoring_format: 'standard', league_type: 'dynasty', is_superflex: true },
  { header: 'your_rank_standard_dynasty_1qb', scoring_format: 'standard', league_type: 'dynasty', is_superflex: false },
] as const

type PlayerRow = {
  id: string
  name: string
  position: string | null
  team: string | null
  season: number | null
  adp: number | null
  bye_week: number | null
  espn_id?: string | null
  sleeper_id?: string | null
  years_exp?: number | null
  jersey_number?: number | null
}

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

function escapeCsvCell(v: string | number | null | undefined): string {
  if (v == null) return ''
  const s = String(v)
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function isUuidLike(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
}

/** Mirrors Rankings.tsx in-memory pool (no live `teams` table — uses full NFL defense name list). */
function buildRankingsPlayerPool(rows: PlayerRow[]): PlayerRow[] {
  const defenseNamesList = [...NFL_DEFENSE_TEAM_NAMES]
  const canonicalDefenseSet = new Set(NFL_DEFENSE_TEAM_NAMES)

  let allPlayersData = mergePlayerPoolAcrossSeasons(
    rows,
    PLAYER_POOL_PRIOR_SEASON,
    PLAYER_POOL_CURRENT_SEASON
  )

  const existingDefenseNames = new Set(
    allPlayersData.filter((p) => p.position === 'D/ST').map((p) => p.name)
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
      }
    })
    allPlayersData = [...allPlayersData, ...defenseInserts]
  }

  const nonDefensePlayers = allPlayersData.filter((p) => p.position !== 'D/ST')
  const allDefensePlayers = allPlayersData.filter(
    (p) => p.position === 'D/ST' && canonicalDefenseSet.has(p.name)
  )

  const uniqueDefenseMap = new Map<string, PlayerRow>()
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

async function fetchAllPlayers(supabase: ReturnType<typeof createClient>): Promise<PlayerRow[]> {
  const out: PlayerRow[] = []
  let from = 0
  let hasMore = true
  while (hasMore) {
    const { data, error } = await supabase
      .from('players')
      .select(
        'id, name, position, team, season, adp, bye_week, espn_id, sleeper_id, years_exp, jersey_number'
      )
      .in('season', [PLAYER_POOL_PRIOR_SEASON, PLAYER_POOL_CURRENT_SEASON])
      .order('adp', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)

    if (error) throw error
    if (data?.length) {
      out.push(...(data as PlayerRow[]))
      from += PAGE_SIZE
      hasMore = data.length === PAGE_SIZE
    } else {
      hasMore = false
    }
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

  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const raw = await fetchAllPlayers(supabase)
  const pool = buildRankingsPlayerPool(raw)

  const staticHeaders = [
    'sort_index',
    'player_id',
    'id_is_db_uuid',
    'name',
    'position',
    'team',
    'season',
    'adp',
    'bye_week',
    'years_exp',
    'espn_id',
    'sleeper_id',
    'jersey_number',
  ] as const

  const rankHeaders = RANK_FORMAT_HEADERS.map((c) => c.header)
  const allHeaders = [...staticHeaders, ...rankHeaders]

  const bucketNote = RANK_FORMAT_HEADERS.map(
    (c) => `${c.header} <=> scoring_format=${c.scoring_format} league_type=${c.league_type} is_superflex=${c.is_superflex}`
  ).join('\n')

  const lines: string[] = []
  lines.push(allHeaders.map(escapeCsvCell).join(','))

  pool.forEach((p, i) => {
    const emptyRanks = rankHeaders.map(() => '')
    const row = [
      i + 1,
      p.id,
      isUuidLike(p.id) ? 'yes' : 'no',
      p.name,
      p.position ?? '',
      p.team ?? '',
      p.season ?? '',
      p.adp ?? '',
      p.bye_week ?? '',
      p.years_exp ?? '',
      p.espn_id ?? '',
      p.sleeper_id ?? '',
      p.jersey_number ?? '',
      ...emptyRanks,
    ]
    lines.push(row.map(escapeCsvCell).join(','))
  })

  const dataDir = join(PROJECT_ROOT, 'data')
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true })

  const envOut = process.env.RANKING_TEMPLATE_OUT?.trim()
  let outPath = envOut ? resolve(envOut) : join(dataDir, 'ranking_template.csv')
  if (!outPath.toLowerCase().endsWith('.csv')) {
    outPath = `${outPath}.csv`
  }

  writeFileSync(outPath, lines.join('\r\n'), 'utf8')

  const synth = pool.filter((p) => !isUuidLike(p.id)).length
  const abs = resolve(outPath)
  console.log(`Wrote CSV: ${abs}`)
  console.log(`(This is a .csv file in data/ — the script you run is scripts/export-ranking-template-csv.ts)`)
  console.log(`Rows: ${pool.length} (non-UUID / synthetic ids: ${synth} — usually in-memory D/ST rows)`)
  console.log('')
  console.log('Per column, assign a unique integer rank from 1 through ' + String(pool.length) + ' (one ranking per bucket).')
  console.log('Column ↔ DB bucket:')
  console.log(bucketNote)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
