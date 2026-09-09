/**
 * Sync `rosters_2026` from nflverse roster_2026.csv.
 *
 * Policy (matches product needs for awards + week-1 stats):
 * - Upsert every nflverse row by `gsis_id` (source of truth for team / status / pos).
 * - Never delete DB-only rows (CUT / FA / stale ACT extras stay for mid-season pickups).
 * - Dry-run by default; writes only with APPLY_CHANGES=1.
 *
 * Usage:
 *   npm run sync:rosters-2026
 *   APPLY_CHANGES=1 npm run sync:rosters-2026
 *
 * Optional env:
 *   ROSTER_URL=https://github.com/nflverse/nflverse-data/releases/download/rosters/roster_2026.csv
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

type RosterRow = {
  gsis_id: string
  team_abbr: string
  full_name: string
  position: string
  depth_chart_position: string | null
  jersey_number: number | null
  status: string | null
  years_exp: number | null
  college: string | null
  rookie_year: number | null
  updated_at: string
}

type DbRosterRow = {
  gsis_id: string
  team_abbr: string
  full_name: string
  position: string
  depth_chart_position: string | null
  jersey_number: number | null
  status: string | null
  years_exp: number | null
  college: string | null
  rookie_year: number | null
}

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const DEFAULT_ROSTER_URL =
  'https://github.com/nflverse/nflverse-data/releases/download/rosters/roster_2026.csv'
const PAGE_SIZE = 1000
const UPSERT_CHUNK = 200
const STATUS_RANK: Record<string, number> = {
  ACT: 0,
  RES: 1,
  DEV: 2,
  CUT: 3,
  RLS: 4,
  EXE: 5,
  RET: 6,
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
    if (overrideExisting || !envValueDefined(key)) {
      process.env[key] = val.trim()
    }
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
        } else {
          inQuotes = false
        }
      } else {
        cur += ch
      }
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

function toInt(v: string | null | undefined): number | null {
  if (v == null) return null
  const t = String(v).trim()
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? Math.trunc(n) : null
}

function normalizeTeam(v: string | null | undefined): string | null {
  const t = (v ?? '').trim().toUpperCase()
  return t || null
}

function statusRank(status: string | null | undefined): number {
  return STATUS_RANK[(status ?? '').trim().toUpperCase()] ?? 9
}

function preferRosterRow(a: CsvRow, b: CsvRow): CsvRow {
  const ra = statusRank(a.status)
  const rb = statusRank(b.status)
  if (ra !== rb) return ra < rb ? a : b
  return a
}

function mapCsvToRoster(row: CsvRow, nowIso: string): RosterRow | null {
  const gsis_id = (row.gsis_id ?? '').trim()
  const full_name = (row.full_name ?? '').trim()
  const position = (row.position ?? '').trim().toUpperCase()
  const team_abbr = normalizeTeam(row.team)
  if (!gsis_id || !full_name || !position || !team_abbr) return null
  return {
    gsis_id,
    team_abbr,
    full_name,
    position,
    depth_chart_position: (row.depth_chart_position ?? '').trim() || null,
    jersey_number: toInt(row.jersey_number),
    status: (row.status ?? '').trim().toUpperCase() || null,
    years_exp: toInt(row.years_exp),
    college: (row.college ?? '').trim() || null,
    rookie_year: toInt(row.rookie_year),
    updated_at: nowIso,
  }
}

async function fetchDbRosters(supabase: SupabaseClient): Promise<Map<string, DbRosterRow>> {
  const map = new Map<string, DbRosterRow>()
  let from = 0
  for (;;) {
    const { data, error } = await supabase
      .from('rosters_2026')
      .select(
        'gsis_id, team_abbr, full_name, position, depth_chart_position, jersey_number, status, years_exp, college, rookie_year'
      )
      .order('gsis_id')
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    const rows = (data ?? []) as DbRosterRow[]
    for (const r of rows) {
      if (r.gsis_id) map.set(r.gsis_id, r)
    }
    if (rows.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  return map
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

function sameStr(a: string | null | undefined, b: string | null | undefined): boolean {
  return (a ?? '') === (b ?? '')
}

function sameNum(a: number | null | undefined, b: number | null | undefined): boolean {
  return (a ?? null) === (b ?? null)
}

async function main() {
  loadDotEnv()
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  const apply = ['1', 'true', 'yes'].includes((process.env.APPLY_CHANGES ?? '').toLowerCase())
  const rosterUrl = process.env.ROSTER_URL?.trim() || DEFAULT_ROSTER_URL

  if (!url || !key) {
    throw new Error('Missing VITE_SUPABASE_URL/SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }

  console.log(`[sync-rosters-2026] mode=${apply ? 'APPLY' : 'DRY_RUN'}`)
  console.log(`[sync-rosters-2026] source=${rosterUrl}`)

  const supabase = createClient(url, key)
  const csvRows = await fetchCsv(rosterUrl)
  console.log(`[sync-rosters-2026] nflverse rows=${csvRows.length}`)

  const byGsis = new Map<string, CsvRow>()
  for (const row of csvRows) {
    const gsis = (row.gsis_id ?? '').trim()
    if (!gsis) continue
    const prev = byGsis.get(gsis)
    byGsis.set(gsis, prev ? preferRosterRow(prev, row) : row)
  }

  const nowIso = new Date().toISOString()
  const incoming: RosterRow[] = []
  for (const row of byGsis.values()) {
    const mapped = mapCsvToRoster(row, nowIso)
    if (mapped) incoming.push(mapped)
  }
  console.log(`[sync-rosters-2026] unique gsis with team=${incoming.length}`)

  const existing = await fetchDbRosters(supabase)
  console.log(`[sync-rosters-2026] db rows=${existing.size}`)

  const toUpsert: RosterRow[] = []
  const teamChanges: Array<{ name: string; from: string; to: string; status: string | null }> = []
  const statusChanges: Array<{ name: string; from: string | null; to: string | null; team: string }> =
    []
  let inserts = 0
  let updates = 0
  let unchanged = 0

  for (const row of incoming) {
    const prev = existing.get(row.gsis_id)
    if (!prev) {
      inserts += 1
      toUpsert.push(row)
      continue
    }

    const teamChanged = !sameStr(prev.team_abbr, row.team_abbr)
    const statusChanged = !sameStr(prev.status, row.status)
    const changed =
      teamChanged ||
      statusChanged ||
      !sameStr(prev.full_name, row.full_name) ||
      !sameStr(prev.position, row.position) ||
      !sameStr(prev.depth_chart_position, row.depth_chart_position) ||
      !sameNum(prev.jersey_number, row.jersey_number) ||
      !sameNum(prev.years_exp, row.years_exp) ||
      !sameStr(prev.college, row.college) ||
      !sameNum(prev.rookie_year, row.rookie_year)

    if (!changed) {
      unchanged += 1
      continue
    }

    updates += 1
    toUpsert.push(row)
    if (teamChanged) {
      teamChanges.push({
        name: row.full_name,
        from: prev.team_abbr,
        to: row.team_abbr,
        status: row.status,
      })
    }
    if (statusChanged) {
      statusChanges.push({
        name: row.full_name,
        from: prev.status,
        to: row.status,
        team: row.team_abbr,
      })
    }
  }

  const dbOnly = [...existing.keys()].filter((id) => !byGsis.has(id)).length

  console.log('\n=== PLAN ===')
  console.log(`inserts=${inserts} updates=${updates} unchanged=${unchanged}`)
  console.log(`db-only kept (no delete)=${dbOnly}`)
  console.log(`team changes=${teamChanges.length}`)
  for (const c of teamChanges.slice(0, 40)) {
    console.log(`  ${c.name}: ${c.from} -> ${c.to} (${c.status ?? '—'})`)
  }
  if (teamChanges.length > 40) console.log(`  ... +${teamChanges.length - 40} more`)

  console.log(`status changes=${statusChanges.length}`)
  for (const c of statusChanges.slice(0, 20)) {
    console.log(`  ${c.name}: ${c.from ?? '—'} -> ${c.to ?? '—'} (${c.team})`)
  }
  if (statusChanges.length > 20) console.log(`  ... +${statusChanges.length - 20} more`)

  if (!apply) {
    console.log('\n[sync-rosters-2026] dry-run only. Re-run with APPLY_CHANGES=1 to write.')
    return
  }

  let written = 0
  for (const batch of chunk(toUpsert, UPSERT_CHUNK)) {
    const { error } = await supabase.from('rosters_2026').upsert(batch, { onConflict: 'gsis_id' })
    if (error) throw error
    written += batch.length
    console.log(`[sync-rosters-2026] upserted ${written}/${toUpsert.length}`)
  }

  console.log(`[sync-rosters-2026] done. Wrote ${written} rows. Kept ${dbOnly} db-only players.`)
}

main().catch((err) => {
  console.error('[sync-rosters-2026] failed:', err)
  process.exitCode = 1
})
