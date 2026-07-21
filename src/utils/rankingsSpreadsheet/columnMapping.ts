export type SpreadsheetColumnMapping = {
  hasHeaderRow: boolean;
  /** Index into each row for each field, or null if not present. */
  nameCol: number | null;
  rankCol: number | null;
  positionCol: number | null;
  teamCol: number | null;
};

const NAME_HEADERS = ['name', 'player', 'player name', 'full name'];
const RANK_HEADERS = ['rank', 'rk', '#', 'ranking', 'ovr', 'overall'];
const POSITION_HEADERS = ['pos', 'position'];
const TEAM_HEADERS = ['team', 'tm', 'nfl team', 'club'];

function findHeaderIndex(headers: string[], candidates: string[]): number | null {
  const normalized = headers.map((h) => h.trim().toLowerCase());
  for (const candidate of candidates) {
    const idx = normalized.indexOf(candidate);
    if (idx !== -1) return idx;
  }
  return null;
}

function looksLikeHeaderRow(row: string[]): boolean {
  const all = [...NAME_HEADERS, ...RANK_HEADERS, ...POSITION_HEADERS, ...TEAM_HEADERS];
  const normalized = row.map((c) => c.trim().toLowerCase());
  return normalized.some((c) => all.includes(c));
}

/** A cell that's purely a small integer — used to spot a "rank"/"#" column in headerless data. */
function isIntegerLikeCell(v: string): boolean {
  return /^\d{1,4}$/.test(v.trim());
}

/** A short 2-4 letter token — used to spot a position or team abbreviation column in headerless data. */
function isShortAlphaCell(v: string): boolean {
  return /^[A-Za-z/]{1,4}$/.test(v.trim());
}

const KNOWN_POSITIONS = new Set(['QB', 'RB', 'WR', 'TE', 'K', 'DST', 'DEF', 'D/ST']);

/**
 * Best-effort detection of which column holds name / rank / position / team.
 * Falls back to sensible guesses for headerless data; the caller should let the user confirm/override.
 */
export function detectColumnMapping(rows: string[][]): SpreadsheetColumnMapping {
  if (rows.length === 0) {
    return { hasHeaderRow: false, nameCol: null, rankCol: null, positionCol: null, teamCol: null };
  }

  const firstRow = rows[0];
  const hasHeaderRow = looksLikeHeaderRow(firstRow);

  if (hasHeaderRow) {
    const nameCol = findHeaderIndex(firstRow, NAME_HEADERS);
    const rankCol = findHeaderIndex(firstRow, RANK_HEADERS);
    const positionCol = findHeaderIndex(firstRow, POSITION_HEADERS);
    const teamCol = findHeaderIndex(firstRow, TEAM_HEADERS);
    return { hasHeaderRow: true, nameCol, rankCol, positionCol, teamCol };
  }

  // Headerless: inspect a sample of data rows to guess column roles by content shape.
  const sample = rows.slice(0, Math.min(15, rows.length));
  const colCount = Math.max(...sample.map((r) => r.length));
  const colStats = Array.from({ length: colCount }, () => ({ intLike: 0, shortAlpha: 0, knownPos: 0, total: 0 }));

  for (const row of sample) {
    for (let c = 0; c < colCount; c++) {
      const cell = (row[c] ?? '').trim();
      if (!cell) continue;
      const stat = colStats[c];
      stat.total += 1;
      if (isIntegerLikeCell(cell)) stat.intLike += 1;
      if (isShortAlphaCell(cell)) stat.shortAlpha += 1;
      if (KNOWN_POSITIONS.has(cell.toUpperCase())) stat.knownPos += 1;
    }
  }

  let rankCol: number | null = null;
  let positionCol: number | null = null;
  let teamCol: number | null = null;

  // Rank column: mostly small integers, and (if there are multiple rows) roughly increasing.
  let bestRankScore = 0;
  colStats.forEach((s, idx) => {
    if (s.total === 0) return;
    const ratio = s.intLike / s.total;
    if (ratio > 0.8 && ratio > bestRankScore) {
      bestRankScore = ratio;
      rankCol = idx;
    }
  });

  // Position column: cells matching known position abbreviations.
  let bestPosScore = 0;
  colStats.forEach((s, idx) => {
    if (s.total === 0 || idx === rankCol) return;
    const ratio = s.knownPos / s.total;
    if (ratio > 0.5 && ratio > bestPosScore) {
      bestPosScore = ratio;
      positionCol = idx;
    }
  });

  // Team column: short alpha tokens that aren't the position column.
  let bestTeamScore = 0;
  colStats.forEach((s, idx) => {
    if (s.total === 0 || idx === rankCol || idx === positionCol) return;
    const ratio = s.shortAlpha / s.total;
    if (ratio > 0.6 && ratio > bestTeamScore) {
      bestTeamScore = ratio;
      teamCol = idx;
    }
  });

  // Name column: the longest remaining text column (falls back to the first unclaimed column).
  const claimed = new Set([rankCol, positionCol, teamCol].filter((c): c is number => c !== null));
  let nameCol: number | null = null;
  let bestAvgLen = 0;
  for (let c = 0; c < colCount; c++) {
    if (claimed.has(c)) continue;
    const lens = sample.map((r) => (r[c] ?? '').length).filter((l) => l > 0);
    if (lens.length === 0) continue;
    const avg = lens.reduce((a, b) => a + b, 0) / lens.length;
    if (avg > bestAvgLen) {
      bestAvgLen = avg;
      nameCol = c;
    }
  }
  if (nameCol === null) {
    for (let c = 0; c < colCount; c++) {
      if (!claimed.has(c)) {
        nameCol = c;
        break;
      }
    }
  }

  return { hasHeaderRow: false, nameCol, rankCol, positionCol, teamCol };
}

/** Data rows only (drops the header row when one was detected). */
export function dataRowsForMapping(rows: string[][], mapping: SpreadsheetColumnMapping): string[][] {
  return mapping.hasHeaderRow ? rows.slice(1) : rows;
}
