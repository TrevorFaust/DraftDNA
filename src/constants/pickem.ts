export const PICKEM_SEASON = 2026;
export const PICKEM_WEEKS = 18;

/** Real team numbers when you have them. Missing teams use a stable 0–99 placeholder. */
export const PICKEM_TEAM_JERSEY_NUMBERS: Partial<Record<string, number>> = {};

export function formatPickemRecord(wins: number, losses: number, pushes: number): string {
  if (pushes > 0) return `${wins}-${losses}-${pushes}`;
  return `${wins}-${losses}`;
}

export function pickemJerseyNumber(abbr: string): number {
  const key = abbr.trim().toUpperCase();
  const assigned = PICKEM_TEAM_JERSEY_NUMBERS[key];
  if (assigned != null && assigned >= 0 && assigned <= 99) return assigned;

  let hash = 2166136261;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % 100;
}

