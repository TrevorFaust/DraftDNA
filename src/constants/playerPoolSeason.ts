/** Prior season row in `players` (full vet pool + 2025 D/ST ids for stats RPC alignment). */
export const PLAYER_POOL_PRIOR_SEASON = 2025 as const;

/** Current / rookie year rows in `players` (rookies and roster updates). */
export const PLAYER_POOL_CURRENT_SEASON = 2026 as const;

/**
 * Combined pool: load both seasons, then `mergePlayerPoolAcrossSeasons` so vets stay from 2025
 * while 2026-only rows (rookies, etc.) appear and same-`espn_id` rows prefer 2026.
 */
export const PLAYER_POOL_SEASONS = [
  PLAYER_POOL_PRIOR_SEASON,
  PLAYER_POOL_CURRENT_SEASON,
] as const;

/** Rookie-only RPCs / imports that target the current class year. */
export const PLAYER_POOL_SEASON = PLAYER_POOL_CURRENT_SEASON;
