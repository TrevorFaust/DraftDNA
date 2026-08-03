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
  };
  keeperTest: {
    trials: number;
    aOrBetter: number;
    bOrBetter: number;
    grades: Record<string, number>;
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

  // 1) Good-aim drafts shouldn't dump into D/F
  checks.push({
    id: 'good_aim_low_df',
    pass: m.goodAimDfRate <= 0.12,
    detail: `good-aim D/F rate ${(m.goodAimDfRate * 100).toFixed(1)}% (max 12%)`,
  });

  // 2) Good-aim mostly B- or better
  checks.push({
    id: 'good_aim_b_or_better',
    pass: m.goodAimBOrBetterRate >= 0.7,
    detail: `good-aim B-or-better ${(m.goodAimBOrBetterRate * 100).toFixed(1)}% (min 70%)`,
  });

  // 3) Excellent drafts produce meaningful A+ and B+ counts
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

  // 4) Excellent should often land A-band
  checks.push({
    id: 'excellent_a_band',
    pass: m.excellentABandRate >= 0.2,
    detail: `excellent A+/A/A- rate ${(m.excellentABandRate * 100).toFixed(1)}% (min 20%)`,
  });

  // 5) Terrible drafts should land low often
  checks.push({
    id: 'terrible_low_band',
    pass: m.terribleLowBandRate >= 0.7,
    detail: `terrible D/F rate ${(m.terribleLowBandRate * 100).toFixed(1)}% (min 70%)`,
  });

  // 6) All user grades appear with some frequency across intents
  checks.push({
    id: 'grade_coverage',
    pass: m.missingGrades.length === 0,
    detail:
      m.missingGrades.length === 0
        ? 'all A+…F grades hit ≥3 times overall'
        : `missing/rare: ${m.missingGrades.join(', ')}`,
  });

  // 7) Keepers don't launder a terrible draft into a good grade
  checks.push({
    id: 'keeper_no_grade_laundering',
    pass: report.keeperTest.pass,
    detail: `keeper+terrible → A-band=${report.keeperTest.aOrBetter}, B-or-better=${report.keeperTest.bOrBetter}/${report.keeperTest.trials}`,
  });

  const failed = checks.filter((c) => !c.pass);
  // REVISE if close (1–2 fails that look tunable); FAIL if structural (3+ or keeper/good-aim DF)
  let verdict: 'PASS' | 'REVISE' | 'FAIL' = 'PASS';
  if (failed.length === 0) verdict = 'PASS';
  else if (
    failed.some((f) => f.id === 'keeper_no_grade_laundering' || f.id === 'good_aim_low_df') ||
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
