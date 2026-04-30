/**
 * Sync player bio fields from nflverse players.csv into public.players_info.
 *
 * Purpose:
 * - Populate birth_date (age lookup), plus optional bio fields where columns exist.
 * - Keep existing app logic intact (PlayerDetailDialog/DraftRoom already read players_info.birth_date).
 *
 * Usage:
 *   npx tsx scripts/sync-players-info-from-nflverse.ts
 *   APPLY_CHANGES=1 npx tsx scripts/sync-players-info-from-nflverse.ts
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

type CsvRow = Record<string, string>
type ExistingRow = { espn_id: string | null }

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const NFLVERSE_PLAYERS_URL =
  'https://github.com/nflverse/nflverse-data/releases/download/players/players.csv'
const PAGE_SIZE = 1000
const WRITE_BATCH_SIZE = 300

function findProjectRoot(): string {
  let dir = resolve(process.cwd())
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(dir, 'package.json'))) return dir
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return process.cwd()
}
const PROJECT_ROOT = findProjectRoot()

function loadEnv() {
  for (const fn of ['.env', '.env.local']) {
    const p = join(PROJECT_ROOT, fn)
    if (!existsSync(p)) continue
    const raw = readFileSync(p, 'utf8')
    for (const line of raw.split(/\r?\n/)) {
      const s = line.trim()
      if (!s || s.startsWith('#') || !s.includes('=')) continue
      let [k, v] = s.split(/=(.*)/s)
      k = k.replace(/^export\s+/i, '').trim()
      v = (v ?? '').trim().replace(/^['"]|['"]$/g, '')
      if (!process.env[k]) process.env[k] = v
    }
  }
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

async function detectColumns(supabase: SupabaseClient, table: string, cols: string[]) {
  const map: Record<string, boolean> = {}
  for (const c of cols) {
    const { error } = await supabase.from(table).select(c).limit(1)
    map[c] = !error
  }
  return map
}

async function fetchExistingEspnIds(supabase: SupabaseClient): Promise<Set<string>> {
  const ids = new Set<string>()
  let from = 0
  for (;;) {
    const { data, error } = await supabase
      .from('players_info')
      .select('espn_id')
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    const rows = (data ?? []) as ExistingRow[]
    for (const r of rows) {
      const id = (r.espn_id ?? '').trim()
      if (id) ids.add(id)
    }
    if (rows.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  return ids
}

function isRetryableMessage(msg: string): boolean {
  const m = msg.toLowerCase()
  return (
    m.includes('fetch failed') ||
    m.includes('und_err_socket') ||
    m.includes('socket') ||
    m.includes('timeout') ||
    m.includes('econnreset') ||
    m.includes('429') ||
    m.includes('5xx')
  )
}

async function withRetry<T>(fn: () => Promise<T>, label: string, tries = 4): Promise<T> {
  let attempt = 0
  let lastErr: unknown = null
  while (attempt < tries) {
    try {
      return await fn()
    } catch (e) {
      lastErr = e
      const msg = (() => {
        try {
          return JSON.stringify(e)
        } catch {
          return String(e)
        }
      })()
      attempt += 1
      if (attempt >= tries || !isRetryableMessage(msg)) throw e
      const delayMs = 700 * attempt
      console.warn(`[sync-players-info] retry ${attempt}/${tries - 1} for ${label} after ${delayMs}ms`)
      await new Promise((r) => setTimeout(r, delayMs))
    }
  }
  throw lastErr
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

async function main() {
  loadEnv()
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  const apply = ['1', 'true', 'yes'].includes((process.env.APPLY_CHANGES ?? '').toLowerCase())
  if (!url || !key) throw new Error('Missing Supabase URL/service role key.')

  const supabase = createClient(url, key)
  const cols = await detectColumns(supabase, 'players_info', [
    'espn_id',
    'name',
    'birth_date',
    'height',
    'weight',
    'position',
    'team',
    'college',
    'rookie_year',
    'years_exp',
    'season',
  ])
  if (!cols.espn_id) throw new Error('players_info.espn_id is not available.')

  const src = await fetchCsv(NFLVERSE_PLAYERS_URL)
  const rows = src
    .filter((r) => (r.espn_id ?? '').trim() !== '')
    .map((r) => ({
      espn_id: (r.espn_id ?? '').trim(),
      name: (r.display_name ?? '').trim() || null,
      birth_date: (r.birth_date ?? '').trim() || null,
      height: (r.height ?? '').trim() || null,
      weight: (r.weight ?? '').trim() || null,
      position: (r.position ?? '').trim() || null,
      team: (r.latest_team ?? '').trim() || null,
      college: (r.college_name ?? '').trim() || null,
      rookie_year: (r.rookie_season ?? '').trim() || null,
      years_exp: (r.years_of_experience ?? '').trim() || null,
      season: 2026,
    }))

  const existing = await fetchExistingEspnIds(supabase)
  const toInsert: Record<string, unknown>[] = []
  const toUpdate: Array<{ espn_id: string; payload: Record<string, unknown> }> = []

  for (const r of rows) {
    const payload = Object.fromEntries(
      Object.entries({
        ...(cols.espn_id ? { espn_id: r.espn_id } : {}),
        ...(cols.name ? { name: r.name } : {}),
        ...(cols.birth_date ? { birth_date: r.birth_date } : {}),
        ...(cols.height ? { height: r.height } : {}),
        ...(cols.weight ? { weight: r.weight } : {}),
        ...(cols.position ? { position: r.position } : {}),
        ...(cols.team ? { team: r.team } : {}),
        ...(cols.college ? { college: r.college } : {}),
        ...(cols.rookie_year ? { rookie_year: r.rookie_year ? Number(r.rookie_year) : null } : {}),
        ...(cols.years_exp ? { years_exp: r.years_exp ? Number(r.years_exp) : null } : {}),
        ...(cols.season ? { season: 2026 } : {}),
      }).filter(([, v]) => v !== undefined)
    )
    if (existing.has(r.espn_id)) toUpdate.push({ espn_id: r.espn_id, payload })
    else toInsert.push(payload)
  }

  console.log(`[sync-players-info] rows from nflverse with espn_id: ${rows.length}`)
  console.log(`[sync-players-info] inserts planned: ${toInsert.length}`)
  console.log(`[sync-players-info] updates planned: ${toUpdate.length}`)
  if (!apply) {
    console.log('[sync-players-info] Dry run complete. Set APPLY_CHANGES=1 to write.')
    return
  }

  if (toInsert.length) {
    const batches = chunk(toInsert, WRITE_BATCH_SIZE)
    let done = 0
    for (const b of batches) {
      const { error } = await withRetry(
        async () => supabase.from('players_info').insert(b),
        `insert batch (${b.length})`
      )
      if (error) throw error
      done += b.length
      if (done % 3000 === 0 || done === toInsert.length) {
        console.log(`[sync-players-info] inserts applied: ${done}/${toInsert.length}`)
      }
    }
  }

  let ok = 0
  let fail = 0
  for (const r of toUpdate) {
    const { error } = await withRetry(
      async () => supabase.from('players_info').update(r.payload).eq('espn_id', r.espn_id),
      `update espn_id=${r.espn_id}`
    )
    if (error) fail++
    else ok++
    if (ok % 2000 === 0) {
      console.log(`[sync-players-info] updates progress: ${ok}/${toUpdate.length}`)
    }
  }
  console.log(`[sync-players-info] updates applied: ${ok}, failed: ${fail}`)
  console.log('[sync-players-info] Complete.')
}

main().catch((e) => {
  console.error('[sync-players-info] FAILED')
  try {
    console.error(JSON.stringify(e, null, 2))
  } catch {
    console.error(e)
  }
  process.exit(1)
})

