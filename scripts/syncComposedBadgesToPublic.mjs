/**
 * Copies finished composed PNGs from badges/composed → public/badges so Vite can serve them at /badges/*.png.
 * No image generation — only file copy. Run automatically before dev/build via package.json.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const composedDir = path.join(root, 'badges', 'composed');
const publicBadgesDir = path.join(root, 'public', 'badges');

if (!fs.existsSync(composedDir)) {
  console.warn('[sync:badges] badges/composed not found — nothing to copy (add PNGs from build_badges.py).');
  process.exit(0);
}

fs.mkdirSync(publicBadgesDir, { recursive: true });

const files = fs.readdirSync(composedDir).filter((f) => f.toLowerCase().endsWith('.png'));
let copied = 0;
let skipped = 0;

for (const name of files) {
  const src = path.join(composedDir, name);
  const dst = path.join(publicBadgesDir, name);
  try {
    if (fs.existsSync(dst) && fs.statSync(src).mtimeMs <= fs.statSync(dst).mtimeMs) {
      skipped++;
      continue;
    }
    fs.copyFileSync(src, dst);
    copied++;
  } catch (e) {
    console.warn('[sync:badges]', name, e.message);
  }
}

console.log(
  `[sync:badges] ${composedDir} → ${publicBadgesDir} — copied ${copied}, up-to-date ${skipped}, total in composed ${files.length}`
);
