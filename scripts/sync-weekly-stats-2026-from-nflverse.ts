/**
 * Sync `weekly_stats_2026` from nflverse player week stats.
 *
 * Source (appears after week 1 games are processed):
 *   https://github.com/nflverse/nflverse-data/releases/download/stats_player/stats_player_week_2026.csv
 *
 * Safety:
 * - DRY_RUN by default
 * - APPLY_CHANGES=1 to upsert
 * - Only columns that exist on `weekly_stats_2026` are written (extra nflverse cols ignored)
 * - Upserts on (player_id, season, week, season_type) — player_id is gsis_id
 *
 * Usage:
 *   npm run sync:weekly-stats-2026
 *   APPLY_CHANGES=1 npm run sync:weekly-stats-2026
 *
 * Optional:
 *   STATS_URL=... override CSV URL
 *   WEEK=1 only sync a single week (regular season)
 *
 * Required:
 *   VITE_SUPABASE_URL or SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

type CsvRow = Record<string, string>

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const DEFAULT_STATS_URL =
  'https://github.com/nflverse/nflverse-data/releases/download/stats_player/stats_player_week_2026.csv'
const UPSERT_CHUNK = 250
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
    if (overrideExisting || !envValueDefined(key)) process.env[key] = val.trim()
  }
}

function loadDotEnv() {
  loadEnvFile('.env', false)
  loadEnvFile('.env.local', true)
}

function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else inQuotes = false
      } else cur += ch
      continue
    }
    if (ch === '"') {
      inQuotes = true
      continue
    }
    if (ch === ',') {
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
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(Boolean)
  if (lines.length === 0) return []
  const headers = parseCsvLine(lines[0]).map((h) => h.trim())
  const out: CsvRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const vals = parseCsvLine(lines[i])
    const row: CsvRow = {}
    for (let j = 0; j < headers.length; j++) row[headers[j]] = (vals[j] ?? '').trim()
    out.push(row)
  }
  return out
}

async function fetchCsvOrNull(url: string): Promise<CsvRow[] | null> {
  const res = await fetch(url)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`)
  return parseCsv(await res.text())
}

async function detectTableColumns(supabase: SupabaseClient): Promise<Set<string>> {
  // Probe via information_schema isn't exposed; select * limit 0 isn't available.
  // Use a known-empty select of one column, then discover via OpenAPI isn't reliable.
  // Fallback: fetch one row if present, else use a hard-coded probe list from weekly_stats_2025.
  const { data, error } = await supabase.from('weekly_stats_2026').select('*').limit(1)
  if (error) throw error
  if (data && data[0]) return new Set(Object.keys(data[0]))

  // Empty table: ask PostgREST for column list via a dummy filter that returns no rows
  // but still validates column names by selecting them in batches is painful.
  // Instead, read columns from weekly_stats_2025 (same shape).
  const { data: sample, error: e2 } = await supabase.from('weekly_stats_2025').select('*').limit(1)
  if (e2) throw e2
  if (sample && sample[0]) return new Set(Object.keys(sample[0]))
  throw new Error('Could not detect weekly_stats columns (both 2026 and 2025 empty?).')
}

function coerceValue(col: string, raw: string): string | number | null {
  if (raw == null) return null
  const v = String(raw).trim()
  if (v === '') return null

  // Keep ids / codes / lists as text
  const textCols = new Set([
    'player_id',
    'player_name',
    'player_display_name',
    'position',
    'position_group',
    'headshot_url',
    'season_type',
    'game_id',
    'team',
    'opponent_team',
    'recent_team',
    'fg_made_list',
    'fg_missed_list',
    'fg_blocked_list',
  ])
  if (textCols.has(col)) return v

  const n = Number(v)
  return Number.isFinite(n) ? n : v
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

async function main() {
  loadDotEnv()
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  const apply = ['1', 'true', 'yes'].includes((process.env.APPLY_CHANGES ?? '').toLowerCase())
  const statsUrl = process.env.STATS_URL?.trim() || DEFAULT_STATS_URL
  const weekFilter = process.env.WEEK?.trim() ? Number(process.env.WEEK) : null

  if (!url || !key) {
    throw new Error('Missing VITE_SUPABASE_URL/SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }

  console.log(`[sync-weekly-stats-2026] mode=${apply ? 'APPLY' : 'DRY_RUN'}`)
  console.log(`[sync-weekly-stats-2026] source=${statsUrl}`)
  if (weekFilter != null && Number.isFinite(weekFilter)) {
    console.log(`[sync-weekly-stats-2026] week filter=${weekFilter}`)
  }

  const supabase = createClient(url, key)

  // Ensure table exists / is readable
  const { count, error: countErr } = await supabase
    .from('weekly_stats_2026')
    .select('player_id', { count: 'exact', head: true })
  if (countErr) {
    throw new Error(
      `weekly_stats_2026 not readable (${countErr.message}). Apply migration 20260909170000_create_weekly_stats_2026.sql first.`
    )
  }
  console.log(`[sync-weekly-stats-2026] current rows=${count ?? 0}`)

  const csv = await fetchCsvOrNull(statsUrl)
  if (!csv) {
    console.log(
      '[sync-weekly-stats-2026] nflverse file not published yet (404). Table is ready; re-run after week 1.'
    )
    console.log(
      '[sync-weekly-stats-2026] Expected URL once available:\n  ' + DEFAULT_STATS_URL
    )
    return
  }

  const cols = await detectTableColumns(supabase)
  console.log(`[sync-weekly-stats-2026] table columns=${cols.size} csv rows=${csv.length}`)

  const payloads: Record<string, string | number | null>[] = []
  let skipped = 0
  for (const row of csv) {
    const season = Number(row.season)
    const week = Number(row.week)
    if (season !== 2026) {
      skipped += 1
      continue
    }
    if (weekFilter != null && Number.isFinite(weekFilter) && week !== weekFilter) {
      skipped += 1
      continue
    }
    const playerId = (row.player_id ?? '').trim()
    const seasonType = (row.season_type ?? '').trim()
    if (!playerId || !Number.isFinite(week) || !seasonType) {
      skipped += 1
      continue
    }

    const payload: Record<string, string | number | null> = {}
    for (const [k, v] of Object.entries(row)) {
      if (!cols.has(k)) continue
      payload[k] = coerceValue(k, v)
    }
    // Ensure key fields present
    payload.player_id = playerId
    payload.season = 2026
    payload.week = week
    payload.season_type = seasonType
    payloads.push(payload)
  }

  console.log(
    `[sync-weekly-stats-2026] upsert candidates=${payloads.length} skipped=${skipped}`
  )
  if (payloads.length > 0) {
    const weeks = [...new Set(payloads.map((p) => p.week))].sort(
      (a, b) => Number(a) - Number(b)
    )
    console.log(`[sync-weekly-stats-2026] weeks in feed: ${weeks.join(', ')}`)
  }

  if (!apply) {
    console.log('[sync-weekly-stats-2026] dry-run only. Re-run with APPLY_CHANGES=1 to write.')
    return
  }

  let written = 0
  for (const batch of chunk(payloads, UPSERT_CHUNK)) {
    const { error } = await supabase.from('weekly_stats_2026').upsert(batch, {
      onConflict: 'player_id,season,week,season_type',
    })
    if (error) throw error
    written += batch.length
    console.log(`[sync-weekly-stats-2026] upserted ${written}/${payloads.length}`)
  }
  console.log(`[sync-weekly-stats-2026] done. Wrote ${written} rows.`)
}

main().catch((err) => {
  console.error('[sync-weekly-stats-2026] failed:', err)
  process.exitCode = 1
})
