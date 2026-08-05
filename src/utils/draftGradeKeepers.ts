/**
 * Keeper context for draft grades: discounted elites (R1–5 talent kept R6–10)
 * change early-run strategy and writeups — they are not late-round "finds."
 */

export interface KeeperPickInfo {
  name: string | null;
  pos: string;
  round_number: number;
  adp: number;
  /** Approximate ADP round (ceil(adp / numTeams)). */
  marketRound: number;
}

export interface KeeperDraftContext {
  keepers: KeeperPickInfo[];
  /** ADP talent in rounds 1–5, kept in rounds 6–10. */
  discountKeepers: KeeperPickInfo[];
  hasEliteWrKeeper: boolean;
  hasEliteRbKeeper: boolean;
  /** Short writeup beat about keepers on the roster. */
  rosterNote: string | null;
  /** Strategy beat when early picks lean into a known keeper. */
  strategyNote: string | null;
}

function formatNames(names: string[]): string {
  const unique = [...new Set(names.filter(Boolean))];
  if (unique.length === 0) return '';
  if (unique.length === 1) return unique[0];
  if (unique.length === 2) return `${unique[0]} and ${unique[1]}`;
  return `${unique[0]}, ${unique[1]}, and ${unique.length - 2} more`;
}

/** True elite / early-round talent kept at a clear discount (through round 10). */
export function isDiscountEliteKeeper(
  round_number: number,
  adp: number,
  numTeams: number
): boolean {
  if (round_number < 6 || round_number > 10) return false;
  const marketRound = Math.max(1, Math.ceil(adp / numTeams));
  return marketRound <= 5 && adp <= numTeams * 5 + 2;
}

export function analyzeKeeperDraftContext(
  picks: { name: string | null; pos: string; round_number: number; adp: number; is_keeper?: boolean }[],
  numTeams: number
): KeeperDraftContext {
  const keepers: KeeperPickInfo[] = picks
    .filter((p) => p.is_keeper)
    .map((p) => ({
      name: p.name,
      pos: p.pos,
      round_number: p.round_number,
      adp: p.adp,
      marketRound: Math.max(1, Math.ceil(p.adp / Math.max(numTeams, 1))),
    }));

  const discountKeepers = keepers.filter((k) =>
    isDiscountEliteKeeper(k.round_number, k.adp, numTeams)
  );

  const hasEliteWrKeeper = discountKeepers.some((k) => k.pos === 'WR');
  const hasEliteRbKeeper = discountKeepers.some((k) => k.pos === 'RB');

  let rosterNote: string | null = null;
  if (discountKeepers.length === 1) {
    const k = discountKeepers[0];
    const who = k.name ?? 'Your keeper';
    const discount =
      k.marketRound <= 2
        ? 'a huge discount'
        : k.marketRound <= 3
          ? 'a real discount'
          : 'solid value for what you paid';
    rosterNote = `${who} was your keeper, and getting him back in round ${k.round_number} is ${discount}.`;
  } else if (discountKeepers.length >= 2) {
    const who = formatNames(discountKeepers.map((k) => k.name ?? 'keeper'));
    rosterNote = `${who} were your keepers, and landing that kind of talent in the middle rounds is a nice head start.`;
  } else if (keepers.length === 1 && keepers[0].name) {
    rosterNote = `${keepers[0].name} was your keeper in round ${keepers[0].round_number}.`;
  }

  const drafted = picks.filter((p) => !p.is_keeper);
  const earlyRb = drafted.filter((p) => p.pos === 'RB' && p.round_number <= 5).length;
  const earlyWr = drafted.filter((p) => p.pos === 'WR' && p.round_number <= 5).length;

  let strategyNote: string | null = null;
  if (hasEliteWrKeeper && earlyRb >= 2 && earlyWr <= 2) {
    const wr = discountKeepers.find((k) => k.pos === 'WR');
    const who = wr?.name ?? 'your WR keeper';
    strategyNote = `Leaning on running backs early makes sense when you already know ${who} is coming back later.`;
  } else if (hasEliteRbKeeper && earlyWr >= 2 && earlyRb <= 2) {
    const rb = discountKeepers.find((k) => k.pos === 'RB');
    const who = rb?.name ?? 'your RB keeper';
    strategyNote = `Loading wideouts early makes sense when you already know ${who} is coming back later.`;
  }

  return {
    keepers,
    discountKeepers,
    hasEliteWrKeeper,
    hasEliteRbKeeper,
    rosterNote,
    strategyNote,
  };
}

/**
 * For balance / synergy: an elite discount keeper fills that position early
 * (you plan around them), so late first drafted WR/RB is not a hole.
 */
export function effectiveFirstRoundWithKeeper(
  firstDraftedRound: number | null,
  hasEliteKeeperAtPos: boolean
): number | null {
  if (hasEliteKeeperAtPos) return 1;
  return firstDraftedRound;
}
