/**
 * Builds src/constants/archetypeBadgeAssets.generated.ts from
 * archetype_logic/badge images/icon_prompts.json (standard + chaos archetypes).
 * Filenames match composed PNG output from build_badges.py — copy those into public/badges/.
 *
 * Run: node scripts/generateArchetypeBadgeMap.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const jsonPath = path.join(root, 'archetype_logic', 'badge images', 'icon_prompts.json');
const outPath = path.join(root, 'src', 'constants', 'archetypeBadgeAssets.generated.ts');

const raw = fs.readFileSync(jsonPath, 'utf8');
const data = JSON.parse(raw);

/** @type {Record<string, string>} */
const byName = {};
/** Master # from icon_prompts (1–360 standard, 361+ chaos) — for Badges grid order. */
/** @type {Record<string, number>} */
const sortIdByName = {};

for (const a of data.archetypes || []) {
  if (a?.name && a?.filename) {
    if (byName[a.name] && byName[a.name] !== a.filename) {
      console.warn(`Duplicate archetype name with different file: ${a.name}`);
    }
    byName[a.name] = a.filename;
    if (a.id != null && a.id !== '') {
      const n = parseInt(String(a.id), 10);
      if (!Number.isNaN(n)) sortIdByName[a.name] = n;
    }
  }
}

for (const a of data.chaos_archetypes || []) {
  if (a?.name && a?.filename) {
    if (byName[a.name] && byName[a.name] !== a.filename) {
      console.warn(`Duplicate chaos name with different file: ${a.name}`);
    }
    byName[a.name] = a.filename;
    if (a.id != null && a.id !== '') {
      const n = parseInt(String(a.id), 10);
      if (!Number.isNaN(n)) sortIdByName[a.name] = n;
    }
  }
}

const lines = [];
lines.push('/**');
lines.push(' * Generated from archetype_logic/badge images/icon_prompts.json.');
lines.push(' * Do not edit by hand. Run: node scripts/generateArchetypeBadgeMap.mjs');
lines.push(' *');
lines.push(' * Canonical art: badges/composed/*.png (build_badges.py). npm run dev/build runs sync:badges → public/badges for Vite.');
lines.push(' */');
lines.push('');
lines.push("export const ARCHETYPE_BADGE_PUBLIC_DIR = '/badges';");
lines.push('');
lines.push(
  `export const ARCHETYPE_BADGE_FILENAME_BY_NAME: Record<string, string> = ${JSON.stringify(byName, null, 2)};`
);
lines.push('');
lines.push(
  '/** Master archetype # from icon_prompts (standard 1–360, chaos 361+). Used to sort Badges grid. Improviser has no entry. */'
);
lines.push(
  `export const BADGE_MASTER_SORT_ID_BY_NAME: Record<string, number> = ${JSON.stringify(sortIdByName, null, 2)};`
);
lines.push('');
lines.push(`/** Public URL for a composed archetype badge PNG, or undefined if unknown. */`);
lines.push(`export function getArchetypeBadgePublicUrl(archetypeName: string): string | undefined {`);
lines.push(`  const filename = ARCHETYPE_BADGE_FILENAME_BY_NAME[archetypeName.trim()];`);
lines.push(`  if (!filename) return undefined;`);
lines.push(`  return \`\${ARCHETYPE_BADGE_PUBLIC_DIR}/\${filename}\`;`);
lines.push(`}`);
lines.push('');

fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
console.log('Wrote', outPath, '—', Object.keys(byName).length, 'names → filenames');
