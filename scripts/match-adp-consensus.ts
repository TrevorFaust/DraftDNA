/**
 * Match rankings/adp-sources/catalog.json to the player pool and write:
 *   public/adp-sources/<bucket>.json
 *   rankings/adp-sources/matched-report.txt
 *
 * Usage:
 *   npx tsx scripts/match-adp-consensus.ts
 */
import { createClient } from '@supabase/supabase-js'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { adpBucketKey, type AdpSourceBoardFile } from '../src/constants/adpRankingSources'
import {
  PLAYER_POOL_CURRENT_SEASON,
  PLAYER_POOL_PRIOR_SEASON,
} from '../src/constants/playerPoolSeason'
import { playerNameMatchKeys } from '../src/utils/playerNameMatch'
import { deduplicatePlayersByIdentity, mergePlayerPoolAcrossSeasons } from '../src/utils/playerDeduplication'
import { canonicalTeamAbbr, teamFieldToAbbr } from '../src/utils/teamMapping'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(SCRIPT_DIR, '..')
const PAGE_SIZE = 1000

type Catalog = {
  buckets: Record<
    string,
    {
      title: string
      sources: string[]
      players: Array<{
        rank: number
        name: string
        pos: string
        team: string
        avg: number
        n: number
        ranks: Record<string, number>
      }>
    }
  >
}

type PoolPlayer = {
  id: string
  name: string
  position: string | null
  team: string | null
  season: number | null
  adp: number | null
  espn_id?: string | null
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

function normPos(raw: string | null | undefined): string {
  const p = (raw || '').trim().toUpperCase()
  if (p === 'DEF' || p === 'D/ST' || p === 'DST' || p === 'D') return 'DST'
  if (p === 'PK') return 'K'
  return p
}

function normTeam(raw: string | null | undefined): string {
  if (!raw?.trim()) return ''
  return canonicalTeamAbbr(teamFieldToAbbr(raw) ?? raw.trim().toUpperCase()) ?? raw.trim().toUpperCase()
}

function firstLast(name: string): { first: string; last: string } {
  const parts = name.split(/\s+/).filter(Boolean)
  return { first: parts[0] || '', last: parts.at(-1) || '' }
}

function firstNameVariants(first: string): string[] {
  const aliases: Record<string, string> = {
    hollywood: 'marquise',
    cam: 'cameron',
    chig: 'chigoziem',
    kenny: 'kenneth',
    tank: 'nathaniel',
    andy: 'andres',
  }
  const reverse: Record<string, string[]> = {}
  for (const [short, full] of Object.entries(aliases)) {
    ;(reverse[full] ??= []).push(short)
  }
  const out = new Set<string>([first])
  if (aliases[first]) out.add(aliases[first])
  for (const s of reverse[first] ?? []) out.add(s)
  return [...out].filter(Boolean)
}

function firstNamesCompatible(a: string, b: string, teamsAgree = false): boolean {
  const fa = firstLast(a).first
  const fb = firstLast(b).first
  if (!fa || !fb) return false
  for (const xa of firstNameVariants(fa)) {
    for (const xb of firstNameVariants(fb)) {
      if (xa === xb) return true
      if (xa.length === 1 && xb.startsWith(xa)) {
        if (xb.length <= 2) {
          if (teamsAgree) return true
          continue
        }
        return true
      }
      if (xb.length === 1 && xa.startsWith(xb)) {
        if (xa.length <= 2) {
          if (teamsAgree) return true
          continue
        }
        return true
      }
      if (Math.min(xa.length, xb.length) >= 3 && (xa.startsWith(xb) || xb.startsWith(xa))) return true
    }
  }
  return false
}

function buildIndexes(pool: PoolPlayer[]) {
  const byFull = new Map<string, PoolPlayer[]>()
  const byInitial = new Map<string, PoolPlayer[]>()
  const byLast = new Map<string, PoolPlayer[]>()
  const byDstTeam = new Map<string, PoolPlayer>()
  const add = (map: Map<string, PoolPlayer[]>, key: string, p: PoolPlayer) => {
    const list = map.get(key) ?? []
    list.push(p)
    map.set(key, list)
  }
  for (const p of pool) {
    const pos = normPos(p.position)
    const team = normTeam(p.team)
    if (pos === 'DST' && team && !byDstTeam.has(team)) {
      byDstTeam.set(team, p)
    }
    for (const k of playerNameMatchKeys(p.name)) {
      add(byFull, `${k}|${pos}|${team}`, p)
      add(byFull, `${k}|${pos}|`, p)
      add(byFull, `${k}||`, p)
      const { first, last } = firstLast(k)
      if (first && last) {
        add(byInitial, `${first[0]}|${last}|${pos}|${team}`, p)
        add(byInitial, `${first[0]}|${last}|${pos}|`, p)
        if (pos && team) add(byLast, `${last}|${pos}|${team}`, p)
      }
    }
  }
  return { byFull, byInitial, byLast, byDstTeam }
}

function pickUnique(hits: PoolPlayer[] | undefined): PoolPlayer | null {
  if (!hits?.length) return null
  const ids = new Set(hits.map((h) => h.id))
  if (ids.size === 1) return hits[0]
  return null
}

const NAME_ALIASES: Record<string, string> = {
  'kenny gainwell': 'kenneth gainwell',
  'kenneth gainwell': 'kenny gainwell',
  'cam skatteb': 'cam skattebo',
  'cameron skatteb': 'cam skattebo',
  'cameron skattebo': 'cam skattebo',
  'cameron ward': 'cam ward',
  'chig okonkwo': 'chigoziem okonkwo',
  'chigoziem okonkwo': 'chig okonkwo',
  'nathaniel dell': 'tank dell',
  'andres borregales': 'andy borregales',
  'chig okonkw': 'chigoziem okonkwo',
  'chigoziem okonkw': 'chigoziem okonkwo',
  'isiah pachec': 'isiah pacheco',
  'eddy pineir': 'eddy pineiro',
  'emari demercad': 'emari demercado',
  'hollywood brown': 'marquise brown',
}

function aliasedNames(name: string): string[] {
  const keys = playerNameMatchKeys(name)
  const out = new Set(keys)
  for (const k of keys) {
    if (NAME_ALIASES[k]) {
      for (const a of playerNameMatchKeys(NAME_ALIASES[k])) out.add(a)
    }
  }
  return [...out]
}
function matchRow(
  name: string,
  pos: string,
  team: string,
  idx: ReturnType<typeof buildIndexes>
): PoolPlayer | null {
  const nPos = normPos(pos)
  const nTeam = normTeam(team)
  if (nPos === 'DST' && nTeam) {
    const dstHit = idx.byDstTeam.get(nTeam)
    if (dstHit) return dstHit
  }
  for (const k of aliasedNames(name)) {
    const hit =
      pickUnique(idx.byFull.get(`${k}|${nPos}|${nTeam}`)) ||
      pickUnique(idx.byFull.get(`${k}|${nPos}|`)) ||
      (!nPos ? pickUnique(idx.byFull.get(`${k}||`)) : null)
    if (hit) return hit
  }
  const nk = playerNameMatchKeys(name)[0] || ''
  const { first, last } = firstLast(nk)
  if (last && nPos && nTeam) {
    const lastHits = idx.byLast.get(`${last}|${nPos}|${nTeam}`) || []
    const compatible = lastHits.filter((h) => {
      const hk = playerNameMatchKeys(h.name)[0] || ''
      return firstNamesCompatible(nk, hk, true)
    })
    const hit = pickUnique(compatible)
    if (hit) return hit
  }
  if (first.length <= 1 && last) {
    const hit =
      pickUnique(idx.byInitial.get(`${first}|${last}|${nPos}|${nTeam}`)) ||
      pickUnique(idx.byInitial.get(`${first}|${last}|${nPos}|`))
    if (hit) return hit
  }
  return null
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

function parseBucketKey(key: string) {
  const rookies = key.endsWith('_rookies')
  const base = rookies ? key.slice(0, -8) : key
  const isSuperflex = base.endsWith('_superflex')
  const rest = isSuperflex ? base.slice(0, -10) : base.replace(/_1qb$/, '')
  const [scoring, league] = rest.split('_').length > 2
    ? [rest.startsWith('half_ppr') ? 'half_ppr' : rest.split('_')[0], rest.includes('dynasty') ? 'dynasty' : 'season']
    : ['ppr', 'season']
  let scoringFormat = 'ppr'
  if (base.startsWith('half_ppr')) scoringFormat = 'half_ppr'
  else if (base.startsWith('standard')) scoringFormat = 'standard'
  const leagueType = base.includes('dynasty') ? 'dynasty' : 'season'
  return { scoringFormat, leagueType, isSuperflex, rookiesOnly: rookies, scoring }
}

async function main() {
  loadEnvFile('.env', false)
  loadEnvFile('.env.local', true)
  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing VITE_SUPABASE_URL/SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }

  const catalogPath = join(PROJECT_ROOT, 'rankings', 'adp-sources', 'catalog.json')
  const catalog = JSON.parse(readFileSync(catalogPath, 'utf8')) as Catalog

  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const raw = await fetchAllPlayers(supabase)
  const pool = mergePlayerPoolAcrossSeasons(raw, PLAYER_POOL_PRIOR_SEASON, PLAYER_POOL_CURRENT_SEASON)
  const deduped = deduplicatePlayersByIdentity(pool)
  const idx = buildIndexes(deduped)

  const publicDir = join(PROJECT_ROOT, 'public', 'adp-sources')
  mkdirSync(publicDir, { recursive: true })

  const report: string[] = []
  const baselineRows: Array<{
    scoring_format: string
    league_type: string
    is_superflex: boolean
    player_id: string
    rank: number
  }> = []

  for (const [bucket, data] of Object.entries(catalog.buckets)) {
    let matched = 0
    const unmatched: string[] = []
    const community: AdpSourceBoardFile['community'] = []
    const boards: AdpSourceBoardFile['boards'] = {}
    for (const src of data.sources) boards[src] = []

    const seen = new Set<string>()
    const matchedRows: Array<{ id: string; avg: number; ranks: Record<string, number> }> = []
    for (const row of data.players) {
      const hit = matchRow(row.name, row.pos, row.team, idx)
      if (!hit || seen.has(hit.id)) {
        if (!hit) unmatched.push(`${row.rank} ${row.name} ${row.pos} ${row.team}`)
        continue
      }
      seen.add(hit.id)
      matched += 1
      community.push({ id: hit.id, adp: row.avg })
      matchedRows.push({ id: hit.id, avg: row.avg, ranks: row.ranks })
    }
    // Site board = that site's ranked list, then everyone else in consensus order.
    // Missing site ranks keep their consensus ADP (so ESPN 245 stays 245 on the ESPN board)
    // but they sit after the site's last ranked player — they are not inserted into the top 200.
    for (const src of data.sources) {
      const ranked = matchedRows
        .filter((row) => row.ranks[src] != null)
        .map((row) => ({ id: row.id, adp: row.ranks[src] }))
        .sort((a, b) => a.adp - b.adp)
      const used = new Set(ranked.map((row) => row.id))
      const tail = community
        .filter((row) => !used.has(row.id))
        .map((row) => ({ id: row.id, adp: row.adp }))
      boards[src] = [...ranked, ...tail]
    }

    const payload: AdpSourceBoardFile = {
      title: data.title,
      sources: data.sources,
      community,
      boards,
    }
    writeFileSync(join(publicDir, `${bucket}.json`), JSON.stringify(payload), 'utf8')

    const parsed = parseBucketKey(bucket)
    if (!parsed.rookiesOnly) {
      const { data: existing } = await supabase
        .from('baseline_community_rankings')
        .select('player_id, rank')
        .eq('scoring_format', parsed.scoringFormat)
        .eq('league_type', parsed.leagueType)
        .eq('is_superflex', parsed.isSuperflex)
        .order('rank', { ascending: true })
      const tail = (existing || []).filter((r) => !seen.has(r.player_id as string))
      community.forEach((row, i) => {
        if (!/^[0-9a-f-]{36}$/i.test(row.id)) return
        baselineRows.push({
          scoring_format: parsed.scoringFormat,
          league_type: parsed.leagueType,
          is_superflex: parsed.isSuperflex,
          player_id: row.id,
          rank: i + 1,
        })
      })
      const start = community.length
      tail.forEach((row, i) => {
        baselineRows.push({
          scoring_format: parsed.scoringFormat,
          league_type: parsed.leagueType,
          is_superflex: parsed.isSuperflex,
          player_id: row.player_id as string,
          rank: start + i + 1,
        })
      })
    }

    report.push(
      `${bucket}: matched ${matched}/${data.players.length} (${data.sources.length} sources), unmatched ${unmatched.length}`
    )
    for (const u of unmatched.slice(0, 15)) report.push(`  - ${u}`)
    if (unmatched.length > 15) report.push(`  … ${unmatched.length - 15} more`)
  }

  writeFileSync(join(PROJECT_ROOT, 'rankings', 'adp-sources', 'matched-report.txt'), report.join('\n'), 'utf8')

  const index = Object.fromEntries(
    Object.entries(catalog.buckets).map(([k, v]) => [k, { title: v.title, sources: v.sources }])
  )
  writeFileSync(join(publicDir, 'index.json'), JSON.stringify(index), 'utf8')

  const sqlLines = ['-- Rebuilt from ADP consensus masters (scripts/match-adp-consensus.ts)']
  const buckets = new Map<string, typeof baselineRows>()
  for (const row of baselineRows) {
    const k = `${row.scoring_format}|${row.league_type}|${row.is_superflex}`
    const list = buckets.get(k) ?? []
    list.push(row)
    buckets.set(k, list)
  }
  for (const [k, rows] of buckets) {
    const [scoring, league, sf] = k.split('|')
    sqlLines.push(
      `DELETE FROM public.baseline_community_rankings WHERE scoring_format = '${scoring}' AND league_type = '${league}' AND is_superflex = ${sf};`
    )
    for (let i = 0; i < rows.length; i += 400) {
      const chunk = rows.slice(i, i + 400)
      sqlLines.push(
        'INSERT INTO public.baseline_community_rankings (scoring_format, league_type, is_superflex, player_id, rank) VALUES'
      )
      sqlLines.push(
        chunk.map((r) => `  ('${r.scoring_format}', '${r.league_type}', ${r.is_superflex}, '${r.player_id}'::uuid, ${r.rank})`).join(',\n') + ';'
      )
    }
  }
  writeFileSync(join(PROJECT_ROOT, 'supabase', 'migrations', '20260818010000_rebuild_baselines_from_adp_consensus.sql'), sqlLines.join('\n'), 'utf8')

  const grouped = new Map<string, typeof baselineRows>()
  for (const row of baselineRows) {
    const k = `${row.scoring_format}|${row.league_type}|${row.is_superflex}`
    const list = grouped.get(k) ?? []
    list.push(row)
    grouped.set(k, list)
  }
  for (const [k, rows] of grouped) {
    const [scoring, league, sf] = k.split('|')
    const { error: delErr } = await supabase
      .from('baseline_community_rankings')
      .delete()
      .eq('scoring_format', scoring)
      .eq('league_type', league)
      .eq('is_superflex', sf === 'true')
    if (delErr) throw delErr
    for (let i = 0; i < rows.length; i += 400) {
      const chunk = rows.slice(i, i + 400)
      const { error: insErr } = await supabase.from('baseline_community_rankings').insert(chunk)
      if (insErr) throw insErr
    }
    console.log(`Upserted baseline ${k}: ${rows.length}`)
  }

  console.log(report.join('\n'))
  console.log(`Wrote ${publicDir}`)
  void adpBucketKey
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
