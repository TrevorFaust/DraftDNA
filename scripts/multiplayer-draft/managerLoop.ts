/**
 * Manager: run Builder → Judge up to 3 attempts; escalate if still failing.
 *
 * Usage:
 *   npx tsx scripts/multiplayer-draft/managerLoop.ts
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), 'output');
const MAX_ATTEMPTS = 3;

function run(cmd: string, args: string[]) {
  const res = spawnSync(cmd, args, {
    cwd: ROOT,
    encoding: 'utf8',
    shell: true,
  });
  if (res.stdout) process.stdout.write(res.stdout);
  if (res.stderr) process.stderr.write(res.stderr);
  return res.status ?? 1;
}

function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const lines: string[] = ['# Multiplayer draft manager summary', ''];
  let passed = false;
  let lastAttempt = 0;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    lastAttempt = attempt;
    lines.push(`## Attempt ${attempt}`);
    const builderCode = run('npx', ['tsx', 'scripts/multiplayer-draft/builderRun.ts', `--attempt=${attempt}`]);
    lines.push(`- Builder exit: ${builderCode}`);
    const judgeCode = run('npx', ['tsx', 'scripts/multiplayer-draft/judgeBuilderRun.ts', `--attempt=${attempt}`]);
    lines.push(`- Judge exit: ${judgeCode}`);
    if (judgeCode === 0) {
      passed = true;
      lines.push('- Result: PASS');
      break;
    }
    lines.push('- Result: FAIL — rerunning');
    lines.push('');
  }

  if (!passed) {
    lines.push('');
    lines.push('## ESCALATE TO HUMAN');
    lines.push(
      `After ${lastAttempt} attempts the multiplayer draft harness still fails completion goals (full roster fill, no duplicate players, keeper locks, per-human grades, badges only for logged-in).`
    );
    lines.push('Inspect `scripts/multiplayer-draft/output/judge-run-*.json` and fix simulator/RPC parity.');
  } else {
    lines.push('');
    lines.push(`## Success on attempt ${lastAttempt}`);
  }

  const summaryPath = join(OUT_DIR, 'manager-summary.md');
  writeFileSync(summaryPath, lines.join('\n') + '\n');
  console.log(`\nWrote ${summaryPath}`);
  if (!passed) {
    console.error('ESCALATE: multiplayer draft harness failed after 3 attempts');
    process.exitCode = 1;
  }
}

main();
