import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { NFL_DEFENSE_TEAM_NAMES } from '@/constants/nflDefenses';

/**
 * Row from the public.teams table used for drafting and visualizing NFL teams
 * (e.g. D/ST list, team colors, abbreviations).
 */
export interface NflTeam {
  team_id: string;
  team_abbr: string | null;
  team_name: string | null;
  team_nick: string | null;
}

/**
 * Fetches the 32 NFL teams from the teams table for use in rankings, draft room,
 * and any team-related display. Falls back to NFL_DEFENSE_TEAM_NAMES when the
 * table is empty or the request fails.
 */
export function useNflTeams() {
  const [teams, setTeams] = useState<NflTeam[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from('teams')
        .select('team_id, team_abbr, team_name, team_nick')
        .order('team_name', { ascending: true });

      if (cancelled) return;

      if (error) {
        console.warn('useNflTeams: failed to fetch teams', error);
        setTeams([]);
      } else if (data && data.length > 0) {
        setTeams(
          data.map((row: any) => ({
            team_id: row.team_id,
            team_abbr: row.team_abbr ?? null,
            team_name: row.team_name ?? null,
            team_nick: row.team_nick ?? null,
          }))
        );
      } else {
        setTeams([]);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  /** Ordered list of full team names for D/ST (from DB or fallback constant). */
  const teamNames: readonly string[] =
    teams.length > 0
      ? teams.map((t) => t.team_name).filter((n): n is string => Boolean(n))
      : NFL_DEFENSE_TEAM_NAMES;

  return { teams, teamNames, loading };
}
