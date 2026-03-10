import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useLeagues } from './useLeagues';
import { tempSettingsStorage } from '@/utils/temporaryStorage';
import type { Tables } from '@/integrations/supabase/types';

export type ScoringFormat = 'standard' | 'ppr' | 'half_ppr';
export type LeagueType = 'season' | 'dynasty';

export interface CommunityRankingsBucket {
  scoringFormat: ScoringFormat;
  leagueType: LeagueType;
  isSuperflex: boolean;
  rookiesOnly: boolean;
}

/** Extract bucket from a league row. Explicitly handle is_superflex to avoid null/undefined as false. */
function bucketFromLeague(league: Pick<Tables<'leagues'>, 'scoring_format' | 'league_type' | 'is_superflex' | 'rookies_only'>): CommunityRankingsBucket {
  return {
    scoringFormat: (league.scoring_format as ScoringFormat) || 'ppr',
    leagueType: (league.league_type as LeagueType) || 'season',
    isSuperflex: Boolean(league.is_superflex),
    rookiesOnly: Boolean((league as any).rookies_only) && ((league.league_type as string) || '') === 'dynasty',
  };
}

/**
 * Returns the bucket (scoring_format, league_type, is_superflex) to use for
 * fetching community rankings. Matches the user's current league settings.
 * When navigating from "Create League", location.state.leagueForBucket is used
 * so the Rankings page shows the correct bucket immediately (avoids race with
 * selectedLeague update).
 * Memoized so the object reference is stable when values haven't changed,
 * preventing dependency loops in consumers (e.g. fetchPlayers).
 * @param guestSettingsVersion - When provided, included in deps so guest temp settings are re-read when this changes (e.g. when guest changes Rankings dropdown).
 */
export function useCommunityRankingsBucket(guestSettingsVersion?: number): CommunityRankingsBucket {
  const { selectedLeague, user, leagues } = useLeagues();
  const location = useLocation();
  const leagueForBucket = (location.state as { leagueForBucket?: Tables<'leagues'> })?.leagueForBucket;
  const bucketForGuest = (location.state as { bucketForGuest?: CommunityRankingsBucket })?.bucketForGuest;

  return useMemo(() => {
    // Prefer league from navigation (e.g. just created) - ensures correct bucket when landing on Rankings to finalize.
    if (leagueForBucket) {
      return bucketFromLeague(leagueForBucket);
    }
    // Guest: prefer bucket passed via navigation (e.g. from League Settings "Go to Rankings") so finalize page shows that bucket.
    if (!user && bucketForGuest && (bucketForGuest.scoringFormat != null || bucketForGuest.leagueType != null)) {
      return {
        scoringFormat: (bucketForGuest.scoringFormat as ScoringFormat) || 'ppr',
        leagueType: (bucketForGuest.leagueType as LeagueType) || 'season',
        isSuperflex: Boolean(bucketForGuest.isSuperflex),
        rookiesOnly: Boolean(bucketForGuest.rookiesOnly) && ((bucketForGuest.leagueType as string) || '') === 'dynasty',
      };
    }
    // When a specific league is selected, use that league's bucket (half_ppr, ppr, standard, etc.)
    if (user && selectedLeague) {
      return bucketFromLeague(selectedLeague);
    }
    // "All leagues" or no selection: use saved league from localStorage, else first league
    if (user && leagues.length > 0) {
      const savedId = typeof window !== 'undefined' ? localStorage.getItem('selectedLeagueId') : null;
      const savedLeague = savedId && savedId !== 'null' ? leagues.find((l) => l.id === savedId) : null;
      return bucketFromLeague(savedLeague ?? leagues[0]);
    }
    // Guest: use bucket from League Settings (tempSettingsStorage) so Rankings matches what they set
    if (!user && typeof window !== 'undefined') {
      const ts = tempSettingsStorage.get();
      if (ts) {
        return {
          scoringFormat: (ts.scoringFormat as ScoringFormat) || 'ppr',
          leagueType: (ts.leagueType as LeagueType) || 'season',
          isSuperflex: Boolean(ts.isSuperflex),
          rookiesOnly: Boolean(ts.rookiesOnly) && (ts.leagueType === 'dynasty'),
        };
      }
    }
    return {
      scoringFormat: 'ppr',
      leagueType: 'season',
      isSuperflex: false,
      rookiesOnly: false,
    };
  }, [
    leagueForBucket?.id,
    leagueForBucket?.scoring_format,
    leagueForBucket?.league_type,
    leagueForBucket?.is_superflex,
    (leagueForBucket as any)?.rookies_only,
    user?.id,
    selectedLeague?.id,
    selectedLeague?.scoring_format,
    selectedLeague?.league_type,
    selectedLeague?.is_superflex,
    (selectedLeague as any)?.rookies_only,
    leagues.length,
    leagues[0]?.id,
    leagues[0]?.scoring_format,
    leagues[0]?.league_type,
    leagues[0]?.is_superflex,
    (leagues[0] as any)?.rookies_only,
    guestSettingsVersion,
    bucketForGuest?.scoringFormat,
    bucketForGuest?.leagueType,
    bucketForGuest?.isSuperflex,
    bucketForGuest?.rookiesOnly,
  ]);
}
