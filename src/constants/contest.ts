/** Shared contest constants for Pick Six Challenge (terms, footer, etc.) */
export const SITE_NAME = '[Site Name]';
export const SEASON = 2026;

/** 8:00 PM ET, Thursday September 3, 2026 — after this, leaderboard can show all users' picks */
export const PICK_SIX_ENTRY_DEADLINE_ET = new Date('2026-09-03T20:00:00-04:00');

/** True when viewing others' picks on the leaderboard is allowed (after entry deadline) */
export const PICK_SIX_VIEW_OTHERS_PICKS = new Date() >= PICK_SIX_ENTRY_DEADLINE_ET;
