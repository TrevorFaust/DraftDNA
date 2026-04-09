/**
 * Match local `players` to Sleeper NFL player ids: ESPN id first (from Sleeper's player object),
 * then name + position with suffix / punctuation variants, then name + position + team.
 *
 * Real updates need the service role (bypasses RLS). Dry run only needs a key that can SELECT `players`
 * (often `VITE_SUPABASE_PUBLISHABLE_KEY` if RLS allows public read).
 *
 * Usage (from repo root):
 *   npx tsx scripts/bootstrap-sleeper-ids.ts
 *
 * Env (`.env` and `.env.local` in repo root are loaded; `.env.local` wins):
 *   VITE_SUPABASE_URL or SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY — required for non–dry-run updates
 *   VITE_SUPABASE_PUBLISHABLE_KEY or SUPABASE_ANON_KEY — optional; used for DRY_RUN if service role unset
 *
 * Optional:
 *   BOOTSTRAP_SEASON=2025           — only rows with this season
 *   BOOTSTRAP_POSITIONS=QB,RB,WR,TE,K — comma-separated; omit for all positions
 *   DRY_RUN=1                       — no DB writes; log counts only
 *   BOOTSTRAP_NAME_MATCH_REQUIRES_TEAM=1 — skip name/team lookup when team is empty or FA/UFA
 *     (ESPN id match still runs). Comma-list override: BOOTSTRAP_FA_TEAMS=FA,UFA,UNK
 *   BOOTSTRAP_DEBUG=1               — log project root and .env paths (no secret values)
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))

/** Resolve repo root so .env loads even if cwd is wrong for some runners. */
function findProjectRoot(): string {
  const tryWalk = (start: string) => {
    let dir = resolve(start)
    for (let i = 0; i < 8; i++) {
      if (existsSync(join(dir, 'package.json'))) return dir
      const parent = dirname(dir)
      if (parent === dir) break
      dir = parent
    }
    return null
  }
  return tryWalk(process.cwd()) ?? tryWalk(SCRIPT_DIR) ?? process.cwd()
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
    if (/^export\s+/i.test(key)) {
      key = key.replace(/^export\s+/i, '').trim()
    }
    let val = s.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    val = val.trim()
    // Treat empty shell vars as unset so .env can still populate (e.g. SUPABASE_SERVICE_ROLE_KEY="")
    if (overrideExisting || !envValueDefined(key)) {
      // Don't let .env.local wipe a non-empty value with an empty placeholder line
      if (
        val === '' &&
        process.env[key] !== undefined &&
        String(process.env[key]).trim() !== ''
      ) {
        continue
      }
      process.env[key] = val
    }
  }
}

/** Vite-style: base then local overrides (shell vars still win if set before this runs). */
function loadDotEnv() {
  loadEnvFile('.env', false)
  loadEnvFile('.env.local', true)
}

loadDotEnv()

function normalizeSecret(v: string | undefined): string | undefined {
  if (v == null) return undefined
  const t = v.trim()
  if (!t) return undefined
  const u = t.replace(/^["']|["']$/g, '')
  return u.trim() || undefined
}

function logEnvDebugHints() {
  const dotEnv = join(PROJECT_ROOT, '.env')
  const dotLocal = join(PROJECT_ROOT, '.env.local')
  const skRaw = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.supabase_service_role_key
  const sk = normalizeSecret(skRaw)
  console.log('[bootstrap-sleeper-ids] BOOTSTRAP_DEBUG')
  console.log('  process.cwd():', process.cwd())
  console.log('  PROJECT_ROOT:', PROJECT_ROOT)
  console.log('  .env exists:', existsSync(dotEnv), dotEnv)
  console.log('  .env.local exists:', existsSync(dotLocal), dotLocal)
  console.log('  SUPABASE_SERVICE_ROLE_KEY length (after trim):', sk ? sk.length : 0)
  console.log(
    '  Expected line (exact name): SUPABASE_SERVICE_ROLE_KEY=eyJ...  (do NOT use VITE_ prefix)'
  )

  const scanFile = (label: string, p: string) => {
    if (!existsSync(p)) return
    const raw = readFileSync(p, 'utf8')
    if (raw.charCodeAt(0) === 0xfeff) {
      console.warn(`  [${label}] UTF-8 BOM detected — OK, parser strips it`)
    }
    const lines = raw.split(/\r?\n/)
    const hits: { n: number; name: string; hasVal: boolean }[] = []
    for (let i = 0; i < lines.length; i++) {
      const t = lines[i].trim()
      if (!t || t.startsWith('#')) continue
      if (!/SERVICE|service|ROLE|role|SUPABASE|supabase/i.test(t)) continue
      const eq = t.indexOf('=')
      let name = eq >= 0 ? t.slice(0, eq).trim() : t
      if (/^export\s+/i.test(name)) name = name.replace(/^export\s+/i, '').trim()
      const rest = eq >= 0 ? t.slice(eq + 1).trim() : ''
      const unquoted =
        (rest.startsWith('"') && rest.endsWith('"')) || (rest.startsWith("'") && rest.endsWith("'"))
          ? rest.slice(1, -1).trim()
          : rest
      hits.push({ n: i + 1, name, hasVal: unquoted.length > 0 })
    }
    if (hits.length === 0) {
      console.log(`  [${label}] no lines mentioning SERVICE/ROLE/SUPABASE (check file contents)`)
      return
    }
    console.log(`  [${label}] Supabase-related variable names (no secrets):`)
    for (const h of hits) {
      console.log(
        `    line ${h.n}: ${h.name} = ${h.hasVal ? '<non-empty>' : '<EMPTY — fix this line>'}`
      )
    }
  }
  scanFile('.env', dotEnv)
  scanFile('.env.local', dotLocal)
}

if (['1', 'true', 'yes'].includes((process.env.BOOTSTRAP_DEBUG ?? '').toLowerCase())) {
  logEnvDebugHints()
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL

const SERVICE_KEY = normalizeSecret(
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.supabase_service_role_key
)
const ANON_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY
const DRY_RUN = ['1', 'true', 'yes'].includes(
  (process.env.DRY_RUN ?? '').toLowerCase()
)

const SEASON_FILTER = process.env.BOOTSTRAP_SEASON
const POSITION_FILTER = process.env.BOOTSTRAP_POSITIONS?.split(',')
  .map((p) => p.trim().toUpperCase())
  .filter(Boolean)

const NAME_MATCH_REQUIRES_TEAM = ['1', 'true', 'yes'].includes(
  (process.env.BOOTSTRAP_NAME_MATCH_REQUIRES_TEAM ?? '').toLowerCase()
)
const FA_TEAM_SET = new Set(
  (process.env.BOOTSTRAP_FA_TEAMS ?? 'FA,UFA')
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
)

function hasAssignableTeamForNameMatch(team: string | null): boolean {
  const t = (team ?? '').trim().toUpperCase()
  if (!t) return false
  if (FA_TEAM_SET.has(t)) return false
  return true
}

function normName(s: string) {
  return s
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[''`]/g, "'")
    .toLowerCase()
}

function keyFor(name: string, position: string) {
  return `${normName(name)}|${position.trim().toUpperCase()}`
}

function keyForTeam(name: string, position: string, teamAbbr: string) {
  const t = teamAbbr.trim().toUpperCase()
  if (!t) return null
  return `${normName(name)}|${position.trim().toUpperCase()}|${t}`
}

/** Remove trailing generational suffixes so "Kevin Coleman Jr." matches "Kevin Coleman". */
function stripGenerationalSuffix(name: string): string {
  let s = name.trim().replace(/\s+/g, ' ')
  const re = /\s+(?:jr\.?|sr\.?|ii|iii|iv|v|vi|vii)\.?$/i
  for (;;) {
    const next = s.replace(re, '').trim()
    if (next === s) break
    s = next
  }
  return s
}

/** All string variants we index / try at lookup time (apostrophes, dots, suffixes). */
function expandNameVariants(raw: string): string[] {
  const t = raw.trim().replace(/\s+/g, ' ').replace(/[''`]/g, "'")
  if (!t) return []
  const out = new Set<string>()
  const add = (s: string) => {
    const x = s.trim()
    if (x) out.add(x)
  }
  add(t)
  add(stripGenerationalSuffix(t))
  add(t.replace(/\./g, ''))
  add(stripGenerationalSuffix(t).replace(/\./g, ''))
  add(t.replace(/'/g, ''))
  add(stripGenerationalSuffix(t).replace(/'/g, ''))
  for (const x of [...out]) {
    if (x.includes('-')) {
      const spaced = x.replace(/-/g, ' ').replace(/\s+/g, ' ')
      add(spaced)
      add(stripGenerationalSuffix(spaced))
      add(spaced.replace(/\./g, ''))
    }
  }
  return [...out]
}

function setMap(
  map: Record<string, string>,
  key: string,
  id: string,
  collisions: string[]
) {
  if (map[key] && map[key] !== id) {
    collisions.push(`${key} -> had ${map[key]}, also ${id}`)
  }
  map[key] = id
}

type SleeperPlayer = {
  first_name?: string
  last_name?: string
  full_name?: string
  position?: string
  espn_id?: string | number | null
  team?: string | null
}

type SleeperLookup = {
  byNamePos: Record<string, string>
  byNamePosTeam: Record<string, string>
  byEspn: Record<string, string>
}

function normalizeEspnId(v: string | number | null | undefined): string | null {
  if (v == null) return null
  const s = String(v).trim()
  return s.length > 0 ? s : null
}

function buildSleeperLookup(
  sleeperPlayers: Record<string, SleeperPlayer>
): SleeperLookup {
  const byNamePos: Record<string, string> = {}
  const byNamePosTeam: Record<string, string> = {}
  const byEspn: Record<string, string> = {}
  const collisions: string[] = []
  const espnCollisions: string[] = []

  for (const [id, p] of Object.entries(sleeperPlayers)) {
    const pos = (p.position ?? '').trim().toUpperCase()
    if (!pos) continue

    const espn = normalizeEspnId(p.espn_id)
    if (espn) {
      if (byEspn[espn] && byEspn[espn] !== id) {
        espnCollisions.push(`espn ${espn} -> ${byEspn[espn]} vs ${id}`)
      }
      byEspn[espn] = id
    }

    const displays = new Set<string>()
    const fn = (p.first_name ?? '').trim()
    const ln = (p.last_name ?? '').trim()
    if (fn && ln) displays.add(`${fn} ${ln}`)
    const full = (p.full_name ?? '').trim()
    if (full) displays.add(full)

    const team = (p.team ?? '').trim().toUpperCase()

    for (const display of displays) {
      for (const variant of expandNameVariants(display)) {
        setMap(byNamePos, keyFor(variant, pos), id, collisions)
        if (team) {
          const tk = keyForTeam(variant, pos, team)
          if (tk) setMap(byNamePosTeam, tk, id, collisions)
        }
      }
    }
  }

  if (collisions.length > 0) {
    console.warn(
      `[bootstrap-sleeper-ids] ${collisions.length} name/team key collisions (last id wins). Sample:`
    )
    console.warn(collisions.slice(0, 12).join('\n'))
  }
  if (espnCollisions.length > 0) {
    console.warn(
      `[bootstrap-sleeper-ids] ${espnCollisions.length} ESPN id collisions in Sleeper feed. Sample:`
    )
    console.warn(espnCollisions.slice(0, 8).join('\n'))
  }

  return { byNamePos, byNamePosTeam, byEspn }
}

function resolveSleeperIdByNameTeam(
  lookup: SleeperLookup,
  row: { name: string; position: string; team: string | null }
): string | undefined {
  const pos = row.position.trim().toUpperCase()
  const team = (row.team ?? '').trim().toUpperCase()

  for (const variant of expandNameVariants(row.name)) {
    const nk = keyFor(variant, pos)
    if (lookup.byNamePos[nk]) return lookup.byNamePos[nk]
    if (team) {
      const tk = keyForTeam(variant, pos, team)
      if (tk && lookup.byNamePosTeam[tk]) return lookup.byNamePosTeam[tk]
    }
  }

  return undefined
}

async function fetchAllPlayersNeedingSleeperId(supabase: SupabaseClient) {
  const pageSize = 1000
  let from = 0
  const all: {
    id: string
    name: string
    position: string
    season: number | null
    espn_id: string | null
    team: string | null
  }[] = []

  for (;;) {
    let q = supabase
      .from('players')
      .select('id, name, position, season, espn_id, team')
      .is('sleeper_id', null)
      .order('id')
      .range(from, from + pageSize - 1)

    if (SEASON_FILTER) {
      q = q.eq('season', Number(SEASON_FILTER))
    }
    if (POSITION_FILTER?.length) {
      q = q.in('position', POSITION_FILTER)
    }

    const { data, error } = await q
    if (error) throw error
    const rows = data ?? []
    all.push(...rows)
    if (rows.length < pageSize) break
    from += pageSize
  }

  return all
}

async function runBatched<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>
) {
  let i = 0
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++
      await fn(items[idx])
    }
  })
  await Promise.all(workers)
}

async function bootstrap() {
  if (!SUPABASE_URL) {
    console.error(
      'Missing Supabase URL. Add VITE_SUPABASE_URL to .env or .env.local in the project root (same as Vite).'
    )
    console.error(`Current directory: ${process.cwd()}`)
    process.exit(1)
  }

  const apiKey = DRY_RUN ? (SERVICE_KEY ?? ANON_KEY) : SERVICE_KEY
  if (!apiKey) {
    if (DRY_RUN) {
      console.error(
        'Dry run needs a key to read `players`: set VITE_SUPABASE_PUBLISHABLE_KEY in .env.local, or SUPABASE_SERVICE_ROLE_KEY.'
      )
    } else {
      console.error(
        'Missing SUPABASE_SERVICE_ROLE_KEY for real updates. Check: spelling SUPABASE_SERVICE_ROLE_KEY (all caps);'
      )
      console.error(
        'quotes in .env are OK; run `npm run` from the project root (folder with package.json);'
      )
      console.error(
        'if you use .env.local, remove any empty SUPABASE_SERVICE_ROLE_KEY= line — it overwrites .env.'
      )
    }
    process.exit(1)
  }

  if (DRY_RUN && !SERVICE_KEY && ANON_KEY) {
    console.log(
      '[bootstrap-sleeper-ids] DRY_RUN: using publishable/anon key (SELECT only).'
    )
  }

  const supabase = createClient(SUPABASE_URL, apiKey)

  console.log('Fetching Sleeper players...')
  const res = await fetch('https://api.sleeper.app/v1/players/nfl')
  if (!res.ok) {
    console.error('Sleeper fetch failed:', res.status, res.statusText)
    process.exit(1)
  }
  const sleeperPlayers = (await res.json()) as Record<string, SleeperPlayer>
  const sleeperLookup = buildSleeperLookup(sleeperPlayers)

  console.log(
    `Fetching DB players (sleeper_id IS NULL${SEASON_FILTER ? `, season=${SEASON_FILTER}` : ''}${POSITION_FILTER?.length ? `, positions=${POSITION_FILTER.join(',')}` : ''})...`
  )
  const players = await fetchAllPlayersNeedingSleeperId(supabase)
  console.log(`Rows to consider: ${players.length}`)

  const toUpdate: { id: string; sleeper_id: string; name: string; position: string }[] = []
  /** Name match was not attempted (FA / empty team) — expected for many pre-draft rookies. */
  const skippedNoTeamRows: string[] = []
  /** ESPN miss and name/team lookup miss while a real team was set (or name match not gated). */
  const triedButNoHit: string[] = []
  let matchedEspn = 0
  let matchedName = 0

  if (NAME_MATCH_REQUIRES_TEAM) {
    console.log(
      `[bootstrap-sleeper-ids] Name/team matching only if team is set and not in FA list: ${[...FA_TEAM_SET].join(', ')}`
    )
  }

  for (const player of players) {
    const espn = normalizeEspnId(player.espn_id)
    let sleeperId: string | undefined
    let skippedNameDueToTeam = false
    if (espn && sleeperLookup.byEspn[espn]) {
      sleeperId = sleeperLookup.byEspn[espn]
      matchedEspn++
    } else if (!NAME_MATCH_REQUIRES_TEAM || hasAssignableTeamForNameMatch(player.team)) {
      sleeperId = resolveSleeperIdByNameTeam(sleeperLookup, player)
      if (sleeperId) matchedName++
    } else {
      skippedNameDueToTeam = true
    }

    if (sleeperId) {
      toUpdate.push({
        id: player.id,
        sleeper_id: sleeperId,
        name: player.name,
        position: player.position,
      })
    } else if (skippedNameDueToTeam) {
      const t = (player.team ?? '').trim() || 'null'
      skippedNoTeamRows.push(`${player.name} (${player.position}) [team=${t}]`)
    } else {
      triedButNoHit.push(`${player.name} (${player.position}) [team=${(player.team ?? '').trim() || 'null'}]`)
    }
  }

  const skippedCount = skippedNoTeamRows.length
  const missCount = triedButNoHit.length

  console.log(
    `[bootstrap-sleeper-ids] Matched via ESPN id: ${matchedEspn}; via name/team variants: ${matchedName}`
  )
  console.log(
    `Matched (will get sleeper_id): ${toUpdate.length} | Still null: ${skippedCount + missCount} ` +
      `(skipped name match — no/FA team: ${skippedCount}; tried ESPN+name, no hit: ${missCount})`
  )

  function logList(title: string, rows: string[], maxShow: number) {
    if (rows.length === 0) return
    console.log(`\n--- ${title} (${rows.length}) ---`)
    const show = Math.min(rows.length, maxShow)
    rows.slice(0, show).forEach((u) => console.warn(u))
    if (rows.length > show) {
      console.warn(`... and ${rows.length - show} more`)
    }
  }

  logList(
    'Skipped — name match not attempted (empty or FA/UFA team)',
    skippedNoTeamRows,
    30
  )
  logList(
    'No Sleeper row after ESPN + name/team (fix names, espn_id, or add manual map)',
    triedButNoHit,
    80
  )

  if (DRY_RUN) {
    console.log('DRY_RUN set — skipping updates.')
    return
  }

  let ok = 0
  let fail = 0

  await runBatched(toUpdate, 12, async (row) => {
    const { error } = await supabase
      .from('players')
      .update({ sleeper_id: row.sleeper_id })
      .eq('id', row.id)
    if (error) {
      fail++
      console.error(`Update failed ${row.name}:`, error.message)
    } else {
      ok++
    }
  })

  console.log(`Done. Updated: ${ok}, failed: ${fail}`)
}

bootstrap().catch((e) => {
  console.error(e)
  process.exit(1)
})
