import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLeagues } from '@/hooks/useLeagues';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Save, Users, Settings2, ArrowLeft, Layers, BookmarkPlus, Plus, Trash2, HelpCircle, ListOrdered } from 'lucide-react';
import { tempSettingsStorage } from '@/utils/temporaryStorage';
import { cn } from '@/lib/utils';
import { PlayerSearchCombobox } from '@/components/PlayerSearchCombobox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { Player } from '@/types/database';

interface PositionLimits {
  QB: number;
  RB: number;
  WR: number;
  TE: number;
  FLEX: number;
  K: number;
  DEF: number;
  BENCH: number;
  KEEPERS: number;
}

interface TeamName {
  team_number: number;
  team_name: string;
}

interface KeeperSlot {
  player: Player | null;
  round: number;
}

export default function LeagueSettings() {
  const { user, loading: authLoading } = useAuth();
  const { selectedLeague, refreshLeagues, setSelectedLeague, loading: leaguesLoading, leagues } = useLeagues();
  const navigate = useNavigate();
  
  // Track previous selectedLeague to detect transitions
  const prevSelectedLeagueRef = useRef<typeof selectedLeague>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  // Check if there's a league ID in localStorage that should be selected
  // This helps when transitioning from "All Leagues" to a specific league
  useEffect(() => {
    if (user && !selectedLeague && !leaguesLoading && leagues.length > 0) {
      const savedLeagueId = localStorage.getItem('selectedLeagueId');
      if (savedLeagueId && savedLeagueId !== 'null' && savedLeagueId !== 'all') {
        const leagueToSelect = leagues.find(l => l.id === savedLeagueId);
        if (leagueToSelect && leagueToSelect.id !== prevSelectedLeagueRef.current?.id) {
          // A league was selected but not yet set - set it now
          setSelectedLeague(leagueToSelect);
          setIsTransitioning(true);
          setTimeout(() => setIsTransitioning(false), 100);
        }
      }
    }
  }, [user, selectedLeague, leaguesLoading, leagues, setSelectedLeague]);
  
  const [positionLimits, setPositionLimits] = useState<Record<keyof PositionLimits, number | string>>({
    QB: 4, RB: 8, WR: 8, TE: 6, FLEX: 1, K: 3, DEF: 3, BENCH: 5, KEEPERS: 1
  });
  
  const defaultMinimums: PositionLimits = {
    QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1, K: 1, DEF: 1, BENCH: 0, KEEPERS: 0
  };
  
  const defaultMaximums: PositionLimits = {
    QB: 15, RB: 15, WR: 15, TE: 15, FLEX: 6, K: 15, DEF: 15, BENCH: 15, KEEPERS: 20
  };
  const [teamNames, setTeamNames] = useState<TeamName[]>([]);
  const [leagueName, setLeagueName] = useState('');
  const [numTeams, setNumTeams] = useState<number | string>(12);
  const [userPickPosition, setUserPickPosition] = useState<number | string>(1);
  const [draftOrder, setDraftOrder] = useState('snake');
  const [scoringFormat, setScoringFormat] = useState<'standard' | 'ppr' | 'half_ppr'>('ppr');
  const [leagueType, setLeagueType] = useState('season');
  const [isSuperflex, setIsSuperflex] = useState(false);
  const [rookiesOnly, setRookiesOnly] = useState(false);
  const [saving, setSaving] = useState(false);
  // Keepers: per team, 1-5 slots. Each slot: { player, round }. Logged-in users only.
  const [keepersByTeam, setKeepersByTeam] = useState<Record<number, KeeperSlot[]>>({});
  
  // Detect when selectedLeague is transitioning from null to a league
  useEffect(() => {
    if (prevSelectedLeagueRef.current === null && selectedLeague !== null) {
      // Transitioning from null to a league - set transitioning state
      setIsTransitioning(true);
      // Clear transitioning state after a brief moment to allow state to settle
      const timer = setTimeout(() => {
        setIsTransitioning(false);
      }, 100);
      return () => clearTimeout(timer);
    }
    prevSelectedLeagueRef.current = selectedLeague;
  }, [selectedLeague]);

  // Don't redirect - allow non-logged-in users to view league settings (read-only)
  // They can adjust settings but can't save without being logged in

  // Load settings from localStorage for guests on mount
  useEffect(() => {
    if (!user && !selectedLeague) {
      const tempSettings = tempSettingsStorage.get();
      if (tempSettings) {
        if (tempSettings.numTeams) setNumTeams(tempSettings.numTeams);
        if (tempSettings.userPickPosition) setUserPickPosition(tempSettings.userPickPosition);
        if (tempSettings.draftOrder) setDraftOrder(tempSettings.draftOrder);
        if (tempSettings.scoringFormat) setScoringFormat(tempSettings.scoringFormat as 'standard' | 'ppr' | 'half_ppr');
        if (tempSettings.leagueType) setLeagueType(tempSettings.leagueType);
        if (tempSettings.isSuperflex !== undefined) setIsSuperflex(tempSettings.isSuperflex);
        if (tempSettings.rookiesOnly !== undefined) setRookiesOnly(tempSettings.rookiesOnly);
        if (tempSettings.positionLimits) {
          // Calculate DEF limit based on numTeams if not already calculated
          const numTeamsValue = tempSettings.numTeams || 12;
          const calculatedDefLimit = Math.floor(32 / numTeamsValue);
          
          setPositionLimits({
            QB: tempSettings.positionLimits.QB ?? 4,
            RB: tempSettings.positionLimits.RB ?? 8,
            WR: tempSettings.positionLimits.WR ?? 8,
            TE: tempSettings.positionLimits.TE ?? 6, // Default to 6 for guests
            FLEX: (tempSettings.positionLimits as { FLEX?: number }).FLEX ?? (tempSettings.isSuperflex ? 2 : 1),
            K: tempSettings.positionLimits.K ?? 3,
            DEF: tempSettings.positionLimits.DEF ?? calculatedDefLimit, // Use calculated if not set
            BENCH: tempSettings.positionLimits.BENCH ?? 5, // Default to 5 for guests
            KEEPERS: (tempSettings.positionLimits as { KEEPERS?: number }).KEEPERS ?? 1,
          });
        }
      }
    }
  }, [user, selectedLeague]);

  // Define loadTeamNames using useCallback so it can be used in useEffect
  const loadTeamNames = useCallback(async (teamCount?: number) => {
    if (!selectedLeague) return;

    const count = teamCount ?? selectedLeague.num_teams;

    const { data, error } = await supabase
      .from('league_teams')
      .select('*')
      .eq('league_id', selectedLeague.id)
      .order('team_number');

    if (error) {
      console.error('Error loading team names:', error);
      return;
    }

    // Initialize with all team slots
    const allTeams: TeamName[] = [];
    for (let i = 1; i <= count; i++) {
      const existing = data?.find(t => t.team_number === i);
      allTeams.push({
        team_number: i,
        team_name: existing?.team_name || ''
      });
    }
    setTeamNames(allTeams);
  }, [selectedLeague]);

  const loadKeepers = useCallback(async () => {
    if (!selectedLeague || !user) return;
    const { data: keepersData, error } = await supabase
      .from('league_keepers')
      .select('id, team_number, player_id, round_number')
      .eq('league_id', selectedLeague.id)
      .order('team_number')
      .order('round_number');
    if (error) {
      console.error('Error loading keepers:', error);
      return;
    }
    const playerIds = [...new Set((keepersData || []).map((k: any) => k.player_id).filter(Boolean))];
    let playersMap = new Map<string, Player>();
    if (playerIds.length > 0) {
      const { data: playersData } = await supabase
        .from('players')
        .select('*')
        .in('id', playerIds);
      (playersData || []).forEach((p: any) => playersMap.set(p.id, p));
    }
    const byTeam: Record<number, KeeperSlot[]> = {};
    const count = selectedLeague.num_teams;
    for (let i = 1; i <= count; i++) byTeam[i] = [];
    (keepersData || []).forEach((row: any) => {
      if (!byTeam[row.team_number]) byTeam[row.team_number] = [];
      byTeam[row.team_number].push({
        player: playersMap.get(row.player_id) || null,
        round: row.round_number,
      });
    });
    const limits = selectedLeague?.position_limits as { KEEPERS?: number; BENCH?: number; FLEX?: number } | undefined;
    const flexCount = limits?.FLEX ?? (selectedLeague?.is_superflex ? 2 : 1);
    const bench = limits?.BENCH ?? 6;
    const keeperLimit = limits ? Math.min(Math.max(0, limits.KEEPERS ?? 1), 8 + flexCount + bench) : 1;
    for (let i = 1; i <= count; i++) {
      const arr = byTeam[i] || [];
      if (arr.length === 0) arr.push({ player: null, round: 1 });
      byTeam[i] = arr.slice(0, keeperLimit);
    }
    setKeepersByTeam(byTeam);
  }, [selectedLeague, user]);

  useEffect(() => {
    if (selectedLeague) {
      // Load league name
      setLeagueName(selectedLeague.name);

      // Load position limits
      const limits = selectedLeague.position_limits as unknown as PositionLimits | null;
      if (limits && typeof limits === 'object') {
        const isSflex = (selectedLeague.is_superflex as boolean) || false;
        setPositionLimits({
          QB: limits.QB ?? 4,
          RB: limits.RB ?? 8,
          WR: limits.WR ?? 8,
          TE: limits.TE ?? 3,
          FLEX: (limits as PositionLimits).FLEX ?? (isSflex ? 2 : 1),
          K: limits.K ?? 3,
          DEF: limits.DEF ?? 3,
          BENCH: (limits as PositionLimits).BENCH ?? 7,
          KEEPERS: (limits as PositionLimits).KEEPERS ?? 1,
        });
      }

      // Load num teams
      setNumTeams(selectedLeague.num_teams);

      // Load user pick position
      setUserPickPosition(selectedLeague.user_pick_position);

      // Load draft settings
      setDraftOrder((selectedLeague.draft_order as string) || 'snake');
      setScoringFormat((selectedLeague.scoring_format as 'standard' | 'ppr' | 'half_ppr') || 'ppr');
      setLeagueType((selectedLeague.league_type as string) || 'season');
      setIsSuperflex((selectedLeague.is_superflex as boolean) || false);
      setRookiesOnly((selectedLeague as any).rookies_only === true);

      // Load team names
      loadTeamNames();
      // Load keepers (logged-in users only)
      if (user) loadKeepers();
    }
  }, [selectedLeague, loadTeamNames, loadKeepers, user]);

  // Initialize team names for guests if not already set or when numTeams changes
  useEffect(() => {
    if (!user && !selectedLeague) {
      const defaultNumTeams = typeof numTeams === 'number' ? numTeams : parseInt(String(numTeams)) || 12;
      setTeamNames(prev => {
        // Only update if the count doesn't match
        if (prev.length !== defaultNumTeams) {
          const defaultTeamNames: TeamName[] = [];
          for (let i = 1; i <= defaultNumTeams; i++) {
            // Preserve existing team name if it exists
            const existing = prev.find(t => t.team_number === i);
            defaultTeamNames.push({
              team_number: i,
              team_name: existing?.team_name || ''
            });
          }
          return defaultTeamNames;
        }
        return prev;
      });
    }
  }, [user, selectedLeague, numTeams]);

  // Adjust user pick position if it becomes invalid when number of teams changes
  // Also recalculate DEF limit for guests when numTeams changes
  useEffect(() => {
    // Safely parse numTeams with strict validation
    let numTeamsValue: number;
    if (typeof numTeams === 'number') {
      numTeamsValue = Math.max(4, Math.min(32, numTeams)); // Clamp to valid range (min 4 for guests)
    } else {
      const parsed = parseInt(String(numTeams));
      numTeamsValue = isNaN(parsed) ? 12 : Math.max(4, Math.min(32, parsed)); // Clamp to valid range (min 4 for guests)
    }
    
    const userPickValue = typeof userPickPosition === 'number' ? userPickPosition : parseInt(String(userPickPosition)) || 1;
    if (userPickValue > numTeamsValue) {
      setUserPickPosition(numTeamsValue);
    }
    
    // For guests, automatically recalculate DEF limit when numTeams changes
    // Ensure numTeamsValue is valid (2-32) before calculating
    if (!user && !selectedLeague && numTeamsValue >= 2 && numTeamsValue <= 32) {
      const calculatedDefLimit = Math.max(1, Math.floor(32 / numTeamsValue)); // Ensure at least 1
      setPositionLimits(prev => ({
        ...prev,
        DEF: calculatedDefLimit,
      }));
    }
  }, [numTeams, userPickPosition, user, selectedLeague]);

  // Max keepers = number of draft rounds (starters + bench from current limits)
  const getMaxKeepers = (): number => {
    const flexCount = typeof positionLimits.FLEX === 'number' ? positionLimits.FLEX : parseInt(String(positionLimits.FLEX)) || (isSuperflex ? 2 : 1);
    const minStarters = 8 + flexCount; // QB, RB, RB, WR, WR, TE, FLEX×N, DEF, K
    const bench = typeof positionLimits.BENCH === 'number' ? positionLimits.BENCH : parseInt(String(positionLimits.BENCH)) || 6;
    return minStarters + bench;
  };

  const handlePositionLimitChange = (position: keyof PositionLimits, value: string) => {
    if (value === '') {
      setPositionLimits(prev => ({ ...prev, [position]: '' }));
    } else {
      const numValue = parseInt(value);
      if (!isNaN(numValue)) {
        // Calculate max based on position and number of teams
        const currentNumTeams = typeof numTeams === 'number' ? numTeams : parseInt(String(numTeams)) || selectedLeague?.num_teams || 12;
        const maxDefLimit = position === 'DEF' ? Math.floor(32 / currentNumTeams) : 15;
        const max = position === 'DEF' ? maxDefLimit : position === 'KEEPERS' ? getMaxKeepers() : position === 'FLEX' ? 6 : defaultMaximums[position];
        // Allow typing any number, but clamp to max only (min will be enforced on save)
        setPositionLimits(prev => ({
          ...prev,
          [position]: Math.min(max, Math.max(0, numValue))
        }));
      }
    }
  };

  const handleNumTeamsChange = (value: string) => {
    if (value === '') {
      setNumTeams('');
      return;
    }
    // Remove any non-numeric characters
    const cleanedValue = value.replace(/[^0-9]/g, '');
    if (cleanedValue === '') {
      setNumTeams('');
      return;
    }
    
    // CRITICAL: Prevent more than 2 digits - if user tries to type a 3rd digit, immediately set to 32
    if (cleanedValue.length > 2) {
      setNumTeams(32);
      return;
    }
    
    const numValue = parseInt(cleanedValue);
    
    // If value is > 32, clamp to 32
    if (!isNaN(numValue) && numValue > 32) {
      setNumTeams(32);
      return;
    }
    
    // Enforce strict limits: 1-32 only
    if (!isNaN(numValue) && numValue >= 1 && numValue <= 32) {
      setNumTeams(numValue);
    } else if (numValue < 1 && cleanedValue !== '') {
      // If value is less than 1 but not empty, clamp to 1
      setNumTeams(1);
    }
  };
  
  // Prevent typing a 3rd digit - block input if current value is already 2 digits
  const handleNumTeamsKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const currentValue = input.value.replace(/[^0-9]/g, ''); // Get only digits
    const key = e.key;
    
    // Allow: backspace, delete, tab, escape, enter, arrow keys
    if (['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(key)) {
      return;
    }
    
    // Allow: Ctrl/Cmd + A, C, V, X
    if ((e.ctrlKey || e.metaKey) && ['a', 'c', 'v', 'x'].includes(key.toLowerCase())) {
      return;
    }
    
    // If it's a number key
    if (/[0-9]/.test(key)) {
      // CRITICAL: If current value already has 2 digits, prevent typing a 3rd digit
      if (currentValue.length >= 2) {
        e.preventDefault();
        // Immediately set to 32 if they try to type a 3rd digit
        setNumTeams(32);
        return;
      }
      
      // Check if adding this digit would exceed 32
      const newValue = currentValue === '' ? key : currentValue + key;
      const numValue = parseInt(newValue);
      
      // If the new value would exceed 32, prevent the input and set to 32
      if (!isNaN(numValue) && numValue > 32) {
        e.preventDefault();
        setNumTeams(32);
        return;
      }
    }
    
    // Block any other characters (non-numeric)
    if (!/[0-9]/.test(key)) {
      e.preventDefault();
    }
  };

  const saveGeneralSettings = async () => {
    // For guests, save to localStorage
    if (!user || !selectedLeague) {
      const numTeamsValue = typeof numTeams === 'number' ? numTeams : parseInt(String(numTeams)) || 12;
      const finalNumTeams = Math.max(4, Math.min(32, numTeamsValue));
      const userPickValue = typeof userPickPosition === 'number' ? userPickPosition : parseInt(String(userPickPosition)) || 1;
      const finalUserPickPosition = Math.max(1, Math.min(finalNumTeams, userPickValue));
      
      // Automatically calculate DEF limit based on number of teams
      // Formula: maxDefLimit = Math.floor(32 / numTeams)
      // This ensures all teams can draft at least 1 defense (DEF limit × num_teams ≤ 32)
      // Ensure finalNumTeams is valid (4-32) before calculating
      const safeNumTeams = Math.max(4, Math.min(32, finalNumTeams));
      const calculatedDefLimit = Math.max(1, Math.floor(32 / safeNumTeams)); // Ensure at least 1
      
      tempSettingsStorage.save({
        numTeams: finalNumTeams,
        userPickPosition: finalUserPickPosition,
        draftOrder: draftOrder || 'snake',
        scoringFormat: scoringFormat || 'ppr',
        leagueType: leagueType || 'season',
        isSuperflex: isSuperflex || false,
        rookiesOnly: leagueType === 'dynasty' ? rookiesOnly : false,
        positionLimits: {
          QB: typeof positionLimits.QB === 'number' ? positionLimits.QB : parseInt(String(positionLimits.QB)) || 4,
          RB: typeof positionLimits.RB === 'number' ? positionLimits.RB : parseInt(String(positionLimits.RB)) || 8,
          WR: typeof positionLimits.WR === 'number' ? positionLimits.WR : parseInt(String(positionLimits.WR)) || 8,
          TE: typeof positionLimits.TE === 'number' ? positionLimits.TE : parseInt(String(positionLimits.TE)) || 6, // Default to 6 for guests
          FLEX: typeof positionLimits.FLEX === 'number' ? positionLimits.FLEX : Math.max(1, Math.min(6, parseInt(String(positionLimits.FLEX)) || (isSuperflex ? 2 : 1))),
          K: typeof positionLimits.K === 'number' ? positionLimits.K : parseInt(String(positionLimits.K)) || 3,
          DEF: calculatedDefLimit, // Automatically calculated based on league size
          BENCH: typeof positionLimits.BENCH === 'number' ? positionLimits.BENCH : parseInt(String(positionLimits.BENCH)) || 5, // Default to 5 for guests
          KEEPERS: typeof positionLimits.KEEPERS === 'number' ? positionLimits.KEEPERS : parseInt(String(positionLimits.KEEPERS)) || 1,
        },
      });
      
      // Update position limits state to reflect the calculated DEF limit
      setPositionLimits(prev => ({
        ...prev,
        DEF: calculatedDefLimit,
      }));
      
      setNumTeams(finalNumTeams);
      setUserPickPosition(finalUserPickPosition);
      toast.success('Settings saved locally');
      return;
    }
    
    if (!selectedLeague) return;
    
    // Validate league name
    if (!leagueName.trim()) {
      toast.error('League name cannot be empty');
      return;
    }
    
    // Enforce minimum of 4 when saving (allows typing "1" for values like 11, 12, etc.)
    const numTeamsValue = typeof numTeams === 'number' ? numTeams : parseInt(String(numTeams)) || 4;
    const finalNumTeams = Math.max(4, Math.min(32, numTeamsValue));
    
    // Validate user pick position
    const userPickValue = typeof userPickPosition === 'number' ? userPickPosition : parseInt(String(userPickPosition)) || 1;
    const finalUserPickPosition = Math.max(1, Math.min(finalNumTeams, userPickValue));
    
    setSaving(true);
    try {
      // First, try to update all fields
      const { error } = await supabase
        .from('leagues')
        .update({ 
          name: leagueName.trim(),
          num_teams: finalNumTeams,
          user_pick_position: finalUserPickPosition,
          draft_order: draftOrder || 'snake',
          scoring_format: scoringFormat || 'ppr',
          league_type: leagueType || 'season',
          is_superflex: isSuperflex || false,
          rookies_only: leagueType === 'dynasty' ? (rookiesOnly || false) : false
        })
        .eq('id', selectedLeague.id);

      if (error) {
        console.error('Error updating league settings:', error);
        // If error is about missing column, try updating just num_teams
        if (error.message?.toLowerCase().includes('column') && 
            (error.message?.toLowerCase().includes('does not exist') || 
             error.message?.toLowerCase().includes('not found'))) {
          console.log('Column missing, falling back to num_teams only update');
          const { error: simpleError } = await supabase
            .from('leagues')
            .update({ num_teams: finalNumTeams })
            .eq('id', selectedLeague.id);
          
          if (simpleError) {
            toast.error(`Failed to update number of teams: ${simpleError.message || 'Unknown error'}`);
          } else {
            toast.success('Number of teams updated. Please run database migration to enable other settings.');
            setNumTeams(finalNumTeams);
            await refreshLeagues();
            loadTeamNames(finalNumTeams);
            // Update selectedLeague after refresh
            const { data: updatedLeague } = await supabase
              .from('leagues')
              .select('*')
              .eq('id', selectedLeague.id)
              .single();
            if (updatedLeague) {
              setSelectedLeague(updatedLeague);
            }
          }
        } else {
          toast.error(`Failed to update settings: ${error.message || 'Unknown error'}`);
        }
      } else {
        toast.success('Settings updated');
        setNumTeams(finalNumTeams);
        setUserPickPosition(finalUserPickPosition);
        await refreshLeagues();
        loadTeamNames(finalNumTeams);
        // Update selectedLeague after refresh
        const { data: updatedLeague } = await supabase
          .from('leagues')
          .select('*')
          .eq('id', selectedLeague.id)
          .single();
        if (updatedLeague) {
          setSelectedLeague(updatedLeague);
        }
      }
    } catch (err: any) {
      console.error('Unexpected error:', err);
      toast.error(`Failed to update settings: ${err?.message || 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleTeamNameChange = (teamNumber: number, name: string) => {
    setTeamNames(prev => prev.map(t => 
      t.team_number === teamNumber ? { ...t, team_name: name } : t
    ));
  };

  /** Navigate to Rankings with current league-type bucket so Rankings shows the correct bucket (guest: pass state; logged-in: just go). */
  const goToRankings = () => {
    if (!user) {
      const cur = tempSettingsStorage.get() || {};
      tempSettingsStorage.save({
        ...cur,
        scoringFormat: scoringFormat || 'ppr',
        leagueType: leagueType || 'season',
        isSuperflex: isSuperflex ?? false,
        rookiesOnly: leagueType === 'dynasty' ? (rookiesOnly ?? false) : false,
      });
      navigate('/rankings', { state: { bucketForGuest: { scoringFormat: scoringFormat || 'ppr', leagueType: leagueType as 'season' | 'dynasty', isSuperflex: isSuperflex ?? false, rookiesOnly: leagueType === 'dynasty' && (rookiesOnly ?? false) } } });
    } else {
      navigate('/rankings');
    }
  };

  // Validate that position limits allow for a valid roster
  const validatePositionLimits = (limits: PositionLimits, isSuperflex: boolean, numTeams: number): { valid: boolean; error?: string } => {
    // Starting lineup: QB(1), RB(2), WR(2), TE(1), FLEX(N), DEF(1), K(1) = 8 + N starters
    const flexCount = limits.FLEX ?? (isSuperflex ? 2 : 1);
    
    if (flexCount < 1 || flexCount > 6) {
      return {
        valid: false,
        error: `Flex count must be between 1 and 6. Currently: ${flexCount}`
      };
    }
    
    // RB + WR + TE must cover 2 RB + 2 WR + 1 TE + flexCount FLEX slots = 5 + flexCount
    const minFlexRequirement = limits.RB + limits.WR + limits.TE;
    if (minFlexRequirement < 5 + flexCount) {
      return {
        valid: false,
        error: `Position limits are too low. You need at least ${5 + flexCount} total players from RB, WR, and TE combined to fill your starting lineup (2 RB + 2 WR + 1 TE + ${flexCount} FLEX). Currently: ${limits.RB} RB + ${limits.WR} WR + ${limits.TE} TE = ${minFlexRequirement}`
      };
    }
    
    // Check individual minimums
    if (limits.QB < 1) {
      return { valid: false, error: 'QB limit must be at least 1' };
    }
    if (limits.RB < 2) {
      return { valid: false, error: 'RB limit must be at least 2 (for RB1 and RB2)' };
    }
    if (limits.WR < 2) {
      return { valid: false, error: 'WR limit must be at least 2 (for WR1 and WR2)' };
    }
    if (limits.TE < 1) {
      return { valid: false, error: 'TE limit must be at least 1' };
    }
    if (limits.K < 1) {
      return { valid: false, error: 'K limit must be at least 1' };
    }
    if (limits.DEF < 1) {
      return { valid: false, error: 'DEF limit must be at least 1' };
    }
    
    // Check defense availability - there are only 32 NFL defenses
    // Each team needs at least 1 defense, so we need: numTeams <= 32
    if (numTeams > 32) {
      return {
        valid: false,
        error: `Cannot have more than 32 teams. There are only 32 NFL defenses available, and each team needs at least 1 defense.`
      };
    }
    
    // Check if defense limit allows all teams to get at least 1 defense
    // Worst case: DEF limit * num_teams = total defenses drafted
    // We need: DEF limit * num_teams <= 32
    const totalDefensesNeeded = limits.DEF * numTeams;
    if (totalDefensesNeeded > 32) {
      const maxDefLimit = Math.floor(32 / numTeams);
      return {
        valid: false,
        error: `Defense limit (${limits.DEF}) is too high for ${numTeams} teams. With ${numTeams} teams, the maximum defense limit is ${maxDefLimit} (${limits.DEF} × ${numTeams} = ${totalDefensesNeeded}, but only 32 NFL defenses exist). This ensures all teams can draft at least 1 defense.`
      };
    }
    
    if (limits.BENCH < 0) {
      return { valid: false, error: 'BENCH limit cannot be negative' };
    }
    
    // Calculate minimum roster size
    // Starters: QB(1) + RB(2) + WR(2) + TE(1) + FLEX(N) + DEF(1) + K(1) = 8 + N
    const minStarters = 8 + flexCount;
    const minRosterSize = minStarters + limits.BENCH;
    
    // Calculate maximum possible roster size from position limits (KEEPERS and FLEX are not separate draft limits)
    const maxRosterSize = limits.QB + limits.RB + limits.WR + limits.TE + limits.K + limits.DEF + limits.BENCH;
    
    // The maximum roster size must be at least the minimum roster size
    if (maxRosterSize < minRosterSize) {
      return {
        valid: false,
        error: `Position limits are too low. Your roster needs at least ${minRosterSize} players (${minStarters} starters + ${limits.BENCH} bench), but your limits only allow ${maxRosterSize} players total.`
      };
    }
    
    // Check if bench slots can be filled without exceeding position limits
    // Starters: QB(1 or 2 with superflex), RB(2), WR(2), TE(1), FLEX(N from RB/WR/TE or one from QB in superflex), DEF(1), K(1)
    const qbUsed = isSuperflex ? 2 : 1;
    const defUsed = 1;
    const kUsed = 1;
    
    // Worst-case remaining capacity: all FLEX slots take from one position
    // Scenario 1: all FLEX from RB
    const scenario1Remaining = 
      Math.max(0, limits.QB - qbUsed) +
      Math.max(0, limits.RB - (2 + flexCount)) +
      Math.max(0, limits.WR - 2) +
      Math.max(0, limits.TE - 1) +
      Math.max(0, limits.DEF - defUsed) +
      Math.max(0, limits.K - kUsed);
    
    const scenario2Remaining = 
      Math.max(0, limits.QB - qbUsed) +
      Math.max(0, limits.RB - 2) +
      Math.max(0, limits.WR - (2 + flexCount)) +
      Math.max(0, limits.TE - 1) +
      Math.max(0, limits.DEF - defUsed) +
      Math.max(0, limits.K - kUsed);
    
    const scenario3Remaining = 
      Math.max(0, limits.QB - qbUsed) +
      Math.max(0, limits.RB - 2) +
      Math.max(0, limits.WR - 2) +
      Math.max(0, limits.TE - (1 + flexCount)) +
      Math.max(0, limits.DEF - defUsed) +
      Math.max(0, limits.K - kUsed);
    
    // Use the minimum remaining capacity (worst case scenario)
    const minRemainingCapacity = Math.min(scenario1Remaining, scenario2Remaining, scenario3Remaining);
    
    // Bench slots can be filled by any position, but total must not exceed remaining capacity
    if (limits.BENCH > minRemainingCapacity) {
      let worstScenario = 'FLEX slots using RB';
      if (scenario2Remaining < scenario1Remaining && scenario2Remaining < scenario3Remaining) {
        worstScenario = 'FLEX slots using WR';
      } else if (scenario3Remaining < scenario1Remaining && scenario3Remaining < scenario2Remaining) {
        worstScenario = 'FLEX slots using TE';
      }
      
      return {
        valid: false,
        error: `Bench slots (${limits.BENCH}) exceed available player capacity. After filling starting positions (worst case: ${worstScenario}), you only have ${minRemainingCapacity} total player slots remaining across all positions. Bench slots must not exceed this total.`
      };
    }

    // Keepers limit: 0 <= KEEPERS <= number of draft rounds (starters + bench)
    if (limits.KEEPERS !== undefined && typeof limits.KEEPERS === 'number') {
      const numRounds = minStarters + limits.BENCH;
      if (limits.KEEPERS < 0 || limits.KEEPERS > numRounds) {
        return {
          valid: false,
          error: `Keepers limit must be between 0 and ${numRounds} (number of draft rounds).`
        };
      }
    }
    
    return { valid: true };
  };

  const savePositionLimits = async () => {
    if (!user) {
      toast.error('Please sign in to save position limits');
      return;
    }
    
    if (!selectedLeague) return;

    setSaving(true);
    
    const maxKeepersForSave = (() => {
      const flexCount = positionLimits.FLEX === '' ? (isSuperflex ? 2 : 1) : Math.max(1, Math.min(6, Number(positionLimits.FLEX) || 1));
      const bench = positionLimits.BENCH === '' ? 6 : Math.max(0, Number(positionLimits.BENCH));
      return 8 + flexCount + bench;
    })();
    const defaultFlex = isSuperflex ? 2 : 1;
    // Apply default minimums for empty values or values below minimum
    const finalLimits: PositionLimits = {
      QB: positionLimits.QB === '' ? defaultMinimums.QB : Math.max(defaultMinimums.QB, Number(positionLimits.QB)),
      RB: positionLimits.RB === '' ? defaultMinimums.RB : Math.max(defaultMinimums.RB, Number(positionLimits.RB)),
      WR: positionLimits.WR === '' ? defaultMinimums.WR : Math.max(defaultMinimums.WR, Number(positionLimits.WR)),
      TE: positionLimits.TE === '' ? defaultMinimums.TE : Math.max(defaultMinimums.TE, Number(positionLimits.TE)),
      FLEX: positionLimits.FLEX === '' ? defaultFlex : Math.max(1, Math.min(6, Number(positionLimits.FLEX) || 1)),
      K: positionLimits.K === '' ? defaultMinimums.K : Math.max(defaultMinimums.K, Number(positionLimits.K)),
      DEF: positionLimits.DEF === '' ? defaultMinimums.DEF : Math.max(defaultMinimums.DEF, Number(positionLimits.DEF)),
      BENCH: positionLimits.BENCH === '' ? defaultMinimums.BENCH : Math.max(defaultMinimums.BENCH, Number(positionLimits.BENCH)),
      KEEPERS: positionLimits.KEEPERS === '' ? 1 : Math.max(0, Math.min(maxKeepersForSave, Number(positionLimits.KEEPERS) || 0)),
    };
    
    // Get current number of teams for validation
    const currentNumTeams = typeof numTeams === 'number' ? numTeams : parseInt(String(numTeams)) || selectedLeague?.num_teams || 12;
    
    // Validate position limits before saving
    const validation = validatePositionLimits(finalLimits, isSuperflex, currentNumTeams);
    if (!validation.valid) {
      toast.error(validation.error || 'Invalid position limits');
      setSaving(false);
      return;
    }
    
    const limitsJson = JSON.parse(JSON.stringify(finalLimits));
    const { error } = await supabase
      .from('leagues')
      .update({ position_limits: limitsJson })
      .eq('id', selectedLeague.id);

    if (error) {
      toast.error('Failed to save position limits');
      console.error(error);
    } else {
      toast.success('Position limits saved');
      setPositionLimits(finalLimits);
      await refreshLeagues();
      // Update selectedLeague after refresh to ensure UI reflects saved changes
      const { data: updatedLeague } = await supabase
        .from('leagues')
        .select('*')
        .eq('id', selectedLeague.id)
        .single();
      if (updatedLeague) {
        setSelectedLeague(updatedLeague);
      }
    }
    setSaving(false);
  };

  const calculateNumRounds = (): number => {
    const limits = selectedLeague?.position_limits as { BENCH?: number; FLEX?: number } | undefined;
    const flexCount = limits?.FLEX ?? (isSuperflex ? 2 : 1);
    const bench = limits?.BENCH ?? 6;
    return 8 + flexCount + bench;
  };

  /** Max keepers per team from league position limits (Position Limits tab). */
  const getKeeperLimit = (): number => {
    const lim = selectedLeague?.position_limits ? (selectedLeague.position_limits as { KEEPERS?: number }).KEEPERS : undefined;
    const n = typeof lim === 'number' ? lim : 1;
    const maxRounds = calculateNumRounds();
    return Math.min(Math.max(0, n), maxRounds);
  };

  const updateKeeperSlot = (teamNumber: number, slotIndex: number, updates: Partial<KeeperSlot>) => {
    setKeepersByTeam((prev) => {
      const arr = [...(prev[teamNumber] || [{ player: null, round: 1 }])];
      arr[slotIndex] = { ...arr[slotIndex], ...updates };
      return { ...prev, [teamNumber]: arr };
    });
  };

  const addKeeperSlot = (teamNumber: number) => {
    const limit = getKeeperLimit();
    setKeepersByTeam((prev) => {
      const arr = [...(prev[teamNumber] || [])];
      if (arr.length >= limit) return prev;
      arr.push({ player: null, round: 1 });
      return { ...prev, [teamNumber]: arr };
    });
  };

  const removeKeeperSlot = (teamNumber: number, slotIndex: number) => {
    setKeepersByTeam((prev) => {
      const arr = [...(prev[teamNumber] || [])];
      if (arr.length <= 0) return prev;
      arr.splice(slotIndex, 1);
      return { ...prev, [teamNumber]: arr };
    });
  };

  const saveKeepers = async () => {
    if (!user || !selectedLeague) return;
    const numRounds = calculateNumRounds();
    const keeperLimit = getKeeperLimit();
    const teamCount = selectedLeague.num_teams;
    const allPlayerIds = new Set<string>();
    const roundUsedByTeam = new Map<string, Set<number>>();

    for (let t = 1; t <= teamCount; t++) {
      const slots = keepersByTeam[t] || [];
      const filledCount = slots.filter((s) => s.player).length;
      if (filledCount > keeperLimit) {
        toast.error(`Team ${t} has ${filledCount} keepers but the league limit is ${keeperLimit}. Set "Keepers" in Position Limits.`);
        return;
      }
      for (const slot of slots) {
        if (!slot.player) continue;
        if (allPlayerIds.has(slot.player.id)) {
          toast.error(`${slot.player.name} is already kept by another team`);
          return;
        }
        allPlayerIds.add(slot.player.id);
        const key = `${t}`;
        if (!roundUsedByTeam.has(key)) roundUsedByTeam.set(key, new Set());
        if (roundUsedByTeam.get(key)!.has(slot.round)) {
          toast.error(`Team ${t} cannot have two keepers in round ${slot.round}`);
          return;
        }
        roundUsedByTeam.get(key)!.add(slot.round);
        if (slot.round < 1 || slot.round > numRounds) {
          toast.error(`Round must be 1-${numRounds} (${slot.player.name})`);
          return;
        }
      }
    }

    // Position limits and roster validation: ensure keepers don't exceed limits and, if all rounds are keepers, roster is fillable
    const limits = (selectedLeague.position_limits || {}) as Record<string, number>;
    const posLimits: Record<string, number> = {
      QB: limits.QB ?? 4,
      RB: limits.RB ?? 8,
      WR: limits.WR ?? 8,
      TE: limits.TE ?? 6,
      K: limits.K ?? 3,
      DEF: limits.DEF ?? 3,
    };
    const normalizePos = (pos: string): string => {
      const p = (pos || '').toUpperCase();
      if (p === 'D/ST' || p === 'DST' || p === 'DEF') return 'DEF';
      return p;
    };

    for (let t = 1; t <= teamCount; t++) {
      const slots = keepersByTeam[t] || [];
      const keptPlayers = slots.map((s) => s.player).filter((p): p is Player => p != null);
      if (keptPlayers.length === 0) continue;

      const byPos: Record<string, number> = { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DEF: 0 };
      for (const p of keptPlayers) {
        const pos = normalizePos(p.position);
        if (pos in byPos) byPos[pos]++;
      }

      for (const [pos, count] of Object.entries(byPos)) {
        const max = posLimits[pos];
        if (max != null && count > max) {
          const teamName = teamNames.find((tn) => tn.team_number === t)?.team_name || `Team ${t}`;
          toast.error(`${teamName}: too many ${pos} keepers (${count}). League limit is ${max}.`);
          return;
        }
      }

      if (keptPlayers.length === numRounds) {
        if (byPos.QB < 1) {
          const teamName = teamNames.find((tn) => tn.team_number === t)?.team_name || `Team ${t}`;
          toast.error(`${teamName}: with keepers in every round you must have at least 1 QB. Add a QB keeper or leave a round open to draft one.`);
          return;
        }
        if (byPos.RB < 2) {
          const teamName = teamNames.find((tn) => tn.team_number === t)?.team_name || `Team ${t}`;
          toast.error(`${teamName}: with keepers in every round you must have at least 2 RBs. Add an RB keeper or leave a round open to draft one.`);
          return;
        }
        if (byPos.WR < 2) {
          const teamName = teamNames.find((tn) => tn.team_number === t)?.team_name || `Team ${t}`;
          toast.error(`${teamName}: with keepers in every round you must have at least 2 WRs. Add a WR keeper or leave a round open to draft one.`);
          return;
        }
        if (byPos.TE < 1) {
          const teamName = teamNames.find((tn) => tn.team_number === t)?.team_name || `Team ${t}`;
          toast.error(`${teamName}: with keepers in every round you must have at least 1 TE. Add a TE keeper or leave a round open to draft one.`);
          return;
        }
        if (byPos.K < 1) {
          const teamName = teamNames.find((tn) => tn.team_number === t)?.team_name || `Team ${t}`;
          toast.error(`${teamName}: with keepers in every round you must have at least 1 K. Add a kicker keeper or leave a round open to draft one.`);
          return;
        }
        if (byPos.DEF < 1) {
          const teamName = teamNames.find((tn) => tn.team_number === t)?.team_name || `Team ${t}`;
          toast.error(`${teamName}: with keepers in every round you must have at least 1 DEF. Add a defense keeper or leave a round open to draft one.`);
          return;
        }
      }
    }

    setSaving(true);
    await supabase.from('league_keepers').delete().eq('league_id', selectedLeague.id);

    const toInsert: { league_id: string; team_number: number; player_id: string; round_number: number }[] = [];
    for (let t = 1; t <= teamCount; t++) {
      const slots = keepersByTeam[t] || [];
      for (const slot of slots) {
        if (slot.player) {
          toInsert.push({
            league_id: selectedLeague.id,
            team_number: t,
            player_id: slot.player.id,
            round_number: slot.round,
          });
        }
      }
    }

    if (toInsert.length > 0) {
      const { error } = await supabase.from('league_keepers').insert(toInsert);
      if (error) {
        toast.error('Failed to save keepers');
        console.error(error);
      } else {
        toast.success('Keepers saved');
      }
    } else {
      toast.success('Keepers cleared');
    }
    setSaving(false);
  };

  const saveTeamNames = async () => {
    if (!user) {
      toast.error('Please sign in to save team names');
      return;
    }
    
    if (!selectedLeague) return;

    setSaving(true);
    
    // Delete existing team names and insert new ones
    await supabase
      .from('league_teams')
      .delete()
      .eq('league_id', selectedLeague.id);

    const teamsToInsert = teamNames
      .filter(t => t.team_name.trim())
      .map(t => ({
        league_id: selectedLeague.id,
        team_number: t.team_number,
        team_name: t.team_name.trim()
      }));

    if (teamsToInsert.length > 0) {
      const { error } = await supabase
        .from('league_teams')
        .insert(teamsToInsert);

      if (error) {
        toast.error('Failed to save team names');
        console.error(error);
        setSaving(false);
        return;
      }
    }

    toast.success('Team names saved');
    setSaving(false);
  };

  // All hooks must be called before any early returns
  // Early returns for loading and "no league selected" states
  if (authLoading || leaguesLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // For non-logged-in users, show tabs with default values even without a selected league
  // For logged-in users, require a selected league
  // Don't show "No League Selected" while loading or transitioning - wait for leagues to finish loading
  // Also check if leagues exist - if they do and we're transitioning, wait a bit
  if (!selectedLeague && user && !leaguesLoading && !isTransitioning) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="max-w-4xl mx-auto px-4 py-8">
          <Card className="glass-card">
            <CardContent className="py-12 text-center">
              <Settings2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h2 className="text-xl font-semibold mb-2">No League Selected</h2>
              <p className="text-muted-foreground mb-4">
                Please select a league from the dropdown in the navigation bar to configure its settings.
              </p>
              <Button variant="outline" onClick={() => navigate('/settings')}>
                Create a League
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-display text-3xl tracking-wide text-gradient">
              LEAGUE SETTINGS
            </h1>
            <p className="text-muted-foreground">{leagueName || selectedLeague?.name || 'Preview Mode'}</p>
          </div>
        </div>

        {/* Teaser Banner for non-logged-in users */}
        {!user && (
          <div className="glass-card p-6 mb-6 bg-gradient-to-r from-primary/10 to-accent/10 border-2 border-primary/20 relative overflow-hidden">
            <div className="absolute inset-0 bg-background/40 backdrop-blur-sm" />
            <div className="relative z-10 flex items-center justify-between">
              <div>
                <h3 className="font-display text-xl mb-2">Unlock Full League Management</h3>
                <p className="text-sm text-muted-foreground">
                  Sign in to save your settings, create multiple leagues, and access advanced customization options
                </p>
              </div>
              <Button variant="hero" onClick={() => navigate('/auth')} className="shrink-0">
                Sign In to Unlock
              </Button>
            </div>
          </div>
        )}

        <Tabs defaultValue="general" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 bg-secondary/50">
            <TabsTrigger value="general" className="gap-2">
              <Settings2 className="w-4 h-4" />
              General
            </TabsTrigger>
            <TabsTrigger value="positions" className="gap-2">
              <Layers className="w-4 h-4" />
              Position Limits
            </TabsTrigger>
            <TabsTrigger value="teams" className="gap-2">
              <Users className="w-4 h-4" />
              Team Names
            </TabsTrigger>
            <TabsTrigger value="keepers" className="gap-2">
              <BookmarkPlus className="w-4 h-4" />
              Keepers
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="relative">
            <Card className="glass-card">
              <CardHeader className="flex flex-row items-start justify-between space-y-0 gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    General Settings
                    {!user && (
                      <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">Preview</span>
                    )}
                  </CardTitle>
                  <CardDescription>
                    Configure the basic settings for your league
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button onClick={saveGeneralSettings} disabled={saving} className="shrink-0">
                    <Save className="w-4 h-4 mr-2" />
                    Save
                  </Button>
                  <Button variant="outline" onClick={goToRankings} className="shrink-0 gap-2">
                    <ListOrdered className="w-4 h-4" />
                    Go to My Rankings
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6 relative z-0">
                {!user && (
                  <div className="mb-4 p-3 bg-primary/10 border border-primary/20 rounded-lg">
                    <p className="text-sm text-primary/80">
                      💡 <strong>Preview Mode:</strong> You can adjust all settings below, but changes won't be saved until you sign in.
                    </p>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="leagueName" className="text-sm font-medium">
                    League Name
                  </Label>
                  <Input
                    id="leagueName"
                    type="text"
                    value={leagueName}
                    onChange={(e) => setLeagueName(e.target.value)}
                    className="bg-secondary/50 max-w-xs"
                    placeholder="My Fantasy League"
                    disabled={!user}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="numTeams" className="text-sm font-medium">
                      Number of Teams
                      <span className="text-xs font-normal text-muted-foreground ml-1">(max 32)</span>
                    </Label>
                    <Input
                      id="numTeams"
                      type="number"
                      min={4}
                      max={32}
                      value={numTeams}
                      onChange={(e) => handleNumTeamsChange(e.target.value)}
                      onKeyDown={handleNumTeamsKeyDown}
                      onPaste={(e) => {
                        // Handle paste to prevent pasting large numbers
                        e.preventDefault();
                        const pastedText = e.clipboardData.getData('text');
                        const cleanedValue = pastedText.replace(/[^0-9]/g, '');
                        
                        // CRITICAL: If pasted value has more than 2 digits, immediately set to 32
                        if (cleanedValue.length > 2) {
                          setNumTeams(32);
                          // Force the input value to 32 immediately to prevent freezing
                          const target = e.currentTarget;
                          setTimeout(() => {
                            target.value = '32';
                            setNumTeams(32);
                          }, 0);
                          return;
                        }
                        
                        if (cleanedValue) {
                          const numValue = parseInt(cleanedValue);
                          if (!isNaN(numValue)) {
                            // Clamp to 4-32 range
                            const clampedValue = Math.max(4, Math.min(32, numValue));
                            setNumTeams(clampedValue);
                          }
                        }
                      }}
                      onInput={(e) => {
                        // Additional safeguard: check on input event
                        const target = e.currentTarget;
                        const value = target.value.replace(/[^0-9]/g, '');
                        
                        // If value has more than 2 digits, immediately set to 32
                        if (value.length > 2) {
                          setNumTeams(32);
                          // Force the input value to 32
                          setTimeout(() => {
                            target.value = '32';
                          }, 0);
                        }
                      }}
                      className="bg-secondary/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="userPickPosition" className="text-sm font-medium">
                      Your Draft Pick Position
                    </Label>
                    <Select 
                      value={String(userPickPosition)} 
                      onValueChange={(value) => setUserPickPosition(parseInt(value))}
                    >
                      <SelectTrigger className="bg-secondary/50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: typeof numTeams === 'number' ? numTeams : parseInt(String(numTeams)) || 12 }, (_, i) => i + 1).map(
                          (n) => (
                            <SelectItem key={n} value={n.toString()}>
                              Pick #{n}
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="draftOrder" className="text-sm font-medium">
                      Draft Order
                    </Label>
                    <Select value={draftOrder} onValueChange={setDraftOrder}>
                      <SelectTrigger className="bg-secondary/50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="snake">Snake</SelectItem>
                        <SelectItem value="linear">Linear</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="numRounds" className="text-sm font-medium">
                      Number of Rounds
                    </Label>
                    <div className="flex h-10 w-full rounded-md border border-input bg-secondary/50 px-3 py-2 text-sm items-center">
                      {(() => {
                        const limits = selectedLeague?.position_limits as { BENCH?: number; FLEX?: number } | undefined;
                        const flexCount = limits?.FLEX ?? (isSuperflex ? 2 : 1);
                        const bench = limits?.BENCH ?? 6;
                        const rosterSize = 8 + flexCount + bench; // QB, RB, RB, WR, WR, TE, FLEX×N, DEF, K + bench
                        return `${rosterSize} rounds`;
                      })()}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="leagueType" className="text-sm font-medium">
                      League Type
                    </Label>
                    <Select value={leagueType} onValueChange={setLeagueType}>
                      <SelectTrigger className="bg-secondary/50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="season">2026 Season</SelectItem>
                        <SelectItem value="dynasty">Dynasty</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="flex items-center space-x-2 pt-6 mt-2">
                      <Checkbox
                        id="isSuperflex"
                        checked={isSuperflex}
                        onCheckedChange={(checked) => setIsSuperflex(checked === true)}
                      />
                      <Label htmlFor="isSuperflex" className="text-sm font-medium cursor-pointer">
                        Superflex (allows QB in flex position)
                      </Label>
                    </div>
                    {leagueType === 'dynasty' && (
                      <div className="flex items-center space-x-2 pt-6">
                        <Checkbox
                          id="rookiesOnly"
                          checked={rookiesOnly}
                          onCheckedChange={(checked) => setRookiesOnly(checked === true)}
                        />
                        <Label htmlFor="rookiesOnly" className="text-sm font-medium cursor-pointer">
                          Rookies only
                        </Label>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="scoringFormat" className="text-sm font-medium">
                      Scoring Format
                    </Label>
                    <Select value={scoringFormat} onValueChange={(v) => setScoringFormat(v as 'standard' | 'ppr' | 'half_ppr')}>
                      <SelectTrigger className="bg-secondary/50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="standard">Standard</SelectItem>
                        <SelectItem value="ppr">PPR</SelectItem>
                        <SelectItem value="half_ppr">Half PPR</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {!user && (
                  <p className="text-xs text-muted-foreground">
                    Settings are saved locally and will be used for your mock drafts.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="positions" className="relative">
            <Card className={cn("glass-card", !user && "opacity-90")}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0 gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    Position Limits
                    {!user && (
                      <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">Preview</span>
                    )}
                  </CardTitle>
                  <CardDescription>
                    Set the maximum number of players that can be drafted per position
                  </CardDescription>
                </div>
                {user && (
                  <Button onClick={savePositionLimits} disabled={saving} className="shrink-0">
                    <Save className="w-4 h-4 mr-2" />
                    Save Position Limits
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-6 relative">
                {!user && (
                  <>
                    {/* Overlay that blocks interaction */}
                    <div className="absolute inset-0 bg-background/60 backdrop-blur-sm z-20 rounded-lg flex items-center justify-center">
                      <div className="text-center p-6 bg-background/90 rounded-lg border-2 border-primary/30 max-w-md">
                        <Layers className="w-12 h-12 mx-auto mb-4 text-primary/60" />
                        <h3 className="font-display text-xl mb-2">Sign In to Customize Position Limits</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          Position limits allow you to control how many players can be drafted at each position. Sign in to unlock this feature and customize your league settings.
                        </p>
                        <Button variant="hero" onClick={() => navigate('/auth')} className="w-full">
                          Sign In to Unlock
                        </Button>
                      </div>
                    </div>
                    {/* Preview content behind overlay */}
                    <div className="opacity-50 pointer-events-none">
                      <div className="mb-4 p-3 bg-primary/10 border border-primary/20 rounded-lg">
                        <p className="text-sm text-primary/80">
                          💡 <strong>Preview Mode:</strong> Position limits allow you to control roster composition.
                        </p>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {(Object.keys(positionLimits) as Array<keyof PositionLimits>).map((position) => {
                          const currentNumTeams = typeof numTeams === 'number' ? numTeams : parseInt(String(numTeams)) || selectedLeague?.num_teams || 12;
                          const maxDefLimit = position === 'DEF' ? Math.floor(32 / currentNumTeams) : 15;
                          const maxValue = position === 'DEF' ? maxDefLimit : position === 'KEEPERS' ? getMaxKeepers() : position === 'FLEX' ? 6 : 15;
                          const label = position === 'DEF' ? 'Defense' : position === 'BENCH' ? 'Bench' : position === 'KEEPERS' ? 'Keepers' : position === 'FLEX' ? 'Flex' : position;
                          return (
                            <div key={position} className="space-y-2">
                              <Label htmlFor={position} className="text-sm font-medium">
                                {label}
                                {position === 'DEF' && (
                                  <span className="text-xs text-muted-foreground ml-1">
                                    (max: {maxDefLimit} for {currentNumTeams} teams)
                                  </span>
                                )}
                                {position === 'KEEPERS' && (
                                  <span className="text-xs text-muted-foreground ml-1">
                                    (max: {getMaxKeepers()} rounds)
                                  </span>
                                )}
                                {position === 'FLEX' && (
                                  <span className="text-xs text-muted-foreground ml-1">
                                    (max: 6)
                                  </span>
                                )}
                              </Label>
                              <Input
                                id={position}
                                type="number"
                                min={0}
                                max={maxValue}
                                value={positionLimits[position]}
                                onChange={(e) => handlePositionLimitChange(position, e.target.value)}
                                className="bg-secondary/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                disabled
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
                {user && (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {(Object.keys(positionLimits) as Array<keyof PositionLimits>).map((position) => {
                        const currentNumTeams = typeof numTeams === 'number' ? numTeams : parseInt(String(numTeams)) || selectedLeague?.num_teams || 12;
                        const maxDefLimit = position === 'DEF' ? Math.floor(32 / currentNumTeams) : 15;
                        const maxValue = position === 'DEF' ? maxDefLimit : position === 'KEEPERS' ? getMaxKeepers() : position === 'FLEX' ? 6 : 15;
                        const label = position === 'DEF' ? 'Defense' : position === 'BENCH' ? 'Bench' : position === 'KEEPERS' ? 'Keepers' : position === 'FLEX' ? 'Flex' : position;
                        return (
                          <div key={position} className="space-y-2">
                            <Label htmlFor={position} className="text-sm font-medium">
                              {label}
                              {position === 'DEF' && (
                                <span className="text-xs text-muted-foreground ml-1">
                                  (max: {maxDefLimit} for {currentNumTeams} teams)
                                </span>
                              )}
                              {position === 'KEEPERS' && (
                                <span className="text-xs text-muted-foreground ml-1">
                                  (max: {getMaxKeepers()} rounds)
                                </span>
                              )}
                              {position === 'FLEX' && (
                                <span className="text-xs text-muted-foreground ml-1">
                                  (max: 6)
                                </span>
                              )}
                            </Label>
                            <Input
                              id={position}
                              type="number"
                              min={0}
                              max={maxValue}
                              value={positionLimits[position]}
                              onChange={(e) => handlePositionLimitChange(position, e.target.value)}
                              className="bg-secondary/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
                <div className="bg-muted/50 border border-border rounded-lg p-4 text-sm">
                  <p className="font-medium mb-2">Minimum Requirements:</p>
                  <ul className="space-y-1 text-muted-foreground list-disc list-inside">
                    <li>QB: 1, RB: 2, WR: 2, TE: 1, Flex: 1 (default 2 in superflex), K: 1, DEF: 1, Bench: 0</li>
                    <li>RB + WR + TE must total at least 5 + Flex count (to fill RB1, RB2, WR1, WR2, TE, and all FLEX positions)</li>
                    <li>Total roster size must accommodate all starting positions plus bench</li>
                    <li>Keepers: max per team (0 to number of draft rounds). When selecting keepers, each team may use up to this many keeper slots; keeper picks count toward position limits during the draft.</li>
                    <li className="text-primary/50">Note: Bench slots can be filled by any position, but must still respect position limits. Bench count cannot exceed the total remaining player capacity after filling starting positions.</li>
                    <li className="text-destructive/50">Defense Limit: There are only 32 NFL defenses available. Defense limit × number of teams must not exceed 32 (e.g., 12 teams × 2 defenses = 24, which is valid).</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="teams" className="relative">
            <Card className={cn("glass-card", !user && "opacity-90")}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0 gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    Team Names
                    {!user && (
                      <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">Preview</span>
                    )}
                  </CardTitle>
                  <CardDescription>
                    Customize the names for each team in your league{selectedLeague ? ` (Team ${selectedLeague.user_pick_position} is your team)` : ''}
                  </CardDescription>
                </div>
                {user && (
                  <Button onClick={saveTeamNames} disabled={saving} className="shrink-0">
                    <Save className="w-4 h-4 mr-2" />
                    Save Team Names
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-4 relative">
                {!user && (
                  <>
                    {/* Overlay that blocks interaction */}
                    <div className="absolute inset-0 bg-background/60 backdrop-blur-sm z-20 rounded-lg flex items-center justify-center">
                      <div className="text-center p-6 bg-background/90 rounded-lg border-2 border-primary/30 max-w-md">
                        <Users className="w-12 h-12 mx-auto mb-4 text-primary/60" />
                        <h3 className="font-display text-xl mb-2">Sign In to Customize Team Names</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          Give each team in your league a custom name. Sign in to unlock this feature and personalize your draft experience.
                        </p>
                        <Button variant="hero" onClick={() => navigate('/auth')} className="w-full">
                          Sign In to Unlock
                        </Button>
                      </div>
                    </div>
                    {/* Preview content behind overlay */}
                    <div className="opacity-50 pointer-events-none">
                      <div className="mb-4 p-3 bg-primary/10 border border-primary/20 rounded-lg">
                        <p className="text-sm text-primary/80">
                          💡 <strong>Preview Mode:</strong> Customize team names to personalize your league.
                        </p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin">
                        {teamNames.map((team) => (
                          <div key={team.team_number} className="space-y-2">
                            <Label htmlFor={`team-${team.team_number}`} className="text-sm font-medium flex items-center gap-2">
                              Team {team.team_number}
                              {selectedLeague && team.team_number === selectedLeague.user_pick_position && (
                                <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">You</span>
                              )}
                            </Label>
                            <Input
                              id={`team-${team.team_number}`}
                              name={`team-${team.team_number}`}
                              placeholder={`Team ${team.team_number}`}
                              value={team.team_name}
                              onChange={(e) => handleTeamNameChange(team.team_number, e.target.value)}
                              className="bg-secondary/50"
                              maxLength={50}
                              autoComplete="off"
                              autoCorrect="off"
                              autoCapitalize="off"
                              spellCheck="false"
                              disabled
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
                {user && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin">
                      {teamNames.map((team) => (
                        <div key={team.team_number} className="space-y-2">
                          <Label htmlFor={`team-${team.team_number}`} className="text-sm font-medium flex items-center gap-2">
                            Team {team.team_number}
                            {selectedLeague && team.team_number === selectedLeague.user_pick_position && (
                              <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">You</span>
                            )}
                          </Label>
                          <Input
                            id={`team-${team.team_number}`}
                            name={`team-${team.team_number}`}
                            placeholder={`Team ${team.team_number}`}
                            value={team.team_name}
                            onChange={(e) => handleTeamNameChange(team.team_number, e.target.value)}
                            className="bg-secondary/50"
                            maxLength={50}
                            autoComplete="off"
                            autoCorrect="off"
                            autoCapitalize="off"
                            spellCheck="false"
                          />
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="keepers" className="relative">
            <Card className={cn("glass-card", !user && "opacity-90")}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0 gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="flex items-center gap-2">
                      Keepers
                      {!user && (
                        <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">Sign in</span>
                      )}
                    </CardTitle>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button type="button" className="text-muted-foreground hover:text-foreground transition-colors">
                          <HelpCircle className="w-4 h-4" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent side="right" className="max-w-xs">
                        <div className="space-y-2 text-sm">
                          <p className="text-muted-foreground">
                            Keepers are removed from the available player pool. When it&apos;s a team&apos;s turn in a round where they have a keeper, that player is auto-assigned. Position limits apply—future keepers count toward the limit.
                          </p>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <CardDescription>
                    Assign keepers per team (limit set in Position Limits). Each keeper is drafted in a specific round.
                  </CardDescription>
                </div>
                {user && selectedLeague && (
                  <Button onClick={saveKeepers} disabled={saving} className="shrink-0">
                    <Save className="w-4 h-4 mr-2" />
                    Save Keepers
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-4 relative">
                {!user ? (
                  <div className="absolute inset-0 bg-background/60 backdrop-blur-sm z-20 rounded-lg flex items-center justify-center">
                    <div className="text-center p-6 bg-background/90 rounded-lg border-2 border-primary/30 max-w-md">
                      <BookmarkPlus className="w-12 h-12 mx-auto mb-4 text-primary/60" />
                      <h3 className="font-display text-xl mb-2">Sign In to Configure Keepers</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Keepers let you carry players from last year into specific rounds. Sign in and select a league to get started.
                      </p>
                      <Button variant="hero" onClick={() => navigate('/auth')} className="w-full">
                        Sign In to Unlock
                      </Button>
                    </div>
                  </div>
                ) : selectedLeague ? (
                  <>
                    {(() => {
                      const teamCount = selectedLeague.num_teams;
                      const numRounds = calculateNumRounds();
                      const allKeeperPlayerIds = new Set<string>();
                      Object.values(keepersByTeam || {}).flat().forEach((s) => s.player?.id && allKeeperPlayerIds.add(s.player.id));

                      const keeperLimit = getKeeperLimit();
                      return Array.from({ length: teamCount }, (_, i) => i + 1).map((teamNum) => {
                        const slots = keepersByTeam[teamNum] ?? (keeperLimit >= 1 ? [{ player: null, round: 1 }] : []);
                        const teamName = teamNames.find((t) => t.team_number === teamNum)?.team_name || `Team ${teamNum}`;
                        const isUserTeam = teamNum === selectedLeague.user_pick_position;

                        return (
                          <div key={teamNum} className="space-y-3 p-4 rounded-lg border border-border bg-secondary/20">
                            <div className="flex items-center gap-2 font-medium">
                              {teamName}
                              {isUserTeam && (
                                <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">You</span>
                              )}
                            </div>
                            {keeperLimit === 0 && (
                              <p className="text-sm text-muted-foreground">No keeper slots. Set &quot;Keepers&quot; in Position Limits to allow keepers.</p>
                            )}
                            <div className="space-y-2">
                              {slots.map((slot, idx) => (
                                <div key={idx} className="flex items-center gap-3 flex-wrap">
                                  <div className="flex-1 min-w-[200px]">
                                    <PlayerSearchCombobox
                                      value={slot.player}
                                      onChange={(p) => updateKeeperSlot(teamNum, idx, { player: p })}
                                      excludePlayerIds={new Set([...allKeeperPlayerIds].filter((id) => id !== slot.player?.id))}
                                      placeholder="Search player..."
                                    />
                                  </div>
                                  <Select
                                    value={String(slot.round)}
                                    onValueChange={(v) => updateKeeperSlot(teamNum, idx, { round: parseInt(v) })}
                                  >
                                    <SelectTrigger className="w-24">
                                      <SelectValue placeholder="Round" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {Array.from({ length: numRounds }, (_, r) => r + 1).map((r) => (
                                        <SelectItem key={r} value={String(r)}>Rd {r}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-9 w-9 shrink-0"
                                    onClick={() => removeKeeperSlot(teamNum, idx)}
                                    title="Remove keeper slot"
                                  >
                                    <Trash2 className="w-4 h-4 text-muted-foreground" />
                                  </Button>
                                </div>
                              ))}
                              {keeperLimit > 0 && slots.length < keeperLimit && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-2"
                                  onClick={() => addKeeperSlot(teamNum)}
                                >
                                  <Plus className="w-4 h-4" /> Add keeper
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </>
                ) : (
                  <p className="text-muted-foreground">Select a league to configure keepers.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
