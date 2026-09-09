/** Normalize display names for matching depth chart rows to `players`. */
export function normPlayerName(v: string): string {
  return v
    .trim()
    .replace(/\s+/g, ' ')
    // Drop apostrophes so "Tre' Harris" and "Tre Harris" (and Ja'Marr / JaMarr) share a key.
    .replace(/[''`\u2018\u2019\u00B4]/g, '')
    .replace(/\./g, '')
    .toLowerCase();
}

/**
 * Aggressive search key: letters+digits only.
 * "T.J. Watt", "TJ Watt", "T J Watt" → "tjwatt"
 */
export function compactPlayerSearchKey(v: string): string {
  return (v || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Whether a player name/team matches a user query after ignoring punctuation/spacing.
 * Examples that match "T.J. Watt": "tj", "t.j", "t j", "tj watt", "t.j.watt"
 */
export function playerSearchMatches(haystack: string, query: string): boolean {
  const q = compactPlayerSearchKey(query);
  if (!q) return false;
  return compactPlayerSearchKey(haystack).includes(q);
}

/** Build PostgREST `ilike` variants so dotted initials still hit remote search. */
export function playerSearchIlikeVariants(query: string): string[] {
  const raw = query.trim().toLowerCase();
  if (!raw) return [];
  const out = new Set<string>();
  out.add(raw);
  const noPunct = raw.replace(/[.\s'_-]+/g, '');
  if (noPunct) out.add(noPunct);
  const spaced = raw.replace(/[.'-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (spaced) out.add(spaced);
  // Initials: tj -> t.j / t.j.
  if (/^[a-z]{2,4}$/i.test(noPunct)) {
    const dotted = noPunct.split('').join('.');
    out.add(dotted);
    out.add(`${dotted}.`);
    out.add(noPunct.split('').join(' '));
  }
  // Keep first token variants for "tj watt"
  const first = spaced.split(' ')[0] || '';
  const firstCompact = first.replace(/[^a-z0-9]/g, '');
  if (firstCompact && firstCompact !== noPunct && /^[a-z]{2,4}$/i.test(firstCompact)) {
    const dotted = firstCompact.split('').join('.');
    out.add(dotted);
    out.add(`${dotted}.`);
  }
  return [...out].filter(Boolean);
}

export function stripPlayerNameSuffix(v: string): string {
  let s = v.trim();
  const re = /\s+(?:jr|jr\.|sr|sr\.|ii|iii|iv|v|vi|vii)$/i;
  for (;;) {
    const n = s.replace(re, '').trim();
    if (n === s) break;
    s = n;
  }
  return s;
}

export function playerNameMatchKeys(v: string): string[] {
  const out = new Set<string>();
  const base = v.trim().replace(/\s+/g, ' ');
  if (!base) return [];
  out.add(normPlayerName(base));
  out.add(normPlayerName(stripPlayerNameSuffix(base)));
  out.add(normPlayerName(base.replace(/-/g, ' ')));
  out.add(normPlayerName(stripPlayerNameSuffix(base.replace(/-/g, ' '))));
  return [...out].filter(Boolean);
}
