export function isLeagueOwner(
  league: { user_id: string } | null | undefined,
  userId: string | null | undefined
): boolean {
  if (!league || !userId) return false;
  return league.user_id === userId;
}
