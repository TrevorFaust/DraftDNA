/**
 * buildDraftConfig — Tab 7 JS Config Reference implementation.
 * Total rounds = 8 base starters + flex + bench. Phases and windows scale with roster.
 * Value override threshold from Tab 5 (scarcity by league size).
 */

/** Round at given percentage of total rounds. direction: ceil | floor | round */
export function pctToRound(
  pct: number,
  totalRounds: number,
  direction: 'ceil' | 'floor' | 'round' = 'round'
): number {
  const raw = pct * totalRounds;
  if (direction === 'ceil') return Math.min(Math.max(1, Math.ceil(raw)), totalRounds);
  if (direction === 'floor') return Math.min(Math.max(1, Math.floor(raw)), totalRounds);
  return Math.min(Math.max(1, Math.round(raw)), totalRounds);
}

/** Total rounds = 8 base (QB+2RB+2WR+TE+DST+K) + flex slots + bench size. Max: 8+6+15=29 */
export function getTotalRounds(flexSlots: number, benchSize: number): number {
  return 8 + flexSlots + benchSize;
}

/** Value override threshold: rounds of ADP value above archetype preference to override. Tab 5. */
export function getValueOverrideThreshold(leagueSize: number): number {
  if (leagueSize <= 6) return 2.0;
  if (leagueSize <= 10) return 1.8;
  if (leagueSize <= 14) return 1.5;
  if (leagueSize <= 18) return 1.3;
  if (leagueSize <= 24) return 1.2;
  return 1.0;
}

export interface DraftConfig {
  totalRounds: number;
  leagueSize: number;
  valueOverrideThreshold: number;
  driftStartRound: number;
  phases: {
    earlyEnd: number;
    midEnd: number;
  };
  windows: {
    rb: { zeroRB_avoidBefore: number; robustRB_end: number; robustRB_totalByRnd: number };
    wr: { robustWR_start: number; robustWR_end: number; wrMid_start: number; wrMid_end: number; wrLate_avoidBefore: number };
    qb: { early_end: number; mid_start: number; mid_end: number; late_start: number; late_end: number; punt_start: number };
    te: { early_end: number; mid_start: number; mid_end: number; stream_start: number };
    late: { philosophy_start: number; vbd_start: number; vbd_end: number; handcuff_start: number };
  };
}

export function buildDraftConfig(flexSlots: number, benchSize: number, leagueSize: number): DraftConfig {
  const totalRounds = getTotalRounds(flexSlots, benchSize);
  const w = (pct: number, dir: 'ceil' | 'floor' | 'round' = 'ceil') => pctToRound(pct, totalRounds, dir);

  return {
    totalRounds,
    leagueSize,
    valueOverrideThreshold: getValueOverrideThreshold(leagueSize),
    driftStartRound: w(0.55),
    phases: {
      earlyEnd: w(0.27),
      midEnd: w(0.6),
    },
    windows: {
      rb: {
        zeroRB_avoidBefore: w(4 / 15),
        robustRB_end: w(3 / 15),
        robustRB_totalByRnd: w(0.4),
      },
      wr: {
        robustWR_start: w(1 / 15, 'floor'),
        robustWR_end: w(5 / 15),
        wrMid_start: w(2 / 15, 'floor'),
        wrMid_end: w(7 / 15),
        wrLate_avoidBefore: w(4 / 15),
      },
      qb: {
        early_end: w(3 / 15),
        mid_start: w(3 / 15, 'floor'),
        mid_end: w(8 / 15),
        late_start: w(8 / 15, 'floor'),
        late_end: w(12 / 15),
        punt_start: w(12 / 15, 'floor'),
      },
      te: {
        early_end: w(3 / 15),
        mid_start: w(3 / 15, 'floor'),
        mid_end: w(8 / 15),
        stream_start: w(8 / 15, 'floor'),
      },
      late: {
        philosophy_start: w(0.6, 'floor'),
        vbd_start: w(0.33, 'floor'),
        vbd_end: w(0.8),
        handcuff_start: w(0.47, 'floor'),
      },
    },
  };
}

export interface HardConstraints {
  dstEarliestRound: number;
  kickerOnlyRound: number;
  maxRosterByPos: Record<string, number>;
  mustHaveStarterBy: number;
}

export function getHardConstraints(config: DraftConfig): HardConstraints {
  return {
    dstEarliestRound: pctToRound(0.67, config.totalRounds),
    kickerOnlyRound: config.totalRounds,
    maxRosterByPos: { RB: 5, WR: 5, QB: 2, TE: 2, DST: 1, K: 1 },
    mustHaveStarterBy: pctToRound(0.67, config.totalRounds),
  };
}
