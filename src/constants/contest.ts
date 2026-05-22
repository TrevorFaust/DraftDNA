/** Shared contest constants for Pick Six Challenge (terms, footer, etc.) */
export const SITE_NAME = '[Site Name]';
export const SEASON = 2026;

/** Public `public/pick_six_icon.png` — used wherever Pick Six Challenge is branded in the UI. */
export const PICK_SIX_ICON_PATH = '/pick_six_icon.png' as const;

/** Perfect Pick Six jackpot per position group (QB, RB, WR, TE, K, D/ST). */
export const PICK_SIX_CATEGORY_PRIZE_USD = 6000;

/** Total Pick Six prize pool (six categories). */
export const PICK_SIX_TOTAL_PRIZE_POOL_USD =
  PICK_SIX_CATEGORY_PRIZE_USD * 6;

/** Whole-dollar USD for UI/marketing (e.g. `"$36,000"`). */
export function formatContestPrizeUsd(amount: number): string {
  return amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

/**
 * Distinct league/community buckets the app models: 3 scoring × 2 superflex for season (rookies only is off),
 * plus 3 × 2 × 2 for dynasty (rookies only on/off). 6 + 12 = 18.
 */
export const LEAGUE_FORMAT_COMBINATION_COUNT = 3 * 2 * 1 + 3 * 2 * 2;

/** 8:00 PM ET, Thursday September 3, 2026 — after this, leaderboard can show all users' picks */
export const PICK_SIX_ENTRY_DEADLINE_ET = new Date('2026-09-03T20:00:00-04:00');

/** True when viewing others' picks on the leaderboard is allowed (after entry deadline) */
export const PICK_SIX_VIEW_OTHERS_PICKS = new Date() >= PICK_SIX_ENTRY_DEADLINE_ET;
