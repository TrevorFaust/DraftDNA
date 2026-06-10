/** Normalize display names for matching depth chart rows to `players`. */
export function normPlayerName(v: string): string {
  return v
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/['`]/g, "'")
    .replace(/\./g, '')
    .toLowerCase();
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
