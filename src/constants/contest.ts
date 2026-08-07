/** Shared contest constants for Pick Six Challenge (terms, footer, etc.) */
export const SITE_NAME = 'Draft DNA';
export const SEASON = 2026;

/** Public support / policy contact (not for collecting user emails in forms). */
export const SUPPORT_EMAIL = 'draftdnafootball@gmail.com';

export function supportMailto(subject?: string): string {
  const q = subject ? `?subject=${encodeURIComponent(subject)}` : '';
  return `mailto:${SUPPORT_EMAIL}${q}`;
}

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

/**
 * 8:20 PM ET, Wednesday September 9, 2026 — NFL kickoff.
 * Entry deadline, others' picks visibility, and live leaderboard scoring all begin at this moment.
 */
export const PICK_SIX_KICKOFF_ET = new Date('2026-09-09T20:20:00-04:00');

/** @deprecated Alias — use {@link PICK_SIX_KICKOFF_ET} */
export const PICK_SIX_ENTRY_DEADLINE_ET = PICK_SIX_KICKOFF_ET;

/** @deprecated Alias — use {@link PICK_SIX_KICKOFF_ET} */
export const PICK_SIX_LIVE_SCORING_START_ET = PICK_SIX_KICKOFF_ET;

/** Human-readable kickoff for UI copy (always Eastern Time). */
export function formatPickSixKickoffDisplay(): string {
  return PICK_SIX_KICKOFF_ET.toLocaleString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/New_York',
    timeZoneName: 'short',
  });
}

/** Contest season whose fantasy totals drive live Pick Six scoring once games begin. */
export const PICK_SIX_SCORING_STATS_SEASON = SEASON;

/**
 * Local preview of live scoring UI (2025 stats via `usePickSixLiveStats` until 2026 RPC exists).
 * Set `VITE_PICK_SIX_PREVIEW_LIVE_SCORING=true` in `.env`.
 */
export const PICK_SIX_PREVIEW_LIVE_SCORING =
  import.meta.env.VITE_PICK_SIX_PREVIEW_LIVE_SCORING === 'true';

/** True when live top 6, scoring, and full leaderboard are shown */
export const PICK_SIX_LIVE_SCORING_ACTIVE =
  PICK_SIX_PREVIEW_LIVE_SCORING || new Date() >= PICK_SIX_KICKOFF_ET;

/**
 * Local preview of post-deadline leaderboard (all picks expandable). Set
 * `VITE_PICK_SIX_PREVIEW_OTHERS_PICKS=true` in `.env` — remove before production.
 */
export const PICK_SIX_PREVIEW_OTHERS_PICKS =
  import.meta.env.VITE_PICK_SIX_PREVIEW_OTHERS_PICKS === 'true';

/** True when viewing others' picks on the leaderboard is allowed (after entry deadline) */
export const PICK_SIX_VIEW_OTHERS_PICKS =
  PICK_SIX_PREVIEW_OTHERS_PICKS || new Date() >= PICK_SIX_KICKOFF_ET;
