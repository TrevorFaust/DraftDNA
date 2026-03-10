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

// Helper function to read saved league ID from localStorage synchronously
const getSavedLeagueId = (): string | null => {
  if (typeof window === 'undefined') return null;
  const savedId = localStorage.getItem('selectedLeagueId');
  return savedId && savedId !== 'null' ? savedId : null;
};

export const LeaguesProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [leagues, setLeagues] = useState<League[]>([]);
  // Initialize selectedLeague state with saved ID from localStorage (synchronously)
  // This ensures we have the saved ID before any async operations
  const [selectedLeague, setSelectedLeague] = useState<League | null>(null);
  const [loading, setLoading] = useState(true);
  const hasInitialized = useRef(false);
  const isRestoringFromStorage = useRef(false);
  // Track previous user to detect sign-out vs initial load
  const previousUserRef = useRef<User | null>(null);
  // CRITICAL: Initialize ref synchronously on component mount, BEFORE any effects run
  // This ensures localStorage is read before fetchLeagues runs
  // Store raw value (including 'null' string) to preserve "All leagues" selection
  const savedLeagueIdRef = useRef<string | null>(
    typeof window !== 'undefined' ? localStorage.getItem('selectedLeagueId') : null
  );
  
  // Mark that we've read from localStorage to prevent auto-selection on first run
  const hasReadFromStorage = useRef(false);

  // Keep ref in sync with localStorage whenever user changes
  // CRITICAL: This runs BEFORE fetchLeagues (useEffect order), ensuring ref is set
  useEffect(() => {
    if (user) {
      // Read raw value from localStorage (not filtered) to preserve 'null' for "All leagues"
      const rawSavedId = localStorage.getItem('selectedLeagueId');
      // Only update ref if localStorage has a value, or if ref is null (preserve ref value if localStorage is empty)
      // This prevents overwriting the ref with null when localStorage might be temporarily unavailable
      if (rawSavedId !== null) {
        savedLeagueIdRef.current = rawSavedId;
        hasReadFromStorage.current = true;
      } else if (savedLeagueIdRef.current === null) {
        // Only set to null if ref is also null (first time, no saved value)
        hasReadFromStorage.current = false;
      } else {
        // localStorage is empty but ref has value - preserve ref value (might be from initialization)
        hasReadFromStorage.current = true;
      }
      previousUserRef.current = user;
    } else {
      // User is null - check if this is a sign-out (user was previously set) vs initial load
      if (previousUserRef.current !== null) {
        // User signed out - clear localStorage
        localStorage.removeItem('selectedLeagueId');
        savedLeagueIdRef.current = null;
        hasReadFromStorage.current = false;
      }
      // If previousUserRef.current is null, this is just initial load, don't clear localStorage
      previousUserRef.current = null;
    }
  }, [user]);

  const fetchLeagues = useCallback(async () => {
    if (!user) {
      setLeagues([]);
      setSelectedLeague(null);
      setLoading(false);
      hasInitialized.current = false;
      isRestoringFromStorage.current = false;
      // DON'T clear localStorage here - user might just be loading
      // Only clear on explicit sign out, not during auth loading
      // localStorage.removeItem('selectedLeagueId');
      return;
    }

    try {
      // CRITICAL: Read from localStorage SYNCHRONOUSLY before fetching leagues
      // This ensures we have the saved ID even on the first call
      // Always read directly from localStorage as the source of truth
      let directRead = localStorage.getItem('selectedLeagueId');
      
      // Use ref as fallback if directRead is null/undefined/empty string
      // This handles cases where localStorage might not be immediately available on refresh
      let actualRead: string | null = directRead;
      
      // CRITICAL: If directRead is null/undefined/empty, check the ref as fallback
      // The ref is initialized synchronously and should have the last known value
      // This handles cases where localStorage might be temporarily unavailable on refresh
      if (!directRead || directRead === '') {
        // localStorage is empty - check ref as fallback
        if (savedLeagueIdRef.current && savedLeagueIdRef.current !== 'null') {
          actualRead = savedLeagueIdRef.current;
          // Also restore it to localStorage if it's missing
          localStorage.setItem('selectedLeagueId', savedLeagueIdRef.current);
        } else if (savedLeagueIdRef.current === 'null') {
          // Ref has 'null' (All leagues), use it
          actualRead = 'null';
          localStorage.setItem('selectedLeagueId', 'null');
        } else {
          // Both are null - first time user or no selection
          actualRead = null;
        }
      } else {
        // localStorage has a value - use it and sync ref
        actualRead = directRead;
        if (directRead !== 'null' && directRead !== savedLeagueIdRef.current) {
          // If directRead has a value but ref doesn't match, update ref (localStorage is source of truth)
          savedLeagueIdRef.current = directRead;
        } else if (directRead === 'null' && savedLeagueIdRef.current !== 'null') {
          // If localStorage explicitly has 'null' (All leagues), update ref
          savedLeagueIdRef.current = 'null';
        }
      }
      
      // Handle three cases:
      // 1. null/undefined = no selection saved (first time user)
      // 2. 'null' = user explicitly selected "All leagues"
      // 3. valid ID = user selected a specific league
      // CRITICAL: Calculate these AFTER the fallback logic has potentially updated actualRead
      // Also ensure actualRead is set correctly - if we restored from ref, use that value
      const isExplicitlyAllLeagues = actualRead === 'null';
      const validSavedId = actualRead && actualRead !== 'null' ? actualRead : null;
      
      // CRITICAL: If we used fallback and restored to localStorage, ensure ref is also updated
      if (!directRead && savedLeagueIdRef.current && savedLeagueIdRef.current !== 'null' && validSavedId) {
        // We restored from ref - ensure ref stays in sync
        if (savedLeagueIdRef.current !== validSavedId) {
          savedLeagueIdRef.current = validSavedId;
        }
      }
      
      // Update ref to keep it in sync (always use the most recent value)
      // Note: validSavedId is null for "All leagues", but we want to preserve 'null' string in ref
      if (isExplicitlyAllLeagues) {
        if (savedLeagueIdRef.current !== 'null') {
          savedLeagueIdRef.current = 'null';
          hasReadFromStorage.current = true;
        }
      } else if (validSavedId !== savedLeagueIdRef.current) {
        savedLeagueIdRef.current = validSavedId;
        hasReadFromStorage.current = true;
      }
      
      const { data, error } = await supabase
        .from('leagues')
        .select('*')
        .eq('user_id', user.id)
        .order('display_order', { ascending: true, nullsLast: true })
        .order('created_at', { ascending: false });

      if (error) throw error;
      const leaguesData = data || [];
      setLeagues(leaguesData);
      
      // CRITICAL: Check if we missed using the ref fallback - if ref has value but validSavedId is null
      // This can happen if localStorage was cleared after ref was initialized, or if the fallback didn't run
      // Recalculate validSavedId using ref if needed
      let finalValidSavedId = validSavedId;
      if (!finalValidSavedId && !isExplicitlyAllLeagues && savedLeagueIdRef.current && savedLeagueIdRef.current !== 'null') {
        finalValidSavedId = savedLeagueIdRef.current;
        localStorage.setItem('selectedLeagueId', savedLeagueIdRef.current);
      }
      
      // Handle explicit "All leagues" selection (localStorage = 'null')
      if (isExplicitlyAllLeagues) {
        setSelectedLeague(null);
        hasInitialized.current = true;
        setLoading(false);
        return;
      }
      
      // ALWAYS check localStorage and restore if we have a saved league
      // This ensures restoration happens even if fetchLeagues is called multiple times
      // Use finalValidSavedId which may come from directRead, ref fallback, or late fallback
      if (finalValidSavedId && leaguesData.length > 0) {
        const savedLeague = leaguesData.find(l => l.id === finalValidSavedId);
        
        if (savedLeague) {
          // Found saved league - ALWAYS restore it if selectedLeague is null or doesn't match
          // This handles page refresh scenarios where selectedLeague starts as null
          setSelectedLeague((current) => {
            // Always restore if current is null (page refresh scenario)
            // Or if current doesn't match the saved league (shouldn't happen, but safety check)
            if (!current || current.id !== savedLeague.id) {
              isRestoringFromStorage.current = true;
              hasInitialized.current = true;
              // Ensure localStorage is also updated (in case it wasn't persisted)
              localStorage.setItem('selectedLeagueId', savedLeague.id);
              return savedLeague;
            }
            // Current matches saved, no change needed
            if (!hasInitialized.current) {
              hasInitialized.current = true;
            }
            return current;
          });
          // Exit early to prevent auto-selection - the saved league is restored
          setLoading(false);
          return;
        } else {
          // Saved league not found in data (might have been deleted), clear localStorage
          localStorage.removeItem('selectedLeagueId');
          savedLeagueIdRef.current = null;
        }
      }
      
      // Only auto-select first league if:
      // 1. We haven't initialized yet (first load)
      // 2. AND no saved league was found/restored (already checked above - we would have returned early)
      // 3. AND we have leagues available
      // 4. AND selectedLeague is currently null (not already set)
      // 5. AND user didn't explicitly select "All leagues" (handled above)
      // 6. AND localStorage key doesn't exist AND ref doesn't have a value (truly first time)
      // CRITICAL: Check both directRead AND ref - if either has a value, don't auto-select
      const hasAnySavedValue = directRead !== null || savedLeagueIdRef.current !== null;
      if (!hasInitialized.current && leaguesData.length > 0 && !isExplicitlyAllLeagues && !hasAnySavedValue && !finalValidSavedId) {
        setSelectedLeague((current) => {
          // Only auto-select if current is null AND there's truly no saved league anywhere
          if (!current) {
            const firstLeague = leaguesData[0];
            localStorage.setItem('selectedLeagueId', firstLeague.id);
            savedLeagueIdRef.current = firstLeague.id;
            hasInitialized.current = true;
            return firstLeague;
          }
          // If current is already set, don't override it
          if (!hasInitialized.current) {
            hasInitialized.current = true;
          }
          return current;
        });
      } else if (!hasInitialized.current) {
        // If we reach here and haven't initialized, it means:
        // - Either localStorage had 'null' (All leagues) - already handled above
        // - Or there was a saved league that wasn't found - already handled above
        // - Or localStorage exists but is invalid - just mark as initialized
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

  const refreshLeagues = useCallback(async () => {
    // Preserve the current selection before refreshing
    const currentSelectedId = selectedLeague?.id || localStorage.getItem('selectedLeagueId');
    
    // fetchLeagues will check localStorage and restore the saved league
    // But we also want to ensure we don't lose the current selection if it's valid
    await fetchLeagues();
    
    // Double-check: if we had a selected league, make sure it's still selected after refresh
    // This is a safety net in case fetchLeagues didn't restore it
    if (currentSelectedId && currentSelectedId !== 'null' && user && !selectedLeague) {
      const { data: refreshedLeagues } = await supabase
        .from('leagues')
        .select('*')
        .eq('user_id', user.id)
        .order('display_order', { ascending: true, nullsLast: true })
        .order('created_at', { ascending: false });
      
      if (refreshedLeagues) {
        const refreshedSelected = refreshedLeagues.find(l => l.id === currentSelectedId);
        if (refreshedSelected) {
          setSelectedLeague(refreshedSelected);
          localStorage.setItem('selectedLeagueId', refreshedSelected.id);
        }
      }
    }
  }, [selectedLeague, user, fetchLeagues]);
  
  // Wrapper for setSelectedLeague that also persists to localStorage
  const setSelectedLeagueWithPersistence = useCallback((league: League | null) => {
    setSelectedLeague(league);
    // Mark that we're no longer restoring from storage (user made a manual selection)
    isRestoringFromStorage.current = false;
    if (league) {
      localStorage.setItem('selectedLeagueId', league.id);
      savedLeagueIdRef.current = league.id;
    } else {
      localStorage.setItem('selectedLeagueId', 'null');
      savedLeagueIdRef.current = null;
    }
  }, []);

  return (
    <LeaguesContext.Provider
      value={{
        leagues,
        selectedLeague,
        setSelectedLeague: setSelectedLeagueWithPersistence,
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
