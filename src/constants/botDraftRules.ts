/**
 * General draft rules that ALL CPU bots must follow.
 * These rules apply before archetype-specific logic. They exist to keep bot
 * behavior realistic and consistent with how humans draft.
 *
 * Enforcement: These rules should filter or constrain the available player
 * pool (or influence selection) in the CPU pick flow. Implementation lives
 * in cpuDraftLogic.ts or DraftRoom as a pre-step before archetype dispatch.
 */

// ─── POSITIONAL TIMING RULES ─────────────────────────────────────────────────

/**
 * DST: Earliest at 5 rounds before the last round. Most users draft DST in the
 * 2nd or 3rd to last round. Max 1 per roster (unless absolute final pick and already have one).
 */
/** Earliest DST = numRounds - DST_EARLIEST_ROUNDS_BEFORE_END (e.g. 18 rounds → round 14). */
export const DST_EARLIEST_ROUNDS_BEFORE_END = 5;

/** Most common DST rounds: 2nd and 3rd to last. */
export const DST_MOST_COMMON_ROUNDS_BEFORE_END = [2, 3] as const; // 2nd-to-last, 3rd-to-last

/** Maximum DST per roster. Only 1 unless it's the absolute final pick and bot already has one. */
export const DST_MAX_PER_ROSTER = 1;

export const DST_RULES = [
  'Earliest DST: 5 rounds before the last round (e.g. 18 rounds → round 14).',
  'Most common: 2nd or 3rd to last round.',
  'Maximum 1 DST per roster; only allow a second on the absolute final pick if already have one.',
  'DST is streamable — no reason to roster two.',
] as const;

/**
 * Kicker: Almost always taken with the last pick. Exception: first ~3 kickers may
 * be taken one round after the first defenses go off, and only if the bot already
 * has a defense. A kicker is NEVER taken before a defense.
 */
export const KICKER_MAX_PER_ROSTER = 1;

/** Kicker is taken with the last pick in almost all cases. */
export const KICKER_TYPICAL_ROUND = 'last' as const;

/** First N kickers may be taken early (one round after first DSTs), only if bot has DST. */
export const KICKER_EARLY_EXCEPTION_COUNT = 3;

/** Early kicker exception: one round after first defenses go off the board. */
export const KICKER_EARLY_EXCEPTION_AFTER = 'first_dst_round_plus_one' as const;

/** Bot must have a defense before ever taking a kicker. */
export const KICKER_REQUIRES_DEFENSE = true;

/** Kicker is never drafted before a defense. */
export const KICKER_NEVER_BEFORE_DEFENSE = true;

export const KICKER_RULES = [
  'Kicker is almost always taken with the last pick.',
  'Exception: first ~3 kickers may be taken one round after the first defenses go off.',
  'Early kicker exception only applies if the bot already has a defense.',
  'Kicker is NEVER taken before a defense.',
  'Maximum 1 kicker per roster.',
] as const;

/**
 * QB rule: Even Early QB archetype shouldn't go before pick 5–6 overall in a 12-team
 * standard league. In round 1, only truly elite, historically dominant QB seasons justify it.
 */
export const QB_EARLIEST_PICK_OVERALL_12_TEAM = 5; // Pick 5–6 overall minimum
export const QB_ROUND_1_JUSTIFIED = 'elite_historically_dominant_only'; // Documentation

export const QB_TIMING_RULES = [
  'Early QB archetype: no QB before pick 5–6 overall in a 12-team league.',
  'Round 1 QB: only justified for truly elite, historically dominant QB seasons.',
] as const;

/**
 * TE rule: Even Early TE shouldn't go before pick 8–10 overall unless the player
 * is historically dominant (Kelce-tier). The position premium must be enormous.
 */
export const TE_EARLIEST_PICK_OVERALL_12_TEAM = 8; // Pick 8–10 minimum
export const TE_ROUND_1_EARLY_JUSTIFIED = 'historically_dominant_kelce_tier_only';

export const TE_TIMING_RULES = [
  'Early TE: no TE before pick 8–10 overall in a 12-team league.',
  'Exception: historically dominant TE (Kelce-tier) — position premium must be enormous.',
] as const;

// ─── ROSTER CONSTRUCTION RULES ───────────────────────────────────────────────

/**
 * Don't overdraft a position beyond what you can start.
 * Track roster counts vs starting requirements and bench limits.
 */

/** Soft maximum RBs before it becomes wasteful (fill other positions first). */
export const RB_SOFT_MAX_BEFORE_FILL_OTHERS = 5;

/** Soft maximum WRs before it becomes wasteful. */
export const WR_SOFT_MAX_BEFORE_FILL_OTHERS = 5;

/** QB max: 2 in single-QB, only if second comes mid-to-late. */
export const QB_MAX_SINGLE_QB = 2;

/** TE max: 2, and only if second is a late flier. */
export const TE_MAX_PER_ROSTER = 2;

export const ROSTER_CONSTRUCTION_RULES = [
  "Don't take a 5th WR before having a QB, 4th RB before having a TE, etc.",
  'RB: soft max 4–5 before filling other positions.',
  'WR: soft max 4–5 before filling other positions.',
  'QB: max 2 in single-QB; second only in mid-to-late rounds.',
  'TE: max 2; second only as late flier.',
  'DST: 1. K: 1.',
  "Don't double-stack same NFL team offense at same position accidentally; if intentional, treat as risk-correlation play.",
  'Two RBs from same backfield is fine if one is a handcuff.',
] as const;

// ─── ADP AND VALUE RULES ─────────────────────────────────────────────────────

/** Maximum rounds a bot may "reach" above a player's ADP (e.g. 3 rounds = 36 picks in 12-team). Scale with num_teams when implementing. */
export const MAX_REACH_ROUNDS = 3;

/** Realistic reach: 1–2 rounds. 3 rounds is the hard cap. */
export const TYPICAL_REACH_ROUNDS = { min: 1, max: 2 } as const;

/**
 * Age penalty: soft penalty for players over 30 at RB, over 32 at WR/QB.
 * Especially in later rounds where upside matters more than name recognition.
 */
export const AGE_SOFT_PENALTY = {
  RB_OVER_AGE: 30,
  WR_OVER_AGE: 32,
  QB_OVER_AGE: 32,
} as const;

export const ADP_VALUE_RULES = [
  'Never reach more than 3 rounds (36 picks in 12-team) from consensus ADP.',
  'Realistic reach: 1–2 rounds for a favored player.',
  'Apply soft age penalty: RB over 30, WR/QB over 32, especially in later rounds.',
  'Think in tiers, not just ADP ranks. If top tier is gone, don\'t panic-reach for next tier.',
  "Don't reach for need in early rounds (1–7). Best value wins early; need filling comes after round 7.",
  "Positional need is a late-round consideration, not early-round. Never take a lesser player in round 3 just because bot 'needs' a WR.",
] as const;

// ─── DRAFT FLOW / BEHAVIORAL RULES ───────────────────────────────────────────

/**
 * Snake draft position awareness: understand turn structure. At a turn (e.g. picks 8 and 9)
 * the bot can plan a pairing. After a long wait, assume top of tier may be gone and plan
 * for the next tier — especially during RB/WR runs in rounds 2–4.
 */
export const DRAFT_FLOW_SNAKE_TURN_AWARENESS = true;

/** Rounds where RB/WR runs are most common; bot should plan for tier drop after long wait. */
export const DRAFT_FLOW_RUN_HEAVY_ROUNDS = [2, 3, 4] as const;

/**
 * Positional run awareness: when N+ of a position go in the last M picks, consider
 * joining the run if the bot needs that position, or consciously sit out and take value elsewhere.
 */
/** e.g. "If 3+ QBs in last 6 picks and I don't have one, consider joining the run." Scale withinLastPicks with num_teams (e.g. num_teams/2). */
export const DRAFT_FLOW_RUN_THRESHOLD = {
  count: 3,
  withinLastPicks: 6,
} as const;

export const DRAFT_FLOW_RUN_RULES = [
  'Track positional runs (e.g. 4 QBs in a row).',
  'If run meets threshold and bot needs that position, consider joining.',
  'Otherwise consciously sit out and take value elsewhere.',
] as const;

/** By this round, bot should have (or be on track for) a viable starter at every required position. Exception: DST and K (streaming). */
export const DRAFT_FLOW_STARTERS_FILLED_BY_ROUND = 10;

/** Viable starter = at least one player at each of QB, RB, WR, TE (excl. DST and K). CPU often drafts heavy RB/WR; QB or TE can wait until later. */
export const DRAFT_FLOW_VIABLE_STARTER_DEFINITION = 'at_least_one_per_position' as const;

export const DRAFT_FLOW_STARTER_RULES = [
  'By round 10, have a viable starter at every required position, or be on track.',
  'Viable = at least one QB, one RB, one WR, one TE (DST and K are streaming; exclude from this rule).',
  'Exception: DST and K are streaming positions.',
] as const;

/** Final N rounds: shift toward upside regardless of archetype. Lottery tickets over safe veterans. */
export const DRAFT_FLOW_LATE_UPSIDE_ROUNDS_BEFORE_END = 4; // last 3–4 rounds

export const DRAFT_FLOW_LATE_UPSIDE_RULES = [
  'In the final 3–4 rounds, every archetype shifts toward upside.',
  'Floor matters less for bench stashes — prefer lottery tickets over safe veterans with no ceiling.',
] as const;

/**
 * Injury/situation flags: known injury concern or unclear role (holdout, recovering from surgery)
 * → apply soft discount to ADP and require better-than-market value to draft.
 */
export const DRAFT_FLOW_INJURY_SITUATION_DISCOUNT = true;

export const DRAFT_FLOW_INJURY_RULES = [
  'If player has known injury concern or unclear role (holdout, recovering from surgery), apply soft discount to ADP.',
  'Require better-than-market value to draft such players.',
] as const;

export const DRAFT_FLOW_RULES = [
  'Snake: understand turn structure; plan pairings at a turn; after long wait, plan for next tier (especially rounds 2–4 RB/WR runs).',
  'Positional runs: join run if threshold met and bot needs position, else sit out and take value.',
  'By round 10: viable starter at every required position (except DST/K).',
  'Final 3–4 rounds: shift toward upside; lottery tickets over safe veterans.',
  'Injury/situation flags: soft discount; require better-than-market value.',
] as const;

// ─── LEAGUE FORMAT MODIFIERS ──────────────────────────────────────────────────

/**
 * These adjust the universal rules based on user league settings.
 * Not universal — apply when the corresponding league setting is present.
 */

/** PPR heavily favors pass-catching RBs and slot WRs. Half-PPR is middle ground. Standard elevates workhorse RBs and goalline backs. */
export const FORMAT_SCORING_MODIFIERS = {
  ppr: 'Favor pass-catching RBs and slot WRs.',
  half_ppr: 'Middle ground between PPR and standard.',
  standard: 'Elevate true workhorse RBs and goalline backs.',
} as const;

/** Shallow draft (e.g. 15 rounds, 10 teams) = rich waiver wire. Deep draft (e.g. 20 rounds, 14 teams) = streaming hard, depth matters enormously. */
export const FORMAT_ROSTER_SIZE_MODIFIERS = [
  'Shallow draft (few rounds / fewer teams): waiver wire is rich; streaming viable.',
  'Deep draft (many rounds / more teams): streaming nearly impossible; depth matters enormously.',
] as const;

/** Two RB / three WR / one flex vs two RB / two WR / two flex — flex spots change positional scarcity significantly. */
export const FORMAT_LINEUP_MODIFIERS = [
  'Starting lineup requirements change scarcity: more flex spots increase RB/WR interchangeability.',
  '2RB / 3WR / 1FLEX is different from 2RB / 2WR / 2FLEX.',
] as const;

/** 10-team: QB depth on wire is deep → late QB very safe. 14-team: mid-tier QBs drafted early → late QB / punt QB genuinely risky. */
export const FORMAT_TEAM_COUNT_MODIFIERS = [
  'Fewer teams (e.g. 10): QB depth on wire deep; late QB is safe.',
  'More teams (e.g. 14): even mid-tier QBs go early; late QB or punt QB is risky.',
] as const;

export const LEAGUE_FORMAT_MODIFIERS_RULES = [
  'Scoring: PPR favors pass-catching RBs/slot WRs; half-PPR middle; standard favors workhorse RBs/goalline backs.',
  'Roster size: shallow draft = rich waiver; deep draft = streaming hard, depth matters.',
  'Starting lineup: flex spots change positional scarcity (2RB/3WR/1FLEX vs 2RB/2WR/2FLEX).',
  'Number of teams: fewer teams = late QB safe; more teams = late/punt QB risky.',
] as const;

// ─── SCALING BY LEAGUE SIZE ──────────────────────────────────────────────────

/**
 * Scale universal rules by num_teams and num_rounds so 10-team and 14-team behave realistically.
 * Examples: run threshold "last N picks" ≈ num_teams/2; QB earliest pick scales with num_teams;
 * DST/K already use num_rounds. Apply scaling when implementing filters.
 */
export const SCALING_BY_LEAGUE_SIZE = [
  'Run threshold (withinLastPicks): scale with num_teams (e.g. Math.ceil(num_teams / 2) or similar).',
  'QB earliest pick overall: scale with num_teams (12-team → 5–6; 10-team → earlier; 14-team → later).',
  'TE earliest pick overall: scale with num_teams.',
  'DST/K timing: already defined relative to num_rounds.',
] as const;

// ─── TIERS (ADP-based, within position) ───────────────────────────────────────

/**
 * Tier bands by ADP rank within position. Use for tier awareness (don't panic-reach for next tier).
 * General: 1–5 elite, 6–15 good, 16–30 falloff, 31+ up in the air. Holds best for top ~20 per position.
 */
export const TIER_BY_POSITION_ADP = {
  elite: { min: 1, max: 5 },
  good: { min: 6, max: 15 },
  falloff: { min: 16, max: 30 },
  late: { min: 31, max: 999 },
} as const;

export type PositionTier = 1 | 2 | 3 | 4;

/** Return tier 1 (elite) … 4 (late) from ADP rank within position. Uses TIER_BY_POSITION_ADP. */
export function getTierFromPositionAdp(adpRankWithinPosition: number): PositionTier {
  if (adpRankWithinPosition <= 5) return 1;
  if (adpRankWithinPosition <= 15) return 2;
  if (adpRankWithinPosition <= 30) return 3;
  return 4;
}

// ─── CONSOLIDATED (for documentation / tooling) ──────────────────────────────

export const BOT_DRAFT_RULES_SUMMARY = {
  positionalTiming: {
    DST: DST_RULES,
    KICKER: KICKER_RULES,
    QB: QB_TIMING_RULES,
    TE: TE_TIMING_RULES,
  },
  rosterConstruction: ROSTER_CONSTRUCTION_RULES,
  adpAndValue: ADP_VALUE_RULES,
  draftFlow: DRAFT_FLOW_RULES,
  leagueFormatModifiers: LEAGUE_FORMAT_MODIFIERS_RULES,
  scalingByLeagueSize: SCALING_BY_LEAGUE_SIZE,
  tierBands: TIER_BY_POSITION_ADP,
} as const;
