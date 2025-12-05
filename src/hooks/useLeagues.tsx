import { useState, useEffect, createContext, useContext, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Tables } from '@/integrations/supabase/types';

type League = Tables<'leagues'>;

interface LeaguesContextType {
  leagues: League[];
  selectedLeague: League | null;
  setSelectedLeague: (league: League | null) => void;
  loading: boolean;
  refreshLeagues: () => Promise<void>;
}

const LeaguesContext = createContext<LeaguesContextType | undefined>(undefined);

export const LeaguesProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [leagues, setLeagues] = useState<League[]>([]);
  const [selectedLeague, setSelectedLeague] = useState<League | null>(null);
  const [loading, setLoading] = useState(true);
  const hasInitialized = useRef(false);

  const fetchLeagues = useCallback(async () => {
    if (!user) {
      setLeagues([]);
      setSelectedLeague(null);
      setLoading(false);
      hasInitialized.current = false;
      return;
    }

    try {
      const { data, error } = await supabase
        .from('leagues')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLeagues(data || []);
      
      // Only auto-select first league on initial load
      if (!hasInitialized.current && data && data.length > 0) {
        setSelectedLeague(data[0]);
        hasInitialized.current = true;
      } else if (!hasInitialized.current) {
        hasInitialized.current = true;
      }
    } catch (error) {
      console.error('Error fetching leagues:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchLeagues();
  }, [fetchLeagues]);

  const refreshLeagues = async () => {
    await fetchLeagues();
  };

  return (
    <LeaguesContext.Provider
      value={{
        leagues,
        selectedLeague,
        setSelectedLeague,
        loading,
        refreshLeagues,
      }}
    >
      {children}
    </LeaguesContext.Provider>
  );
};

export const useLeagues = () => {
  const context = useContext(LeaguesContext);
  if (context === undefined) {
    throw new Error('useLeagues must be used within a LeaguesProvider');
  }
  return context;
};
