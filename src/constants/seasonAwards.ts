export const SEASON_AWARD_IDS = [
  'mvp',
  'opoy',
  'dpoy',
  'oroy',
  'droy',
  'coach',
] as const;

export type SeasonAwardId = (typeof SEASON_AWARD_IDS)[number];

export type SeasonAwardKind = 'player' | 'coach';

export type SeasonAwardDef = {
  id: SeasonAwardId;
  label: string;
  kind: SeasonAwardKind;
};

/** Short display labels — no AP prefix, sponsors, or named prefixes. */
export const SEASON_AWARD_DEFS: readonly SeasonAwardDef[] = [
  { id: 'mvp', label: 'Most Valuable Player', kind: 'player' },
  { id: 'opoy', label: 'Offensive Player of the Year', kind: 'player' },
  { id: 'dpoy', label: 'Defensive Player of the Year', kind: 'player' },
  { id: 'oroy', label: 'Offensive Rookie of the Year', kind: 'player' },
  { id: 'droy', label: 'Defensive Rookie of the Year', kind: 'player' },
  { id: 'coach', label: 'Coach of the Year', kind: 'coach' },
];

export type SeasonAwardPick = {
  id: string;
  name: string;
  team: string | null;
  position: string | null;
};

export type SeasonAwardsPicks = Record<SeasonAwardId, SeasonAwardPick | null>;

export function emptySeasonAwardsPicks(): SeasonAwardsPicks {
  return {
    mvp: null,
    opoy: null,
    dpoy: null,
    oroy: null,
    droy: null,
    coach: null,
  };
}

export function normalizeSeasonAwardsPicks(raw: unknown): SeasonAwardsPicks {
  const empty = emptySeasonAwardsPicks();
  if (!raw || typeof raw !== 'object') return empty;
  const src = raw as Record<string, unknown>;
  const next = { ...empty };
  for (const def of SEASON_AWARD_DEFS) {
    const row = src[def.id];
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    if (typeof r.id !== 'string' || typeof r.name !== 'string') continue;
    next[def.id] = {
      id: r.id,
      name: r.name,
      team: typeof r.team === 'string' ? r.team : null,
      position: typeof r.position === 'string' ? r.position : null,
    };
  }
  return next;
}
