/**
 * Manager: run builder → judge up to 3 attempts; stop on PASS or after 3 non-PASS.
 *
 * Usage:
 *   npx tsx scripts/grade-calibration/runManagerLoop.ts
 *   npx tsx scripts/grade-calibration/runManagerLoop.ts --trials=10 --seed=42
 */
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), 'output');

function parseArgs() {
  const trials = process.argv.find((a) => a.startsWith('--trials='))?.split('=')[1] ?? '10';
  const seed = process.argv.find((a) => a.startsWith('--seed='))?.split('=')[1] ?? '42';
  return { trials, seed };
}

function run(cmd: string, args: string[]) {
  console.log(`\n$ ${cmd} ${args.join(' ')}`);
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: true });
  return r.status ?? 1;
}

function main() {
  const { trials, seed } = parseArgs();
  mkdirSync(OUT_DIR, { recursive: true });

  const attempts: { attempt: number; verdict: string }[] = [];
  let finalVerdict = 'FAIL';

  for (let attempt = 1; attempt <= 3; attempt++) {
    const builderStatus = run('npx', [
      'tsx',
      'scripts/grade-calibration/simulateMockDraftGrades.ts',
      `--trials=${trials}`,
      `--seed=${seed}`,
      `--attempt=${attempt}`,
    ]);
    if (builderStatus !== 0) {
      attempts.push({ attempt, verdict: 'BUILDER_ERROR' });
      finalVerdict = 'FAIL';
      break;
    }

    const judgeStatus = run('npx', [
      'tsx',
      'scripts/grade-calibration/judgeBuilderRun.ts',
      `--attempt=${attempt}`,
    ]);

    const judgePath = join(OUT_DIR, `judge-run-${attempt}.json`);
    let verdict = judgeStatus === 0 ? 'PASS' : 'REVISE';
    if (existsSync(judgePath)) {
      const j = JSON.parse(readFileSync(judgePath, 'utf8')) as { verdict?: string };
      verdict = j.verdict ?? verdict;
    }
    attempts.push({ attempt, verdict });

    if (verdict === 'PASS') {
      finalVerdict = 'PASS';
      break;
    }
    if (verdict === 'FAIL') {
      finalVerdict = 'FAIL';
      break;
    }
    finalVerdict = 'REVISE';
  }

  const lines = [
    `# Manager summary — grade aim loop`,
    '',
    `## Outcome: **${finalVerdict}**`,
    '',
    '| Attempt | Judge |',
    '| ---: | --- |',
    ...attempts.map((a) => `| ${a.attempt} | ${a.verdict} |`),
    '',
    `Trials/aim=${trials}, seed=${seed}`,
    '',
    'See `builder-run-N.json` for aim hit rates and `rosters-attempt-N.md` for A+/F− rosters.',
    '',
  ];
  const summaryPath = join(OUT_DIR, 'manager-summary.md');
  writeFileSync(summaryPath, lines.join('\n'));
  console.log(`\n=== MANAGER: ${finalVerdict} ===`);
  console.log(`Wrote ${summaryPath}`);
  if (finalVerdict !== 'PASS') process.exit(1);
}

main();
