import type { ParsedSpreadsheet } from './parseFile';

/** Matches the start of an entry like "81. (WR40)" or "225. (RB66)" — the tag ESPN-style Top 300 pages use. */
const ENTRY_START_RE = /\d{1,4}\.\s*\([A-Za-z/]{1,5}\d{0,3}\)/g;
const ENTRY_DETAIL_RE = /^(\d{1,4})\.\s*\(([A-Za-z/]{1,5}\d{0,3})\)\s*(.+?),\s*([A-Za-z/]{2,5})\b/;

export type TaggedRankingEntry = {
  rank: number;
  name: string;
  position: string;
  team: string;
};

/**
 * True when text is riddled with "12. (WR40) Name, TEAM ..." tags — the shape sites like ESPN's
 * printable Top 300 collapse into on copy-paste, often with several ranks jammed onto one line
 * (e.g. rank 1, 81, 161, 241 all on the same visual line from a 4-column page layout).
 */
export function looksLikeTaggedRankingText(text: string): boolean {
  const matches = text.match(ENTRY_START_RE);
  return Boolean(matches && matches.length >= 8);
}

function positionFromTag(tag: string): string {
  const letters = tag.match(/^[A-Za-z/]+/)?.[0]?.toUpperCase().replace(/\//g, '') ?? '';
  return letters === 'DEF' ? 'DST' : letters;
}

/**
 * Extracts every "N. (POS#) Name, TEAM ..." entry from raw text, wherever it appears — regardless
 * of line breaks or how many entries were packed onto one line — and returns them sorted by rank.
 * Anything that doesn't fit this shape (bye-week legends, stray notes, page furniture) is ignored.
 */
export function parseTaggedRankingEntries(text: string): TaggedRankingEntry[] {
  const starts: number[] = [];
  const startRe = new RegExp(ENTRY_START_RE.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = startRe.exec(text))) {
    starts.push(m.index);
  }

  const entries: TaggedRankingEntry[] = [];
  for (let i = 0; i < starts.length; i++) {
    const chunk = text.slice(starts[i], starts[i + 1] ?? text.length);
    const detail = chunk.match(ENTRY_DETAIL_RE);
    if (!detail) continue;
    const [, rankStr, posTag, name, team] = detail;
    entries.push({
      rank: parseInt(rankStr, 10),
      name: name.trim(),
      position: positionFromTag(posTag),
      team: team.trim().toUpperCase(),
    });
  }

  entries.sort((a, b) => a.rank - b.rank);
  return entries;
}

/** Builds a Rank/Name/Position/Team table so tagged text flows through the normal column-mapping pipeline unchanged. */
export function parseTaggedRankingText(text: string): ParsedSpreadsheet {
  const entries = parseTaggedRankingEntries(text);
  const rows: string[][] = [['Rank', 'Name', 'Position', 'Team']];
  for (const e of entries) {
    rows.push([String(e.rank), e.name, e.position, e.team]);
  }
  return { rows };
}
