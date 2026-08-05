/**
 * Builder: simulate multiplayer drafts across 4–32 team sizes.
 *
 * Usage:
 *   npx tsx scripts/multiplayer-draft/builderRun.ts --attempt=1
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  makeSyntheticBoard,
  simulateMultiplayerDraft,
  type SimDraftResult,
} from './simulateMultiplayerDraft';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), 'output');
const TEAM_SIZES = [4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32] as const;

function parseArgs() {
  const attempt = Number(process.argv.find((a) => a.startsWith('--attempt='))?.split('=')[1] ?? 1);
  return { attempt };
}

function runOne(numTeams: number, humanCount: number, withKeepers: boolean): SimDraftResult {
  const numRounds = 15;
  const board = makeSyntheticBoard(numTeams * numRounds + 40, numTeams);
  const humans = Array.from({ length: humanCount }, (_, i) => ({
    team_number: i + 1,
    user_id: i === 0 ? `user-host-${numTeams}` : i % 2 === 0 ? `user-${numTeams}-${i}` : null,
    guest_session_id: i % 2 === 1 ? `guest-${numTeams}-${i}` : null,
  }));

  const keepers = withKeepers
    ? [
        { team_number: 1, player_id: board[numTeams * numRounds + 5].id, round_number: 5 },
        { team_number: 2, player_id: board[numTeams * numRounds + 6].id, round_number: 4 },
      ]
    : [];

  return simulateMultiplayerDraft({
    numTeams,
    numRounds,
    board,
    humans,
    keepers,
    positionLimits: { QB: 4, RB: 8, WR: 8, TE: 4, DEF: 1, K: 1 },
  });
}

function main() {
  const { attempt } = parseArgs();
  mkdirSync(OUT_DIR, { recursive: true });

  const cases: Array<{
    numTeams: number;
    humanCount: number;
    withKeepers: boolean;
    result: SimDraftResult;
    ok: boolean;
    errors: string[];
  }> = [];

  for (const numTeams of TEAM_SIZES) {
    const humanCounts = [
      1,
      Math.min(numTeams, 2),
      Math.min(numTeams, Math.max(2, Math.floor(numTeams / 2))),
      numTeams,
    ];
    const uniqueHumans = [...new Set(humanCounts)];

    for (const humanCount of uniqueHumans) {
      for (const withKeepers of [false, true]) {
        const errors: string[] = [];
        let result: SimDraftResult;
        try {
          result = runOne(numTeams, humanCount, withKeepers);
        } catch (e: any) {
          cases.push({
            numTeams,
            humanCount,
            withKeepers,
            result: null as any,
            ok: false,
            errors: [e?.message || String(e)],
          });
          continue;
        }

        if (!result.completed) errors.push('not completed');
        if (result.duplicatePlayers > 0) errors.push(`duplicates=${result.duplicatePlayers}`);
        for (let t = 1; t <= numTeams; t++) {
          if (result.rosterSizes[t] !== result.numRounds) {
            errors.push(`team ${t} roster ${result.rosterSizes[t]} != ${result.numRounds}`);
          }
        }
        // Every team must be able to fill required starters (incl. DEF + K)
        for (const err of result.starterFillErrors) {
          errors.push(err);
        }
        if (withKeepers && !result.keeperLocked) errors.push('keeper lock failed');
        if (result.grades.length !== humanCount) errors.push('missing grades');
        for (const g of result.grades) {
          if (!g.grade_letter) errors.push(`no grade for team ${g.team_number}`);
          if (g.badge_awarded && !g.has_user_id) errors.push(`guest badge on team ${g.team_number}`);
          if (!g.badge_awarded && g.has_user_id) {
            errors.push(`logged-in missing badge flag team ${g.team_number}`);
          }
        }

        cases.push({
          numTeams,
          humanCount,
          withKeepers,
          result: {
            ...result,
            picks: result.picks.slice(0, 3), // trim report size
          },
          ok: errors.length === 0,
          errors,
        });
      }
    }
  }

  const passCount = cases.filter((c) => c.ok).length;
  const report = {
    attempt,
    generatedAt: new Date().toISOString(),
    teamSizes: TEAM_SIZES,
    totalCases: cases.length,
    passCount,
    failCount: cases.length - passCount,
    cases,
  };

  const outPath = join(OUT_DIR, `builder-run-${attempt}.json`);
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`Builder attempt ${attempt}: ${passCount}/${cases.length} passed → ${outPath}`);
  if (passCount < cases.length) process.exitCode = 1;
}

main();
