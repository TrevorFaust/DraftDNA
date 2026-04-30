/**
 * Remove stale expected rookies from public.players safely.
 *
 * Candidate definition:
 * - season in TARGET_SEASONS (default 2025,2026)
 * - fantasy positions
 * - name+position not found in nflverse players.csv
 * - not referenced in draft_picks/user_rankings/league_keepers
 *
 * Usage:
 *   npx tsx scripts/cleanup-stale-expected-rookies.ts
 *   APPLY_CHANGES=1 npx tsx scripts/cleanup-stale-expected-rookies.ts
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

type CsvRow = Record<string, string>
type PlayerRow = { id: string; name: string; position: string; season: number | null }

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const NFLVERSE_PLAYERS_URL =
  'https://github.com/nflverse/nflverse-data/releases/download/players/players.csv'
const PAGE_SIZE = 1000

function root() {
  let d = resolve(process.cwd())
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(d, 'package.json'))) return d
    const p = dirname(d)
    if (p === d) break
    d = p
  }
  return process.cwd()
}
const PROJECT_ROOT = root()

function loadEnv() {
  for (const fn of ['.env', '.env.local']) {
    const p = join(PROJECT_ROOT, fn)
    if (!existsSync(p)) continue
    for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
      const s = line.trim()
      if (!s || s.startsWith('#') || !s.includes('=')) continue
      let [k, v] = s.split(/=(.*)/s)
      k = k.replace(/^export\s+/i, '').trim()
      v = (v ?? '').trim().replace(/^['"]|['"]$/g, '')
      if (!process.env[k]) process.env[k] = v
    }
  }
}

function parseCsvLine(line: string) {
  const out: string[] = []
  let cur = ''
  let q = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      const nx = line[i + 1]
      if (q && nx === '"') {
        cur += '"'
        i++
      } else q = !q
      continue
    }
    if (ch === ',' && !q) {
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
  if (!lines.length) return []
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

function n(v: string) {
  return v
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/['`]/g, "'")
    .replace(/\./g, '')
    .toLowerCase()
}

async function fetchCsv(url: string) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`)
  return parseCsv(await res.text())
}

async function fetchPlayers(supabase: SupabaseClient, seasons: number[]) {
  const out: PlayerRow[] = []
  for (const season of seasons) {
    let from = 0
    for (;;) {
      const { data, error } = await supabase
        .from('players')
        .select('id,name,position,season')
        .eq('season', season)
        .range(from, from + PAGE_SIZE - 1)
      if (error) throw error
      const rows = (data ?? []) as PlayerRow[]
      out.push(...rows)
      if (rows.length < PAGE_SIZE) break
      from += PAGE_SIZE
    }
  }
  return out
}

async function getReferencedIds(supabase: SupabaseClient, ids: string[]) {
  const refs = new Set<string>()
  const tables = [
    { t: 'draft_picks', c: 'player_id' },
    { t: 'user_rankings', c: 'player_id' },
    { t: 'league_keepers', c: 'player_id' },
  ] as const
  for (const x of tables) {
    for (let i = 0; i < ids.length; i += PAGE_SIZE) {
      const batch = ids.slice(i, i + PAGE_SIZE)
      const { data, error } = await supabase.from(x.t).select(x.c).in(x.c, batch)
      if (error) break
      for (const r of data ?? []) {
        const v = String((r as Record<string, unknown>)[x.c] ?? '').trim()
        if (v) refs.add(v)
      }
    }
  }
  return refs
}

async function main() {
  loadEnv()
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  const apply = ['1', 'true', 'yes'].includes((process.env.APPLY_CHANGES ?? '').toLowerCase())
  const seasons = (process.env.TARGET_SEASONS ?? '2025,2026')
    .split(',')
    .map((x) => Number(x.trim()))
    .filter((x) => Number.isFinite(x))
  if (!url || !key) throw new Error('Missing Supabase env.')
  const supabase = createClient(url, key)

  const nf = await fetchCsv(NFLVERSE_PLAYERS_URL)
  const live = new Set(
    nf
      .filter((r) => (r.display_name ?? '').trim() && (r.position ?? '').trim())
      .map((r) => `${(r.position ?? '').trim().toUpperCase()}|${n(r.display_name ?? '')}`)
  )

  const fantasyPos = new Set(['QB', 'RB', 'WR', 'TE', 'K', 'FB'])
  const players = await fetchPlayers(supabase, seasons)
  const candidates = players.filter(
    (p) => fantasyPos.has((p.position ?? '').toUpperCase()) && !live.has(`${p.position.toUpperCase()}|${n(p.name)}`)
  )
  const refs = await getReferencedIds(
    supabase,
    candidates.map((c) => c.id)
  )
  const deletable = candidates.filter((c) => !refs.has(c.id))

  console.log(`[cleanup-rookies] target seasons: ${seasons.join(',')}`)
  console.log(`[cleanup-rookies] stale candidates: ${candidates.length}`)
  console.log(`[cleanup-rookies] protected by refs: ${candidates.length - deletable.length}`)
  console.log(`[cleanup-rookies] deletable: ${deletable.length}`)
  console.log(
    '[cleanup-rookies] sample:',
    deletable.slice(0, 15).map((d) => ({ id: d.id, name: d.name, position: d.position, season: d.season }))
  )
  if (!apply) {
    console.log('[cleanup-rookies] Dry run complete. Set APPLY_CHANGES=1 to delete.')
    return
  }
  if (!deletable.length) {
    console.log('[cleanup-rookies] nothing to delete.')
    return
  }
  const { error } = await supabase
    .from('players')
    .delete()
    .in(
      'id',
      deletable.map((d) => d.id)
    )
  if (error) throw error
  console.log(`[cleanup-rookies] deleted: ${deletable.length}`)
}

main().catch((e) => {
  console.error('[cleanup-rookies] FAILED')
  try {
    console.error(JSON.stringify(e, null, 2))
  } catch {
    console.error(e)
  }
  process.exit(1)
})

