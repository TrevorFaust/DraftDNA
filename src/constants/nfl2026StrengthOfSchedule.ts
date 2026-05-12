import { canonicalTeamAbbr } from "@/utils/teamMapping";

/**
 * 2026 strength of schedule by opponent win % from 2025.
 * Rank 1 = hardest schedule, 32 = easiest.
 */

/** Shared hover / popover copy for 2026 SOS (Player Stats header + comparison dialog). */
export const NFL_2026_SOS_HELP_TEXT =
  "2026 strength of schedule: combined opponent win % from 2025. 1st is the hardest 2026 schedule and 32nd is the easiest.";

export const NFL_2026_SOS_OPP_WIN_PCT: Record<string, number> = {
  CHI: 0.55,
  MIA: 0.542,
  ARI: 0.538,
  GB: 0.538,
  KC: 0.536,
  NE: 0.531,
  LV: 0.529,
  BUF: 0.528,
  LAC: 0.522,
  CAR: 0.521,
  MIN: 0.519,
  NYJ: 0.517,
  LAR: 0.516,
  SEA: 0.514,
  DEN: 0.512,
  WAS: 0.502,
  NYG: 0.498,
  SF: 0.497,
  PIT: 0.495,
  DAL: 0.493,
  TB: 0.491,
  JAX: 0.49,
  PHI: 0.481,
  BAL: 0.479,
  TEN: 0.476,
  HOU: 0.474,
  DET: 0.467,
  ATL: 0.465,
  IND: 0.465,
  CIN: 0.45,
  NO: 0.434,
  CLE: 0.429,
};

/** SOS rank among 32 teams (1 = hardest, 32 = easiest). Ties share the same rank. */
export const NFL_2026_SOS_RANK: Record<string, number> = {
  CHI: 1,
  MIA: 2,
  ARI: 3,
  GB: 3,
  KC: 5,
  NE: 6,
  LV: 7,
  BUF: 8,
  LAC: 9,
  CAR: 10,
  MIN: 11,
  NYJ: 12,
  LAR: 13,
  SEA: 14,
  DEN: 15,
  WAS: 16,
  NYG: 17,
  SF: 18,
  PIT: 19,
  DAL: 20,
  TB: 21,
  JAX: 22,
  PHI: 23,
  BAL: 24,
  TEN: 25,
  HOU: 26,
  DET: 27,
  ATL: 28,
  IND: 28,
  CIN: 30,
  NO: 31,
  CLE: 32,
};

export function getNfl2026SosRank(teamAbbr: string | null | undefined): number | null {
  const c = canonicalTeamAbbr(teamAbbr);
  if (!c || c === "FA") return null;
  return NFL_2026_SOS_RANK[c] ?? null;
}

export function getNfl2026SosOppWinPct(teamAbbr: string | null | undefined): number | null {
  const c = canonicalTeamAbbr(teamAbbr);
  if (!c || c === "FA") return null;
  return NFL_2026_SOS_OPP_WIN_PCT[c] ?? null;
}

/** Renders like `.434` (three decimals, leading digit omitted per NFL SOS charts). */
export function formatOpponentWinPctDisplay(pct: number): string {
  const s = pct.toFixed(3);
  return s.startsWith("0") ? s.slice(1) : `.${s}`;
}

export function sosOrdinal(rank: number): string {
  const j = rank % 10;
  const k = rank % 100;
  if (k >= 11 && k <= 13) return `${rank}th`;
  if (j === 1) return `${rank}st`;
  if (j === 2) return `${rank}nd`;
  if (j === 3) return `${rank}rd`;
  return `${rank}th`;
}

/** e.g. `.434 (31st)` */
export function formatSosCellDisplay(pct: number, rank: number): string {
  return `${formatOpponentWinPctDisplay(pct)} (${sosOrdinal(rank)})`;
}
