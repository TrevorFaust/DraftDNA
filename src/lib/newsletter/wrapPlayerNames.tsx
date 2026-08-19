import { Fragment, isValidElement, type ReactElement, type ReactNode } from "react";
import { PlayerNameChip } from "@/components/news/PlayerNameChip";
import type { PlayerLookupEntry, PlayerPositionLookup } from "./playerRegistry";
import {
  inferRolesFromContext,
  looksLikePersonName,
  type InferredRoleMap,
} from "./nameRoleInference";
import { normalizePlayerKey, type FantasyPosition } from "./positions";
import { getTeamNameLexicon } from "./teams";

const SUFFIX_TOKENS = new Set(["jr", "sr", "ii", "iii", "iv", "v"]);
const TOKEN_RE = /^[A-Za-z][A-Za-z'’.-]*/;

/** "J.J." -> "j.j", "Smith." -> "smith" (strip trailing punctuation only). */
function tokenKey(token: string): string {
  return token.toLowerCase().replace(/[.'’-]+$/, "");
}

/** "Verse's" -> "Verse", "Verse." -> "Verse" (case preserved for surname matching). */
function bareToken(token: string): string {
  return token.replace(/['’]s$/, "").replace(/[.'’-]+$/, "");
}

export type ChipMatcher = {
  fullNameIndex: Map<string, PlayerLookupEntry[]>;
  surnames: Map<string, PlayerLookupEntry>;
  /** Unambiguous first names for players mentioned in this section (e.g. Tua). */
  firstNames: Map<string, PlayerLookupEntry>;
  byNormalized: Map<string, PlayerLookupEntry>;
  inferredRoles: InferredRoleMap;
  /** First resolved role for a key wins for the whole section. */
  lockedRoles: Map<string, FantasyPosition>;
};

/** Tracks players already chipped within one paragraph/list-item render. */
export type ChipSession = { seen: Set<string> };

export function createChipSession(): ChipSession {
  return { seen: new Set() };
}

function buildFullNameIndex(
  lookup: PlayerPositionLookup
): Map<string, PlayerLookupEntry[]> {
  const index = new Map<string, PlayerLookupEntry[]>();
  for (const entry of lookup.byLength) {
    const first = entry.displayName.split(/\s+/)[0];
    if (!first) continue;
    const key = tokenKey(first);
    const bucket = index.get(key);
    if (bucket) bucket.push(entry);
    else index.set(key, [entry]);
  }
  for (const bucket of index.values()) {
    bucket.sort((a, b) => b.displayName.length - a.displayName.length);
  }
  return index;
}

function surnameOf(entry: PlayerLookupEntry): string | null {
  const tokens = entry.displayName.split(/\s+/);
  while (
    tokens.length &&
    SUFFIX_TOKENS.has(tokens[tokens.length - 1].toLowerCase().replace(/\.+$/, ""))
  ) {
    tokens.pop();
  }
  if (tokens.length < 2) return null;
  return tokens[tokens.length - 1];
}

function firstNameOf(entry: PlayerLookupEntry): string | null {
  const first = entry.displayName.split(/\s+/)[0];
  return first || null;
}

function isWordStart(text: string, i: number): boolean {
  return i === 0 || !/[A-Za-z0-9]/.test(text[i - 1]);
}

function hasBoundaryAfter(text: string, end: number): boolean {
  const next = text[end];
  return !next || !/[A-Za-z0-9]/.test(next);
}

/** "the Washington", "against Houston", "vs. Dallas" — city token is the franchise, not a player. */
const TEAM_CUE_BEFORE_RE =
  /(?:^|[^A-Za-z0-9])(?:the|against|vs\.?|versus|hosted|hosting|visits|visiting|host|visit)\s+$/i;

function nextBareTokenAfter(text: string, end: number): string | null {
  const rest = text.slice(end);
  const space = /^\s+/.exec(rest)?.[0] ?? "";
  const token = TOKEN_RE.exec(rest.slice(space.length))?.[0];
  return token ? bareToken(token) : null;
}

/**
 * Length of an NFL franchise phrase at i, or 0.
 * Prevents "Washington Commanders" from chipping as Malik Washington.
 */
function teamNameLengthAt(text: string, i: number): number {
  const lexicon = getTeamNameLexicon();
  const lower = text.slice(i).toLowerCase();

  for (const name of lexicon.fullNames) {
    if (
      lower.startsWith(name.toLowerCase()) &&
      hasBoundaryAfter(text, i + name.length)
    ) {
      return name.length;
    }
  }

  for (const city of lexicon.cities) {
    if (!lower.startsWith(city) || !hasBoundaryAfter(text, i + city.length)) {
      continue;
    }
    if (TEAM_CUE_BEFORE_RE.test(text.slice(0, i))) {
      return city.length;
    }
  }

  const token = TOKEN_RE.exec(text.slice(i))?.[0];
  if (!token) return 0;
  const bare = bareToken(token);
  if (
    lexicon.nicknames.has(bare.toLowerCase()) &&
    hasBoundaryAfter(text, i + bare.length)
  ) {
    return bare.length;
  }
  return 0;
}

/** "Malik Washington Commanders" — player last name glued onto the franchise. */
function isFranchiseMash(
  text: string,
  i: number,
  entry: PlayerLookupEntry,
  nameLen: number
): boolean {
  const surname = surnameOf(entry);
  if (!surname) return false;
  const lexicon = getTeamNameLexicon();
  if (!lexicon.cities.includes(surname.toLowerCase())) return false;
  const next = nextBareTokenAfter(text, i + nameLen);
  if (!next) return false;
  const candidate = `${surname} ${next}`.toLowerCase();
  return lexicon.fullNames.some((n) => n.toLowerCase() === candidate);
}

function matchFullNameAt(
  text: string,
  i: number,
  index: Map<string, PlayerLookupEntry[]>
): { entry: PlayerLookupEntry; len: number } | null {
  const slice = text.slice(i);
  const token = TOKEN_RE.exec(slice)?.[0];
  if (!token) return null;
  const bucket = index.get(tokenKey(token));
  if (!bucket) return null;
  const lower = slice.toLowerCase();
  for (const entry of bucket) {
    const name = entry.displayName;
    if (lower.startsWith(name.toLowerCase()) && hasBoundaryAfter(text, i + name.length)) {
      return { entry, len: name.length };
    }
  }
  return null;
}

function collectMentionedEntries(
  text: string,
  index: Map<string, PlayerLookupEntry[]>
): PlayerLookupEntry[] {
  const found = new Map<string, PlayerLookupEntry>();
  let i = 0;
  while (i < text.length) {
    if (isWordStart(text, i)) {
      const teamLen = teamNameLengthAt(text, i);
      if (teamLen) {
        i += teamLen;
        continue;
      }
      const hit = matchFullNameAt(text, i, index);
      if (hit) {
        found.set(hit.entry.normalized, hit.entry);
        i += hit.len;
        continue;
      }
      const token = TOKEN_RE.exec(text.slice(i))?.[0];
      i += token ? token.length : 1;
      continue;
    }
    i++;
  }
  return [...found.values()];
}

/**
 * Build a matcher for one section. contextText should be the concatenated
 * markdown of the whole team section so a bare "Verse" / "Tua" can resolve.
 */
export function buildChipMatcher(
  lookup: PlayerPositionLookup,
  contextText: string
): ChipMatcher {
  const fullNameIndex = buildFullNameIndex(lookup);
  const surnames = new Map<string, PlayerLookupEntry>();
  const firstNames = new Map<string, PlayerLookupEntry>();
  const ambiguousSurname = new Set<string>();
  const ambiguousFirst = new Set<string>();
  const mentioned = collectMentionedEntries(contextText, fullNameIndex);

  for (const entry of mentioned) {
    const surname = surnameOf(entry);
    if (surname && !ambiguousSurname.has(surname)) {
      const existing = surnames.get(surname);
      if (existing && existing.normalized !== entry.normalized) {
        surnames.delete(surname);
        ambiguousSurname.add(surname);
      } else {
        surnames.set(surname, entry);
      }
    }
    const first = firstNameOf(entry);
    if (first && !ambiguousFirst.has(first)) {
      const existing = firstNames.get(first);
      if (existing && existing.normalized !== entry.normalized) {
        firstNames.delete(first);
        ambiguousFirst.add(first);
      } else {
        firstNames.set(first, entry);
      }
    }
  }

  const inferredRoles = inferRolesFromContext(contextText);
  const lockedRoles = new Map<string, FantasyPosition>();
  // Registry/DB position always wins. Prefill from every mentioned roster/coach
  // hit so a later weak inference cue cannot flip the badge. Inference only
  // fills names the registry does not know (and uses highest-confidence cue).
  for (const entry of mentioned) {
    lockedRoles.set(entry.normalized, entry.position);
  }
  for (const [key, role] of inferredRoles) {
    if (!lockedRoles.has(key)) lockedRoles.set(key, role);
  }

  return {
    fullNameIndex,
    surnames,
    firstNames,
    byNormalized: lookup.byNormalized,
    inferredRoles,
    lockedRoles,
  };
}

function matchAt(
  text: string,
  i: number,
  matcher: ChipMatcher
): { entry: PlayerLookupEntry; len: number; display: string } | null {
  if (teamNameLengthAt(text, i) > 0) return null;

  const full = matchFullNameAt(text, i, matcher.fullNameIndex);
  if (full) {
    if (isFranchiseMash(text, i, full.entry, full.len)) return null;
    return { entry: full.entry, len: full.len, display: text.slice(i, i + full.len) };
  }
  const token = TOKEN_RE.exec(text.slice(i))?.[0];
  if (!token) return null;
  const bare = bareToken(token);
  const bySurname = matcher.surnames.get(bare);
  if (bySurname && hasBoundaryAfter(text, i + bare.length)) {
    return { entry: bySurname, len: bare.length, display: bySurname.displayName };
  }
  const byFirst = matcher.firstNames.get(bare);
  if (byFirst && hasBoundaryAfter(text, i + bare.length)) {
    return { entry: byFirst, len: bare.length, display: byFirst.displayName };
  }
  return null;
}

function lockRole(
  matcher: ChipMatcher,
  key: string,
  role: FantasyPosition
): FantasyPosition {
  // Never overwrite: first lock is registry (preferred) or best inference.
  const existing = matcher.lockedRoles.get(key);
  if (existing) return existing;
  // Prefer full registry entry when available even if caller passed inference.
  const registry = matcher.byNormalized.get(key);
  const finalRole = registry?.position ?? role;
  matcher.lockedRoles.set(key, finalRole);
  return finalRole;
}

const SUPER_DIGITS = "⁰¹²³⁴⁵⁶⁷⁸⁹";
const CITATION_TRAIL_RE = new RegExp(`^[.'’]*[${SUPER_DIGITS}]+`);

function splitCitationTrail(text: string): { taken: string; rest: string } | null {
  const m = CITATION_TRAIL_RE.exec(text);
  if (!m) return null;
  return { taken: m[0], rest: text.slice(m[0].length) };
}

function NameRun({ children }: { children: ReactNode }) {
  return <span className="news-name-run">{children}</span>;
}

function isNameChip(node: ReactNode): boolean {
  return isValidElement(node) && node.type === PlayerNameChip;
}

export function wrapTextWithPlayerChips(
  text: string,
  matcher: ChipMatcher,
  session: ChipSession
): ReactNode {
  if (!text || matcher.fullNameIndex.size === 0) return text;

  const nodes: ReactNode[] = [];
  let plainStart = 0;
  let i = 0;
  let key = 0;

  const flushPlain = (end: number) => {
    if (end > plainStart) {
      nodes.push(<Fragment key={`t-${key++}`}>{text.slice(plainStart, end)}</Fragment>);
    }
  };

  while (i < text.length) {
    if (isWordStart(text, i)) {
      const teamLen = teamNameLengthAt(text, i);
      if (teamLen) {
        i += teamLen;
        continue;
      }
      const hit = matchAt(text, i, matcher);
      if (hit) {
        if (!session.seen.has(hit.entry.normalized)) {
          session.seen.add(hit.entry.normalized);
          flushPlain(i);
          const position = lockRole(
            matcher,
            hit.entry.normalized,
            hit.entry.position
          );
          const trail = splitCitationTrail(text.slice(i + hit.len));
          const chip = (
            <PlayerNameChip
              key={`p-${key++}`}
              name={hit.display}
              position={position}
            />
          );
          nodes.push(
            trail ? (
              <NameRun key={`r-${key++}`}>
                {chip}
                {trail.taken}
              </NameRun>
            ) : (
              chip
            )
          );
          i += hit.len + (trail?.taken.length ?? 0);
          plainStart = i;
          continue;
        }
        i += hit.len;
        continue;
      }
      const token = TOKEN_RE.exec(text.slice(i))?.[0];
      i += token ? token.length : 1;
      continue;
    }
    i++;
  }
  flushPlain(text.length);

  return nodes.length === 1 ? nodes[0] : <>{nodes}</>;
}

export function extractTextContent(children: ReactNode): string {
  if (typeof children === "string") return children;
  if (typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(extractTextContent).join("");
  if (children && typeof children === "object" && "props" in children) {
    const props = (children as { props?: { children?: ReactNode } }).props;
    return extractTextContent(props?.children ?? "");
  }
  return "";
}

function resolveExactName(text: string, matcher: ChipMatcher): PlayerLookupEntry | null {
  const direct = matcher.byNormalized.get(normalizePlayerKey(text));
  if (direct) return direct;
  if (!/\s/.test(text)) {
    const bare = bareToken(text);
    return matcher.surnames.get(bare) ?? matcher.firstNames.get(bare) ?? null;
  }
  return null;
}

function resolveStrongRole(
  text: string,
  matcher: ChipMatcher
): { name: string; position: FantasyPosition; key: string } | null {
  if (!looksLikePersonName(text)) return null;

  const entry = resolveExactName(text, matcher);
  if (entry) {
    const position = lockRole(matcher, entry.normalized, entry.position);
    return { name: text, position, key: entry.normalized };
  }

  const norm = normalizePlayerKey(text);
  const locked = matcher.lockedRoles.get(norm);
  if (locked) return { name: text, position: locked, key: norm };

  const inferred = matcher.inferredRoles.get(norm);
  if (inferred) {
    const position = lockRole(matcher, norm, inferred);
    return { name: text, position, key: norm };
  }

  return null;
}

function renderStrong(
  el: ReactElement,
  matcher: ChipMatcher,
  session: ChipSession
): ReactNode {
  const raw = extractTextContent((el.props as { children?: ReactNode }).children);
  const text = raw.trim();
  const resolved = text ? resolveStrongRole(text, matcher) : null;
  if (!resolved) return el;

  if (session.seen.has(resolved.key)) {
    return raw;
  }
  session.seen.add(resolved.key);

  const registry = resolveExactName(text, matcher);
  const isBareSurname =
    !!registry && normalizePlayerKey(text) !== registry.normalized;
  return (
    <NameRun>
      <PlayerNameChip
        name={isBareSurname ? registry!.displayName : resolved.name}
        position={resolved.position}
      />
    </NameRun>
  );
}

export function renderChildrenWithPlayerChips(
  children: ReactNode,
  matcher: ChipMatcher,
  session: ChipSession
): ReactNode {
  if (typeof children === "string") {
    return wrapTextWithPlayerChips(children, matcher, session);
  }
  if (Array.isArray(children)) {
    const out: ReactNode[] = [];
    for (let idx = 0; idx < children.length; idx++) {
      const rendered = renderChildrenWithPlayerChips(children[idx], matcher, session);
      const next = children[idx + 1];
      const trail = typeof next === "string" ? splitCitationTrail(next) : null;
      if ((isNameChip(rendered) || (isValidElement(rendered) && rendered.type === NameRun)) && trail) {
        const inner = isValidElement(rendered) && rendered.type === NameRun
          ? (rendered.props as { children?: ReactNode }).children
          : rendered;
        out.push(
          <NameRun key={idx}>
            {inner}
            {trail.taken}
          </NameRun>
        );
        if (trail.rest) {
          out.push(
            <Fragment key={`${idx}-rest`}>
              {wrapTextWithPlayerChips(trail.rest, matcher, session)}
            </Fragment>
          );
        }
        idx += 1;
        continue;
      }
      out.push(<Fragment key={idx}>{rendered}</Fragment>);
    }
    return out;
  }
  if (isValidElement(children) && children.type === "strong") {
    return renderStrong(children, matcher, session);
  }
  return children;
}
