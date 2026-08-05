/**
 * Judge: pass / fail / revise on a builder-run-N.json report.
 *
 * Usage:
 *   npx tsx scripts/grade-calibration/judgeBuilderRun.ts --attempt=1
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), 'output');

type BuilderReport = {
  attempt: number;
  metrics: {
    goodAimDfRate: number;
    goodAimBOrBetterRate: number;
    excellentAPlusCount: number;
    excellentBPlusCount: number;
    excellentABandRate: number;
    excellentN: number;
    goodAimN: number;
    terribleLowBandRate: number;
    coverage: Record<string, number>;
    missingGrades: string[];
    aPlusAimExactRate?: number;
    fMinusAimExactRate?: number;
  };
  aimHitRates?: Record<
    string,
    { n: number; exactHits: number; exactRate: number; nearHits: number; nearRate: number }
  >;
  keeperTest: {
    trials: number;
    aOrBetter: number;
    bOrBetter: number;
    grades: Record<string, number>;
    pass: boolean;
  };
  keeperStrategyTest?: {
    trials: number;
    bOrBetterRate: number;
    keptMentionRate: number;
    falseFinds: number;
    pass: boolean;
  };
  byIntent: Record<string, { n: number; avgScore: number; grades: Record<string, number> }>;
};

function parseArgs() {
  const attempt = Number(process.argv.find((a) => a.startsWith('--attempt='))?.split('=')[1] ?? 1);
  return { attempt };
}

function main() {
  const { attempt } = parseArgs();
  const inPath = join(OUT_DIR, `builder-run-${attempt}.json`);
  if (!existsSync(inPath)) {
    console.error(`Missing ${inPath}`);
    process.exit(2);
  }
  const report = JSON.parse(readFileSync(inPath, 'utf8')) as BuilderReport;
  const m = report.metrics;

  const checks: { id: string; pass: boolean; detail: string }[] = [];

  checks.push({
    id: 'good_aim_low_df',
    pass: m.goodAimDfRate <= 0.12,
    detail: `good-aim D/F rate ${(m.goodAimDfRate * 100).toFixed(1)}% (max 12%)`,
  });

  checks.push({
    id: 'good_aim_b_or_better',
    pass: m.goodAimBOrBetterRate >= 0.7,
    detail: `good-aim B-or-better ${(m.goodAimBOrBetterRate * 100).toFixed(1)}% (min 70%)`,
  });

  const aPlusRate = m.excellentN ? m.excellentAPlusCount / m.excellentN : 0;
  const bPlusRate = m.excellentN ? m.excellentBPlusCount / m.excellentN : 0;
  checks.push({
    id: 'excellent_a_plus_rate',
    pass: aPlusRate >= 0.08 || m.excellentAPlusCount >= 12,
    detail: `excellent A+ ${m.excellentAPlusCount}/${m.excellentN} (${(aPlusRate * 100).toFixed(1)}%) — need ≥8% or ≥12 hits`,
  });
  checks.push({
    id: 'excellent_b_plus_presence',
    pass: bPlusRate >= 0.05 || m.excellentBPlusCount >= 8 || m.excellentABandRate >= 0.25,
    detail: `excellent B+ ${m.excellentBPlusCount} / A-band ${(m.excellentABandRate * 100).toFixed(1)}%`,
  });

  checks.push({
    id: 'excellent_a_band',
    pass: m.excellentABandRate >= 0.2,
    detail: `excellent A+/A/A- rate ${(m.excellentABandRate * 100).toFixed(1)}% (min 20%)`,
  });

  checks.push({
    id: 'terrible_low_band',
    pass: m.terribleLowBandRate >= 0.7,
    detail: `terrible D/F rate ${(m.terribleLowBandRate * 100).toFixed(1)}% (min 70%)`,
  });

  // A–C +/− must appear; D-band and F-band each need some hits (not every +/-).
  const cov = m.coverage ?? {};
  const dBandHits = (cov['D+'] ?? 0) + (cov['D'] ?? 0) + (cov['D-'] ?? 0);
  const fBandHits = (cov['F+'] ?? 0) + (cov['F'] ?? 0) + (cov['F-'] ?? 0);
  const baseMissing = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-'].filter(
    (g) => (cov[g] ?? 0) < 3
  );
  const dBandOk = dBandHits >= 3;
  const fBandOk = fBandHits >= 3;
  checks.push({
    id: 'grade_coverage',
    pass: baseMissing.length === 0 && dBandOk && fBandOk,
    detail:
      baseMissing.length === 0 && dBandOk && fBandOk
        ? `A–C +/− covered; D-band=${dBandHits}, F-band=${fBandHits}`
        : `missing/rare: ${[...baseMissing, !dBandOk ? 'D-band' : '', !fBandOk ? 'F-band' : ''].filter(Boolean).join(', ')}`,
  });

  checks.push({
    id: 'keeper_no_grade_laundering',
    pass: report.keeperTest.pass,
    detail: `keeper+terrible → A-band=${report.keeperTest.aOrBetter}, B-or-better=${report.keeperTest.bOrBetter}/${report.keeperTest.trials}`,
  });

  const ks = report.keeperStrategyTest;
  checks.push({
    id: 'keeper_strategy_and_writeups',
    pass: Boolean(ks?.pass),
    detail: ks
      ? `discount-keeper drafts B+=${(ks.bOrBetterRate * 100).toFixed(0)}%, keptMentions=${(ks.keptMentionRate * 100).toFixed(0)}%, falseFinds=${ks.falseFinds}`
      : 'missing keeperStrategyTest',
  });

  // Human aim checks: A+ and F- should be reachable when trying for them.
  const aPlusAim = m.aPlusAimExactRate ?? report.aimHitRates?.['A+']?.exactRate ?? 0;
  const aPlusNear = report.aimHitRates?.['A+']?.nearRate ?? 0;
  checks.push({
    id: 'aim_a_plus_reachable',
    pass: aPlusAim >= 0.05 || aPlusNear >= 0.2 || (report.aimHitRates?.['A+']?.exactHits ?? 0) >= 3,
    detail: `aim A+ exact ${(aPlusAim * 100).toFixed(1)}% / ±1 ${(aPlusNear * 100).toFixed(1)}%`,
  });

  const fMinusAim = m.fMinusAimExactRate ?? report.aimHitRates?.['F-']?.exactRate ?? 0;
  const fMinusNear = report.aimHitRates?.['F-']?.nearRate ?? 0;
  checks.push({
    id: 'aim_f_minus_reachable',
    pass: fMinusAim >= 0.15 || fMinusNear >= 0.5 || (report.aimHitRates?.['F-']?.exactHits ?? 0) >= 6,
    detail: `aim F- exact ${(fMinusAim * 100).toFixed(1)}% / ±1 ${(fMinusNear * 100).toFixed(1)}%`,
  });

  const failed = checks.filter((c) => !c.pass);
  let verdict: 'PASS' | 'REVISE' | 'FAIL' = 'PASS';
  if (failed.length === 0) verdict = 'PASS';
  else if (
    failed.some(
      (f) =>
        f.id === 'keeper_no_grade_laundering' ||
        f.id === 'good_aim_low_df' ||
        f.id === 'keeper_strategy_and_writeups'
    ) ||
    failed.length >= 3
  ) {
    verdict = failed.length >= 4 ? 'FAIL' : 'REVISE';
  } else {
    verdict = 'REVISE';
  }

  const out = {
    generatedAt: new Date().toISOString(),
    attempt,
    verdict,
    checks,
    failed: failed.map((f) => f.id),
    summary: {
      byIntent: report.byIntent,
      aimHitRates: report.aimHitRates,
      metrics: m,
      keeperTest: report.keeperTest,
    },
  };

  mkdirSync(OUT_DIR, { recursive: true });
  const outPath = join(OUT_DIR, `judge-run-${attempt}.json`);
  writeFileSync(outPath, JSON.stringify(out, null, 2));

  console.log(`\n=== JUDGE attempt ${attempt}: ${verdict} ===`);
  for (const c of checks) {
    console.log(`${c.pass ? 'PASS' : 'FAIL'} | ${c.id}: ${c.detail}`);
  }
  console.log(`Wrote ${outPath}`);
  if (verdict !== 'PASS') process.exit(1);
}

main();
