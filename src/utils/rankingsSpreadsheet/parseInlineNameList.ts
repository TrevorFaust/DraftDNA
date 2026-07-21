import type { ParsedSpreadsheet } from './parseFile';

/** A plausible full name: letters/apostrophes/hyphens/periods, at least two words. */
const NAME_LIKE_RE = /^[A-Za-z][A-Za-z.'-]*(?:\s+[A-Za-z][A-Za-z.'-]*)+$/;

function splitOnComma(text: string): string[] {
  return text
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
}

/**
 * True for a single-line (or near single-line) "Name, Name, Name" paste — a ranked list written as one
 * comma-separated sentence rather than one player per line. Without this, a naive CSV parser reads the
 * commas as field separators and turns the whole list into columns of a single row instead of a list of
 * players in order.
 */
export function looksLikeInlineNameList(text: string): boolean {
  const lineCount = text
    .split(/\r\n|\r|\n/)
    .map((l) => l.trim())
    .filter(Boolean).length;
  if (lineCount === 0 || lineCount > 3) return false;

  const parts = splitOnComma(text);
  if (parts.length < 4) return false;

  const nameLike = parts.filter((p) => NAME_LIKE_RE.test(p));
  return nameLike.length >= Math.ceil(parts.length * 0.7);
}

/** Builds a one-column Name table, one row per comma-separated entry, in the order given. */
export function parseInlineNameList(text: string): ParsedSpreadsheet {
  const rows: string[][] = [['Name']];
  for (const part of splitOnComma(text)) rows.push([part]);
  return { rows };
}
