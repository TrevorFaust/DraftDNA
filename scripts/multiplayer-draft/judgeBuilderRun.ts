/**
 * Judge: pass/fail a builder-run-N.json for multiplayer draft completion goals.
 *
 * Usage:
 *   npx tsx scripts/multiplayer-draft/judgeBuilderRun.ts --attempt=1
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), 'output');

type BuilderReport = {
  attempt: number;
  totalCases: number;
  passCount: number;
  failCount: number;
  cases: Array<{
    numTeams: number;
    humanCount: number;
    withKeepers: boolean;
    ok: boolean;
    errors: string[];
  }>;
};

function parseArgs() {
  const attempt = Number(process.argv.find((a) => a.startsWith('--attempt='))?.split('=')[1] ?? 1);
  return { attempt };
}

function main() {
  const { attempt } = parseArgs();
  mkdirSync(OUT_DIR, { recursive: true });
  const inPath = join(OUT_DIR, `builder-run-${attempt}.json`);
  if (!existsSync(inPath)) {
    console.error(`Missing ${inPath}`);
    process.exit(2);
  }

  const report = JSON.parse(readFileSync(inPath, 'utf8')) as BuilderReport;
  const checks: { id: string; pass: boolean; detail: string }[] = [];

  checks.push({
    id: 'all_cases_pass',
    pass: report.failCount === 0 && report.passCount === report.totalCases,
    detail: `${report.passCount}/${report.totalCases} cases passed`,
  });

  const failed = report.cases.filter((c) => !c.ok);
  const sizeCoverage = new Set(report.cases.map((c) => c.numTeams));
  checks.push({
    id: 'size_coverage_4_to_32',
    pass: sizeCoverage.size >= 15,
    detail: `covered ${sizeCoverage.size} team sizes`,
  });

  checks.push({
    id: 'keeper_cases_present',
    pass: report.cases.some((c) => c.withKeepers && c.ok),
    detail: 'at least one passing keeper case',
  });

  checks.push({
    id: 'mixed_human_cpu',
    pass: report.cases.some((c) => c.humanCount < c.numTeams && c.ok),
    detail: 'at least one mixed human/CPU pass',
  });

  const starterErrors = report.cases.flatMap((c) =>
    (c.errors || []).filter((e) => e.includes('missing required starters'))
  );
  checks.push({
    id: 'full_starters_all_teams',
    pass: starterErrors.length === 0 && report.failCount === 0,
    detail:
      starterErrors.length === 0
        ? 'all teams fill QB/2RB/2WR/TE/DEF/K'
        : `${starterErrors.length} starter-fill failures`,
  });

  const dupErrors = report.cases.flatMap((c) =>
    (c.errors || []).filter((e) => e.startsWith('duplicates='))
  );
  checks.push({
    id: 'no_duplicate_players',
    pass: dupErrors.length === 0,
    detail: dupErrors.length === 0 ? 'no duplicated drafted players' : dupErrors.slice(0, 3).join('; '),
  });

  const keeperFails = report.cases.filter((c) => c.withKeepers && c.errors.some((e) => e.includes('keeper')));
  checks.push({
    id: 'keepers_locked_to_team_round',
    pass: keeperFails.length === 0 && report.cases.some((c) => c.withKeepers),
    detail:
      keeperFails.length === 0
        ? 'keeper cases keep players on assigned team/round'
        : `${keeperFails.length} keeper lock failures`,
  });

  const failedDetail = failed
    .slice(0, 12)
    .map((c) => `${c.numTeams}t/${c.humanCount}h keepers=${c.withKeepers}: ${c.errors.join('; ')}`)
    .join('\n');

  const allPass = checks.every((c) => c.pass);
  const verdict = allPass ? 'PASS' : 'FAIL';

  const out = {
    attempt,
    verdict,
    checks,
    failCount: report.failCount,
    sampleFailures: failed.slice(0, 20),
  };

  writeFileSync(join(OUT_DIR, `judge-run-${attempt}.json`), JSON.stringify(out, null, 2));
  console.log(`Judge attempt ${attempt}: ${verdict}`);
  for (const c of checks) {
    console.log(`  ${c.pass ? 'OK' : 'FAIL'} ${c.id}: ${c.detail}`);
  }
  if (failedDetail) console.log(`Sample failures:\n${failedDetail}`);
  if (!allPass) process.exitCode = 1;
}

main();
