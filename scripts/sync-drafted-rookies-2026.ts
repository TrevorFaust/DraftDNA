/**
 * Sync drafted 2026 rookies from nflverse into `players`.
 *
 * Safety model:
 * - DRY_RUN is ON by default
 * - Writes only happen when APPLY_CHANGES=1
 * - Deletes are conservative and only remove likely placeholder rookies
 *   (team is null/FA/UFA) that are NOT drafted and NOT referenced.
 *
 * Usage:
 *   npx tsx scripts/sync-drafted-rookies-2026.ts
 *   APPLY_CHANGES=1 npx tsx scripts/sync-drafted-rookies-2026.ts
 *
 * Optional env:
 *   TARGET_SEASON=2026
 *   ROSTER_URL=https://github.com/nflverse/nflverse-data/releases/download/rosters/roster_2026.csv
 *   PLAYERS_URL=https://github.com/nflverse/nflverse-data/releases/download/players/players.csv
 *
 * Required env:
 *   VITE_SUPABASE_URL or SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

type CsvRow = Record<string, string>

type RookieFeedRow = {
  fullName: string
  position: string
  team: string | null
  espnId: string | null
  sleeperId: string | null
  gsisId: string | null
  draftSort: number
}

type PlayerRow = {
  id: string
  name: string
  position: string
  team: string | null
  adp: number
  season: number | null
  espn_id: string | null
  sleeper_id: string | null
}

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const DEFAULT_ROSTER_URL =
  'https://github.com/nflverse/nflverse-data/releases/download/rosters/roster_2026.csv'
const DEFAULT_PLAYERS_URL =
  'https://github.com/nflverse/nflverse-data/releases/download/players/players.csv'
const DEFAULT_DRAFT_PICKS_URL =
  'https://github.com/nflverse/nflverse-data/releases/download/draft_picks/draft_picks.csv'
const PAGE_SIZE = 1000

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

function envValueDefined(key: string): boolean {
  const v = process.env[key]
  return v != null && String(v).trim() !== ''
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
    let key = s.slice(0, eq).trim()
    if (/^export\s+/i.test(key)) key = key.replace(/^export\s+/i, '').trim()
    let val = s.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    val = val.trim()
    if (overrideExisting || !envValueDefined(key)) {
      process.env[key] = val
    }
  }
}

function loadDotEnv() {
  loadEnvFile('.env', false)
  loadEnvFile('.env.local', true)
}

function normalizeKey(v: string | null | undefined): string | null {
  if (v == null) return null
  const t = String(v).trim()
  return t ? t : null
}

function normName(v: string): string {
  return v
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/['`]/g, "'")
    .replace(/\./g, '')
    .toLowerCase()
}

function stripSuffix(v: string): string {
  let s = v.trim()
  const re = /\s+(?:jr|jr\.|sr|sr\.|ii|iii|iv|v|vi|vii)$/i
  for (;;) {
    const n = s.replace(re, '').trim()
    if (n === s) break
    s = n
  }
  return s
}

function nameKeys(v: string): string[] {
  const out = new Set<string>()
  const base = v.trim().replace(/\s+/g, ' ')
  if (!base) return []
  out.add(normName(base))
  out.add(normName(stripSuffix(base)))
  out.add(normName(base.replace(/-/g, ' ')))
  out.add(normName(stripSuffix(base.replace(/-/g, ' '))))
  return [...out].filter(Boolean)
}

function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      const next = line[i + 1]
      if (inQuotes && next === '"') {
        cur += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (ch === ',' && !inQuotes) {
      out.push(cur)
      cur = ''
      continue
    }
    cur += ch
  }
  out.push(cur)
  return out
}

function parseCsv(text: string): CsvRow[] {
  const rows: CsvRow[] = []
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  if (lines.length === 0) return rows
  const headers = parseCsvLine(lines[0]).map((h) => h.trim())
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line || !line.trim()) continue
    const vals = parseCsvLine(line)
    const row: CsvRow = {}
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = (vals[j] ?? '').trim()
    }
    rows.push(row)
  }
  return rows
}

function toInt(v: string | null | undefined): number | null {
  if (v == null) return null
  const t = v.trim()
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? Math.trunc(n) : null
}

function isSkillPosition(pos: string): boolean {
  const p = pos.trim().toUpperCase()
  return p === 'QB' || p === 'RB' || p === 'WR' || p === 'TE' || p === 'K'
}

function draftedSort(row: CsvRow): number {
  const round = toInt(row.draft_round)
  const pick = toInt(row.draft_pick)
  const overall = toInt(row.draft_number)
  if (overall != null) return overall
  if (round != null && pick != null) return round * 1000 + pick
  if (round != null) return round * 1000
  return Number.MAX_SAFE_INTEGER
}

function isDraftedRookie(row: CsvRow, targetSeason: number): boolean {
  const yearsExp = toInt(row.years_exp)
  const rookieYear = toInt(row.rookie_year)
  const entryYear = toInt(row.entry_year)
  const draftYear = toInt(row.draft_year)
  const status = (row.status ?? '').trim().toUpperCase()
  const hasDraftSignals =
    toInt(row.draft_number) != null ||
    toInt(row.draft_pick) != null ||
    toInt(row.draft_round) != null ||
    normalizeKey(row.draft_team) != null ||
    normalizeKey(row.draft_club) != null

  if (!isSkillPosition(row.position ?? '')) return false

  // Strong positive: explicit draft-year markers.
  if (draftYear === targetSeason && hasDraftSignals) return true
  if (rookieYear === targetSeason && hasDraftSignals) return true
  if (entryYear === targetSeason && hasDraftSignals) return true

  // nflverse roster files can lag draft metadata fields while still setting rookie_year/years_exp.
  // In that case, treat active rookies for target season as drafted population candidate.
  if (rookieYear === targetSeason || entryYear === targetSeason) {
    return status === 'ACT'
  }
  if (yearsExp === 0 && status === 'ACT') return true

  return false
}

async function fetchCsv(url: string): Promise<CsvRow[]> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`)
  const txt = await res.text()
  return parseCsv(txt)
}

async function fetchPlayersForSeason(supabase: SupabaseClient, targetSeason: number): Promise<PlayerRow[]> {
  const out: PlayerRow[] = []
  let from = 0
  for (;;) {
    const { data, error } = await supabase
      .from('players')
      .select('id, name, position, team, adp, season, espn_id, sleeper_id')
      .eq('season', targetSeason)
      .range(from, from + PAGE_SIZE - 1)
      .order('id')

    if (error) throw error
    const rows = (data ?? []) as PlayerRow[]
    out.push(...rows)
    if (rows.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  return out
}

async function fetchReferencedPlayerIds(supabase: SupabaseClient, ids: string[]): Promise<Set<string>> {
  const refs = new Set<string>()
  if (ids.length === 0) return refs

  const tables = [
    { table: 'user_rankings', col: 'player_id' },
    { table: 'draft_picks', col: 'player_id' },
    { table: 'league_keepers', col: 'player_id' },
  ] as const

  for (const t of tables) {
    for (let i = 0; i < ids.length; i += PAGE_SIZE) {
      const batch = ids.slice(i, i + PAGE_SIZE)
      const { data, error } = await supabase
        .from(t.table)
        .select(t.col)
        .in(t.col, batch)
      if (error) {
        // If a table does not exist in an environment, keep going.
        console.warn(`[sync-rookies] Warning: could not check references in ${t.table}: ${error.message}`)
        break
      }
      for (const row of data ?? []) {
        const v = normalizeKey((row as Record<string, unknown>)[t.col] as string | null | undefined)
        if (v) refs.add(v)
      }
    }
  }

  return refs
}

function rookieFeedFromRosters(rows: CsvRow[], targetSeason: number): RookieFeedRow[] {
  const drafted = rows.filter((r) => isDraftedRookie(r, targetSeason))
  const map = new Map<string, RookieFeedRow>()
  for (const r of drafted) {
    const fullName = normalizeKey(r.full_name) ?? normalizeKey(r.player_name)
    const position = normalizeKey(r.position)
    if (!fullName || !position) continue
    const item: RookieFeedRow = {
      fullName,
      position: position.toUpperCase(),
      team: normalizeKey(r.team),
      espnId: normalizeKey(r.espn_id),
      sleeperId: normalizeKey(r.sleeper_id),
      gsisId: normalizeKey(r.gsis_id),
      draftSort: draftedSort(r),
    }
    const key = `${item.position}|${nameKeys(item.fullName)[0] ?? normName(item.fullName)}`
    const prev = map.get(key)
    if (!prev || item.draftSort < prev.draftSort) map.set(key, item)
  }
  return [...map.values()].sort((a, b) => a.draftSort - b.draftSort)
}

function rookieFeedFromDraftPicks(rows: CsvRow[], targetSeason: number): RookieFeedRow[] {
  const picked = rows.filter((r) => {
    const season = toInt(r.season)
    const pos = (r.position ?? '').trim().toUpperCase()
    return season === targetSeason && isSkillPosition(pos)
  })
  const out: RookieFeedRow[] = []
  for (const r of picked) {
    const fullName = normalizeKey(r.pfr_player_name)
    const position = normalizeKey(r.position)
    if (!fullName || !position) continue
    const round = toInt(r.round) ?? 99
    const pick = toInt(r.pick) ?? 999
    out.push({
      fullName,
      position: position.toUpperCase(),
      team: normalizeKey(r.team),
      espnId: null,
      sleeperId: null,
      gsisId: normalizeKey(r.gsis_id),
      draftSort: round * 1000 + pick,
    })
  }
  return out.sort((a, b) => a.draftSort - b.draftSort)
}

async function main() {
  loadDotEnv()

  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  const targetSeason = Number(process.env.TARGET_SEASON ?? '2026')
  const rosterUrl = process.env.ROSTER_URL ?? DEFAULT_ROSTER_URL
  const playersUrl = process.env.PLAYERS_URL ?? DEFAULT_PLAYERS_URL
  const draftPicksUrl = process.env.DRAFT_PICKS_URL ?? DEFAULT_DRAFT_PICKS_URL
  const apply = ['1', 'true', 'yes'].includes((process.env.APPLY_CHANGES ?? '').toLowerCase())

  if (!supabaseUrl || !serviceKey) {
    throw new Error(
      'Missing env vars. Need VITE_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.'
    )
  }
  if (!Number.isFinite(targetSeason)) {
    throw new Error(`Invalid TARGET_SEASON: ${process.env.TARGET_SEASON}`)
  }

  const supabase = createClient(supabaseUrl, serviceKey)

  console.log(`[sync-rookies] target season: ${targetSeason}`)
  console.log(`[sync-rookies] APPLY_CHANGES=${apply ? '1' : '0 (dry run)'}`)
  console.log(`[sync-rookies] fetching roster CSV: ${rosterUrl}`)
  const rosterRows = await fetchCsv(rosterUrl)
  console.log(`[sync-rookies] roster rows: ${rosterRows.length}`)

  // Optional fetch, useful for auditing freshness and ID coverage.
  console.log(`[sync-rookies] fetching players CSV: ${playersUrl}`)
  const playersRows = await fetchCsv(playersUrl)
  console.log(`[sync-rookies] players rows: ${playersRows.length}`)

  console.log(`[sync-rookies] fetching draft picks CSV: ${draftPicksUrl}`)
  const draftPickRows = await fetchCsv(draftPicksUrl)
  console.log(`[sync-rookies] draft picks rows: ${draftPickRows.length}`)

  const fromDraftPicks = rookieFeedFromDraftPicks(draftPickRows, targetSeason)
  const draftedRookies =
    fromDraftPicks.length > 0 ? fromDraftPicks : rookieFeedFromRosters(rosterRows, targetSeason)
  console.log(
    `[sync-rookies] source used: ${fromDraftPicks.length > 0 ? 'draft_picks' : 'rosters fallback'}`
  )
  if (draftedRookies.length === 0) {
    console.warn('[sync-rookies] No drafted rookies detected. Check roster URL and season logic.')
    return
  }
  console.log(`[sync-rookies] drafted rookie skill players: ${draftedRookies.length}`)

  const dbPlayers = await fetchPlayersForSeason(supabase, targetSeason)
  console.log(`[sync-rookies] DB players in season ${targetSeason}: ${dbPlayers.length}`)

  const byEspn = new Map<string, PlayerRow>()
  const bySleeper = new Map<string, PlayerRow>()
  const byNamePos = new Map<string, PlayerRow>()
  for (const p of dbPlayers) {
    if (p.espn_id) byEspn.set(p.espn_id, p)
    if (p.sleeper_id) bySleeper.set(p.sleeper_id, p)
    for (const nk of nameKeys(p.name)) {
      byNamePos.set(`${p.position.toUpperCase()}|${nk}`, p)
    }
  }

  const toInsert: Omit<PlayerRow, 'id'>[] = []
  const toUpdate: Array<{ id: string; patch: Partial<PlayerRow>; label: string }> = []
  const draftedMatchedIds = new Set<string>()

  for (let i = 0; i < draftedRookies.length; i++) {
    const r = draftedRookies[i]
    let match: PlayerRow | undefined
    if (r.espnId && byEspn.has(r.espnId)) match = byEspn.get(r.espnId)
    if (!match && r.sleeperId && bySleeper.has(r.sleeperId)) match = bySleeper.get(r.sleeperId)
    if (!match) {
      for (const nk of nameKeys(r.fullName)) {
        const k = `${r.position}|${nk}`
        if (byNamePos.has(k)) {
          match = byNamePos.get(k)
          break
        }
      }
    }

    if (match) {
      draftedMatchedIds.add(match.id)
      const patch: Partial<PlayerRow> = {}
      if (r.team && (!match.team || match.team === 'FA' || match.team === 'UFA')) patch.team = r.team
      if (r.espnId && !match.espn_id) patch.espn_id = r.espnId
      if (r.sleeperId && !match.sleeper_id) patch.sleeper_id = r.sleeperId
      if (Object.keys(patch).length > 0) {
        toUpdate.push({ id: match.id, patch, label: `${match.name} (${match.position})` })
      }
      continue
    }

    toInsert.push({
      name: r.fullName,
      position: r.position,
      team: r.team,
      season: targetSeason,
      adp: 200 + i + 1,
      bye_week: null as unknown as number | null,
      espn_id: r.espnId,
      sleeper_id: r.sleeperId,
    })
  }

  // Conservative delete candidates: placeholder rookie-ish rows that are not in drafted set.
  const draftedKeys = new Set<string>()
  for (const r of draftedRookies) {
    if (r.espnId) draftedKeys.add(`espn:${r.espnId}`)
    if (r.sleeperId) draftedKeys.add(`sleeper:${r.sleeperId}`)
    for (const nk of nameKeys(r.fullName)) draftedKeys.add(`namepos:${r.position}|${nk}`)
  }

  const maybeDelete = dbPlayers.filter((p) => {
    if (!isSkillPosition(p.position)) return false
    const team = (p.team ?? '').trim().toUpperCase()
    const placeholderTeam = team === '' || team === 'FA' || team === 'UFA'
    if (!placeholderTeam) return false
    if (draftedMatchedIds.has(p.id)) return false
    if (p.espn_id && draftedKeys.has(`espn:${p.espn_id}`)) return false
    if (p.sleeper_id && draftedKeys.has(`sleeper:${p.sleeper_id}`)) return false
    for (const nk of nameKeys(p.name)) {
      if (draftedKeys.has(`namepos:${p.position.toUpperCase()}|${nk}`)) return false
    }
    return true
  })

  const referenced = await fetchReferencedPlayerIds(
    supabase,
    maybeDelete.map((p) => p.id)
  )
  const toDelete = maybeDelete.filter((p) => !referenced.has(p.id))
  const protectedFromDelete = maybeDelete.filter((p) => referenced.has(p.id))

  console.log('\n[sync-rookies] PLAN')
  console.log(`  inserts: ${toInsert.length}`)
  console.log(`  updates: ${toUpdate.length}`)
  console.log(`  delete candidates (unreferenced): ${toDelete.length}`)
  console.log(`  protected from delete (referenced): ${protectedFromDelete.length}`)

  const preview = <T>(label: string, rows: T[], take = 15) => {
    if (rows.length === 0) return
    console.log(`\n[sync-rookies] ${label} (showing ${Math.min(rows.length, take)} of ${rows.length})`)
    for (const r of rows.slice(0, take)) console.log(r)
  }
  preview('insert preview', toInsert)
  preview('update preview', toUpdate.map((u) => ({ id: u.id, ...u.patch, label: u.label })))
  preview('delete preview', toDelete.map((p) => ({ id: p.id, name: p.name, position: p.position, team: p.team })))

  if (!apply) {
    console.log('\n[sync-rookies] Dry run complete. Re-run with APPLY_CHANGES=1 to execute.')
    return
  }

  if (toInsert.length > 0) {
    const { error } = await supabase.from('players').insert(
      toInsert.map((r) => ({
        name: r.name,
        position: r.position,
        team: r.team,
        season: r.season,
        adp: r.adp,
        bye_week: null,
        espn_id: r.espn_id,
        sleeper_id: r.sleeper_id,
      }))
    )
    if (error) throw error
  }

  for (const u of toUpdate) {
    const { error } = await supabase.from('players').update(u.patch).eq('id', u.id)
    if (error) throw error
  }

  if (toDelete.length > 0) {
    const { error } = await supabase
      .from('players')
      .delete()
      .in(
        'id',
        toDelete.map((p) => p.id)
      )
    if (error) throw error
  }

  console.log('\n[sync-rookies] Apply complete.')
  console.log(`  inserted: ${toInsert.length}`)
  console.log(`  updated: ${toUpdate.length}`)
  console.log(`  deleted: ${toDelete.length}`)
}

main().catch((err) => {
  console.error('[sync-rookies] FAILED')
  console.error(err)
  process.exit(1)
})
