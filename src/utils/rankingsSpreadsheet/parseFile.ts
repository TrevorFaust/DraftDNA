import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { looksLikeTaggedRankingText, parseTaggedRankingText } from './parseTaggedRankings';
import { looksLikePlainRankingLines, parsePlainRankingLines } from './parsePlainRankingLines';
import { looksLikeInlineNameList, parseInlineNameList } from './parseInlineNameList';

export type ParsedSpreadsheet = {
  /** Raw rows as string cells, in file order (may or may not include a header row — caller detects that). */
  rows: string[][];
};

/** A parse failure with a message safe to show the user as-is. */
export class SpreadsheetParseError extends Error {}

function cellToString(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number') return String(v);
  return String(v).trim();
}

/**
 * Spreadsheet apps often paste a whole multi-line list into a single cell (the line breaks stay
 * *inside* that one cell instead of creating new rows). Split any cell like that back into its own
 * rows so a "Top 300" pasted into cell A1 still becomes 300 rows instead of one giant blob.
 */
function expandMultilineCells(rows: string[][]): string[][] {
  const out: string[][] = [];
  for (const row of rows) {
    const perCellLines = row.map((cell) => cell.split(/\r\n|\r|\n/).map((l) => l.trim()));
    const maxLines = Math.max(1, ...perCellLines.map((lines) => lines.length));
    if (maxLines <= 1) {
      out.push(row);
      continue;
    }
    for (let i = 0; i < maxLines; i++) {
      const subRow = perCellLines.map((lines) => lines[i] ?? '');
      if (subRow.some((c) => c !== '')) out.push(subRow);
    }
  }
  return out;
}

function parseDelimitedText(text: string): ParsedSpreadsheet {
  // Sites like ESPN's printable Top 300 pack several ranks per line with "(RB1)"-style tags —
  // handle that shape directly rather than trying to force it through generic column splitting.
  if (looksLikeTaggedRankingText(text)) {
    return parseTaggedRankingText(text);
  }

  // Some lists arrive with the columns already collapsed into flat lines like
  // "1 Joe Burrow QB CIN 6 3" (no commas/tabs at all — often from copying a PDF or webpage table).
  // Papa.parse can't split that on its own, so pull it apart with the position/team anchors instead.
  if (looksLikePlainRankingLines(text)) {
    return parsePlainRankingLines(text);
  }

  // A whole ranked list written as one comma-separated line ("Justin Jefferson, Ja'Marr Chase, ...").
  // A generic CSV parse would read those commas as columns of a single row instead of a list of players.
  if (looksLikeInlineNameList(text)) {
    return parseInlineNameList(text);
  }

  const result = Papa.parse<string[]>(text, {
    skipEmptyLines: true,
  });
  const rows = (result.data || []).map((row) => row.map((cell) => cellToString(cell)));
  const nonEmpty = rows.filter((r) => r.some((c) => c !== ''));

  // Papa found no real delimiter (every row is one giant cell) — last resort, try the flat-line
  // shape even if it didn't hit the normal confidence threshold, since there's nothing to lose.
  const columnCount = Math.max(0, ...nonEmpty.map((r) => r.length));
  if (columnCount <= 1) {
    const plain = parsePlainRankingLines(text);
    if (plain.rows.length > 1) return plain;
  }

  return { rows: expandMultilineCells(nonEmpty) };
}

async function parseCsvLike(file: File): Promise<ParsedSpreadsheet> {
  const text = await file.text();
  return parseDelimitedText(text);
}

async function parseWorkbook(file: File): Promise<ParsedSpreadsheet> {
  const buf = await file.arrayBuffer();
  const workbook = XLSX.read(buf, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];
  const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
  const rows = raw.map((row) => (row as unknown[]).map((cell) => cellToString(cell)));
  const nonEmpty = rows.filter((r) => r.some((c) => c !== ''));

  // If the ranks landed spread across real spreadsheet columns/rows (e.g. rank 1 next to rank 81),
  // flatten everything back to text and let the same tagged-entry parser pull it apart by rank.
  const flattened = nonEmpty.map((r) => r.join(' ')).join('\n');
  if (looksLikeTaggedRankingText(flattened)) {
    return parseTaggedRankingText(flattened);
  }

  const columnCount = Math.max(0, ...nonEmpty.map((r) => r.length));
  if (columnCount <= 1 && looksLikePlainRankingLines(flattened)) {
    return parsePlainRankingLines(flattened);
  }
  if (nonEmpty.length <= 3 && looksLikeInlineNameList(flattened)) {
    return parseInlineNameList(flattened);
  }

  return { rows: expandMultilineCells(nonEmpty) };
}

async function parsePdfFile(file: File): Promise<ParsedSpreadsheet> {
  const { extractPdfText } = await import('./parsePdf');
  const text = await extractPdfText(await file.arrayBuffer());
  if (!/[A-Za-z]/.test(text)) {
    throw new SpreadsheetParseError(
      "This PDF doesn't have selectable text (it may be a scan or image). Try a text-based PDF, or copy the list and use \"Paste a list\" instead."
    );
  }
  return parseDelimitedText(text);
}

/** Parses an uploaded rankings file (.csv, .tsv, .xlsx, .xls, .pdf) into raw string rows. */
export async function parseSpreadsheetFile(file: File): Promise<ParsedSpreadsheet> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    return parseWorkbook(file);
  }
  if (name.endsWith('.pdf') || file.type === 'application/pdf') {
    return parsePdfFile(file);
  }
  return parseCsvLike(file);
}

/** Parses a pasted plain-text list (one player per line, optionally "1. Name" or "Name, POS, TEAM"). */
export function parsePastedRankingsText(text: string): ParsedSpreadsheet {
  return parseDelimitedText(text);
}

export const SPREADSHEET_IMPORT_ACCEPT = '.csv,.tsv,.xlsx,.xls,.pdf,text/csv,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
