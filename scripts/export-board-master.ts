/**
 * Export every format's Consensus / ESPN / Yahoo / Sleeper board ranks
 * the same way Rankings does: site order first, then consensus tail.
 *
 * Writes rankings/adp-sources/board-master.json
 * Usage: npx tsx scripts/export-board-master.ts
 */
import { createClient } from '@supabase/supabase-js'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { AdpSourceBoardFile } from '../src/constants/adpRankingSources'
import {
  PLAYER_POOL_CURRENT_SEASON,
  PLAYER_POOL_PRIOR_SEASON,
} from '../src/constants/playerPoolSeason'
import { deduplicatePlayersByIdentity, mergePlayerPoolAcrossSeasons } from '../src/utils/playerDeduplication'
import { displayTeamAbbrevOrFa } from '../src/utils/teamMapping'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(SCRIPT_DIR, '..')
const PAGE_SIZE = 1000

const BUCKET_ORDER = [
  'ppr_season_1qb',
  'half_ppr_season_1qb',
  'standard_season_1qb',
  'ppr_season_superflex',
  'half_ppr_season_superflex',
  'standard_season_superflex',
  'ppr_dynasty_1qb',
  'half_ppr_dynasty_1qb',
  'standard_dynasty_1qb',
  'ppr_dynasty_superflex',
  'half_ppr_dynasty_superflex',
  'standard_dynasty_superflex',
  'ppr_dynasty_1qb_rookies',
  'ppr_dynasty_superflex_rookies',
] as const

type PoolPlayer = {
  id: string
  name: string
  position: string | null
  team: string | null
  season: number | null
  adp: number | null
  espn_id?: string | null
}

type Catalog = {
  buckets: Record<
    string,
    {
      title: string
      sources: string[]
      players: Array<{ avg: number; ranks: Record<string, number> }>
    }
  >
}

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

async function fetchAllPlayers(supabase: ReturnType<typeof createClient>): Promise<PoolPlayer[]> {
  const out: PoolPlayer[] = []
  let from = 0
  let hasMore = true
  while (hasMore) {
    const { data, error } = await supabase
      .from('players')
      .select('id, name, position, team, season, adp, espn_id')
      .in('season', [PLAYER_POOL_PRIOR_SEASON, PLAYER_POOL_CURRENT_SEASON])
      .order('adp', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    if (data?.length) {
      out.push(...(data as PoolPlayer[]))
      from += PAGE_SIZE
      hasMore = data.length === PAGE_SIZE
    } else {
      hasMore = false
    }
  }
  return out
}

function parseBucket(key: string) {
  const rookies = key.endsWith('_rookies')
  const isSuperflex = key.includes('_superflex')
  let scoringFormat = 'ppr'
  if (key.startsWith('half_ppr')) scoringFormat = 'half_ppr'
  else if (key.startsWith('standard')) scoringFormat = 'standard'
  return { scoringFormat, isSuperflex, rookies }
}

function displayPos(raw: string | null | undefined): string {
  const p = (raw || '').trim().toUpperCase()
  if (p === 'DEF' || p === 'D/ST' || p === 'DST' || p === 'D') return 'DST'
  if (p === 'PK') return 'K'
  return p
}

function orderIdsByBoard(universe: string[], sourceRows: Array<{ id: string }> | null | undefined): string[] {
  if (!sourceRows?.length) return universe
  const allowed = new Set(universe)
  const used = new Set<string>()
  const out: string[] = []
  for (const row of sourceRows) {
    if (!allowed.has(row.id) || used.has(row.id)) continue
    used.add(row.id)
    out.push(row.id)
  }
  for (const id of universe) {
    if (used.has(id)) continue
    out.push(id)
  }
  return out
}

function rankMap(order: string[]): Map<string, number> {
  const m = new Map<string, number>()
  order.forEach((id, i) => m.set(id, i + 1))
  return m
}

function mainJson() {
  loadEnvFile('.env', false)
  loadEnvFile('.env.local', true)
}

async function main() {
  mainJson()
  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing VITE_SUPABASE_URL/SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }

  const catalog = JSON.parse(
    readFileSync(join(PROJECT_ROOT, 'rankings', 'adp-sources', 'catalog.json'), 'utf8')
  ) as Catalog
  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const raw = await fetchAllPlayers(supabase)
  const pool = deduplicatePlayersByIdentity(
    mergePlayerPoolAcrossSeasons(raw, PLAYER_POOL_PRIOR_SEASON, PLAYER_POOL_CURRENT_SEASON)
  )
  const byId = new Map(pool.map((p) => [p.id, p]))
  const publicDir = join(PROJECT_ROOT, 'public', 'adp-sources')

  const sheets: Array<{
    key: string
    title: string
    rows: Array<{
      name: string
      pos: string
      team: string
      avg: number
      consensus: number
      espn: number
      yahoo: number
      sleeper: number
    }>
  }> = []

  for (const key of BUCKET_ORDER) {
    const cat = catalog.buckets[key]
    const boardPath = join(publicDir, `${key}.json`)
    if (!cat || !existsSync(boardPath)) continue
    const board = JSON.parse(readFileSync(boardPath, 'utf8')) as AdpSourceBoardFile
    const parsed = parseBucket(key)
    const rookies = parsed.rookies

    const communityIds = board.community.map((r) => r.id).filter((id) => byId.has(id))
    const boardIdSet = new Set(communityIds)
    for (const rows of Object.values(board.boards)) {
      for (const row of rows) boardIdSet.add(row.id)
    }

    let remaining = pool
      .filter((p) => !boardIdSet.has(p.id))
      .sort((a, b) => (a.adp ?? 9999) - (b.adp ?? 9999) || a.name.localeCompare(b.name))

    if (rookies) {
      const { data: rookiesRows, error } = await supabase.rpc('get_rookies_rankings', {
        p_scoring_format: parsed.scoringFormat,
        p_league_type: 'dynasty',
        p_is_superflex: parsed.isSuperflex,
        p_season: PLAYER_POOL_CURRENT_SEASON,
      })
      if (!error && Array.isArray(rookiesRows) && rookiesRows.length) {
        const rookieIds = new Set(
          (rookiesRows as Array<{ player_id: string }>).map((r) => r.player_id).filter((id) => byId.has(id))
        )
        remaining = remaining.filter((p) => rookieIds.has(p.id))
        const extra = [...rookieIds].filter((id) => !boardIdSet.has(id) && !remaining.some((p) => p.id === id))
        remaining = [
          ...remaining,
          ...extra
            .map((id) => byId.get(id)!)
            .filter(Boolean)
            .sort((a, b) => (a.adp ?? 9999) - (b.adp ?? 9999) || a.name.localeCompare(b.name)),
        ]
      } else {
        remaining = []
      }
    }

    const universe = [...communityIds, ...remaining.map((p) => p.id).filter((id) => !communityIds.includes(id))]

    const avgById = new Map<string, number>()
    for (const row of board.community) {
      if (Number.isFinite(row.adp)) avgById.set(row.id, row.adp)
    }

    const consensus = rankMap(universe)
    const espn = rankMap(orderIdsByBoard(universe, board.boards.espn))
    const yahoo = rankMap(orderIdsByBoard(universe, board.boards.yahoo))
    const sleeper = rankMap(orderIdsByBoard(universe, board.boards.sleeper))

    const rows = universe.map((id) => {
      const p = byId.get(id)
      const consensusRank = consensus.get(id) ?? 0
      const avg = avgById.get(id)
      return {
        name: p?.name ?? id,
        pos: displayPos(p?.position),
        team: displayTeamAbbrevOrFa(p?.team, p?.position, p?.name),
        avg: avg != null ? avg : consensusRank,
        consensus: consensusRank,
        espn: espn.get(id) ?? consensusRank,
        yahoo: yahoo.get(id) ?? consensusRank,
        sleeper: sleeper.get(id) ?? consensusRank,
      }
    })
    rows.sort((a, b) => a.consensus - b.consensus)
    sheets.push({ key, title: cat.title, rows })
    console.log(`${key}: ${rows.length} players`)
  }

  const outDir = join(PROJECT_ROOT, 'rankings', 'adp-sources')
  mkdirSync(outDir, { recursive: true })
  const jsonPath = join(outDir, 'board-master.json')
  writeFileSync(jsonPath, JSON.stringify({ sheets }), 'utf8')
  console.log(`Wrote ${jsonPath}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
