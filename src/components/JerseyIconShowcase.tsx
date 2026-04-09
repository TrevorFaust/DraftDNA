import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { JerseyIcon } from '@/components/JerseyIcon';

/** Demo players; team colors are loaded from `teams` by `team_abbr`. */
const DEMO_ROWS = [
  { name: 'Lamar Jackson', teamAbbr: 'BAL', jerseyNumber: 8 },
  { name: 'Patrick Mahomes', teamAbbr: 'KC', jerseyNumber: 15 },
  { name: 'Josh Allen', teamAbbr: 'BUF', jerseyNumber: 17 },
  { name: 'Justin Jefferson', teamAbbr: 'MIN', jerseyNumber: 18 },
  { name: 'CeeDee Lamb', teamAbbr: 'DAL', jerseyNumber: 88 },
  { name: 'Jordan Love', teamAbbr: 'GB', jerseyNumber: 10 },
  { name: 'Christian McCaffrey', teamAbbr: 'SF', jerseyNumber: 23 },
  { name: 'T.J. Watt', teamAbbr: 'PIT', jerseyNumber: 90 },
] as const;

type TeamColors = {
  team_color: string | null;
  team_color2: string | null;
  team_color3: string | null;
};

/**
 * Renders jersey icons using live `teams.team_color*` values from the database.
 * Includes BAL / MIN as strong two-tone checks (body should read as primary, accents as secondary).
 */
export function JerseyIconShowcase() {
  const [byAbbr, setByAbbr] = useState<Record<string, TeamColors | undefined>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const abbrs = [...new Set(DEMO_ROWS.map((r) => r.teamAbbr))];
      const { data, error: qErr } = await supabase
        .from('teams')
        .select('team_abbr, team_color, team_color2, team_color3')
        .in('team_abbr', abbrs);

      if (cancelled) return;

      if (qErr) {
        setError(qErr.message);
        setByAbbr({});
      } else {
        const map: Record<string, TeamColors> = {};
        for (const row of data ?? []) {
          const ab = row.team_abbr;
          if (ab) {
            map[ab] = {
              team_color: row.team_color,
              team_color2: row.team_color2,
              team_color3: row.team_color3,
            };
          }
        }
        setByAbbr(map);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="glass-card p-6 mb-8">
      <div className="mb-4">
        <h2 className="font-display text-xl">Jersey preview</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Team colors loaded from your database (<code className="text-xs">teams</code> table). Names and numbers are for display only.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-6">
          <Loader2 className="w-5 h-5 animate-spin shrink-0" />
          Loading team colors…
        </div>
      ) : error ? (
        <p className="text-sm text-destructive py-2">{error}</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
          {DEMO_ROWS.map((row) => {
            const colors = byAbbr[row.teamAbbr];
            return (
              <div
                key={row.teamAbbr + row.name}
                className="flex flex-col items-center gap-3 rounded-lg border border-border/40 bg-secondary/20 p-4 text-center"
              >
                <JerseyIcon
                  jerseyNumber={row.jerseyNumber}
                  primaryColor={colors?.team_color}
                  secondaryColor={colors?.team_color2}
                  tertiaryColor={colors?.team_color3}
                  size="md"
                  className="shrink-0"
                />
                <div className="min-w-0 w-full">
                  <div className="font-medium text-sm truncate" title={row.name}>
                    {row.name}
                  </div>
                  <div className="text-xs text-muted-foreground">{row.teamAbbr}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
