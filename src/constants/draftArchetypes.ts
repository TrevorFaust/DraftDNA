/**
 * Draft archetypes for CPU/bot drafters in mock drafts.
 * Each archetype defines a named strategy; the actual pick logic is implemented
 * in cpuDraftLogic.ts (or per-archetype modules). This file defines IDs, display
 * names, categories, and short descriptions only.
 *
 * For general draft rules that ALL bots follow (positional timing, roster
 * construction, ADP/value rules), see @/constants/botDraftRules.
 */

// ─── Ground rules for ALL bots (applied before archetype-specific logic) ─────
// These are enforced in DraftRoom / CPU pick flow; archetype logic only chooses
// among players that already satisfy these rules.
//
// 1. POSITION LIMITS: Never draft a player if it would exceed the league's
//    position limit (QB, RB, WR, TE, FLEX, DEF, K, BENCH). The pool passed to
//    archetype logic is already filtered by hasAvailableSpotForPosition.
//
// 2. DEFENSE FAIRNESS: Ensure every team gets at least one D/ST before any team
//    gets a second (when DEF limit allows). If this team is the last without a
//    defense, prioritize DEF in the available pool.
//
// 3. KEEPER SLOTS: Keeper picks are forced; bots do not "choose" for keepers.
//
// 4. ROSTER VALIDITY: The bot must pick from the available list provided; no
//    inventing players or ignoring availability. If the list is empty after
//    filters, the draft is stuck (handled by caller).
//
// 5. DRAFT ORDER: Bots respect snake/linear order and pick only when it is
//    their turn.
// ─────────────────────────────────────────────────────────────────────────────

export const BOT_GROUND_RULES = [
  'Respect position limits (no over-drafting any position).',
  'Ensure all teams get at least one D/ST before any team gets a second (when limit allows).',
  'Keeper picks are forced; no archetype logic for keepers.',
  'Pick only from the available (undrafted, non-keeper) player list.',
  'Respect draft order (snake or linear).',
] as const;

// ─── Archetype IDs (use these in code and storage) ───────────────────────────

/** Running back strategies */
export const RB_ARCHETYPES = [
  'zero_rb',
  'hero_rb',
  'robust_rb',
] as const;

/** Wide receiver strategies */
export const WR_ARCHETYPES = [
  'zero_wr',
  'hero_wr',
  'robust_wr',
] as const;

/** Quarterback strategies */
export const QB_ARCHETYPES = [
  'early_qb',
  'mid_qb',
  'late_qb',
  'punt_qb',
] as const;

/** Tight end strategies */
export const TE_ARCHETYPES = [
  'early_te',
  'late_te',
] as const;

/** Broad / philosophical strategies */
export const BROAD_ARCHETYPES = [
  'bpa',
  'vbd',
  'upside',
  'floor',
  'handcuff_heavy',
  'onesies',
] as const;

export type RbArchetypeId = (typeof RB_ARCHETYPES)[number];
export type WrArchetypeId = (typeof WR_ARCHETYPES)[number];
export type QbArchetypeId = (typeof QB_ARCHETYPES)[number];
export type TeArchetypeId = (typeof TE_ARCHETYPES)[number];
export type BroadArchetypeId = (typeof BROAD_ARCHETYPES)[number];

export type DraftArchetypeId =
  | RbArchetypeId
  | WrArchetypeId
  | QbArchetypeId
  | TeArchetypeId
  | BroadArchetypeId;

/** All archetype IDs in one array for random assignment and validation */
export const ALL_ARCHETYPE_IDS: readonly DraftArchetypeId[] = [
  ...RB_ARCHETYPES,
  ...WR_ARCHETYPES,
  ...QB_ARCHETYPES,
  ...TE_ARCHETYPES,
  ...BROAD_ARCHETYPES,
];

// ─── Metadata for each archetype ────────────────────────────────────────────

export type ArchetypeCategory =
  | 'rb'
  | 'wr'
  | 'qb'
  | 'te'
  | 'broad';

export interface DraftArchetypeMeta {
  id: DraftArchetypeId;
  label: string;
  category: ArchetypeCategory;
  shortDescription: string;
}

export const DRAFT_ARCHETYPE_META: Record<DraftArchetypeId, DraftArchetypeMeta> = {
  // ─── Running back strategies ───
  zero_rb: {
    id: 'zero_rb',
    label: 'Zero RB',
    category: 'rb',
    shortDescription: 'Avoids RB in the first 4–5 rounds; loads up on WR/TE, then targets high-upside RBs late.',
  },
  hero_rb: {
    id: 'hero_rb',
    label: 'Hero RB',
    category: 'rb',
    shortDescription: 'One elite workhorse RB in round 1, then pivots to Zero RB logic (WR-heavy).',
  },
  robust_rb: {
    id: 'robust_rb',
    label: 'Robust RB',
    category: 'rb',
    shortDescription: 'RBs in rounds 1–3 (sometimes 4); accepts thin WR depth, streams WR/TE.',
  },

  // ─── Wide receiver strategies ───
  zero_wr: {
    id: 'zero_wr',
    label: 'Zero WR (WR Late)',
    category: 'wr',
    shortDescription: 'Avoids WR early; loads up on RB/QB/TE, then targets WRs in the middle and late rounds.',
  },
  hero_wr: {
    id: 'hero_wr',
    label: 'Hero WR',
    category: 'wr',
    shortDescription: 'One elite WR in round 1, then loads up on RBs; bets on WR1 durability.',
  },
  robust_wr: {
    id: 'robust_wr',
    label: 'Robust WR',
    category: 'wr',
    shortDescription: 'WR in rounds 1–3; punts RB depth, relies on late-round fliers and waivers at RB.',
  },

  // ─── Quarterback strategies ───
  early_qb: {
    id: 'early_qb',
    label: 'Early QB',
    category: 'qb',
    shortDescription: 'QB in round 1 or 2; locks in elite tier with rushing upside.',
  },
  mid_qb: {
    id: 'mid_qb',
    label: 'Mid QB',
    category: 'qb',
    shortDescription: 'QB in rounds 4–7; compromise between premium and late-QB.',
  },
  late_qb: {
    id: 'late_qb',
    label: 'Late QB',
    category: 'qb',
    shortDescription: 'QB in rounds 8–12; maximizes early capital for skill positions.',
  },
  punt_qb: {
    id: 'punt_qb',
    label: 'Punt QB / Streamer',
    category: 'qb',
    shortDescription: 'QB in final rounds or streams; accepts weekly volatility at QB.',
  },

  // ─── Tight end strategies ───
  early_te: {
    id: 'early_te',
    label: 'Early TE',
    category: 'te',
    shortDescription: 'Elite TE in rounds 1–3; treats TE as solved, focuses on RB/WR depth.',
  },
  late_te: {
    id: 'late_te',
    label: 'Late TE / Streaming TE',
    category: 'te',
    shortDescription: 'TE in rounds 10–14; streams by matchup, stronger depth elsewhere.',
  },

  // ─── Broad / philosophical ───
  bpa: {
    id: 'bpa',
    label: 'Best Player Available (BPA)',
    category: 'broad',
    shortDescription: 'No positional bias; always takes highest value on board (ADP/rank). Neutral baseline.',
  },
  vbd: {
    id: 'vbd',
    label: 'Value Based Drafting (VBD)',
    category: 'broad',
    shortDescription: 'Drafts by value over replacement at each position; accounts for scarcity.',
  },
  upside: {
    id: 'upside',
    label: 'Upside / Ceiling Chaser',
    category: 'broad',
    shortDescription: 'Targets boom-or-bust players; rookies, unclear depth charts, high variance.',
  },
  floor: {
    id: 'floor',
    label: 'Floor / Safe',
    category: 'broad',
    shortDescription: 'Targets proven, high-volume, consistent usage; avoids rookies and injury risk.',
  },
  handcuff_heavy: {
    id: 'handcuff_heavy',
    label: 'Handcuff Heavy',
    category: 'broad',
    shortDescription: 'After drafting a starting RB, prioritizes their backup; extends to other handcuffs.',
  },
  onesies: {
    id: 'onesies',
    label: 'Onesies / One of Each',
    category: 'broad',
    shortDescription: 'Fills one reliable option per starting slot before doubling up anywhere.',
  },
};

/** Get metadata for an archetype; returns undefined if id is invalid */
export function getArchetypeMeta(id: string): DraftArchetypeMeta | undefined {
  return DRAFT_ARCHETYPE_META[id as DraftArchetypeId];
}

/** Check if a string is a valid DraftArchetypeId */
export function isDraftArchetypeId(id: string): id is DraftArchetypeId {
  return ALL_ARCHETYPE_IDS.includes(id as DraftArchetypeId);
}

/** Pick a random archetype (for assigning to CPU teams when not user-selected) */
export function getRandomArchetypeId(): DraftArchetypeId {
  const idx = Math.floor(Math.random() * ALL_ARCHETYPE_IDS.length);
  return ALL_ARCHETYPE_IDS[idx];
}

// ─── Archetype combos (2–3 per CPU) ──────────────────────────────────────────

/**
 * Predefined combos that mesh well: e.g. Hero RB + many WRs + Mid QB + streaming TE.
 * Each entry is 2–3 archetype ids. Logic will apply the relevant strategy per position/timing.
 */
export const ARCHETYPE_COMBO_TEMPLATES: readonly DraftArchetypeId[][] = [
  ['hero_rb', 'mid_qb', 'late_te'],
  ['hero_rb', 'late_qb', 'late_te'],
  ['zero_rb', 'robust_wr', 'late_qb', 'late_te'],
  ['zero_rb', 'robust_wr', 'mid_qb', 'late_te'],
  ['robust_rb', 'late_qb', 'late_te'],
  ['hero_wr', 'mid_qb', 'late_te'],
  ['hero_wr', 'late_qb', 'early_te'],
  ['robust_wr', 'mid_qb', 'late_te'],
  ['bpa', 'late_qb', 'late_te'],
  ['onesies', 'mid_qb'],
  ['vbd', 'late_qb', 'late_te'],
  ['hero_rb', 'punt_qb', 'late_te'],
  ['zero_wr', 'robust_rb', 'mid_qb', 'late_te'],
];

/** Normalize stored value to array of archetype ids (supports legacy single string). */
export function normalizeArchetypesForTeam(value: string | string[] | undefined): DraftArchetypeId[] {
  if (value == null) return [];
  const arr = Array.isArray(value) ? value : [value];
  return arr.filter((id): id is DraftArchetypeId => isDraftArchetypeId(id));
}

/**
 * Assign 2–3 archetypes per CPU team using predefined combos. User's team is not in the map.
 */
export function assignRandomArchetypeCombosForDraft(
  numTeams: number,
  userPickPosition: number
): Record<number, DraftArchetypeId[]> {
  const map: Record<number, DraftArchetypeId[]> = {};
  for (let teamNum = 1; teamNum <= numTeams; teamNum++) {
    if (teamNum === userPickPosition) continue;
    const template = ARCHETYPE_COMBO_TEMPLATES[Math.floor(Math.random() * ARCHETYPE_COMBO_TEMPLATES.length)];
    map[teamNum] = [...template];
  }
  return map;
}
