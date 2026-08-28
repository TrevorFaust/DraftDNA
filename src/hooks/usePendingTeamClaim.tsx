import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useLeagues } from '@/hooks/useLeagues';
import { supabase } from '@/integrations/supabase/client';
import { leagueClaimTeam, leagueListSeats } from '@/utils/leagueSocialApi';
import { userFacingErrorMessage } from '@/utils/userFacingError';
import type { LeagueSeat } from '@/types/leagueSocial';

type OpenClaim = {
  leagueId: string;
  seats: LeagueSeat[];
};

type PendingTeamClaimContextType = {
  claim: (OpenClaim & { leagueName: string }) | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  pickedTeam: number | null;
  setPickedTeam: (teamNumber: number | null) => void;
  submit: () => Promise<boolean>;
  reload: () => Promise<void>;
};

const PendingTeamClaimContext = createContext<PendingTeamClaimContextType | undefined>(undefined);

export function PendingTeamClaimProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { leagues, selectedLeague, setSelectedLeague } = useLeagues();
  const [claim, setClaim] = useState<OpenClaim | null>(null);
  const [loading, setLoading] = useState(Boolean(user));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickedTeam, setPickedTeam] = useState<number | null>(null);

  const reload = useCallback(async () => {
    if (!user) {
      setClaim(null);
      setPickedTeam(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: queryError } = await (supabase as any)
        .from('league_members')
        .select('league_id, team_number, role')
        .eq('user_id', user.id)
        .eq('role', 'member')
        .is('team_number', null);
      if (queryError) throw queryError;
      const rows = (data as { league_id: string }[] | null) ?? [];
      const first = rows[0];
      if (!first) {
        setClaim(null);
        setPickedTeam(null);
        return;
      }
      const seats = await leagueListSeats(first.league_id);
      setClaim({ leagueId: first.league_id, seats });
    } catch (err) {
      setError(userFacingErrorMessage(err, "Couldn't load teams to claim."));
      setClaim(null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!claim) return;
    const league = leagues.find((item) => item.id === claim.leagueId);
    if (league && selectedLeague?.id !== league.id) {
      setSelectedLeague(league);
    }
  }, [claim, leagues, selectedLeague?.id, setSelectedLeague]);

  const submit = useCallback(async () => {
    if (!claim || pickedTeam == null) return false;
    setSaving(true);
    setError(null);
    try {
      await leagueClaimTeam(claim.leagueId, pickedTeam);
      setPickedTeam(null);
      await reload();
      return true;
    } catch (err) {
      setError(userFacingErrorMessage(err, "Couldn't claim that team."));
      return false;
    } finally {
      setSaving(false);
    }
  }, [claim, pickedTeam, reload]);

  const claimWithName = useMemo(() => {
    if (!claim) return null;
    return {
      ...claim,
      leagueName: leagues.find((item) => item.id === claim.leagueId)?.name ?? 'this league',
    };
  }, [claim, leagues]);

  return (
    <PendingTeamClaimContext.Provider
      value={{
        claim: claimWithName,
        loading,
        saving,
        error,
        pickedTeam,
        setPickedTeam,
        submit,
        reload,
      }}
    >
      {children}
    </PendingTeamClaimContext.Provider>
  );
}

export function usePendingTeamClaim() {
  const context = useContext(PendingTeamClaimContext);
  if (context === undefined) {
    throw new Error('usePendingTeamClaim must be used within a PendingTeamClaimProvider');
  }
  return context;
}
