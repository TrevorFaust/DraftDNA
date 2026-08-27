/**
 * One-off generator: parse NFL Football Operations 2026 schedule dump into kickoff ISO times.
 * Input: agent-tools schedule markdown. Output: src/constants/nfl2026Kickoffs.generated.ts
 */
import fs from 'node:fs';

const SRC = process.argv[2];
const DEST = process.argv[3];

const FULL_TO_ABBR: Record<string, string> = {
  'arizona cardinals': 'ARI',
  'atlanta falcons': 'ATL',
  'baltimore ravens': 'BAL',
  'buffalo bills': 'BUF',
  'carolina panthers': 'CAR',
  'chicago bears': 'CHI',
  'cincinnati bengals': 'CIN',
  'cleveland browns': 'CLE',
  'dallas cowboys': 'DAL',
  'denver broncos': 'DEN',
  'detroit lions': 'DET',
  'green bay packers': 'GB',
  'houston texans': 'HOU',
  'indianapolis colts': 'IND',
  'jacksonville jaguars': 'JAX',
  'kansas city chiefs': 'KC',
  'los angeles rams': 'LAR',
  'los angeles chargers': 'LAC',
  'las vegas raiders': 'LV',
  'miami dolphins': 'MIA',
  'minnesota vikings': 'MIN',
  'new england patriots': 'NE',
  'new orleans saints': 'NO',
  'new york giants': 'NYG',
  'new york jets': 'NYJ',
  'philadelphia eagles': 'PHI',
  'pittsburgh steelers': 'PIT',
  'seattle seahawks': 'SEA',
  'san francisco 49ers': 'SF',
  'tampa bay buccaneers': 'TB',
  'tennessee titans': 'TEN',
  'washington commanders': 'WAS',
};

const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  sept: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function etIso(year: number, month: number, day: number, hour: number, minute: number): string | null {
  for (const off of ['-04:00', '-05:00'] as const) {
    const iso = `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00${off}`;
    const inst = Date.parse(iso);
    if (!Number.isFinite(inst)) continue;
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hourCycle: 'h23',
    }).formatToParts(new Date(inst));
    const get = (type: string) => parts.find((p) => p.type === type)?.value;
    const hourPart = Number(get('hour'));
    const hour24 = hourPart === 24 ? 0 : hourPart;
    if (
      Number(get('year')) === year &&
      Number(get('month')) === month &&
      Number(get('day')) === day &&
      hour24 === hour &&
      Number(get('minute')) === minute
    ) {
      return new Date(inst).toISOString();
    }
  }
  return null;
}

function parseTime(raw: string): { hour: number; minute: number } | null {
  const m = raw.trim().toLowerCase().match(/^(\d{1,2}):(\d{2})\s*([ap])$/);
  if (!m) return null;
  let hour = Number(m[1]);
  const minute = Number(m[2]);
  const ap = m[3];
  if (ap === 'a') {
    if (hour === 12) hour = 0;
  } else if (hour !== 12) {
    hour += 12;
  }
  return { hour, minute };
}

function parseTeam(raw: string): string | null {
  const cleaned = raw.replace(/\s*\([^)]*\)\s*$/, '').trim().toLowerCase();
  return FULL_TO_ABBR[cleaned] ?? null;
}

const text = fs.readFileSync(SRC, 'utf8');
const lines = text.split(/\r?\n/);

const kickoffs: Record<string, string> = {};
let week = 0;
let lastWeekHeader: number | null = null;
let year = 2026;
let month = 9;
let day = 9;

for (const line of lines) {
  const weekMatch = line.match(/^WEEK\s+(\d+)/i);
  if (weekMatch) {
    const next = Number(weekMatch[1]);
    if (next === lastWeekHeader) continue;
    lastWeekHeader = next;
    week = next;
    continue;
  }

  const dateMatch = line.match(
    /^(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+([A-Za-z]+)\.?\s+(\d{1,2}),\s+(\d{4})\s*$/
  );
  if (dateMatch) {
    const mo = MONTHS[dateMatch[1].toLowerCase()];
    if (mo) {
      month = mo;
      day = Number(dateMatch[2]);
      year = Number(dateMatch[3]);
    }
    continue;
  }

  const gameMatch = line.match(/^\|\s*(.+?)\s*\|\s*([0-9]{1,2}:[0-9]{2}\s*[ap])\s*\|/i);
  if (!gameMatch || week < 1) continue;
  const matchup = gameMatch[1].trim();
  if (/^tbd$/i.test(matchup)) continue;
  const time = parseTime(gameMatch[2]);
  if (!time) continue;

  const parts = matchup.split(/\s+(?:at|vs\.?)\s+/i);
  if (parts.length !== 2) continue;
  const away = parseTeam(parts[0]);
  const home = parseTeam(parts[1]);
  if (!away || !home) {
    console.warn('Unparsed matchup', matchup);
    continue;
  }
  const iso = etIso(year, month, day, time.hour, time.minute);
  if (!iso) {
    console.warn('Bad time', matchup, year, month, day, time);
    continue;
  }
  const key = `${week}:${away}@${home}`;
  if (!kickoffs[key]) kickoffs[key] = iso;
}

const keys = Object.keys(kickoffs).sort((a, b) => {
  const [wa, restA] = a.split(':');
  const [wb, restB] = b.split(':');
  return Number(wa) - Number(wb) || restA.localeCompare(restB);
});

const body = keys.map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify(kickoffs[k])},`).join('\n');
const out = `/** Official 2026 NFL kickoff times (America/New_York). Key: week:AWAY@HOME */\nexport const NFL_2026_KICKOFFS: Record<string, string> = {\n${body}\n};\n`;

fs.writeFileSync(DEST, out);
console.log(`wrote ${keys.length} kickoffs`);
for (let w = 1; w <= 18; w++) {
  const n = keys.filter((k) => k.startsWith(`${w}:`)).length;
  console.log(`week ${w}: ${n}`);
}
