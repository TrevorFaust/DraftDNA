/**
 * Generates src/constants/archetypeMappings.generated.ts from:
 * - archetype_logic/Fantasy_Football_Archetype_Master.xlsx - Master Archetypes (2).csv (preferred: named archetypes + flavor text)
 *   OR archetype_logic/Fantasy_Football_Archetype_Master.xlsx - Master Archetypes.csv (secondary)
 *   OR archetype_logic/archetype_mapping(2).csv (fallback: no flavor text)
 * - archetype_logic/detection.scaling_mapping.csv (optional: round windows by total rounds)
 * Run: node scripts/generateArchetypeLogic.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const STRATEGY_TO_ID = {
  'bpa': 'bpa', 'zero rb': 'zero_rb', 'robust rb': 'robust_rb', 'skill pos late': 'skill_pos_late', 'hybrid': 'hybrid', 'hero rb': 'hero_rb',
  'robust wr': 'robust_wr', 'wr late': 'wr_late', 'hero wr': 'hero_wr', 'wr mid': 'wr_mid',
  'early qb': 'early_qb', 'mid qb': 'mid_qb', 'late qb': 'late_qb', 'punt qb': 'punt_qb',
  'early te': 'early_te', 'mid te': 'mid_te', 'stream te': 'stream_te',
  'floor': 'floor', 'upside': 'upside', 'vbd': 'vbd', 'handcuff': 'handcuff',
};

function parseCsv(content) {
  const lines = content.split(/\r?\n/).filter(Boolean);
  return lines.map(line => {
    const parts = [];
    let cur = '', inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { inQuotes = !inQuotes; continue; }
      if (!inQuotes && c === ',') { parts.push(cur.trim()); cur = ''; continue; }
      cur += c;
    }
    parts.push(cur.trim());
    return parts;
  });
}

function normalize(s) { return (s || '').trim().toLowerCase(); }

function capitalizeSentenceStart(text) {
  const s = (text || '').trim();
  if (!s) return '';
  return s.replace(/[a-zA-Z]/, (c) => c.toLocaleUpperCase('en-US'));
}

// Prefer Master Archetypes (2) CSV (has Flavor Text); then Master Archetypes; fallback to legacy mapping
const masterArchetypePathV2 = path.join(root, 'archetype_logic', 'Fantasy_Football_Archetype_Master.xlsx - Master Archetypes (2).csv');
const masterArchetypePath = path.join(root, 'archetype_logic', 'Fantasy_Football_Archetype_Master.xlsx - Master Archetypes.csv');
const legacyArchetypePath = path.join(root, 'archetype_logic', 'archetype_mapping(2).csv');
const archetypePath = fs.existsSync(masterArchetypePathV2)
  ? masterArchetypePathV2
  : (fs.existsSync(masterArchetypePath) ? masterArchetypePath : legacyArchetypePath);
const archetypeCsv = fs.readFileSync(archetypePath, 'utf8');
const archetypeRows = parseCsv(archetypeCsv);
const dataRows = archetypeRows.slice(1); // skip header

// Master CSV columns: #, Archetype Name, Named?, RB Strategy, WR Strategy, QB Strategy, TE Strategy, Late Round Philosophy, Flavor Text (index 8)
// Legacy CSV columns: #, Archetype Name, Named?, RB, WR, QB, TE, Late (no flavor text)
const hasFlavorColumn = archetypeRows[0] && normalize(archetypeRows[0][8] || '').includes('flavor');

const archetypes = [];
const missingFlavor = [];
for (const row of dataRows) {
  const name = row[1];
  const rb = STRATEGY_TO_ID[normalize(row[3])];
  const wr = STRATEGY_TO_ID[normalize(row[4])];
  const qb = STRATEGY_TO_ID[normalize(row[5])];
  const te = STRATEGY_TO_ID[normalize(row[6])];
  const late = STRATEGY_TO_ID[normalize(row[7])];
  if (name && rb && wr && qb && te && late) {
    let flavorText = hasFlavorColumn && row[8] ? (row[8] || '').trim() : undefined;
    if (flavorText) flavorText = capitalizeSentenceStart(flavorText);
    if (hasFlavorColumn && (!flavorText || flavorText.length < 20)) missingFlavor.push(name);
    archetypes.push({ name, rb, wr, qb, te, late, flavorText: flavorText || undefined });
  }
}
if (missingFlavor.length > 0) {
  console.warn('Archetypes with missing or very short flavor text:', missingFlavor.join(', '));
}

// Override flavor text for archetypes that may be truncated in CSV (e.g. unquoted field with commas)
const STEADY_BUILDER_FLAVOR = 'The first six rounds were a methodical RB and WR rotation before the tight end position was skipped entirely and the quarterback added deep in the backend after the skill positions were fully stacked. The Steady Builder lays the foundation one skill position at a time and does not address supporting roles until the core is complete. The floor-first backend confirms that every decision on this roster was made in the correct order.';
for (const a of archetypes) {
  if (a.name === 'The Steady Builder') a.flavorText = STEADY_BUILDER_FLAVOR;
}

// Detection CSV (optional): round windows by total rounds
let strategyWindows = {};
const detectionPath = path.join(root, 'archetype_logic', 'detection.scaling_mapping.csv');
if (fs.existsSync(detectionPath)) {
  const detectionCsv = fs.readFileSync(detectionPath, 'utf8');
  const detectionRows = parseCsv(detectionCsv);
  const totalRoundsColumns = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 22, 25, 28, 30];
  for (let r = 4; r < detectionRows.length; r++) {
    const row = detectionRows[r];
    const strategy = (row[0] || '').trim();
    if (!strategy || strategy === 'RB STRATEGY' || strategy === 'WR STRATEGY' || strategy === 'QB STRATEGY' || strategy === 'TE STRATEGY' || strategy === 'LATE ROUND PHILOSOPHY') continue;
    const key = normalize(strategy).replace(/\s+/g, '_');
    strategyWindows[key] = {};
    totalRoundsColumns.forEach(tr => {
      const col = totalRoundsColumns.indexOf(tr) + 3;
      strategyWindows[key][tr] = (row[col] || '').trim();
    });
  }
}

// Build round-window lookup: strategy ID (our IDs) to key in strategyWindows
const strategyIdToDetectionKey = {
  zero_rb: 'zero_rb', hero_rb: 'hero_rb', robust_rb: 'robust_rb', skill_pos_late: 'skill_pos_late', hybrid: 'hybrid', bpa: 'bpa',
  hero_wr: 'hero_wr', robust_wr: 'robust_wr', wr_mid: 'wr_mid', wr_late: 'wr_late',
  early_qb: 'early_qb', mid_qb: 'mid_qb', late_qb: 'late_qb', punt_qb: 'punt_qb',
  early_te: 'early_te', mid_te: 'mid_te', stream_te: 'stream_te',
  upside: 'upside', floor: 'floor', vbd: 'vbd', handcuff: 'handcuff',
};

function out() {
  const lines = [];
  lines.push('/**');
  lines.push(' * Generated from Master Archetypes CSV (or archetype_mapping) and optional detection.scaling_mapping.csv.');
  lines.push(' * Do not edit by hand. Run: node scripts/generateArchetypeLogic.mjs');
  lines.push(' */');
  lines.push('');
  lines.push("import type { ArchetypeStrategies, RbStrategyId, WrStrategyId, QbStrategyId, TeStrategyId, LateStrategyId } from './archetypeStrategies';");
  lines.push('');
  lines.push('export interface NamedArchetype {');
  lines.push('  name: string;');
  lines.push('  strategies: ArchetypeStrategies;');
  lines.push('  /** 1–2 sentence description for tooltips and draft completion. */');
  lines.push('  flavorText?: string;');
  lines.push('}');
  lines.push('');
  const listEntries = archetypes.map(a => {
    const o = { name: a.name, strategies: { rb: a.rb, wr: a.wr, qb: a.qb, te: a.te, late: a.late } };
    if (a.flavorText) o.flavorText = a.flavorText;
    return o;
  });
  lines.push(`export const ARCHETYPE_LIST: NamedArchetype[] = ${JSON.stringify(listEntries, null, 2)};`);
  lines.push('');
  lines.push('const ARCHETYPE_BY_NAME = new Map(ARCHETYPE_LIST.map(a => [a.name.toLowerCase(), a]));');
  lines.push('');
  lines.push('export function getArchetypeByName(name: string): NamedArchetype | undefined {');
  lines.push('  return ARCHETYPE_BY_NAME.get(name.trim().toLowerCase());');
  lines.push('}');
  lines.push('');
  lines.push('export function getArchetypeNameByStrategies(strategies: ArchetypeStrategies): string | undefined {');
  lines.push('  const s = strategies;');
  lines.push('  return ARCHETYPE_LIST.find(a => a.strategies.rb === s.rb && a.strategies.wr === s.wr && a.strategies.qb === s.qb && a.strategies.te === s.te && a.strategies.late === s.late)?.name;');
  lines.push('}');
  lines.push('');
  lines.push('// Round windows by total draft rounds (from detection.scaling_mapping.csv)');
  lines.push(`export const ROUND_WINDOWS_BY_STRATEGY: Record<string, Record<number, string>> = ${JSON.stringify(strategyWindows, null, 2)};`);
  lines.push('');
  lines.push('export const DETECTION_STRATEGY_KEYS: Record<string, string> = ' + JSON.stringify(strategyIdToDetectionKey) + ';');
  lines.push('');
  lines.push('/** Get round window string for a strategy and total rounds (e.g. "R1-4", "R8+"). Uses closest column if exact totalRounds not in sheet. */');
  lines.push('export function getRoundWindowForStrategy(strategyId: string, totalRounds: number): string | undefined {');
  lines.push('  const key = DETECTION_STRATEGY_KEYS[strategyId];');
  lines.push('  if (!key) return undefined;');
  lines.push('  const windows = ROUND_WINDOWS_BY_STRATEGY[key];');
  lines.push('  if (!windows) return undefined;');
  lines.push('  const rounds = [9,10,11,12,13,14,15,16,17,18,19,20,22,25,28,30];');
  lines.push('  let best = rounds[0];');
  lines.push('  for (const r of rounds) { if (r <= totalRounds) best = r; }');
  lines.push('  return windows[best];');
  lines.push('}');
  lines.push('');
  return lines.join('\n');
}

const outPath = path.join(root, 'src', 'constants', 'archetypeMappings.generated.ts');
fs.writeFileSync(outPath, out(), 'utf8');
console.log('Wrote', outPath, '—', archetypes.length, 'archetypes,', Object.keys(strategyWindows).length, 'strategy windows');
