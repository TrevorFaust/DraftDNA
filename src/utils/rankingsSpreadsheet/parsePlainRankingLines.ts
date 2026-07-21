import type { ParsedSpreadsheet } from './parseFile';
import { KNOWN_TEAM_TEXT_TOKENS } from '@/utils/teamMapping';

const POSITION_TOKENS = ['QB', 'RB', 'WR', 'TE', 'K', 'DST', 'DEF', 'D/ST'];
const TEAM_TOKENS = KNOWN_TEAM_TEXT_TOKENS;

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Matches one "flattened" ranking line with no delimiters at all, e.g.
 * "1 Joe Burrow QB CIN 6 3" → rank, name, position, team, [bye], [adp].
 * This is what you get when a table (a spreadsheet, a PDF, or a webpage) gets copied as plain text
 * and the original column boundaries collapse into single spaces.
 */
function buildLineEntryRegex(): RegExp {
  const posAlt = POSITION_TOKENS.map(escapeRegex).join('|');
  const teamAlt = TEAM_TOKENS.map(escapeRegex).join('|');
  return new RegExp(
    `^(?:(\\d{1,4})[.):-]?\\s+)?(.+?)\\s+(${posAlt})\\s+(${teamAlt})\\b(?:\\s+(\\d{1,2}))?(?:\\s+(-?\\d+(?:\\.\\d+)?))?\\s*$`,
    'i'
  );
}

const LINE_ENTRY_RE = buildLineEntryRegex();

function splitLines(text: string): string[] {
  return text
    .split(/\r\n|\r|\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

/** True when most non-empty lines look like "Rank Name POS TEAM [Bye] [ADP]" with no separators. */
export function looksLikePlainRankingLines(text: string): boolean {
  const lines = splitLines(text);
  if (lines.length < 5) return false;
  const matchCount = lines.filter((l) => LINE_ENTRY_RE.test(l)).length;
  return matchCount >= Math.max(5, Math.ceil(lines.length * 0.5));
}

/**
 * Builds a Rank/Name/Position/Team/Bye/ADP table so these lines flow through the normal pipeline unchanged.
 *
 * Rows come out in the order the lines appeared in the source, not sorted by whatever number preceded
 * each name. Whatever number sits in front of a player is often unreliable (gaps, a typo, or actually
 * someone's ADP rather than their rank) — the player's position in the list is the real signal of intent,
 * so line order — not the printed number — is what determines the final ranking.
 */
export function parsePlainRankingLines(text: string): ParsedSpreadsheet {
  const lines = splitLines(text);
  const rows: string[][] = [['Rank', 'Name', 'Position', 'Team', 'Bye', 'ADP']];
  let autoRank = 0;

  for (const line of lines) {
    const m = line.match(LINE_ENTRY_RE);
    if (!m) continue;
    autoRank += 1;
    const [, rankStr, name, position, team, bye, adp] = m;
    const rank = rankStr ? parseInt(rankStr, 10) : autoRank;
    rows.push([String(rank), name.trim(), position.toUpperCase(), team.toUpperCase(), bye ?? '', adp ?? '']);
  }

  return { rows };
}
