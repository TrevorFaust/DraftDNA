export const ADP_SOURCE_LABELS: Record<string, string> = {
  community: 'Consensus',
  consensus: 'Consensus',
  yours: 'Your rankings',
  mine: 'Your rankings',
  espn: 'ESPN',
  cbs: 'CBS',
  yahoo: 'Yahoo',
  sleeper: 'Sleeper',
  fantasypros: 'FantasyPros',
  pff: 'PFF',
  underdog: 'Underdog',
  rtsports: 'RTSports',
  fantrax: 'Fantrax',
  draftsharks: 'DraftSharks',
  nfl: 'NFL',
};

export const ADP_SOURCE_ORDER = [
  'espn',
  'cbs',
  'yahoo',
  'sleeper',
  'fantasypros',
  'pff',
  'underdog',
  'rtsports',
  'fantrax',
  'draftsharks',
  'nfl',
] as const;

export type AdpSourceId = (typeof ADP_SOURCE_ORDER)[number];
export type RankingsBoardId = 'community' | 'consensus' | 'mine' | 'yours' | AdpSourceId;

/** Mock / lobby pickers: Consensus + the three named site boards. */
export const DRAFT_AGAINST_BOARD_IDS = ['consensus', 'espn', 'yahoo', 'sleeper'] as const;
export type DraftAgainstBoardId = (typeof DRAFT_AGAINST_BOARD_IDS)[number];
export type YourBoardId = 'yours' | DraftAgainstBoardId;

export function boardSourceLabel(id: string | null | undefined): string {
  if (!id) return 'Consensus';
  return ADP_SOURCE_LABELS[id] ?? id;
}

export function normalizeDraftAgainstId(id: string | null | undefined): string {
  if (!id || id === 'community') return 'consensus';
  return id;
}

export function normalizeYourBoardId(id: string | null | undefined): string {
  if (!id || id === 'mine') return 'yours';
  if (id === 'community') return 'consensus';
  return id;
}

const mpYourBoardKey = (draftId: string) => `mp_your_board_${draftId}`;

/** Per-player viewing board for a multiplayer room (local to this browser). */
export function readMpYourBoardSource(draftId: string | null | undefined): string {
  if (!draftId || typeof window === 'undefined') return 'yours';
  try {
    return normalizeYourBoardId(localStorage.getItem(mpYourBoardKey(draftId)));
  } catch {
    return 'yours';
  }
}

export function writeMpYourBoardSource(draftId: string, source: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(mpYourBoardKey(draftId), normalizeYourBoardId(source));
  } catch {
    /* quota / private mode */
  }
}

/** Consensus is always listed. ESPN / Yahoo / Sleeper only if this bucket has that column. */
export function draftAgainstOptions(availableSources: string[]): DraftAgainstBoardId[] {
  const have = new Set(availableSources);
  return DRAFT_AGAINST_BOARD_IDS.filter((id) => id === 'consensus' || have.has(id));
}

/** Import templates: Consensus plus every site column in the bucket. */
export function importBoardOptions(availableSources: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = ['consensus'];
  seen.add('consensus');
  for (const src of availableSources) {
    if (seen.has(src)) continue;
    seen.add(src);
    out.push(src);
  }
  return out;
}

export function yourBoardOptions(availableSources: string[]): YourBoardId[] {
  return ['yours', ...draftAgainstOptions(availableSources)];
}

export type AdpBucketKey =
  | 'ppr_season_1qb'
  | 'half_ppr_season_1qb'
  | 'standard_season_1qb'
  | 'ppr_season_superflex'
  | 'half_ppr_season_superflex'
  | 'standard_season_superflex'
  | 'ppr_dynasty_1qb'
  | 'half_ppr_dynasty_1qb'
  | 'standard_dynasty_1qb'
  | 'ppr_dynasty_superflex'
  | 'half_ppr_dynasty_superflex'
  | 'standard_dynasty_superflex'
  | 'ppr_dynasty_1qb_rookies'
  | 'ppr_dynasty_superflex_rookies';

export function adpBucketKey(opts: {
  scoringFormat: string;
  leagueType: string;
  isSuperflex: boolean;
  rookiesOnly?: boolean;
}): AdpBucketKey {
  const scoring = opts.scoringFormat === 'half_ppr' || opts.scoringFormat === 'standard' ? opts.scoringFormat : 'ppr';
  const league = opts.leagueType === 'dynasty' ? 'dynasty' : 'season';
  const flex = opts.isSuperflex ? 'superflex' : '1qb';
  if (opts.rookiesOnly && league === 'dynasty') {
    return `ppr_dynasty_${flex}_rookies` as AdpBucketKey;
  }
  return `${scoring}_${league}_${flex}` as AdpBucketKey;
}

export type AdpSourceBoardFile = {
  title: string;
  sources: string[];
  community: Array<{ id: string; adp: number }>;
  boards: Record<string, Array<{ id: string; adp: number }>>;
};
