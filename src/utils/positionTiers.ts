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
