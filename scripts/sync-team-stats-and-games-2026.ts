/**
 * Sync 2026 team stats and game scores from nflverse.
 *
 *   npm run sync:team-games-2026
 *   APPLY_CHANGES=1 npm run sync:team-games-2026
 *
 * Sources:
 *   stats_team_week_2026.csv
 *   games.csv (season 2026, regular season)
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

type CsvRow = Record<string, string>

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const TEAM_URL =
  'https://github.com/nflverse/nflverse-data/releases/download/stats_team/stats_team_week_2026.csv'
const GAMES_URL =
  'https://github.com/nflverse/nflverse-data/releases/download/schedules/games.csv'
const SKIP_COLUMNS = new Set(['total_yards'])

function findProjectRoot(): string {
  let dir = resolve(process.cwd())
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(dir, 'package.json'))) return dir
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return resolve(SCRIPT_DIR, '..')
}

const PROJECT_ROOT = findProjectRoot()

function loadDotEnv() {
  for (const filename of ['.env', '.env.local']) {
    const p = join(PROJECT_ROOT, filename)
    if (!existsSync(p)) continue
    let raw = readFileSync(p, 'utf8')
    if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1)
    for (const line of raw.split(/\r?\n/)) {
      const s = line.trim()
      if (!s || s.startsWith('#')) continue
      const eq = s.indexOf('=')
      if (eq <= 0) continue
      let key = s.slice(0, eq).trim().replace(/^export\s+/i, '')
      let val = s.slice(eq + 1).trim()
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1)
      }
      if (!process.env[key]) process.env[key] = val
    }
  }
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

async function fetchCsv(url: string): Promise<CsvRow[]> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`)
  return parseCsv(await res.text())
}

function coerce(raw: string): string | number | null {
  const v = raw.trim()
  if (v === '') return null
  const n = Number(v)
  return Number.isFinite(n) && /^-?\d+(\.\d+)?$/.test(v) ? n : v
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

async function columnSet(supabase: SupabaseClient, sampleTable: string): Promise<Set<string>> {
  const { data, error } = await supabase.from(sampleTable).select('*').limit(1)
  if (error) throw error
  if (!data?.[0]) throw new Error(`No sample row in ${sampleTable}`)
  const cols = new Set(Object.keys(data[0]))
  for (const skip of SKIP_COLUMNS) cols.delete(skip)
  return cols
}

async function upsert(
  supabase: SupabaseClient,
  table: string,
  rows: Record<string, string | number | null>[],
  onConflict: string
) {
  let written = 0
  for (const batch of chunk(rows, 200)) {
    const { error } = await supabase.from(table).upsert(batch, { onConflict })
    if (error) throw error
    written += batch.length
    console.log(`[sync-2026-defense] ${table} ${written}/${rows.length}`)
  }
}

async function main() {
  loadDotEnv()
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  const apply = ['1', 'true', 'yes'].includes((process.env.APPLY_CHANGES ?? '').toLowerCase())
  if (!url || !key) throw new Error('Missing Supabase URL or service role key')

  console.log(`[sync-2026-defense] mode=${apply ? 'APPLY' : 'DRY_RUN'}`)
  const supabase = createClient(url, key)

  const teamCols = await columnSet(supabase, 'team_stats_2025')
  const gameCols = await columnSet(supabase, 'games_2025')

  const teamCsv = await fetchCsv(TEAM_URL)
  const teamRows: Record<string, string | number | null>[] = []
  for (const row of teamCsv) {
    if (Number(row.season) !== 2026) continue
    if ((row.season_type || 'REG') !== 'REG') continue
    const payload: Record<string, string | number | null> = {}
    for (const [k, v] of Object.entries(row)) {
      if (!teamCols.has(k)) continue
      payload[k] = coerce(v)
    }
    if (!payload.team || payload.week == null) continue
    teamRows.push(payload)
  }

  const gamesCsv = await fetchCsv(GAMES_URL)
  const gameRows: Record<string, string | number | null>[] = []
  for (const row of gamesCsv) {
    if (Number(row.season) !== 2026) continue
    const gameType = (row.game_type || row.season_type || '').toUpperCase()
    if (gameType && gameType !== 'REG') continue
    const payload: Record<string, string | number | null> = {}
    for (const [k, v] of Object.entries(row)) {
      if (!gameCols.has(k)) continue
      payload[k] = coerce(v)
    }
    if (!payload.game_id) continue
    gameRows.push(payload)
  }

  const weeks = [...new Set(teamRows.map((r) => r.week))].sort((a, b) => Number(a) - Number(b))
  console.log(`[sync-2026-defense] team rows=${teamRows.length} weeks=${weeks.join(',')}`)
  console.log(`[sync-2026-defense] game rows=${gameRows.length}`)
  if (!apply) {
    console.log('[sync-2026-defense] dry-run only. Re-run with APPLY_CHANGES=1 to write.')
    return
  }

  await upsert(supabase, 'team_stats_2026', teamRows, 'team,season,week,season_type')
  await upsert(supabase, 'games_2026', gameRows, 'game_id')
  console.log('[sync-2026-defense] done')
}

main().catch((err) => {
  console.error('[sync-2026-defense] failed:', err)
  process.exit(1)
})
