import { normalizePositionForAdpLabel } from '@/utils/positionAdpRank';

/** Per-position cut points: sorted positional ranks that end a tier (last rank in that tier). */
export type PositionTierCuts = Record<string, number[]>;

/** Distinct solid colors before the palette wraps. */
export const TIER_PALETTE_SIZE = 20;

export type TierTone = {
  /** 1-based tier index */
  tier: number;
  label: string;
  /** Solid HSL for border, text, and break bars */
  color: string;
  /** Soft translucent fill for badges */
  bgColor: string;
};

/**
 * 20 hues spaced by the golden angle so each tier sits far from the ones above/below.
 * Slight sat/light wobble keeps near-wrap neighbors from looking identical.
 */
function buildTierPalette(count: number): { color: string; bgColor: string }[] {
  const GOLDEN_ANGLE = 137.508;
  const out: { color: string; bgColor: string }[] = [];
  for (let i = 0; i < count; i++) {
    const hue = (i * GOLDEN_ANGLE) % 360;
    const sat = 72 + (i % 3) * 6;
    const light = 58 + (i % 4) * 3;
    out.push({
      color: `hsl(${hue.toFixed(1)} ${sat}% ${light}%)`,
      bgColor: `hsl(${hue.toFixed(1)} ${sat}% ${light}% / 0.16)`,
    });
  }
  return out;
}

const TIER_PALETTE = buildTierPalette(TIER_PALETTE_SIZE);

export function normalizeTierPosition(position: string): string {
  return normalizePositionForAdpLabel(position);
}

/** Keep cuts unique, sorted, positive integers; drop cuts at/above maxRank when provided. */
export function normalizeCuts(cuts: number[], maxRank?: number): number[] {
  const cleaned = [
    ...new Set(
      cuts
        .map((n) => Math.floor(Number(n)))
        .filter((n) => Number.isFinite(n) && n >= 1)
    ),
  ].sort((a, b) => a - b);
  if (maxRank == null || maxRank < 1) return cleaned;
  return cleaned.filter((n) => n < maxRank);
}

export function getCutsForPosition(allCuts: PositionTierCuts, position: string): number[] {
  const key = normalizeTierPosition(position);
  return normalizeCuts(allCuts[key] ?? []);
}

/** 1-based tier for a positional rank given cut-after ranks. */
export function getTierNumber(posRank: number, cuts: number[]): number {
  if (!Number.isFinite(posRank) || posRank < 1) return 1;
  const sorted = normalizeCuts(cuts);
  let tier = 1;
  for (const cut of sorted) {
    if (posRank <= cut) return tier;
    tier += 1;
  }
  return tier;
}

export function getTierTone(tier: number): TierTone {
  const idx = Math.max(0, tier - 1) % TIER_PALETTE.length;
  const swatch = TIER_PALETTE[idx]!;
  return {
    tier,
    label: `T${tier}`,
    color: swatch.color,
    bgColor: swatch.bgColor,
  };
}

export function hasTierCutAfter(cuts: number[], afterRank: number): boolean {
  return normalizeCuts(cuts).includes(afterRank);
}

/**
 * True when this positional rank is the first player of a new tier
 * (a cut ended the previous tier immediately above them).
 */
export function hasTierBreakBefore(cuts: number[], posRank: number): boolean {
  const rank = Math.floor(posRank);
  if (!Number.isFinite(rank) || rank < 2) return false;
  return hasTierCutAfter(cuts, rank - 1);
}

/**
 * Overall (mixed-position) board: one break per tier number, at the first player
 * in list order who belongs to that tier. Later first-of-tier players at other
 * positions do not get another break for the same tier.
 */
export function buildOverallTierBreakBeforeIds(
  orderedPlayerIds: readonly string[],
  getTier: (playerId: string) => number | null | undefined
): Set<string> {
  const out = new Set<string>();
  const seenTiers = new Set<number>();
  for (const id of orderedPlayerIds) {
    const tier = getTier(id);
    if (tier == null || tier < 2) continue;
    if (seenTiers.has(tier)) continue;
    seenTiers.add(tier);
    out.add(id);
  }
  return out;
}

/** Merge cuts: `primary` wins per position; `fallback` fills missing positions. */
export function mergePositionTierCuts(
  primary: PositionTierCuts,
  fallback: PositionTierCuts
): PositionTierCuts {
  const out: PositionTierCuts = {};
  const keys = new Set([
    ...Object.keys(primary),
    ...Object.keys(fallback),
  ]);
  for (const key of keys) {
    const pos = normalizeTierPosition(key);
    const fromPrimary = normalizeCuts(primary[key] ?? primary[pos] ?? []);
    const fromFallback = normalizeCuts(fallback[key] ?? fallback[pos] ?? []);
    const chosen = fromPrimary.length > 0 ? fromPrimary : fromFallback;
    if (chosen.length > 0) out[pos] = chosen;
  }
  return out;
}

/** Toggle a cut after the given positional rank. */
export function toggleTierCut(cuts: number[], afterRank: number): number[] {
  const rank = Math.floor(afterRank);
  if (!Number.isFinite(rank) || rank < 1) return normalizeCuts(cuts);
  const next = new Set(normalizeCuts(cuts));
  if (next.has(rank)) next.delete(rank);
  else next.add(rank);
  return normalizeCuts([...next]);
}

export function setCutsForPosition(
  allCuts: PositionTierCuts,
  position: string,
  cuts: number[]
): PositionTierCuts {
  const key = normalizeTierPosition(position);
  const normalized = normalizeCuts(cuts);
  const next: PositionTierCuts = { ...allCuts };
  if (normalized.length === 0) {
    delete next[key];
  } else {
    next[key] = normalized;
  }
  return next;
}

export function parsePositionTierCuts(raw: unknown): PositionTierCuts {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: PositionTierCuts = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(value)) continue;
    const cuts = normalizeCuts(value.map((v) => Number(v)));
    if (cuts.length > 0) out[normalizeTierPosition(key)] = cuts;
  }
  return out;
}

export function positionTierCutsEqual(a: PositionTierCuts, b: PositionTierCuts): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    const ac = normalizeCuts(a[key] ?? []).join(',');
    const bc = normalizeCuts(b[key] ?? []).join(',');
    if (ac !== bc) return false;
  }
  return true;
}

function medianSorted(values: number[]): number | null {
  if (values.length === 0) return null;
  const mid = Math.floor(values.length / 2);
  if (values.length % 2 === 1) return values[mid]!;
  return Math.round((values[mid - 1]! + values[mid]!) / 2);
}

/**
 * Only positions where the user drew at least one tier break.
 * Untouched positions stay implicit Tier 1 for everyone and must not
 * enter community consensus.
 */
export function eligiblePositionTierCuts(cuts: PositionTierCuts): PositionTierCuts {
  const out: PositionTierCuts = {};
  for (const [rawPos, rawCuts] of Object.entries(cuts)) {
    const pos = normalizeTierPosition(rawPos);
    const normalized = normalizeCuts(rawCuts);
    if (normalized.length >= 1) out[pos] = normalized;
  }
  return out;
}

/**
 * Build consensus cut points from many users' tier submissions.
 *
 * For each position, the 1st cut across users (median) is the end of Tier 1 /
 * start of Tier 2; the 2nd cut is the Tier 2→3 boundary, and so on. A user's
 * cuts for a position count only when they set ≥1 break there (no default-T1
 * submissions). Boundaries need enough submitters to be kept.
 */
export function aggregateCommunityTierCuts(
  submissions: PositionTierCuts[],
  minShare = 0.2
): PositionTierCuts {
  const cutsByPos = new Map<string, number[][]>();
  const submittersByPos = new Map<string, number>();

  for (const sub of submissions) {
    const eligible = eligiblePositionTierCuts(sub);
    for (const [pos, cuts] of Object.entries(eligible)) {
      submittersByPos.set(pos, (submittersByPos.get(pos) ?? 0) + 1);
      const list = cutsByPos.get(pos) ?? [];
      list.push(cuts);
      cutsByPos.set(pos, list);
    }
  }

  const out: PositionTierCuts = {};
  for (const [pos, allCuts] of cutsByPos) {
    const submitters = submittersByPos.get(pos) ?? 0;
    if (submitters === 0) continue;
    const minVotes = Math.max(1, Math.ceil(submitters * minShare));
    const maxDepth = Math.max(...allCuts.map((c) => c.length));
    const chosen: number[] = [];

    for (let depth = 0; depth < maxDepth; depth++) {
      const atDepth: number[] = [];
      for (const cuts of allCuts) {
        const cut = cuts[depth];
        if (cut != null) atDepth.push(cut);
      }
      if (atDepth.length < minVotes) break;
      atDepth.sort((a, b) => a - b);
      const med = medianSorted(atDepth);
      if (med == null) break;
      // Keep boundaries strictly increasing (Tier 2 start before Tier 3 start).
      if (chosen.length > 0 && med <= chosen[chosen.length - 1]!) break;
      chosen.push(med);
    }

    if (chosen.length > 0) out[pos] = chosen;
  }
  return out;
}
