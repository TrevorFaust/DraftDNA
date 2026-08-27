/**
 * Shared starting-lineup config for league settings and draft roster filling.
 * Stored under position_limits.starters; FLEX/BENCH stay top-level for compatibility.
 */

export type StarterPosition = 'QB' | 'RB' | 'WR' | 'TE' | 'DEF' | 'K';

export type StarterCounts = Record<StarterPosition, number>;

export type DraftTeamSlot = { label: string; positions: string[] };

export const DEFAULT_STARTERS: StarterCounts = {
  QB: 1,
  RB: 2,
  WR: 2,
  TE: 1,
  DEF: 1,
  K: 1,
};

export const STARTER_MIN: StarterCounts = {
  QB: 0,
  RB: 0,
  WR: 0,
  TE: 0,
  DEF: 0,
  K: 0,
};

export const STARTER_MAX: StarterCounts = {
  QB: 3,
  RB: 4,
  WR: 5,
  TE: 3,
  DEF: 2,
  K: 2,
};

export const STARTER_POSITION_ORDER: StarterPosition[] = ['QB', 'RB', 'WR', 'TE', 'DEF', 'K'];

export type PositionLimitsLike = {
  QB?: number;
  RB?: number;
  WR?: number;
  TE?: number;
  FLEX?: number;
  K?: number;
  DEF?: number;
  BENCH?: number;
  IR?: number;
  KEEPERS?: number;
  starters?: Partial<StarterCounts> | null;
};

/** Map D/ST / DST / DEF onto the same roster key. */
export function normalizeRosterPos(pos: string | null | undefined): string {
  const p = (pos || '').toUpperCase();
  if (p === 'D/ST' || p === 'DST' || p === 'DEF') return 'DEF';
  return p;
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : parseInt(String(value ?? ''), 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** Parse starter counts from position_limits JSON; missing keys use defaults. */
export function parseStarters(limits?: PositionLimitsLike | null): StarterCounts {
  const raw = limits?.starters;
  return {
    QB: clampInt(raw?.QB, STARTER_MIN.QB, STARTER_MAX.QB, DEFAULT_STARTERS.QB),
    RB: clampInt(raw?.RB, STARTER_MIN.RB, STARTER_MAX.RB, DEFAULT_STARTERS.RB),
    WR: clampInt(raw?.WR, STARTER_MIN.WR, STARTER_MAX.WR, DEFAULT_STARTERS.WR),
    TE: clampInt(raw?.TE, STARTER_MIN.TE, STARTER_MAX.TE, DEFAULT_STARTERS.TE),
    DEF: clampInt(raw?.DEF, STARTER_MIN.DEF, STARTER_MAX.DEF, DEFAULT_STARTERS.DEF),
    K: clampInt(raw?.K, STARTER_MIN.K, STARTER_MAX.K, DEFAULT_STARTERS.K),
  };
}

export function countBaseStarters(starters: StarterCounts): number {
  return (
    starters.QB + starters.RB + starters.WR + starters.TE + starters.DEF + starters.K
  );
}

export function getFlexCount(
  limits?: PositionLimitsLike | null,
  isSuperflex = false
): number {
  const fallback = isSuperflex ? 2 : 1;
  return clampInt(limits?.FLEX, 0, 6, fallback);
}

export function getBenchCount(limits?: PositionLimitsLike | null, fallback = 6): number {
  return clampInt(limits?.BENCH, 0, 15, fallback);
}

/** Injured reserve slots. Not drafted; Team Rankings puts IR players in the Bench room. */
export function getIrCount(limits?: PositionLimitsLike | null, fallback = 0): number {
  return clampInt(limits?.IR, 0, 4, fallback);
}

/** Numeric max for a draftable position (ignores nested starters object). */
export function getPositionMax(
  limits: PositionLimitsLike | null | undefined,
  position: string
): number | undefined {
  const key = position.toUpperCase() === 'D/ST' ? 'DEF' : position.toUpperCase();
  if (
    key !== 'QB' &&
    key !== 'RB' &&
    key !== 'WR' &&
    key !== 'TE' &&
    key !== 'K' &&
    key !== 'DEF' &&
    key !== 'FLEX' &&
    key !== 'BENCH' &&
    key !== 'KEEPERS'
  ) {
    return undefined;
  }
  const value = limits?.[key as keyof PositionLimitsLike];
  return typeof value === 'number' ? value : undefined;
}

/** Flat numeric caps for CPU / eligibility helpers (no nested starters). */
export function toNumericPositionLimits(
  limits?: PositionLimitsLike | null
): Record<string, number> {
  if (!limits) return {};
  const out: Record<string, number> = {};
  for (const key of ['QB', 'RB', 'WR', 'TE', 'FLEX', 'K', 'DEF', 'BENCH', 'KEEPERS'] as const) {
    const value = limits[key];
    if (typeof value === 'number') out[key] = value;
  }
  return out;
}

/** Base starters (no flex) + flex + bench = draft rounds for a full roster. */
export function getRosterRounds(
  limits?: PositionLimitsLike | null,
  isSuperflex = false
): number {
  const starters = parseStarters(limits);
  const flex = getFlexCount(limits, isSuperflex);
  const bench = getBenchCount(limits);
  return countBaseStarters(starters) + flex + bench;
}

function labeledSlots(
  position: StarterPosition,
  count: number
): DraftTeamSlot[] {
  if (count <= 0) return [];
  const positions =
    position === 'DEF' ? ['DEF', 'D/ST'] : ([position] as string[]);
  if (count === 1) {
    return [{ label: position, positions }];
  }
  return Array.from({ length: count }, (_, i) => ({
    label: `${position}${i + 1}`,
    positions,
  }));
}

/** Build ordered starter slots from league config (QB → RB → WR → TE → FLEX → DEF → K). */
export function buildStartingSlots(
  limits?: PositionLimitsLike | null,
  isSuperflex = false
): DraftTeamSlot[] {
  const starters = parseStarters(limits);
  const flexCount = getFlexCount(limits, isSuperflex);
  const flexPositions = isSuperflex
    ? ['QB', 'RB', 'WR', 'TE', 'K', 'DEF', 'D/ST']
    : ['RB', 'WR', 'TE'];

  return [
    ...labeledSlots('QB', starters.QB),
    ...labeledSlots('RB', starters.RB),
    ...labeledSlots('WR', starters.WR),
    ...labeledSlots('TE', starters.TE),
    ...Array.from({ length: flexCount }, () => ({
      label: 'FLEX',
      positions: flexPositions,
    })),
    ...labeledSlots('DEF', starters.DEF),
    ...labeledSlots('K', starters.K),
  ];
}

/** Unfilled dedicated starter holes (flex ignored), multiplicity preserved. */
export function starterNeedsFromCounts(
  positionCounts: Record<string, number>,
  starters?: StarterCounts | null
): string[] {
  const required = starters ?? DEFAULT_STARTERS;
  const needed: string[] = [];
  for (const pos of STARTER_POSITION_ORDER) {
    const have = positionCounts[pos] ?? 0;
    const want = required[pos] ?? 0;
    for (let i = have; i < want; i++) {
      needed.push(pos);
    }
  }
  return needed;
}

/** Ensure max roster caps can cover configured starters (and flex for skill positions). */
export function ensureLimitsCoverStarters(
  limits: PositionLimitsLike,
  starters: StarterCounts,
  flexCount: number,
  isSuperflex: boolean
): PositionLimitsLike {
  const next = { ...limits };
  const bump = (key: StarterPosition, min: number) => {
    const cur = typeof next[key] === 'number' ? (next[key] as number) : 0;
    if (cur < min) next[key] = min;
  };
  bump('QB', Math.max(starters.QB, isSuperflex ? starters.QB + Math.min(1, flexCount) : starters.QB));
  bump('RB', starters.RB);
  bump('WR', starters.WR);
  bump('TE', starters.TE);
  bump('DEF', starters.DEF);
  bump('K', starters.K);

  // Skill-position pool must cover dedicated starters + all flex (non-SF).
  // Superflex: one flex can be QB, so skill pool covers starters + (flex-1).
  const flexFromSkill = isSuperflex ? Math.max(0, flexCount - 1) : flexCount;
  const skillNeed = starters.RB + starters.WR + starters.TE + flexFromSkill;
  const skillHave =
    (typeof next.RB === 'number' ? next.RB : 0) +
    (typeof next.WR === 'number' ? next.WR : 0) +
    (typeof next.TE === 'number' ? next.TE : 0);
  if (skillHave < skillNeed) {
    // Prefer bumping WR, then RB, then TE
    let deficit = skillNeed - skillHave;
    const order: StarterPosition[] = ['WR', 'RB', 'TE'];
    for (const pos of order) {
      if (deficit <= 0) break;
      const cur = typeof next[pos] === 'number' ? (next[pos] as number) : 0;
      next[pos] = cur + deficit;
      deficit = 0;
    }
  }
  return next;
}

export function formatLineupSummary(
  starters: StarterCounts,
  flexCount: number,
  irCount = 0
): string {
  const parts: string[] = [];
  for (const pos of STARTER_POSITION_ORDER) {
    if (starters[pos] > 0) parts.push(`${starters[pos]} ${pos}`);
  }
  if (flexCount > 0) parts.push(`${flexCount} FLEX`);
  if (irCount > 0) parts.push(`${irCount} IR`);
  return parts.join(' · ');
}
