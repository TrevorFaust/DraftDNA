/**
 * Import a 2026 draft board file into:
 *  1) public.rookies_2026 (full board rows)
 *  2) public.players (fantasy-relevant rookies for season 2026)
 *
 * Usage:
 *   npx tsx scripts/import-rookies-2026-board.ts
 *
 * Required env:
 *   VITE_SUPABASE_URL or SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   DRAFT_BOARD_PATH=path/to/rookies_2026_board.csv (optional if using nflverse fallback)
 *
 * Optional env:
 *   TARGET_SEASON=2026
 *   APPLY_CHANGES=1            (default is dry run)
 *   INCLUDE_DEFENSE=1          (default false; imports all positions into players)
 *
 * Expected columns (case-sensitive, from your board):
 *   Rnd, Pick, Tm, Player, Pos, College/Univ
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

type CsvRow = Record<string, string>
type BoardRow = {
  round: number
  pick: number
  team: string
  playerName: string
  position: string
  college: string | null
  espnId: string | null
  sleeperId: string | null
  jerseyNumber: number | null
  yearsExp: number
  source: string
}

type DbPlayer = {
  id: string
  name: string
  position: string
  team: string | null
  season: number | null
  espn_id?: string | null
  sleeper_id?: string | null
  years_exp?: number | null
  jersey_number?: number | null
}

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const PAGE_SIZE = 1000
const NFLVERSE_PLAYERS_URL =
  'https://github.com/nflverse/nflverse-data/releases/download/players/players.csv'

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
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter((l) => l.trim() !== '')
  if (lines.length === 0) return rows
  const headers = parseCsvLine(lines[0]).map((h) => h.trim())
  for (let i = 1; i < lines.length; i++) {
    const vals = parseCsvLine(lines[i])
    const row: CsvRow = {}
    for (let j = 0; j < headers.length; j++) row[headers[j]] = (vals[j] ?? '').trim()
    rows.push(row)
  }
  return rows
}

function toInt(v: string | undefined): number | null {
  if (!v) return null
  const n = Number(v.trim())
  return Number.isFinite(n) ? Math.trunc(n) : null
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

function nameVariants(v: string): string[] {
  const out = new Set<string>()
  const base = v.trim().replace(/\s+/g, ' ')
  if (!base) return []
  out.add(normName(base))
  out.add(normName(stripSuffix(base)))
  out.add(normName(base.replace(/-/g, ' ')))
  out.add(normName(stripSuffix(base.replace(/-/g, ' '))))
  return [...out]
}

function teamMap(raw: string): string {
  const t = raw.trim().toUpperCase()
  const map: Record<string, string> = {
    KAN: 'KC',
    TAM: 'TB',
    NOR: 'NO',
    GNB: 'GB',
    NWE: 'NE',
    SFO: 'SF',
    LVR: 'LV',
    ARI: 'ARI',
    ATL: 'ATL',
    BAL: 'BAL',
    BUF: 'BUF',
    CAR: 'CAR',
    CHI: 'CHI',
    CIN: 'CIN',
    CLE: 'CLE',
    DAL: 'DAL',
    DEN: 'DEN',
    DET: 'DET',
    HOU: 'HOU',
    IND: 'IND',
    JAX: 'JAX',
    LAC: 'LAC',
    LAR: 'LAR',
    MIA: 'MIA',
    MIN: 'MIN',
    NYG: 'NYG',
    NYJ: 'NYJ',
    PHI: 'PHI',
    PIT: 'PIT',
    SEA: 'SEA',
    TEN: 'TEN',
    WAS: 'WAS',
  }
  return map[t] ?? t
}

function isFantasyPos(pos: string): boolean {
  const p = pos.trim().toUpperCase()
  return p === 'QB' || p === 'RB' || p === 'WR' || p === 'TE' || p === 'K' || p === 'FB'
}

function readBoardRows(pathArg: string): BoardRow[] {
  const p = resolve(PROJECT_ROOT, pathArg)
  if (!existsSync(p)) throw new Error(`DRAFT_BOARD_PATH not found: ${p}`)
  const raw = readFileSync(p, 'utf8')
  const csv = parseCsv(raw)
  const out: BoardRow[] = []
  for (const r of csv) {
    const round = toInt(r.Rnd)
    const pick = toInt(r.Pick)
    const playerName = (r.Player ?? '').trim()
    const position = (r.Pos ?? '').trim().toUpperCase()
    const team = teamMap(r.Tm ?? '')
    if (!round || !pick || !playerName || !position || !team) continue
    out.push({
      round,
      pick,
      team,
      playerName,
      position,
      college: (r['College/Univ'] ?? '').trim() || null,
      espnId: null,
      sleeperId: null,
      jerseyNumber: null,
      yearsExp: 0,
      source: 'manual_draft_board',
    })
  }
  return out.sort((a, b) => a.pick - b.pick)
}

async function fetchCsv(url: string): Promise<CsvRow[]> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`)
  const txt = await res.text()
  return parseCsv(txt)
}

async function fetchPlayersSeason(supabase: SupabaseClient, season: number): Promise<DbPlayer[]> {
  const out: DbPlayer[] = []
  let from = 0
  for (;;) {
    const { data, error } = await supabase
      .from('players')
      .select('id, name, position, team, season, espn_id, sleeper_id, years_exp, jersey_number')
      .eq('season', season)
      .range(from, from + PAGE_SIZE - 1)
      .order('id')
    if (error) throw error
    const rows = (data ?? []) as DbPlayer[]
    out.push(...rows)
    if (rows.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  return out
}

async function detectPlayersYearsExpColumn(supabase: SupabaseClient): Promise<boolean> {
  const { error } = await supabase.from('players').select('years_exp').limit(1)
  return !error
}

async function detectPlayersColumns(
  supabase: SupabaseClient,
  cols: string[]
): Promise<Record<string, boolean>> {
  const out: Record<string, boolean> = {}
  for (const c of cols) {
    const { error } = await supabase.from('players').select(c).limit(1)
    out[c] = !error
  }
  return out
}

async function updatePlayerWithFallback(
  supabase: SupabaseClient,
  playerId: string,
  payload: Record<string, unknown>
): Promise<{ ok: boolean; failedFields: string[]; errorMessage?: string }> {
  const fields = Object.entries(payload)
  if (fields.length === 0) return { ok: true, failedFields: [] }

  // First try one-shot update for performance.
  const firstTry = await supabase.from('players').update(payload).eq('id', playerId)
  if (!firstTry.error) return { ok: true, failedFields: [] }

  // Fallback: isolate bad fields and still apply good ones.
  const failedFields: string[] = []
  let anySuccess = false
  for (const [k, v] of fields) {
    const one = await supabase.from('players').update({ [k]: v }).eq('id', playerId)
    if (one.error) {
      failedFields.push(k)
    } else {
      anySuccess = true
    }
  }

  return {
    ok: anySuccess,
    failedFields,
    errorMessage: firstTry.error?.message,
  }
}

async function main() {
  loadDotEnv()

  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  const boardPath = process.env.DRAFT_BOARD_PATH?.trim()
  const targetSeason = Number(process.env.TARGET_SEASON ?? '2026')
  const apply = ['1', 'true', 'yes'].includes((process.env.APPLY_CHANGES ?? '').toLowerCase())
  const includeDefense = ['1', 'true', 'yes'].includes((process.env.INCLUDE_DEFENSE ?? '').toLowerCase())

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing SUPABASE URL / SERVICE ROLE KEY env vars.')
  }
  let boardRows: BoardRow[] = []
  if (boardPath && existsSync(resolve(PROJECT_ROOT, boardPath))) {
    boardRows = readBoardRows(boardPath)
    console.log(`[import-rookies] source: board file (${boardPath})`)
  } else {
    console.log('[import-rookies] board file missing; falling back to nflverse players.csv')
    const nflverseRows = await fetchCsv(NFLVERSE_PLAYERS_URL)
    const rookieRows = nflverseRows
      .filter((r) => {
        const rookieSeason = toInt(r.rookie_season)
        const pos = (r.position ?? '').trim().toUpperCase()
        return rookieSeason === targetSeason && (includeDefense || isFantasyPos(pos))
      })
      .map((r, idx) => ({
        round: 0,
        pick: idx + 1,
        team: teamMap(r.latest_team ?? ''),
        playerName: (r.display_name ?? '').trim(),
        position: (r.position ?? '').trim().toUpperCase(),
        college: (r.college_name ?? '').trim() || null,
        espnId: (r.espn_id ?? '').trim() || null,
        // nflverse players.csv currently does not provide Sleeper player id.
        // Do NOT map GSIS id into sleeper_id; formats/types differ and can break writes.
        sleeperId: null,
        jerseyNumber: toInt(r.jersey_number),
        yearsExp: toInt(r.years_of_experience) ?? 0,
        source: 'nflverse_players',
      }))
      .filter((r) => r.playerName && r.position && r.team)
    boardRows = rookieRows
  }

  if (boardRows.length === 0) throw new Error('No rows parsed from draft board CSV.')

  console.log(`[import-rookies] parsed board rows: ${boardRows.length}`)
  console.log(`[import-rookies] target season: ${targetSeason}`)
  console.log(`[import-rookies] APPLY_CHANGES=${apply ? '1' : '0 (dry run)'}`)

  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const hasYearsExp = await detectPlayersYearsExpColumn(supabase)
  const playerCols = await detectPlayersColumns(supabase, [
    'espn_id',
    'sleeper_id',
    'jersey_number',
    'years_exp',
    'season',
    'adp',
    'bye_week',
    'team',
    'name',
    'position',
  ])
  if (!hasYearsExp) {
    console.warn(
      '[import-rookies] players.years_exp is not available in current DB schema; continuing without years_exp writes.'
    )
  }

  if (apply) {
    console.log('[import-rookies] writing rookies_2026 upsert...')
    const { error: rookieUpsertErr } = await supabase.from('rookies_2026').upsert(
      boardRows.map((r) => ({
        round: r.round,
        pick: r.pick,
        nfl_team: r.team,
        player_name: r.playerName,
        position: r.position,
        college: r.college,
        years_exp: hasYearsExp ? r.yearsExp : 0,
        source: r.source,
      })),
      { onConflict: 'pick' }
    )
    if (rookieUpsertErr) {
      console.error('[import-rookies] rookies_2026 upsert failed')
      console.error('[import-rookies] rookies_2026 first row sample:', boardRows[0])
      throw rookieUpsertErr
    }
  }

  const fantasyRows = includeDefense ? boardRows : boardRows.filter((r) => isFantasyPos(r.position))
  const players = await fetchPlayersSeason(supabase, targetSeason)
  const byNamePos = new Map<string, DbPlayer>()
  for (const p of players) {
    for (const nv of nameVariants(p.name)) {
      byNamePos.set(`${p.position.toUpperCase()}|${nv}`, p)
    }
  }

  const toInsert: Array<Record<string, unknown>> = []
  const toUpdate: Array<{ id: string; team: string; years_exp: number; espn_id: string | null; sleeper_id: string | null; jersey_number: number | null }> = []
  for (let i = 0; i < fantasyRows.length; i++) {
    const r = fantasyRows[i]
    let existing: DbPlayer | undefined
    for (const nv of nameVariants(r.playerName)) {
      const hit = byNamePos.get(`${r.position}|${nv}`)
      if (hit) {
        existing = hit
        break
      }
    }

    if (!existing) {
      toInsert.push({
        ...(playerCols.name ? { name: r.playerName } : {}),
        ...(playerCols.position ? { position: r.position } : {}),
        ...(playerCols.team ? { team: r.team } : {}),
        ...(playerCols.season ? { season: targetSeason } : {}),
        ...(hasYearsExp ? { years_exp: r.yearsExp } : {}),
        ...(playerCols.adp ? { adp: 200 + i + 1 } : {}),
        ...(playerCols.bye_week ? { bye_week: null } : {}),
        ...(playerCols.espn_id ? { espn_id: r.espnId } : {}),
        ...(playerCols.sleeper_id ? { sleeper_id: r.sleeperId } : {}),
        ...(playerCols.jersey_number ? { jersey_number: r.jerseyNumber } : {}),
      })
    } else {
      toUpdate.push({
        id: existing.id,
        team: r.team,
        years_exp: r.yearsExp,
        espn_id: r.espnId,
        sleeper_id: r.sleeperId,
        jersey_number: r.jerseyNumber,
      })
    }
  }

  console.log(`[import-rookies] rookies_2026 upsert rows: ${boardRows.length}`)
  console.log(`[import-rookies] players inserts planned: ${toInsert.length}`)
  console.log(`[import-rookies] players updates planned: ${toUpdate.length}`)

  if (!apply) {
    console.log('[import-rookies] Dry run complete. Re-run with APPLY_CHANGES=1 to write players changes.')
    return
  }

  if (toInsert.length > 0) {
    console.log(`[import-rookies] writing players insert batch (${toInsert.length})...`)
    const { error } = await supabase.from('players').insert(toInsert)
    if (error) {
      console.error('[import-rookies] players insert failed')
      console.error('[import-rookies] players insert first row sample:', toInsert[0])
      throw error
    }
  }

  if (toUpdate.length > 0) {
    console.log(`[import-rookies] writing players updates (${toUpdate.length})...`)
    let successCount = 0
    let partialCount = 0
    let skippedCount = 0
    for (const u of toUpdate) {
      const payloadRaw = {
        ...(playerCols.team ? { team: u.team } : {}),
        ...(hasYearsExp ? { years_exp: u.years_exp } : {}),
        ...(playerCols.espn_id ? { espn_id: u.espn_id ?? null } : {}),
        ...(playerCols.sleeper_id ? { sleeper_id: u.sleeper_id ?? null } : {}),
        ...(playerCols.jersey_number ? { jersey_number: u.jersey_number ?? null } : {}),
      }
      // Remove undefined keys explicitly; keep nulls to allow clearing values.
      const payload = Object.fromEntries(
        Object.entries(payloadRaw).filter(([, v]) => v !== undefined)
      )
      if (Object.keys(payload).length === 0) continue

      const r = await updatePlayerWithFallback(supabase, u.id, payload)
      if (r.ok && r.failedFields.length === 0) {
        successCount += 1
        continue
      }
      if (r.ok && r.failedFields.length > 0) {
        partialCount += 1
        console.warn(
          `[import-rookies] partial update for id=${u.id}; skipped fields: ${r.failedFields.join(', ')}`
        )
        continue
      }
      skippedCount += 1
      console.warn(`[import-rookies] skipped player id=${u.id}; reason: ${r.errorMessage ?? 'unknown'}`)
      console.warn('[import-rookies] skipped payload sample:', payload)
    }
    console.log(
      `[import-rookies] update summary: success=${successCount}, partial=${partialCount}, skipped=${skippedCount}`
    )
  }

  // Bump years_exp +1 for non-rookies in target season where currently null/0 and not in rookie set.
  if (hasYearsExp) {
    console.log('[import-rookies] optional years_exp backfill...')
    const rookieKeys = new Set<string>()
    for (const r of fantasyRows) {
      for (const nv of nameVariants(r.playerName)) rookieKeys.add(`${r.position}|${nv}`)
    }
    const bumpIds = players
      .filter((p) => {
        if (!isFantasyPos(p.position)) return false
        for (const nv of nameVariants(p.name)) {
          if (rookieKeys.has(`${p.position.toUpperCase()}|${nv}`)) return false
        }
        return true
      })
      .map((p) => p.id)

    if (bumpIds.length > 0) {
      // PostgREST can reject mixed in()+or() filters as Bad Request.
      // Run in two explicit passes and never fail the core import if backfill fails.
      const q1 = await supabase
        .from('players')
        .update({ years_exp: 1 })
        .in('id', bumpIds)
        .is('years_exp', null)
      if (q1.error) {
        console.warn('[import-rookies] years_exp null backfill skipped:', q1.error.message)
      }
      const q2 = await supabase
        .from('players')
        .update({ years_exp: 1 })
        .in('id', bumpIds)
        .eq('years_exp', 0)
      if (q2.error) {
        console.warn('[import-rookies] years_exp zero backfill skipped:', q2.error.message)
      }
    }

    // Ensure 2025 has non-rookie default years_exp where missing.
    const players2025 = await fetchPlayersSeason(supabase, 2025)
    const missing2025ExpIds = players2025
      .filter((p) => isFantasyPos(p.position) && (p.years_exp == null || p.years_exp === 0))
      .map((p) => p.id)
    if (missing2025ExpIds.length > 0) {
      const { error } = await supabase
        .from('players')
        .update({ years_exp: 1 })
        .in('id', missing2025ExpIds)
      if (error) {
        console.warn('[import-rookies] 2025 years_exp backfill skipped:', error.message)
      }
    }
  }

  console.log('[import-rookies] Apply complete.')
}

main().catch((err) => {
  console.error('[import-rookies] FAILED')
  try {
    console.error(JSON.stringify(err, null, 2))
  } catch {
    console.error(err)
  }
  process.exit(1)
})

