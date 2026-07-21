import type { RankedPlayer } from '@/types/database';
import { playerNameMatchKeys } from '@/utils/playerNameMatch';
import {
  teamFieldToAbbr,
  canonicalTeamAbbr,
  resolveTeamAbbrFromText,
  resolveDefenseTeamAbbr,
  stripTrailingTeamReference,
} from '@/utils/teamMapping';
import type { SpreadsheetColumnMapping } from './columnMapping';

export type ImportRowStatus = 'matched' | 'needs_review' | 'not_found' | 'duplicate';

export type ImportRowResult = {
  rowIndex: number;
  rawName: string;
  rawPosition: string | null;
  rawTeam: string | null;
  rawRank: number | null;
  status: ImportRowStatus;
  /** Resolved player, or null when excluded / not yet resolved by the user. */
  player: RankedPlayer | null;
  /** Candidates for the user to choose from in the review step (best guesses first). */
  suggestions: RankedPlayer[];
  /** When status is `duplicate`, the earlier row this player already appeared on. */
  duplicateOfRowIndex?: number | null;
  /** Display helpers for the earlier occurrence (rank number and/or raw name from the file). */
  duplicateOfRank?: number | null;
  duplicateOfRawName?: string | null;
};

export type ImportMatchResult = {
  rows: ImportRowResult[];
  matchedCount: number;
  needsReviewCount: number;
  notFoundCount: number;
  duplicateCount: number;
};

const FUZZY_REVIEW_THRESHOLD = 0.72;
/** Auto-accept a fuzzy hit when name is this close AND team + position both corroborate (one candidate only). */
const FUZZY_AUTO_ACCEPT_WITH_CONTEXT = 0.78;
const MAX_SUGGESTIONS = 5;

/** Sorted-word form of an already-normalized key — catches "Last, First" vs "First Last" without special-casing commas. */
function sortedTokenKey(normalizedKey: string): string {
  return normalizedKey.split(/\s+/).filter(Boolean).sort().join(' ');
}

function buildNameKeys(raw: string): string[] {
  const cleaned = raw.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];
  const base = playerNameMatchKeys(cleaned);
  const withSorted = new Set(base);
  for (const key of base) withSorted.add(sortedTokenKey(key));
  return [...withSorted].filter(Boolean);
}

function normalizePositionForMatch(pos: string | null | undefined): string | null {
  if (!pos) return null;
  const p = pos.trim().toUpperCase().replace(/\//g, '');
  if (p === 'DEF' || p === 'DST' || p === 'D') return 'DST';
  return p || null;
}

function normalizeTeamForMatch(team: string | null | undefined): string | null {
  if (!team?.trim()) return null;
  // resolveTeamAbbrFromText first: it knows alternate abbreviations other sites use (JAC, PHL, AZ, ...),
  // while teamFieldToAbbr passes any 2-4 letter token through unchanged and would leave those unmapped.
  const abbr = resolveTeamAbbrFromText(team) ?? teamFieldToAbbr(team) ?? team.trim().toUpperCase();
  return canonicalTeamAbbr(abbr) ?? abbr;
}

function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const prev = new Array(b.length + 1);
  const curr = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

function nameSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshteinDistance(a, b) / maxLen;
}

type PoolEntry = {
  player: RankedPlayer;
  keys: string[];
  primaryKey: string;
  position: string | null;
  team: string | null;
};

function buildPoolIndex(pool: RankedPlayer[]): PoolEntry[] {
  return pool.map((player) => {
    const keys = buildNameKeys(player.name);
    const position = normalizePositionForMatch(player.position);
    // D/ST rows sometimes store the club in the name ("Jacksonville Jaguars") with team blank or FA.
    const team =
      normalizeTeamForMatch(player.team) ??
      (position === 'DST' ? resolveDefenseTeamAbbr(player.name) : null);
    return {
      player,
      keys,
      primaryKey: keys[0] ?? player.name.toLowerCase(),
      position,
      team,
    };
  });
}

function exactCandidates(rowKeys: string[], poolIndex: PoolEntry[]): PoolEntry[] {
  const rowKeySet = new Set(rowKeys);
  return poolIndex.filter((entry) => entry.keys.some((k) => rowKeySet.has(k)));
}

function fuzzyCandidates(rowPrimaryKey: string, poolIndex: PoolEntry[]): { entry: PoolEntry; score: number }[] {
  const scored = poolIndex.map((entry) => ({ entry, score: nameSimilarity(rowPrimaryKey, entry.primaryKey) }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, MAX_SUGGESTIONS);
}

/** Exact-key and fuzzy name candidates for one name string, filtered/disambiguated by position and team when known. */
function matchByName(
  name: string,
  wantPosition: string | null,
  wantTeam: string | null,
  poolIndex: PoolEntry[]
): {
  candidates: PoolEntry[];
  strongFuzzy: { entry: PoolEntry; score: number }[];
  /** Single fuzzy hit safe to auto-accept because team + position both agree. */
  autoAcceptFuzzy: PoolEntry | null;
} {
  const rowKeys = buildNameKeys(name);
  let candidates = exactCandidates(rowKeys, poolIndex);

  if (candidates.length > 1 && wantPosition) {
    const byPosition = candidates.filter((c) => c.position === wantPosition);
    if (byPosition.length >= 1) candidates = byPosition;
  }
  if (candidates.length > 1 && wantTeam) {
    const byTeam = candidates.filter((c) => c.team === wantTeam);
    if (byTeam.length === 1) candidates = byTeam;
  }

  const primaryKey = rowKeys[0] ?? name.toLowerCase();
  const fuzzy = fuzzyCandidates(primaryKey, poolIndex);
  const strongFuzzy = candidates.length === 0 ? fuzzy.filter((f) => f.score >= FUZZY_REVIEW_THRESHOLD) : [];

  let autoAcceptFuzzy: PoolEntry | null = null;
  if (candidates.length === 0 && wantPosition && wantTeam) {
    const corroborated = strongFuzzy.filter(
      (f) =>
        f.score >= FUZZY_AUTO_ACCEPT_WITH_CONTEXT &&
        f.entry.position === wantPosition &&
        f.entry.team === wantTeam
    );
    if (corroborated.length === 1) autoAcceptFuzzy = corroborated[0].entry;
  }

  return { candidates, strongFuzzy, autoAcceptFuzzy };
}

function cellAt(row: string[], col: number | null): string | null {
  if (col === null) return null;
  const v = row[col];
  return v?.trim() ? v.trim() : null;
}

/** Pasted lists are often numbered ("1. Justin Jefferson", "12) Bijan Robinson") — split that out when there's no separate rank column. */
const LEADING_RANK_RE = /^\s*(\d{1,4})\s*[.):-]?\s+(.+)$/;

function splitLeadingRankFromName(raw: string): { rank: number | null; name: string } {
  const m = raw.match(LEADING_RANK_RE);
  if (m) {
    const name = m[2].trim();
    if (name) return { rank: parseInt(m[1], 10), name };
  }
  return { rank: null, name: raw };
}

/**
 * Matches uploaded spreadsheet rows against the current bucket's player pool.
 * Only real players already in `pool` can end up "matched" or selectable as a suggestion —
 * anything with no exact or close-enough fuzzy hit is reported as `not_found` and excluded.
 */
export function matchImportRows(
  dataRows: string[][],
  mapping: SpreadsheetColumnMapping,
  pool: RankedPlayer[]
): ImportMatchResult {
  const poolIndex = buildPoolIndex(pool);
  const rows: ImportRowResult[] = [];

  dataRows.forEach((row, rowIndex) => {
    const nameCell = cellAt(row, mapping.nameCol);
    if (!nameCell) return; // blank row for this mapping — skip entirely, not an error

    const rawPosition = cellAt(row, mapping.positionCol);
    const rawTeam = cellAt(row, mapping.teamCol);
    const rawRankStr = cellAt(row, mapping.rankCol);

    let rawRank = rawRankStr && /^\d+$/.test(rawRankStr) ? parseInt(rawRankStr, 10) : null;
    let rawName = nameCell;
    if (mapping.rankCol === null) {
      const split = splitLeadingRankFromName(nameCell);
      if (split.rank !== null) {
        rawRank = split.rank;
        rawName = split.name;
      }
    }

    const wantPosition = normalizePositionForMatch(rawPosition);
    const wantTeam = normalizeTeamForMatch(rawTeam);

    // Defense/special-teams naming varies enormously between sources — "Philadelphia Eagles", "Eagles",
    // "Philadelphia", "PHI D/ST", "PHL DEF" can all mean the same thing. Resolve the team from whichever
    // field actually carries it (team column, position+team combined in the name, or the name alone) and
    // match on team + position before ever touching name-similarity logic, which is far too strict for this.
    const isExplicitlyDefense = wantPosition === 'DST';
    if (isExplicitlyDefense || wantPosition === null) {
      // Try every field that could carry the team, not just the first truthy one: the team column may
      // hold something we can't map while the name ("Jaguars D/ST") resolves fine, or vice versa.
      const teamGuesses = [
        isExplicitlyDefense ? wantTeam : null,
        resolveDefenseTeamAbbr(rawTeam),
        resolveDefenseTeamAbbr(rawName),
      ].filter((t): t is string => Boolean(t));

      for (const guess of teamGuesses) {
        const dstCandidates = poolIndex.filter((c) => c.position === 'DST' && c.team === guess);
        if (dstCandidates.length === 1) {
          rows.push({
            rowIndex,
            rawName,
            rawPosition,
            rawTeam,
            rawRank,
            status: 'matched',
            player: dstCandidates[0].player,
            suggestions: [],
          });
          return;
        }
      }
    }

    let { candidates, strongFuzzy, autoAcceptFuzzy } = matchByName(rawName, wantPosition, wantTeam, poolIndex);

    // Nothing matched at all. The name field might have a team tacked onto the end with no separator
    // ("Aaron Rodgers Pittsburgh Steelers"). Retry against just the name with that stripped off. This
    // never runs before a normal match is attempted, so a genuine "Steelers"-only row (a defense) is
    // never affected; it's already handled by the defense check above.
    if (candidates.length === 0 && strongFuzzy.length === 0 && !autoAcceptFuzzy) {
      const strippedName = stripTrailingTeamReference(rawName);
      if (strippedName !== rawName) {
        const retry = matchByName(strippedName, wantPosition, wantTeam, poolIndex);
        if (retry.candidates.length > 0 || retry.strongFuzzy.length > 0 || retry.autoAcceptFuzzy) {
          candidates = retry.candidates;
          strongFuzzy = retry.strongFuzzy;
          autoAcceptFuzzy = retry.autoAcceptFuzzy;
        }
      }
    }

    if (candidates.length === 1) {
      rows.push({
        rowIndex,
        rawName,
        rawPosition,
        rawTeam,
        rawRank,
        status: 'matched',
        player: candidates[0].player,
        suggestions: [],
      });
      return;
    }

    if (candidates.length > 1) {
      rows.push({
        rowIndex,
        rawName,
        rawPosition,
        rawTeam,
        rawRank,
        status: 'needs_review',
        player: null,
        suggestions: candidates.slice(0, MAX_SUGGESTIONS).map((c) => c.player),
      });
      return;
    }

    // Close name + matching team and position: auto-accept so users aren't stuck confirming
    // dozens of apostrophe / spelling near-misses that are otherwise unambiguous.
    if (autoAcceptFuzzy) {
      rows.push({
        rowIndex,
        rawName,
        rawPosition,
        rawTeam,
        rawRank,
        status: 'matched',
        player: autoAcceptFuzzy.player,
        suggestions: [],
      });
      return;
    }

    // Fuzzy without enough corroboration: ask the user, never auto-accept.
    if (strongFuzzy.length > 0) {
      rows.push({
        rowIndex,
        rawName,
        rawPosition,
        rawTeam,
        rawRank,
        status: 'needs_review',
        player: null,
        suggestions: strongFuzzy.map((f) => f.entry.player),
      });
      return;
    }

    rows.push({
      rowIndex,
      rawName,
      rawPosition,
      rawTeam,
      rawRank,
      status: 'not_found',
      player: null,
      suggestions: [],
    });
  });

  const annotated = annotateDuplicateRows(rows);
  return summarizeImportRows(annotated);
}

/**
 * Marks later rows that resolve to the same player as an earlier row as `duplicate`.
 * First occurrence keeps its prior status (`matched` / `needs_review` once the user picks someone).
 * Call again after the user reassigns a row so counts and flags stay in sync.
 */
export function annotateDuplicateRows(rows: ImportRowResult[]): ImportRowResult[] {
  const firstByPlayerId = new Map<string, ImportRowResult>();
  return rows.map((row) => {
    // Clear prior duplicate annotation; we'll re-apply below if still warranted.
    const base: ImportRowResult = {
      ...row,
      duplicateOfRowIndex: null,
      duplicateOfRank: null,
      duplicateOfRawName: null,
    };

    if (!base.player) {
      // No resolved player: restore not_found / needs_review if this was only flagged as duplicate before.
      if (base.status === 'duplicate') {
        return { ...base, status: 'needs_review' };
      }
      return base;
    }

    const prior = firstByPlayerId.get(base.player.id);
    if (!prior) {
      firstByPlayerId.set(base.player.id, base);
      // First time we see this player. If it was marked duplicate from a previous pass, promote to matched.
      if (base.status === 'duplicate') {
        return { ...base, status: 'matched' };
      }
      return base;
    }

    return {
      ...base,
      status: 'duplicate',
      duplicateOfRowIndex: prior.rowIndex,
      duplicateOfRank: prior.rawRank,
      duplicateOfRawName: prior.rawName,
    };
  });
}

/** Rebuilds summary counts after the user edits a row assignment. */
export function summarizeImportRows(rows: ImportRowResult[]): ImportMatchResult {
  return {
    rows,
    matchedCount: rows.filter((r) => r.status === 'matched').length,
    needsReviewCount: rows.filter((r) => r.status === 'needs_review').length,
    notFoundCount: rows.filter((r) => r.status === 'not_found').length,
    duplicateCount: rows.filter((r) => r.status === 'duplicate').length,
  };
}

export type FinalizedImportSummary = {
  /** Ordered, deduped player ids ready for mergeRankingsWithDraftOrder. */
  orderedPlayerIds: string[];
  matchedCount: number;
  adjustedCount: number;
  excludedCount: number;
  duplicateCount: number;
};

/**
 * Resolves the review-confirmed rows into a final ordered id list.
 * Rows the user never assigned a player to are excluded; duplicate player assignments keep only the first occurrence.
 */
export function finalizeImportRows(rows: ImportRowResult[]): FinalizedImportSummary {
  const seen = new Set<string>();
  const orderedPlayerIds: string[] = [];
  let matchedCount = 0;
  let adjustedCount = 0;
  let excludedCount = 0;
  let duplicateCount = 0;

  for (const row of rows) {
    if (!row.player) {
      excludedCount += 1;
      continue;
    }
    if (seen.has(row.player.id)) {
      duplicateCount += 1;
      continue;
    }
    seen.add(row.player.id);
    orderedPlayerIds.push(row.player.id);
    if (row.status === 'matched') matchedCount += 1;
    else adjustedCount += 1;
  }

  return { orderedPlayerIds, matchedCount, adjustedCount, excludedCount, duplicateCount };
}
