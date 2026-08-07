import {
  getFlexCount,
  parseStarters,
  type PositionLimitsLike,
} from '@/utils/rosterSlots';

export type MpLobbyVisibility = 'invite' | 'open';

/** Open lobbies cancel after this much idle time (joins, seats, ready, chat, rename). */
export const OPEN_LOBBY_IDLE_MS = 10 * 60 * 1000;
/** Show closing warning when remaining time is at or below this. */
export const OPEN_LOBBY_WARN_MS = 2 * 60 * 1000;

export function openLobbyExpiresAtMs(lastActivityIso: string | null | undefined): number | null {
  if (!lastActivityIso) return null;
  const t = new Date(lastActivityIso).getTime();
  if (Number.isNaN(t)) return null;
  return t + OPEN_LOBBY_IDLE_MS;
}

/**
 * @param nowMs - wall clock to compare against (use server-adjusted time when possible)
 * @param clockSkewMs - clientNow - serverNow; positive means the browser clock is ahead
 */
export function openLobbyRemainingMs(
  lastActivityIso: string | null | undefined,
  nowMs = Date.now(),
  clockSkewMs = 0
): number | null {
  const expires = openLobbyExpiresAtMs(lastActivityIso);
  if (expires == null) return null;
  // Convert client wall time to approximate server time before comparing.
  const serverAlignedNow = nowMs - clockSkewMs;
  return expires - serverAlignedNow;
}

/** clientNow - serverNow (ms). Positive = browser ahead of Postgres. */
export function clockSkewFromServerNow(serverNowIso: string, clientNowMs = Date.now()): number {
  const serverMs = new Date(serverNowIso).getTime();
  if (Number.isNaN(serverMs)) return 0;
  return clientNowMs - serverMs;
}

export function formatOpenLobbyCountdown(remainingMs: number): string {
  const sec = Math.max(0, Math.ceil(remainingMs / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m <= 0) return `${s}s`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatMpScoring(format: string | null | undefined): string {
  switch ((format || '').toLowerCase()) {
    case 'ppr':
      return 'PPR';
    case 'half_ppr':
      return 'Half PPR';
    case 'standard':
      return 'Standard';
    default:
      return format?.trim() || 'PPR';
  }
}

export function formatMpLeagueType(leagueType: string | null | undefined): string {
  return (leagueType || '').toLowerCase() === 'dynasty' ? 'Dynasty' : 'Redraft';
}

/** Short lineup summary for lobby cards, e.g. "1QB · 2RB · 2WR · 1TE · 1FLEX · 1DEF · 1K". */
export function formatMpLineupSummary(
  limits: PositionLimitsLike | null | undefined,
  isSuperflex = false
): string {
  const starters = parseStarters(limits);
  const flex = getFlexCount(limits, isSuperflex);
  const parts: string[] = [];
  if (starters.QB > 0) parts.push(`${starters.QB}QB`);
  if (starters.RB > 0) parts.push(`${starters.RB}RB`);
  if (starters.WR > 0) parts.push(`${starters.WR}WR`);
  if (starters.TE > 0) parts.push(`${starters.TE}TE`);
  if (flex > 0) parts.push(`${flex}FLEX`);
  if (starters.DEF > 0) parts.push(`${starters.DEF}DEF`);
  if (starters.K > 0) parts.push(`${starters.K}K`);
  return parts.join(' · ');
}

export function formatMpLobbyMeta(opts: {
  scoringFormat?: string | null;
  leagueType?: string | null;
  isSuperflex?: boolean;
  positionLimits?: PositionLimitsLike | null;
}): string {
  const bits = [
    formatMpScoring(opts.scoringFormat),
    formatMpLeagueType(opts.leagueType),
    opts.isSuperflex ? 'Superflex' : null,
  ].filter(Boolean);
  return bits.join(' · ');
}
