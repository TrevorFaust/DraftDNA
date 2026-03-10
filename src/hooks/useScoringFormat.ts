import { useLeagues } from './useLeagues';
import { tempSettingsStorage } from '@/utils/temporaryStorage';
import type { ScoringFormat } from '@/utils/fantasyPoints';

/**
 * Returns the current scoring format for display/calculation.
 * - Logged-in with league selected: uses league.scoring_format
 * - Guest or no league: uses tempSettingsStorage.scoringFormat
 * - Default: 'ppr'
 */
export function useScoringFormat(): ScoringFormat {
  const { selectedLeague, user } = useLeagues();

  if (user && selectedLeague?.scoring_format) {
    const format = selectedLeague.scoring_format as string;
    if (format === 'standard' || format === 'ppr' || format === 'half_ppr') {
      return format as ScoringFormat;
    }
  }

  const tempSettings = tempSettingsStorage.get();
  const format = tempSettings?.scoringFormat;
  if (format === 'standard' || format === 'ppr' || format === 'half_ppr') {
    return format as ScoringFormat;
  }

  return 'ppr'; // default for guests and new users
}
