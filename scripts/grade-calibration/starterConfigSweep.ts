/**
 * Exhaustive sweep: every legal starter combo × every letter grade.
 *
 *   npx tsx scripts/grade-calibration/starterConfigSweep.ts
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import {
  computeDraftGrade,
  type DraftGradePick,
  type LetterGrade,
} from '../../src/utils/draftGrade.ts';
import {
  STARTER_MAX,
  STARTER_MIN,
  STARTER_POSITION_ORDER,
  countBaseStarters,
  type StarterCounts,
  type StarterPosition,
} from '../../src/utils/rosterSlots.ts';

const ALL_GRADES: LetterGrade[] = [
  'A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F+', 'F', 'F-',
];

const NUM_TEAMS = 12;
const FLEX = 1;
const BENCH = 5;

function range(min: number, max: number): number[] {
  const out: number[] = [];
  for (let i = min; i <= max; i++) out.push(i);
  return out;
}

function* allStarterConfigs(): Generator<StarterCounts> {
  for (const QB of range(STARTER_MIN.QB, STARTER_MAX.QB)) {
    for (const RB of range(STARTER_MIN.RB, STARTER_MAX.RB)) {
      for (const WR of range(STARTER_MIN.WR, STARTER_MAX.WR)) {
        for (const TE of range(STARTER_MIN.TE, STARTER_MAX.TE)) {
          for (const DEF of range(STARTER_MIN.DEF, STARTER_MAX.DEF)) {
            for (const K of range(STARTER_MIN.K, STARTER_MAX.K)) {
              const starters = { QB, RB, WR, TE, DEF, K };
              if (countBaseStarters(starters) + FLEX < 1) continue;
              yield starters;
            }
          }
        }
      }
    }
  }
}

function keyOf(s: StarterCounts): string {
  return STARTER_POSITION_ORDER.map((p) => `${p}${s[p]}`).join('-');
}

function preferredSkill(starters: StarterCounts): string {
  if (starters.WR > 0) return 'WR';
  if (starters.RB > 0) return 'RB';
  if (starters.TE > 0) return 'TE';
  if (starters.QB > 0) return 'QB';
  return 'WR';
}

function skillNeed(starters: StarterCounts): number {
  return starters.QB + starters.RB + starters.WR + starters.TE;
}

function requiredOrder(starters: StarterCounts): string[] {
  const order: string[] = [];
  for (const pos of STARTER_POSITION_ORDER) {
    for (let i = 0; i < starters[pos as StarterPosition]; i++) order.push(pos);
  }
  // Flex: skill when the league starts skill; else a ST or WR bench
  if (skillNeed(starters) > 0) order.push(preferredSkill(starters));
  else if (starters.DEF > 0) order.push('DEF');
  else if (starters.K > 0) order.push('K');
  else order.push('WR');
  return order;
}

function mkPick(
  round: number,
  pos: string,
  adp: number,
  id: string
): DraftGradePick {
  const pick_number = (round - 1) * NUM_TEAMS + 1;
  const poolPad = NUM_TEAMS * 30;
  return {
    pick_number,
    round_number: round,
    is_autodraft: false,
    is_keeper: false,
    player: {
      id,
      name: `${pos}-R${round}`,
      position: pos,
      team: ['KC', 'BUF', 'PHI', 'SF', 'MIA', 'DET', 'BAL', 'CIN', 'DAL', 'GB', 'LAR', 'MIN'][
        (round + id.length) % 12
      ],
      // Keep ADP inside market band so steals/reaches count.
      adp: Math.max(1, Math.min(adp, poolPad)),
      bye_week: ((round + id.length) % 14) + 1,
    },
  };
}

function countPos(positions: string[], pos: string): number {
  return positions.filter((p) => p === pos).length;
}

function buildFilledPositions(starters: StarterCounts, numRounds: number): string[] {
  const need = skillNeed(starters);
  // ST-only: fill required DEF/K once, then skill bench (extras DEF/K count as early ST).
  const fill = need > 0 ? preferredSkill(starters) : 'WR';
  const positions: string[] = [];

  // Early skill anchors (without dropping other required starters).
  if (starters.WR > 0) positions.push('WR');
  if (starters.RB > 0) positions.push('RB');
  if (starters.WR > 1) positions.push('WR');
  if (starters.RB > 1) positions.push('RB');
  if (starters.QB > 0) positions.push('QB');
  if (starters.TE > 0) positions.push('TE');
  // Remaining required skill
  for (const pos of ['QB', 'RB', 'WR', 'TE'] as StarterPosition[]) {
    while (countPos(positions, pos) < starters[pos]) positions.push(pos);
  }
  // Flex skill/ST
  if (need > 0) positions.push(preferredSkill(starters));
  else if (starters.DEF > 0) positions.push('DEF');
  else if (starters.K > 0) positions.push('K');
  else positions.push('WR');

  while (positions.length < numRounds) positions.push(fill);
  positions.length = numRounds;

  // Place required DEF/K as late as possible (R10+ when draft is long enough).
  const placeLate = (pos: string, count: number) => {
    let left = count - countPos(positions, pos);
    if (left <= 0) return;
    const minIdx = Math.min(numRounds - 1, Math.max(0, numRounds - 1 - left));
    const preferFrom = numRounds >= 10 ? 9 : Math.max(0, numRounds - left - 1);
    for (let i = numRounds - 1; i >= preferFrom && left > 0; i--) {
      if (positions[i] === 'DEF' || positions[i] === 'K') continue;
      if (need > 0 && countPos(positions, positions[i] as StarterPosition) <= starters[positions[i] as StarterPosition]) {
        // Don't steal the last required skill slot
        const p = positions[i] as StarterPosition;
        if (['QB', 'RB', 'WR', 'TE'].includes(p) && countPos(positions, p) <= starters[p]) continue;
      }
      positions[i] = pos;
      left -= 1;
    }
    for (let i = numRounds - 1; i >= 0 && left > 0; i--) {
      if (positions[i] === 'DEF' || positions[i] === 'K') continue;
      const p = positions[i];
      if (
        ['QB', 'RB', 'WR', 'TE'].includes(p) &&
        countPos(positions, p) <= starters[p as StarterPosition]
      ) {
        continue;
      }
      positions[i] = pos;
      left -= 1;
    }
    void minIdx;
  };

  // Clear accidental early ST before placing the exact required counts late
  for (let i = 0; i < positions.length; i++) {
    if (positions[i] === 'DEF' || positions[i] === 'K') positions[i] = fill;
  }
  placeLate('DEF', starters.DEF);
  placeLate('K', starters.K);

  return positions;
}

/**
 * Build picks aimed at a specific letter via known floor/ceiling branches.
 * Value = pick − ADP (positive = steal / player fell).
 */
export function buildForGrade(
  starters: StarterCounts,
  target: LetterGrade,
  numRounds: number,
  variant = 0
): DraftGradePick[] {
  const skill = preferredSkill(starters);
  const need = skillNeed(starters);
  const idBase = `${keyOf(starters)}-${target}-v${variant}`;
  const picks: DraftGradePick[] = [];

  const fillRest = (
    fromRound: number,
    posFn: (r: number) => string,
    adpFn: (r: number) => number
  ) => {
    for (let r = fromRound; r <= numRounds; r++) {
      picks.push(mkPick(r, posFn(r), adpFn(r), `${idBase}-r${r}`));
    }
  };

  if (target.startsWith('F')) {
    const earlyStPos = starters.K === 0 ? 'K' : 'DEF';
    const otherSt = earlyStPos === 'K' ? 'DEF' : 'K';

    if (target === 'F-') {
      if (need === 0 && starters.DEF + starters.K > 0) {
        // Never fill required ST; 5+ early skill → F-
        for (let r = 1; r <= numRounds; r++) {
          picks.push(mkPick(r, skill, Math.max(1, 40 + r), `${idBase}-r${r}`));
        }
      } else {
        picks.push(mkPick(1, earlyStPos, 20, `${idBase}-1`));
        picks.push(mkPick(2, otherSt, 30, `${idBase}-2`));
        picks.push(mkPick(3, earlyStPos, 40, `${idBase}-3`));
        fillRest(4, () => skill, (r) => r * NUM_TEAMS);
      }
    } else if (target === 'F') {
      if (need === 0 && starters.DEF + starters.K > 0) {
        // earlyST>=2 + missing a required ST → F
        if (starters.DEF > 0 && starters.K > 0) {
          for (let i = 0; i < starters.DEF; i++) {
            picks.push(mkPick(picks.length + 1, 'DEF', 20 + i, `${idBase}-d${i}`));
          }
          // Two extras → earlyST>=2
          picks.push(mkPick(picks.length + 1, 'DEF', 40, `${idBase}-x1`));
          picks.push(mkPick(picks.length + 1, 'DEF', 45, `${idBase}-x2`));
          fillRest(picks.length + 1, () => skill, (r) => 70 + r);
          for (let i = 0; i < picks.length; i++) {
            if (picks[i].player?.position === 'K') {
              picks[i] = { ...picks[i], player: { ...picks[i].player!, position: skill } };
            }
          }
        } else {
          const needSt = starters.K > 0 ? 'K' : 'DEF';
          const junk = needSt === 'K' ? 'DEF' : 'K';
          picks.push(mkPick(1, junk, 25, `${idBase}-1`));
          picks.push(mkPick(2, junk, 35, `${idBase}-2`));
          picks.push(mkPick(3, skill, 45, `${idBase}-3`));
          fillRest(4, () => skill, (r) => 70 + r);
          for (let i = 0; i < picks.length; i++) {
            if (picks[i].player?.position === needSt) {
              picks[i] = { ...picks[i], player: { ...picks[i].player!, position: skill } };
            }
          }
        }
      } else {
        // earlyST=2 + starter hole → F (skillEarly may be 0)
        picks.push(mkPick(1, earlyStPos, 20, `${idBase}-1`));
        picks.push(mkPick(2, otherSt, 30, `${idBase}-2`));
        fillRest(3, () => skill, (r) => r * NUM_TEAMS);
        const omitPos =
          starters.TE > 0 ? 'TE' : starters.QB > 0 ? 'QB' : starters.RB > 0 ? 'RB' : starters.WR > 0 ? 'WR' : null;
        if (omitPos) {
          for (let i = 0; i < picks.length; i++) {
            if (picks[i].player?.position === omitPos) {
              picks[i] = {
                ...picks[i],
                player: { ...picks[i].player!, position: omitPos === 'WR' ? 'RB' : 'WR' },
              };
            }
          }
        }
      }
    } else {
      // F+
      if (need === 0 && starters.DEF + starters.K > 0) {
        // earlyST=1 + skillEarly>=2 + missing a required ST → F+
        if (starters.DEF > 0 && starters.K > 0) {
          // Fill required DEF, take one EXTRA DEF (early), leave K empty.
          for (let i = 0; i < starters.DEF; i++) {
            picks.push(mkPick(picks.length + 1, 'DEF', 20 + i, `${idBase}-def${i}`));
          }
          picks.push(mkPick(picks.length + 1, 'DEF', 40, `${idBase}-extra`)); // early extra
          picks.push(mkPick(picks.length + 1, skill, 50, `${idBase}-s1`));
          picks.push(mkPick(picks.length + 1, skill, 60, `${idBase}-s2`));
          fillRest(picks.length + 1, () => skill, (r) => 70 + r);
          for (let i = 0; i < picks.length; i++) {
            if (picks[i].player?.position === 'K') {
              picks[i] = { ...picks[i], player: { ...picks[i].player!, position: skill } };
            }
          }
        } else {
          const needSt = starters.K > 0 ? 'K' : 'DEF';
          const junkSt = needSt === 'K' ? 'DEF' : 'K';
          picks.push(mkPick(1, junkSt, 25, `${idBase}-1`)); // non-required → early
          picks.push(mkPick(2, skill, 50, `${idBase}-2`));
          picks.push(mkPick(3, skill, 60, `${idBase}-3`));
          fillRest(4, () => skill, (r) => 70 + r);
          for (let i = 0; i < picks.length; i++) {
            if (picks[i].player?.position === needSt) {
              picks[i] = { ...picks[i], player: { ...picks[i].player!, position: skill } };
            }
          }
        }
      } else if (need === 0) {
        // Flex-only: early ST + 2 skill
        picks.push(mkPick(1, 'K', 25, `${idBase}-1`));
        picks.push(mkPick(2, skill, 5, `${idBase}-2`));
        picks.push(mkPick(3, skill, 10, `${idBase}-3`));
        fillRest(4, () => skill, (r) => r * NUM_TEAMS + 5);
      } else {
        picks.push(mkPick(1, earlyStPos, 25, `${idBase}-1`));
        picks.push(mkPick(2, skill, 5, `${idBase}-2`));
        picks.push(mkPick(3, skill, 10, `${idBase}-3`));
        fillRest(4, () => skill, (r) => r * NUM_TEAMS + 5);
        const omit =
          starters.QB > 0 && skill !== 'QB'
            ? 'QB'
            : starters.TE > 0 && skill !== 'TE'
              ? 'TE'
              : starters.RB > 0 && skill !== 'RB'
                ? 'RB'
                : starters.WR > 0 && skill !== 'WR'
                  ? 'WR'
                  : null;
        if (omit) {
          for (let i = 0; i < picks.length; i++) {
            if (picks[i].player?.position === omit) {
              picks[i] = {
                ...picks[i],
                player: { ...picks[i].player!, position: skill },
              };
            }
          }
        } else {
          // Only one skill position is started — keep fewer than required (leave a hole).
          const needCount = starters[skill as StarterPosition] ?? 0;
          const keepMax = Math.max(0, needCount - 1);
          let kept = 0;
          for (let i = 0; i < picks.length; i++) {
            if (picks[i].player?.position !== skill) continue;
            if (kept < keepMax) {
              kept += 1;
              continue;
            }
            const alt = skill === 'WR' ? 'RB' : skill === 'RB' ? 'WR' : 'WR';
            picks[i] = {
              ...picks[i],
              player: { ...picks[i].player!, position: alt },
            };
          }
        }
      }
    }
    return picks.slice(0, numRounds);
  }

  const positions = buildFilledPositions(starters, numRounds);

  for (let r = 1; r <= numRounds; r++) {
    const pos = positions[r - 1];
    const pickNum = (r - 1) * NUM_TEAMS + 1;
    let adp = pickNum;

    const skillLeague = need > 0;
    const rbWrLeague = starters.RB + starters.WR > 0;

    if (target.startsWith('A')) {
      // Gates: A+ steals>=2 avg>=3; A steals>=1 avg>=1.5; A- steals=0 avg>=-0.5
      // Pick-1 ADP must stay inside premium-slot tolerance (tierGap < 5).
      if (r === 1) {
        if (pos === 'RB' || pos === 'WR') adp = 4;
        else if (pos === 'QB' || pos === 'TE') adp = 3;
        else adp = pickNum;
      } else if (target === 'A+') {
        adp = Math.max(1, pickNum - (NUM_TEAMS * 1.5 + variant * 0.4));
      } else if (target === 'A') {
        if (r === 2) adp = Math.max(1, pickNum - (NUM_TEAMS + 6));
        else adp = Math.max(1, pickNum - 2);
      } else {
        // A-: chalk / tiny positive-or-flat, zero steals (avg >= -0.5)
        adp = Math.max(1, pickNum - 0.2);
        if (r === 2 && (pos === 'RB' || pos === 'WR' || pos === 'TE' || pos === 'QB')) {
          adp = Math.min(18, Math.max(1, pickNum - 1));
        }
      }
    } else if (target.startsWith('B')) {
      // B+: 1 steal, avg in [-1.5, 1.5); B: no steal, avg in [-3.5,-0.5); B-: avg in [-6,-0.5)
      // Keep R1 ADP within premium-slot tolerance (tierGap < 5 at pick 1).
      if (r === 1 && (pos === 'RB' || pos === 'WR' || pos === 'QB' || pos === 'TE')) {
        adp = 4;
      } else if (target === 'B+') {
        if (r === 3) adp = Math.max(1, pickNum - (NUM_TEAMS * 0.8));
        else adp = pickNum + 0.8;
        if (!skillLeague && r === 3) adp = Math.max(1, pickNum - 9);
        if (!skillLeague && r !== 3) adp = pickNum + 0.8;
      } else if (target === 'B') {
        adp = pickNum + 1.5 + variant * 0.05;
        if (r === 1 && (pos === 'RB' || pos === 'WR' || pos === 'QB' || pos === 'TE')) adp = 4;
        if (r === 2 && (pos === 'RB' || pos === 'WR' || pos === 'QB' || pos === 'TE')) {
          adp = Math.min(18, Math.max(1, pickNum - 1));
        }
      } else {
        adp = pickNum + 4.5 + variant * 0.1;
        if (r === 5) adp = pickNum + NUM_TEAMS * 0.9;
        if (r === 1 && (pos === 'RB' || pos === 'WR' || pos === 'QB' || pos === 'TE')) adp = 4;
        if (r === 2 && (pos === 'RB' || pos === 'WR' || pos === 'QB' || pos === 'TE')) {
          adp = Math.min(20, Math.max(1, pickNum - 1));
        }
      }
    } else if (target.startsWith('C')) {
      // C+: 2–3 reaches, avg>=-7.5; C: 3–5 reaches; C-: reach>=6 or avg<-11, not blindFaith
      if (target === 'C+') {
        if (r <= Math.min(3, numRounds)) adp = pickNum + NUM_TEAMS * (1.05 + variant * 0.02);
        else adp = pickNum + 2;
      } else if (target === 'C') {
        // Need 3–5 reaches; avg in [-11, -7.5). Avoid R1 premium miss (tierGap < 5).
        const rr =
          numRounds <= 8 ? Math.min(4, numRounds) : Math.min(5, Math.max(4, numRounds - 2));
        if (r === 1) adp = Math.min(pickNum + 4, pickNum + NUM_TEAMS * 1.05);
        else if (r <= rr) adp = pickNum + NUM_TEAMS * (1.3 + variant * 0.02);
        else adp = pickNum + 3;
      } else {
        // C-: past C band without blindFaith.
        if (numRounds <= 7) {
          if (r === 1) adp = pickNum + 4;
          else if (r <= 4) adp = pickNum + NUM_TEAMS * (1.6 + variant * 0.05);
          else adp = pickNum + 2;
        } else {
          const cMinusReaches = Math.min(6, numRounds);
          if (r === 1) adp = pickNum + 4;
          else if (r <= cMinusReaches) adp = pickNum + NUM_TEAMS * (1.05 + variant * 0.01);
          else adp = pickNum + 2;
        }
      }
      if (r === 1 && (pos === 'RB' || pos === 'WR' || pos === 'QB' || pos === 'TE')) {
        adp = Math.min(adp, 5);
      }
    } else if (target.startsWith('D')) {
      if (r <= 7) {
        if (target === 'D+') adp = pickNum + NUM_TEAMS * (1.05 + variant * 0.01);
        else if (target === 'D') adp = pickNum + NUM_TEAMS * (1.55 + variant * 0.04);
        else adp = pickNum + NUM_TEAMS * (3.6 + variant * 0.08);
      } else {
        adp = pickNum + NUM_TEAMS * 0.4;
      }
      if (rbWrLeague && r === 1 && (pos === 'RB' || pos === 'WR') && target === 'D+') {
        adp = Math.min(adp, 30);
      }
    }

    picks.push(mkPick(r, pos, adp, `${idBase}-r${r}`));
  }

  return picks;
}

export function achieveGrade(
  starters: StarterCounts,
  target: LetterGrade,
  numRounds: number
): { ok: boolean; score?: number; attempts: number; got?: LetterGrade; samples?: LetterGrade[] } {
  const samples: LetterGrade[] = [];
  let attempts = 0;
  for (let variant = 0; variant < 48; variant++) {
    attempts += 1;
    const picks = buildForGrade(starters, target, numRounds, variant);
    const result = computeDraftGrade(picks, {
      numTeams: NUM_TEAMS,
      numRounds,
      starters,
      flexCount: FLEX,
      isSuperflex: starters.QB >= 2,
    });
    const got = result?.grade ?? null;
    if (got && samples.length < 8) samples.push(got);
    if (got === target) {
      return { ok: true, score: result!.numericScore, attempts, got, samples };
    }
  }
  return { ok: false, attempts, samples };
}

function main() {
  const missingFreq: Record<string, number> = {};
  for (const g of ALL_GRADES) missingFreq[g] = 0;

  const notableKeys = new Set([
    'QB1-RB2-WR2-TE1-DEF1-K1',
    'QB1-RB1-WR2-TE1-DEF1-K1',
    'QB1-RB2-WR3-TE1-DEF1-K1',
    'QB1-RB2-WR2-TE0-DEF1-K1',
    'QB2-RB2-WR2-TE1-DEF1-K1',
    'QB0-RB2-WR2-TE1-DEF1-K1',
    'QB1-RB0-WR3-TE1-DEF1-K1',
    'QB3-RB1-WR1-TE0-DEF0-K0',
    'QB0-RB0-WR0-TE0-DEF1-K1',
    'QB0-RB0-WR0-TE0-DEF0-K0',
  ]);
  const notableFailures: unknown[] = [];

  let configs = 0;
  let totalOk = 0;
  let totalMissing = 0;
  let failureCount = 0;

  for (const starters of allStarterConfigs()) {
    configs += 1;
    const numRounds = countBaseStarters(starters) + FLEX + BENCH;
    const missing: LetterGrade[] = [];
    const hit: Partial<Record<LetterGrade, number>> = {};
    const sampleMiss: Partial<Record<LetterGrade, LetterGrade[]>> = {};

    for (const grade of ALL_GRADES) {
      const res = achieveGrade(starters, grade, numRounds);
      if (res.ok) {
        hit[grade] = res.score;
        totalOk += 1;
      } else {
        missing.push(grade);
        missingFreq[grade] += 1;
        totalMissing += 1;
        sampleMiss[grade] = res.samples;
      }
    }

    if (missing.length > 0) {
      failureCount += 1;
      const k = keyOf(starters);
      if (notableKeys.has(k) || failureCount <= 12) {
        notableFailures.push({ starters, missing, hit, sampleMiss });
      }
    }

    if (configs % 400 === 0) {
      console.log(`… ${configs} configs, failures=${failureCount}`);
    }
  }

  const outDir = join(dirname(fileURLToPath(import.meta.url)), 'output');
  mkdirSync(outDir, { recursive: true });
  const summary = {
    configs,
    letterChecks: configs * ALL_GRADES.length,
    totalOk,
    totalMissing,
    failureCount,
    missingFreq,
    notableFailures,
    allPassed: failureCount === 0,
  };
  const outPath = join(outDir, 'starter-config-sweep.json');
  writeFileSync(outPath, JSON.stringify(summary, null, 2));
  writeFileSync(
    join(outDir, 'starter-config-sweep-summary.txt'),
    [
      `configs=${configs}`,
      `ok=${totalOk}/${summary.letterChecks}`,
      `failureConfigs=${failureCount}`,
      `missingFreq=${JSON.stringify(missingFreq)}`,
      `allPassed=${summary.allPassed}`,
    ].join('\n')
  );

  console.log(
    JSON.stringify(
      {
        configs,
        totalOk,
        totalMissing,
        failureCount,
        missingFreq,
        notableFailures: notableFailures.slice(0, 8),
        outPath,
      },
      null,
      2
    )
  );

  if (failureCount > 0) process.exitCode = 1;
}

const entry = process.argv[1] ? resolve(process.argv[1]) : '';
const self = resolve(fileURLToPath(import.meta.url));
if (entry === self) {
  main();
}
