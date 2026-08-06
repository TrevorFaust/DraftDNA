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

export interface KeeperDiscountBits {
  name: string;
  pos: string;
  round: number;
  marketRound: number;
  discountPhrase: string;
}

export interface KeeperDraftContext {
  keepers: KeeperPickInfo[];
  /** ADP talent in rounds 1–5, kept in rounds 6–10. */
  discountKeepers: KeeperPickInfo[];
  hasEliteWrKeeper: boolean;
  hasEliteRbKeeper: boolean;
  /** Standalone keeper beat (placement varies in the writeup). */
  rosterNote: string | null;
  /** Strategy beat when early picks lean into a known keeper. */
  strategyNote: string | null;
  /** Structured bits for weaving keeper talk into WR/RB/core sentences. */
  primaryDiscount: KeeperDiscountBits | null;
}

function formatNames(names: string[]): string {
  const unique = [...new Set(names.filter(Boolean))];
  if (unique.length === 0) return '';
  if (unique.length === 1) return unique[0];
  if (unique.length === 2) return `${unique[0]} and ${unique[1]}`;
  return `${unique[0]}, ${unique[1]}, and ${unique.length - 2} more`;
}

function narrativeSalt(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return h;
}

function discountPhraseFor(marketRound: number): string {
  if (marketRound <= 2) return 'a huge discount';
  if (marketRound <= 3) return 'a real discount';
  return 'solid value for what you paid';
}

function posLabel(pos: string): string {
  const p = pos.trim().toUpperCase();
  if (p === 'WR') return 'receiver';
  if (p === 'RB') return 'running back';
  if (p === 'QB') return 'quarterback';
  if (p === 'TE') return 'tight end';
  return 'keeper';
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

function buildRosterNoteVariants(bits: KeeperDiscountBits): string[] {
  const who = bits.name;
  const r = bits.round;
  const d = bits.discountPhrase;
  const role = posLabel(bits.pos);
  return [
    `${who} was your keeper, and getting him back in round ${r} is ${d}.`,
    `Keeping ${who} into round ${r} handed you ${d} at ${role}.`,
    `You had ${who} locked as a keeper in round ${r}, ${d} against his usual ADP.`,
    `Round ${r} brought ${who} back as your keeper, ${d} for that kind of talent.`,
    `${who} returning as a round-${r} keeper is ${d}, and the board around him shows it.`,
  ];
}

function buildMultiKeeperNote(names: string[]): string {
  const who = formatNames(names);
  return `${who} were your keepers, and landing that kind of talent in the middle rounds is a nice head start.`;
}

function buildStrategyNoteVariants(
  bits: KeeperDiscountBits,
  lean: 'rb' | 'wr',
  salt: number
): string {
  const who = bits.name;
  const d = bits.discountPhrase;
  const r = bits.round;
  if (lean === 'rb') {
    const opts = [
      `Leaning on running backs early makes sense when you already know ${who} is coming back later.`,
      `With ${who} locked in as a round-${r} keeper (${d}), going RB-heavy early fits the plan.`,
      `You could hammer the backfield early because ${who} was already coming back later as your keeper.`,
    ];
    return opts[salt % opts.length]!;
  }
  const opts = [
    `Loading wideouts early makes sense when you already know ${who} is coming back later.`,
    `With ${who} locked in as a round-${r} keeper (${d}), stacking receivers early fits the plan.`,
    `You could load receivers early because ${who} was already coming back later as your keeper.`,
  ];
  return opts[salt % opts.length]!;
}

/**
 * Fold a keeper mention into an existing core/WR/RB sentence when it fits.
 * Returns null if weaving would read awkwardly.
 */
export function weaveKeeperIntoSegment(
  segment: string,
  bits: KeeperDiscountBits,
  salt: number
): string | null {
  const lower = segment.toLowerCase();
  if (lower.includes('keeper') || lower.includes(bits.name.toLowerCase())) {
    return null;
  }

  const pos = bits.pos.toUpperCase();
  const mentionsWr =
    lower.includes('wideout') ||
    lower.includes('receiver') ||
    lower.includes(' wr') ||
    /\bwr\b/.test(lower);
  const mentionsRb =
    lower.includes('running back') ||
    lower.includes('backfield') ||
    lower.includes(' rb') ||
    /\brb\b/.test(lower);
  const mentionsCore = lower.includes('built your core') || lower.includes('core around');

  const clauseOpts = [
    `with ${bits.name} locked in as your round-${bits.round} keeper for ${bits.discountPhrase}`,
    `knowing ${bits.name} was already coming back in round ${bits.round} as a keeper`,
    `and ${bits.name} returning as a round-${bits.round} keeper gave you ${bits.discountPhrase}`,
  ];
  const clause = clauseOpts[salt % clauseOpts.length]!;

  if (pos === 'WR' && (mentionsWr || mentionsCore)) {
    return segment.replace(/\.\s*$/, '') + `, ${clause}.`;
  }
  if (pos === 'RB' && (mentionsRb || mentionsCore)) {
    return segment.replace(/\.\s*$/, '') + `, ${clause}.`;
  }
  if (pos === 'QB' && (lower.includes('quarterback') || lower.includes(' qb') || mentionsCore)) {
    return segment.replace(/\.\s*$/, '') + `, ${clause}.`;
  }
  if (pos === 'TE' && (lower.includes('tight end') || lower.includes(' te') || mentionsCore)) {
    return segment.replace(/\.\s*$/, '') + `, ${clause}.`;
  }
  // Generic core weave for any elite keeper when the opener is the core sentence.
  if (mentionsCore && salt % 2 === 0) {
    return segment.replace(/\.\s*$/, '') + `, ${clause}.`;
  }
  return null;
}

/**
 * Insert keeper talk into narrative segments without always leading with it.
 * Prefers weaving into a fitting beat; otherwise slots mid-paragraph.
 */
export function placeKeeperNoteInSegments(
  segments: string[],
  opts: {
    rosterNote: string | null;
    strategyNote: string | null;
    primaryDiscount: KeeperDiscountBits | null;
  }
): string[] {
  const out = [...segments];
  const bits = opts.primaryDiscount;
  const rosterNote = opts.rosterNote?.trim() || null;
  if (!rosterNote && !bits) return out;

  const keeperName = bits?.name?.toLowerCase() ?? '';
  const alreadyMentioned = out.some((s) => {
    const l = s.toLowerCase();
    return (
      l.includes('keeper') ||
      (keeperName.length > 0 && l.includes(keeperName)) ||
      (opts.strategyNote != null && s.includes(opts.strategyNote.trim()))
    );
  });
  // Strategy beat already covers the keeper plan — don't pile on the same lead-in.
  if (alreadyMentioned) return out;

  const salt = narrativeSalt(
    `${bits?.name ?? rosterNote ?? ''}|${bits?.round ?? ''}|${out[0] ?? ''}`
  );

  if (bits) {
    for (let i = 0; i < out.length; i++) {
      // Prefer weaving into opener / balance / WR-RB talk, not the grade verdict.
      if (i === out.length - 1 && out.length > 1) continue;
      const woven = weaveKeeperIntoSegment(out[i]!, bits, salt + i);
      if (woven) {
        out[i] = woven;
        return out;
      }
    }
  }

  if (!rosterNote) return out;

  // Slot after the opener most of the time; occasionally later so it doesn't feel stuck.
  if (out.length === 0) {
    out.push(rosterNote);
    return out;
  }
  const slot = out.length === 1 ? 1 : 1 + (salt % Math.min(2, out.length));
  out.splice(Math.min(slot, out.length), 0, rosterNote);
  return out;
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

  const primary =
    discountKeepers.find((k) => k.pos === 'WR') ??
    discountKeepers.find((k) => k.pos === 'RB') ??
    discountKeepers[0] ??
    null;

  const primaryDiscount: KeeperDiscountBits | null =
    primary && primary.name
      ? {
          name: primary.name,
          pos: primary.pos,
          round: primary.round_number,
          marketRound: primary.marketRound,
          discountPhrase: discountPhraseFor(primary.marketRound),
        }
      : null;

  const salt = narrativeSalt(
    `${primaryDiscount?.name ?? keepers[0]?.name ?? 'k'}|${primaryDiscount?.round ?? 0}|${numTeams}`
  );

  let rosterNote: string | null = null;
  if (discountKeepers.length === 1 && primaryDiscount) {
    const variants = buildRosterNoteVariants(primaryDiscount);
    rosterNote = variants[salt % variants.length]!;
  } else if (discountKeepers.length >= 2) {
    rosterNote = buildMultiKeeperNote(discountKeepers.map((k) => k.name ?? 'keeper'));
  } else if (keepers.length === 1 && keepers[0]!.name) {
    rosterNote = `${keepers[0]!.name} was your keeper in round ${keepers[0]!.round_number}.`;
  }

  const drafted = picks.filter((p) => !p.is_keeper);
  const earlyRb = drafted.filter((p) => p.pos === 'RB' && p.round_number <= 5).length;
  const earlyWr = drafted.filter((p) => p.pos === 'WR' && p.round_number <= 5).length;

  let strategyNote: string | null = null;
  if (hasEliteWrKeeper && earlyRb >= 2 && earlyWr <= 2 && primaryDiscount) {
    strategyNote = buildStrategyNoteVariants(primaryDiscount, 'rb', salt);
  } else if (hasEliteRbKeeper && earlyWr >= 2 && earlyRb <= 2 && primaryDiscount) {
    strategyNote = buildStrategyNoteVariants(primaryDiscount, 'wr', salt);
  }

  return {
    keepers,
    discountKeepers,
    hasEliteWrKeeper,
    hasEliteRbKeeper,
    rosterNote,
    strategyNote,
    primaryDiscount,
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
