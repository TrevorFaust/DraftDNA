import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const root = join(import.meta.dirname ?? __dirname, '..');
const sql = readFileSync(
  join(root, 'supabase/migrations/20260524120000_fantasy_team_depth_chart.sql'),
  'utf8'
);
const ddlEnd = sql.indexOf('DELETE FROM');
const ddl = sql.slice(0, ddlEnd);
const data = sql.slice(ddlEnd);
const valuesStart = data.indexOf('VALUES') + 'VALUES'.length;
const valuesBody = data.slice(valuesStart).trim().replace(/;\s*$/, '');
const vals = valuesBody.split(/,\n(?=\(2026)/);

writeFileSync(join(root, 'supabase/.tmp_depth_ddl.sql'), ddl);

const chunkCount = 3;
const per = Math.ceil(vals.length / chunkCount);
for (let i = 0; i < chunkCount; i++) {
  const chunk = vals.slice(i * per, (i + 1) * per);
  const prefix =
    i === 0 ? 'DELETE FROM public.fantasy_team_depth WHERE season = 2026;\n' : '';
  const suffix = i === chunkCount - 1 ? ';' : ',';
  const q = `${prefix}INSERT INTO public.fantasy_team_depth (season, team_abbr, position, depth_rank, player_name) VALUES\n${chunk.join(',\n')}${suffix}`;
  writeFileSync(join(root, `supabase/.tmp_depth_data_${i}.sql`), q);
}

console.log(`ddl ${ddl.length} bytes, ${vals.length} rows in ${chunkCount} chunks`);
