import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
import { Save, Users, Settings2, ArrowLeft, Layers, BookmarkPlus, Plus, Trash2, HelpCircle, ListOrdered, Info, LayoutList, UserPlus } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { tempSettingsStorage } from '@/utils/temporaryStorage';
import { cn } from '@/lib/utils';
import { PlayerSearchCombobox } from '@/components/PlayerSearchCombobox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { Player } from '@/types/database';
import { BrandedLoader } from '@/components/BrandedLoader';
import { userFacingErrorMessage } from '@/utils/userFacingError';
import { LeagueMembersPanel } from '@/components/league/LeagueMembersPanel';
import { isLeagueOwner } from '@/utils/leagueAccess';
import { leagueListSeats, leagueMyMembership, leagueSetTeamName } from '@/utils/leagueSocialApi';
import type { LeagueMemberRole, LeagueSeat } from '@/types/leagueSocial';
import {
  DEFAULT_STARTERS,
  STARTER_MAX,
  STARTER_MIN,
  STARTER_POSITION_ORDER,
  countBaseStarters,
  ensureLimitsCoverStarters,
  formatLineupSummary,
  getRosterRounds,
  parseStarters,
  type PositionLimitsLike,
  type StarterCounts,
  type StarterPosition,
} from '@/utils/rosterSlots';

interface PositionLimits {
  QB: number;
  RB: number;
  WR: number;
  TE: number;
  FLEX: number;
  K: number;
  DEF: number;
  BENCH: number;
  IR: number;
  KEEPERS: number;
  starters?: StarterCounts;
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
  const [searchParams] = useSearchParams();
  const [settingsTab, setSettingsTab] = useState(
    searchParams.get('tab') === 'members' ? 'members' : 'general'
  );
  const visibleSettingsTab =
    settingsTab === 'members' && !(user && selectedLeague) ? 'general' : settingsTab;
  
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
  
  const [positionLimits, setPositionLimits] = useState<Record<keyof Omit<PositionLimits, 'starters'>, number | string>>({
    QB: 4, RB: 8, WR: 8, TE: 6, FLEX: 1, K: 3, DEF: 3, BENCH: 5, IR: 0, KEEPERS: 1
  });
  const [starterCounts, setStarterCounts] = useState<Record<StarterPosition, number | string>>({
    ...DEFAULT_STARTERS,
  });
  
  const defaultMaximums: Record<keyof Omit<PositionLimits, 'starters'>, number> = {
    QB: 15, RB: 15, WR: 15, TE: 15, FLEX: 6, K: 15, DEF: 15, BENCH: 15, IR: 4, KEEPERS: 20
  };

  const resolvedStarters = (): StarterCounts => ({
    QB: starterCounts.QB === '' ? DEFAULT_STARTERS.QB : Math.max(STARTER_MIN.QB, Math.min(STARTER_MAX.QB, Number(starterCounts.QB) || 0)),
    RB: starterCounts.RB === '' ? DEFAULT_STARTERS.RB : Math.max(STARTER_MIN.RB, Math.min(STARTER_MAX.RB, Number(starterCounts.RB) || 0)),
    WR: starterCounts.WR === '' ? DEFAULT_STARTERS.WR : Math.max(STARTER_MIN.WR, Math.min(STARTER_MAX.WR, Number(starterCounts.WR) || 0)),
    TE: starterCounts.TE === '' ? DEFAULT_STARTERS.TE : Math.max(STARTER_MIN.TE, Math.min(STARTER_MAX.TE, Number(starterCounts.TE) || 0)),
    DEF: starterCounts.DEF === '' ? DEFAULT_STARTERS.DEF : Math.max(STARTER_MIN.DEF, Math.min(STARTER_MAX.DEF, Number(starterCounts.DEF) || 0)),
    K: starterCounts.K === '' ? DEFAULT_STARTERS.K : Math.max(STARTER_MIN.K, Math.min(STARTER_MAX.K, Number(starterCounts.K) || 0)),
  });

  const resolvedFlex = (): number => {
    if (positionLimits.FLEX === '') return isSuperflex ? 2 : 1;
    return Math.max(0, Math.min(6, Number(positionLimits.FLEX) || 0));
  };
  const resolvedIr = (): number => {
    if (positionLimits.IR === '') return 0;
    return Math.max(0, Math.min(4, Number(positionLimits.IR) || 0));
  };
  const [teamNames, setTeamNames] = useState<TeamName[]>([]);
  const [seats, setSeats] = useState<LeagueSeat[]>([]);
  const [myMembership, setMyMembership] = useState<{
    team_number: number | null;
    role: LeagueMemberRole;
  } | null>(null);
  const [leagueName, setLeagueName] = useState('');
  const [numTeams, setNumTeams] = useState<number | string>(12);
  const [userPickPosition, setUserPickPosition] = useState<number | string>(1);
  const [draftOrder, setDraftOrder] = useState('snake');
  const [scoringFormat, setScoringFormat] = useState<'standard' | 'ppr' | 'half_ppr'>('ppr');
  const [leagueType, setLeagueType] = useState('season');
  const [isSuperflex, setIsSuperflex] = useState(false);
  const [rookiesOnly, setRookiesOnly] = useState(false);
  const [saving, setSaving] = useState(false);
  // Keepers: per team, 1-5 slots. Each slot: { player, round }.
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

  // Guests can edit and save settings on this device.

  // Load settings from localStorage for guests on mount
  useEffect(() => {
    if (!user && !selectedLeague) {
      const tempSettings = tempSettingsStorage.get();
      if (tempSettings) {
        if (tempSettings.leagueName) setLeagueName(tempSettings.leagueName);
        if (tempSettings.numTeams) setNumTeams(tempSettings.numTeams);
        if (tempSettings.userPickPosition) setUserPickPosition(tempSettings.userPickPosition);
        if (tempSettings.draftOrder) setDraftOrder(tempSettings.draftOrder);
        if (tempSettings.scoringFormat) setScoringFormat(tempSettings.scoringFormat as 'standard' | 'ppr' | 'half_ppr');
        if (tempSettings.leagueType) setLeagueType(tempSettings.leagueType);
        if (tempSettings.isSuperflex !== undefined) setIsSuperflex(tempSettings.isSuperflex);
        if (tempSettings.rookiesOnly !== undefined) setRookiesOnly(tempSettings.rookiesOnly);
        if (Array.isArray(tempSettings.teamNames) && tempSettings.teamNames.length > 0) {
          setTeamNames(tempSettings.teamNames);
        }
        if (tempSettings.positionLimits) {
          // Calculate DEF limit based on numTeams if not already calculated
          const numTeamsValue = tempSettings.numTeams || 12;
          const calculatedDefLimit = Math.floor(32 / numTeamsValue);
          const guestLimits = tempSettings.positionLimits as PositionLimitsLike;
          
          setPositionLimits({
            QB: tempSettings.positionLimits.QB ?? 4,
            RB: tempSettings.positionLimits.RB ?? 8,
            WR: tempSettings.positionLimits.WR ?? 8,
            TE: tempSettings.positionLimits.TE ?? 6, // Default to 6 for guests
            FLEX: guestLimits.FLEX ?? (tempSettings.isSuperflex ? 2 : 1),
            K: tempSettings.positionLimits.K ?? 3,
            DEF: tempSettings.positionLimits.DEF ?? calculatedDefLimit, // Use calculated if not set
            BENCH: tempSettings.positionLimits.BENCH ?? 5, // Default to 5 for guests
            IR: guestLimits.IR ?? 0,
            KEEPERS: guestLimits.KEEPERS ?? 1,
          });
          setStarterCounts(parseStarters(guestLimits));
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
    const limits = selectedLeague?.position_limits as PositionLimitsLike | undefined;
    const keeperLimit = limits
      ? Math.min(Math.max(0, limits.KEEPERS ?? 1), getRosterRounds(limits, !!selectedLeague?.is_superflex))
      : 1;
    for (let i = 1; i <= count; i++) {
      const arr = byTeam[i] || [];
      if (arr.length === 0) arr.push({ player: null, round: 1 });
      byTeam[i] = arr.slice(0, keeperLimit);
    }
    setKeepersByTeam(byTeam);
  }, [selectedLeague, user]);

  useEffect(() => {
    if (user) return;
    const rawKeepers = tempSettingsStorage.get()?.keepers as
      | Array<{ team_number: number; player_id: string; round_number: number }>
      | undefined;
    if (!rawKeepers || rawKeepers.length === 0) return;
    let cancelled = false;
    void (async () => {
      const playerIds = [...new Set(rawKeepers.map((k) => k.player_id).filter(Boolean))];
      const playersMap = new Map<string, Player>();
      if (playerIds.length > 0) {
        const { data: playersData } = await supabase.from('players').select('*').in('id', playerIds);
        (playersData || []).forEach((p: Player) => playersMap.set(p.id, p));
      }
      if (cancelled) return;
      const byTeam: Record<number, KeeperSlot[]> = {};
      rawKeepers.forEach((row) => {
        if (!byTeam[row.team_number]) byTeam[row.team_number] = [];
        byTeam[row.team_number].push({
          player: playersMap.get(row.player_id) || null,
          round: row.round_number,
        });
      });
      setKeepersByTeam(byTeam);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (selectedLeague) {
      // Load league name
      setLeagueName(selectedLeague.name);

      // Load position limits + starter lineup
      const limits = selectedLeague.position_limits as unknown as PositionLimits | null;
      if (limits && typeof limits === 'object') {
        const isSflex = (selectedLeague.is_superflex as boolean) || false;
        setPositionLimits({
          QB: limits.QB ?? 4,
          RB: limits.RB ?? 8,
          WR: limits.WR ?? 8,
          TE: limits.TE ?? 3,
          FLEX: limits.FLEX ?? (isSflex ? 2 : 1),
          K: limits.K ?? 3,
          DEF: limits.DEF ?? 3,
          BENCH: limits.BENCH ?? 7,
          IR: limits.IR ?? 0,
          KEEPERS: limits.KEEPERS ?? 1,
        });
        setStarterCounts(parseStarters(limits));
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

  useEffect(() => {
    const userId = user?.id ?? null;
    const leagueId = selectedLeague?.id ?? null;
    if (!userId || !leagueId) {
      setSeats([]);
      setMyMembership(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const [membership, rows] = await Promise.all([
          leagueMyMembership(leagueId, userId),
          leagueListSeats(leagueId).catch((err) => {
            console.error(err);
            return [] as LeagueSeat[];
          }),
        ]);
        if (cancelled) return;
        setMyMembership(membership);
        setSeats(rows);
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setMyMembership(null);
          setSeats([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, selectedLeague?.id]);

  const mySeatTeamNumber = useMemo(() => {
    if (myMembership?.team_number != null) return myMembership.team_number;
    if (!user) return null;
    return seats.find((seat) => seat.user_id === user.id)?.team_number ?? null;
  }, [myMembership, user, seats]);

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
    
  }, [numTeams, userPickPosition, user, selectedLeague]);

  // Max keepers = number of draft rounds (starters + flex + bench from current form)
  const getMaxKeepers = (): number => {
    const starters = resolvedStarters();
    const flexCount = resolvedFlex();
    const bench = typeof positionLimits.BENCH === 'number' ? positionLimits.BENCH : parseInt(String(positionLimits.BENCH)) || 6;
    return countBaseStarters(starters) + flexCount + Math.max(0, bench);
  };

  const handlePositionLimitChange = (position: keyof Omit<PositionLimits, 'starters'>, value: string) => {
    const cleaned = value.replace(/-/g, '');
    if (cleaned === '') {
      setPositionLimits(prev => ({ ...prev, [position]: '' }));
      return;
    }
    if (/^0+$/.test(cleaned)) {
      if (position === 'BENCH' || position === 'FLEX' || position === 'IR') {
        setPositionLimits(prev => ({ ...prev, [position]: 0 }));
      } else {
        setPositionLimits(prev => ({ ...prev, [position]: '' }));
      }
      return;
    }
    const limited = cleaned.length > 3 ? cleaned.slice(0, 3) : cleaned;
    const numValue = parseInt(limited, 10);
    if (isNaN(numValue)) return;
    const maxDefLimit = position === 'DEF' ? 29 : 15;
    const max = position === 'DEF' ? maxDefLimit : position === 'KEEPERS' ? getMaxKeepers() : position === 'FLEX' ? 6 : position === 'IR' ? 4 : defaultMaximums[position];
    const clamped = Math.min(max, Math.max(0, numValue));
    setPositionLimits(prev => ({ ...prev, [position]: clamped }));
  };

  const handleStarterChange = (position: StarterPosition, value: string) => {
    const cleaned = value.replace(/-/g, '');
    if (cleaned === '') {
      setStarterCounts(prev => ({ ...prev, [position]: '' }));
      return;
    }
    if (/^0+$/.test(cleaned)) {
      setStarterCounts(prev => ({ ...prev, [position]: 0 }));
      return;
    }
    const numValue = parseInt(cleaned.slice(0, 2), 10);
    if (isNaN(numValue)) return;
    const clamped = Math.min(STARTER_MAX[position], Math.max(STARTER_MIN[position], numValue));
    setStarterCounts(prev => ({ ...prev, [position]: clamped }));
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
      
      const defLimit = typeof positionLimits.DEF === 'number' ? positionLimits.DEF : Math.max(1, Math.min(29, parseInt(String(positionLimits.DEF)) || 1));
      
      tempSettingsStorage.save({
        numTeams: finalNumTeams,
        userPickPosition: finalUserPickPosition,
        draftOrder: draftOrder || 'snake',
        scoringFormat: scoringFormat || 'ppr',
        leagueType: leagueType || 'season',
        leagueName: leagueName.trim() || 'My Fantasy League',
        isSuperflex: isSuperflex || false,
        rookiesOnly: leagueType === 'dynasty' ? rookiesOnly : false,
        teamNames,
        positionLimits: {
          QB: typeof positionLimits.QB === 'number' ? positionLimits.QB : parseInt(String(positionLimits.QB)) || 4,
          RB: typeof positionLimits.RB === 'number' ? positionLimits.RB : parseInt(String(positionLimits.RB)) || 8,
          WR: typeof positionLimits.WR === 'number' ? positionLimits.WR : parseInt(String(positionLimits.WR)) || 8,
          TE: typeof positionLimits.TE === 'number' ? positionLimits.TE : parseInt(String(positionLimits.TE)) || 6,
          FLEX: typeof positionLimits.FLEX === 'number' ? positionLimits.FLEX : Math.max(1, Math.min(6, parseInt(String(positionLimits.FLEX)) || (isSuperflex ? 2 : 1))),
          K: typeof positionLimits.K === 'number' ? positionLimits.K : parseInt(String(positionLimits.K)) || 3,
          DEF: defLimit,
          BENCH: typeof positionLimits.BENCH === 'number' ? positionLimits.BENCH : parseInt(String(positionLimits.BENCH)) || 5,
          IR: typeof positionLimits.IR === 'number' ? positionLimits.IR : Math.max(0, Math.min(4, parseInt(String(positionLimits.IR)) || 0)),
          KEEPERS: typeof positionLimits.KEEPERS === 'number' ? positionLimits.KEEPERS : parseInt(String(positionLimits.KEEPERS)) || 1,
          starters: resolvedStarters(),
        },
      });
      
      setPositionLimits(prev => ({ ...prev, DEF: defLimit }));
      
      setNumTeams(finalNumTeams);
      setUserPickPosition(finalUserPickPosition);
      toast.success('Settings saved on this device');
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
            toast.error(
              userFacingErrorMessage(simpleError, "Couldn't update number of teams. Please try again.")
            );
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
          toast.error(userFacingErrorMessage(error, "Couldn't update settings. Please try again."));
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
      toast.error(userFacingErrorMessage(err, "Couldn't update settings. Please try again."));
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

  // Validate that position limits allow for a valid roster given the starter lineup
  const validatePositionLimits = (
    limits: PositionLimits,
    isSuperflexLeague: boolean,
    numTeamsValue: number
  ): { valid: boolean; error?: string } => {
    const starters = parseStarters(limits);
    const flexCount = Math.max(0, Math.min(6, limits.FLEX ?? (isSuperflexLeague ? 2 : 1)));
    const baseStarters = countBaseStarters(starters);

    if (baseStarters + flexCount < 1) {
      return { valid: false, error: 'Starting lineup must include at least one starter or flex slot.' };
    }

    if (flexCount > 6) {
      return { valid: false, error: `Flex count must be between 0 and 6. Currently: ${flexCount}` };
    }

    for (const pos of STARTER_POSITION_ORDER) {
      if (limits[pos] < starters[pos]) {
        return {
          valid: false,
          error: `${pos} limit (${limits[pos]}) cannot be below starting ${pos} slots (${starters[pos]}).`,
        };
      }
    }

    const flexFromSkill = isSuperflexLeague ? Math.max(0, flexCount - 1) : flexCount;
    const skillNeed = starters.RB + starters.WR + starters.TE + flexFromSkill;
    const skillHave = limits.RB + limits.WR + limits.TE;
    if (skillHave < skillNeed) {
      return {
        valid: false,
        error: `Position limits are too low. You need at least ${skillNeed} combined RB/WR/TE to cover starters${flexFromSkill ? ` + ${flexFromSkill} flex` : ''}. Currently: ${limits.RB} RB + ${limits.WR} WR + ${limits.TE} TE = ${skillHave}.`,
      };
    }

    if (limits.DEF > 29) {
      return { valid: false, error: 'DEF limit cannot exceed 29 (smallest league is 4; 29+3=32 defenses)' };
    }

    if (numTeamsValue > 32) {
      return {
        valid: false,
        error: `Cannot have more than 32 teams. There are only 32 NFL defenses available.`,
      };
    }

    if (limits.BENCH < 0) {
      return { valid: false, error: 'BENCH limit cannot be negative' };
    }

    const minStarters = baseStarters + flexCount;
    const minRosterSize = minStarters + limits.BENCH;
    const maxRosterSize = limits.QB + limits.RB + limits.WR + limits.TE + limits.K + limits.DEF + limits.BENCH;

    if (maxRosterSize < minRosterSize) {
      return {
        valid: false,
        error: `Position limits are too low. Your roster needs at least ${minRosterSize} players (${minStarters} starters + ${limits.BENCH} bench), but your limits only allow ${maxRosterSize} players total.`,
      };
    }

    const qbUsed = starters.QB + (isSuperflexLeague && flexCount > 0 ? 1 : 0);
    const defUsed = starters.DEF;
    const kUsed = starters.K;

    const scenario1Remaining =
      Math.max(0, limits.QB - qbUsed) +
      Math.max(0, limits.RB - (starters.RB + flexCount)) +
      Math.max(0, limits.WR - starters.WR) +
      Math.max(0, limits.TE - starters.TE) +
      Math.max(0, limits.DEF - defUsed) +
      Math.max(0, limits.K - kUsed);

    const scenario2Remaining =
      Math.max(0, limits.QB - qbUsed) +
      Math.max(0, limits.RB - starters.RB) +
      Math.max(0, limits.WR - (starters.WR + flexCount)) +
      Math.max(0, limits.TE - starters.TE) +
      Math.max(0, limits.DEF - defUsed) +
      Math.max(0, limits.K - kUsed);

    const scenario3Remaining =
      Math.max(0, limits.QB - qbUsed) +
      Math.max(0, limits.RB - starters.RB) +
      Math.max(0, limits.WR - starters.WR) +
      Math.max(0, limits.TE - (starters.TE + flexCount)) +
      Math.max(0, limits.DEF - defUsed) +
      Math.max(0, limits.K - kUsed);

    const minRemainingCapacity = Math.min(scenario1Remaining, scenario2Remaining, scenario3Remaining);

    if (limits.BENCH > minRemainingCapacity) {
      let worstScenario = 'FLEX slots using RB';
      if (scenario2Remaining <= scenario1Remaining && scenario2Remaining <= scenario3Remaining) {
        worstScenario = 'FLEX slots using WR';
      } else if (scenario3Remaining <= scenario1Remaining && scenario3Remaining <= scenario2Remaining) {
        worstScenario = 'FLEX slots using TE';
      }

      return {
        valid: false,
        error: `Bench slots (${limits.BENCH}) exceed available player capacity. After filling starting positions (worst case: ${worstScenario}), you only have ${minRemainingCapacity} total player slots remaining across all positions. Bench slots must not exceed this total.`,
      };
    }

    if (limits.KEEPERS !== undefined && typeof limits.KEEPERS === 'number') {
      const numRounds = minStarters + limits.BENCH;
      if (limits.KEEPERS < 0 || limits.KEEPERS > numRounds) {
        return {
          valid: false,
          error: `Keepers limit must be between 0 and ${numRounds} (number of draft rounds).`,
        };
      }
    }

    return { valid: true };
  };

  const buildFinalPositionLimits = (): PositionLimits => {
    const starters = resolvedStarters();
    const flexCount = resolvedFlex();
    const bench = positionLimits.BENCH === '' ? 0 : Math.max(0, Number(positionLimits.BENCH));
    const maxKeepersForSave = countBaseStarters(starters) + flexCount + bench;

    let limits: PositionLimits = {
      QB: positionLimits.QB === '' ? Math.max(4, starters.QB) : Math.max(starters.QB, Number(positionLimits.QB) || 0),
      RB: positionLimits.RB === '' ? Math.max(8, starters.RB) : Math.max(starters.RB, Number(positionLimits.RB) || 0),
      WR: positionLimits.WR === '' ? Math.max(8, starters.WR) : Math.max(starters.WR, Number(positionLimits.WR) || 0),
      TE: positionLimits.TE === '' ? Math.max(6, starters.TE) : Math.max(starters.TE, Number(positionLimits.TE) || 0),
      FLEX: flexCount,
      K: positionLimits.K === '' ? Math.max(3, starters.K) : Math.max(starters.K, Number(positionLimits.K) || 0),
      DEF: positionLimits.DEF === ''
        ? Math.max(3, starters.DEF)
        : Math.max(starters.DEF, Math.min(29, Number(positionLimits.DEF) || 0)),
      BENCH: bench,
      IR: resolvedIr(),
      KEEPERS: positionLimits.KEEPERS === '' ? 1 : Math.max(0, Math.min(maxKeepersForSave, Number(positionLimits.KEEPERS) || 0)),
      starters,
    };

    const covered = ensureLimitsCoverStarters(limits, starters, flexCount, isSuperflex);
    limits = {
      ...limits,
      QB: typeof covered.QB === 'number' ? covered.QB : limits.QB,
      RB: typeof covered.RB === 'number' ? covered.RB : limits.RB,
      WR: typeof covered.WR === 'number' ? covered.WR : limits.WR,
      TE: typeof covered.TE === 'number' ? covered.TE : limits.TE,
      DEF: typeof covered.DEF === 'number' ? covered.DEF : limits.DEF,
      K: typeof covered.K === 'number' ? covered.K : limits.K,
    };
    return limits;
  };

  const persistPositionLimits = async (finalLimits: PositionLimits, successMessage: string) => {
    if (!selectedLeague) return false;
    const limitsJson = JSON.parse(JSON.stringify(finalLimits));
    const { error } = await supabase
      .from('leagues')
      .update({ position_limits: limitsJson })
      .eq('id', selectedLeague.id);

    if (error) {
      toast.error('Failed to save roster settings');
      console.error(error);
      return false;
    }

    toast.success(successMessage);
    setPositionLimits({
      QB: finalLimits.QB,
      RB: finalLimits.RB,
      WR: finalLimits.WR,
      TE: finalLimits.TE,
      FLEX: finalLimits.FLEX,
      K: finalLimits.K,
      DEF: finalLimits.DEF,
      BENCH: finalLimits.BENCH,
      IR: finalLimits.IR,
      KEEPERS: finalLimits.KEEPERS,
    });
    if (finalLimits.starters) setStarterCounts(finalLimits.starters);
    await refreshLeagues();
    const { data: updatedLeague } = await supabase
      .from('leagues')
      .select('*')
      .eq('id', selectedLeague.id)
      .single();
    if (updatedLeague) {
      setSelectedLeague(updatedLeague);
    }
    return true;
  };

  const savePositionLimits = async () => {
    setSaving(true);
    const finalLimits = buildFinalPositionLimits();
    const currentNumTeams = typeof numTeams === 'number' ? numTeams : parseInt(String(numTeams)) || selectedLeague?.num_teams || 12;
    const validation = validatePositionLimits(finalLimits, isSuperflex, currentNumTeams);
    if (!validation.valid) {
      toast.error(validation.error || 'Invalid position limits');
      setSaving(false);
      return;
    }
    if (!user) {
      const cur = tempSettingsStorage.get() || {};
      tempSettingsStorage.save({
        ...cur,
        isSuperflex,
        positionLimits: {
          ...(cur.positionLimits || {}),
          ...finalLimits,
        },
      });
      toast.success('Position limits saved on this device');
      setSaving(false);
      return;
    }
    if (!selectedLeague) {
      setSaving(false);
      return;
    }

    await persistPositionLimits(finalLimits, 'Position limits saved');
    setSaving(false);
  };

  const saveStartingLineup = async () => {
    setSaving(true);
    const finalLimits = buildFinalPositionLimits();
    const currentNumTeams =
      typeof numTeams === 'number'
        ? numTeams
        : parseInt(String(numTeams)) || selectedLeague?.num_teams || 12;
    const validation = validatePositionLimits(finalLimits, isSuperflex, currentNumTeams);
    if (!validation.valid) {
      toast.error(validation.error || 'Invalid starting lineup');
      setSaving(false);
      return;
    }

    if (!user) {
      const cur = tempSettingsStorage.get() || {};
      tempSettingsStorage.save({
        ...cur,
        isSuperflex,
        positionLimits: {
          ...(cur.positionLimits || {}),
          ...finalLimits,
        },
      });
      setPositionLimits({
        QB: finalLimits.QB,
        RB: finalLimits.RB,
        WR: finalLimits.WR,
        TE: finalLimits.TE,
        FLEX: finalLimits.FLEX,
        K: finalLimits.K,
        DEF: finalLimits.DEF,
        BENCH: finalLimits.BENCH,
        IR: finalLimits.IR,
        KEEPERS: finalLimits.KEEPERS,
      });
      setStarterCounts(finalLimits.starters || DEFAULT_STARTERS);
      toast.success('Starting lineup saved on this device');
      setSaving(false);
      return;
    }

    if (!selectedLeague) {
      toast.error('Select a league to save starting lineup');
      setSaving(false);
      return;
    }

    await persistPositionLimits(finalLimits, 'Starting lineup saved');
    setSaving(false);
  };

  const calculateNumRounds = (): number => {
    if (selectedLeague?.position_limits) {
      return getRosterRounds(selectedLeague.position_limits as PositionLimitsLike, isSuperflex);
    }
    return countBaseStarters(resolvedStarters()) + resolvedFlex() + (
      typeof positionLimits.BENCH === 'number' ? positionLimits.BENCH : parseInt(String(positionLimits.BENCH)) || 6
    );
  };

  /** Max keepers per team from live Position Limits form (falls back to saved league). */
  const getKeeperLimit = (): number => {
    const fromForm =
      typeof positionLimits.KEEPERS === 'number'
        ? positionLimits.KEEPERS
        : parseInt(String(positionLimits.KEEPERS), 10);
    const fromLeague = selectedLeague?.position_limits
      ? (selectedLeague.position_limits as { KEEPERS?: number }).KEEPERS
      : undefined;
    const n = Number.isFinite(fromForm) ? fromForm : typeof fromLeague === 'number' ? fromLeague : 1;
    const maxRounds = getMaxKeepers();
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
    const maxSlots = getMaxKeepers();
    setKeepersByTeam((prev) => {
      const arr = [...(prev[teamNumber] || [])];
      if (arr.length >= maxSlots) return prev;
      const nextLen = arr.length + 1;
      arr.push({ player: null, round: 1 });
      // Bump Keepers limit so Add keeper works without a trip to Position Limits first.
      setPositionLimits((limits) => {
        const current =
          typeof limits.KEEPERS === 'number'
            ? limits.KEEPERS
            : parseInt(String(limits.KEEPERS), 10) || 0;
        if (current >= nextLen) return limits;
        return { ...limits, KEEPERS: Math.min(maxSlots, nextLen) };
      });
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
    if (user && !selectedLeague) return;
    const numRounds = calculateNumRounds();
    const keeperLimit = getKeeperLimit();
    const teamCount =
      selectedLeague?.num_teams ??
      (typeof numTeams === 'number' ? numTeams : parseInt(String(numTeams)) || 12);
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

    const serializeKeepers = () => {
      const rows: Array<{ team_number: number; player_id: string; round_number: number }> = [];
      for (let t = 1; t <= teamCount; t++) {
        for (const slot of keepersByTeam[t] || []) {
          if (slot.player) {
            rows.push({
              team_number: t,
              player_id: slot.player.id,
              round_number: slot.round,
            });
          }
        }
      }
      return rows;
    };

    const maxSlotsUsed = Math.max(
      0,
      ...Array.from({ length: teamCount }, (_, i) => (keepersByTeam[i + 1] || []).length)
    );
    const nextKeeperLimit = Math.min(getMaxKeepers(), Math.max(getKeeperLimit(), maxSlotsUsed));

    if (!user) {
      const keepers = serializeKeepers();
      const cur = tempSettingsStorage.get() || {};
      tempSettingsStorage.save({
        ...cur,
        keepers,
        positionLimits: {
          ...(cur.positionLimits || {}),
          KEEPERS: nextKeeperLimit,
        },
      });
      setPositionLimits((prev) => ({ ...prev, KEEPERS: nextKeeperLimit }));
      toast.success(keepers.length > 0 ? 'Keepers saved on this device' : 'Keepers cleared');
      setSaving(false);
      return;
    }

    if (!selectedLeague) {
      setSaving(false);
      return;
    }

    // Keep Position Limits.KEEPERS in sync with the most slots any team is using.
    const existingLimits = (selectedLeague.position_limits || {}) as Record<string, number>;
    if ((existingLimits.KEEPERS ?? 1) < nextKeeperLimit || positionLimits.KEEPERS !== nextKeeperLimit) {
      const updatedLimits = { ...existingLimits, KEEPERS: nextKeeperLimit };
      const { error: limitsError } = await supabase
        .from('leagues')
        .update({ position_limits: updatedLimits })
        .eq('id', selectedLeague.id);
      if (limitsError) {
        toast.error('Failed to update keepers limit');
        console.error(limitsError);
        setSaving(false);
        return;
      }
      setPositionLimits((prev) => ({ ...prev, KEEPERS: nextKeeperLimit }));
      setSelectedLeague({ ...selectedLeague, position_limits: updatedLimits } as typeof selectedLeague);
    }

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
      const cur = tempSettingsStorage.get() || {};
      tempSettingsStorage.save({ ...cur, teamNames });
      toast.success('Team names saved on this device');
      return;
    }
    
    if (!selectedLeague) return;

    const saveAsOwner = myMembership?.role === 'owner';

    setSaving(true);
    try {
      if (myMembership?.role === 'member' || !saveAsOwner) {
        if (mySeatTeamNumber == null) {
          toast.error('Claim a team on Home before you can rename it');
          return;
        }
        const row = teamNames.find((t) => t.team_number === mySeatTeamNumber);
        await leagueSetTeamName(selectedLeague.id, mySeatTeamNumber, row?.team_name ?? '');
        toast.success('Team name saved');
        await loadTeamNames();
        return;
      }

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
          return;
        }
      }

      toast.success('Team names saved');
    } catch (err) {
      toast.error(userFacingErrorMessage(err, 'Failed to save team names'));
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  // All hooks must be called before any early returns
  // Early returns for loading and "no league selected" states
  if (authLoading || leaguesLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="flex min-h-[70vh] items-center justify-center px-4">
          <BrandedLoader />
        </main>
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

  const isRookieOnlyLeague = leagueType === 'dynasty' && rookiesOnly;
  const isMember = myMembership?.role === 'member';
  const canEditLeague =
    !user ||
    myMembership?.role === 'owner' ||
    (myMembership == null && Boolean(user && isLeagueOwner(selectedLeague, user.id)));
  const ownerOrGuestPick =
    typeof userPickPosition === 'number' ? userPickPosition : parseInt(String(userPickPosition)) || 1;
  // Logged-in members: claimed seat only. Never the commissioner's draft slot.
  const myTeamNumber = user && selectedLeague
    ? mySeatTeamNumber ?? (isMember ? null : myMembership?.role === 'owner' ? ownerOrGuestPick : null)
    : ownerOrGuestPick;
  const mySeatTeamName =
    mySeatTeamNumber != null
      ? teamNames.find((t) => t.team_number === mySeatTeamNumber)?.team_name?.trim() || ''
      : '';
  const canSaveTeamNames = canEditLeague || mySeatTeamNumber != null;
  const canEditTeamName = (teamNumber: number) =>
    !user || canEditLeague || teamNumber === mySeatTeamNumber;

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
            <p className="text-muted-foreground">{leagueName || selectedLeague?.name || 'Guest league'}</p>
          </div>
        </div>

        {!user && (
          <p className="text-sm text-muted-foreground mb-6">
            Settings on this device are not saved to an account and do not affect community consensus.
          </p>
        )}

        {user && selectedLeague && isMember && (
          <Alert className="mb-6">
            <Info className="h-4 w-4" />
            <AlertDescription>
              {mySeatTeamNumber != null
                ? `Your team is Team ${mySeatTeamNumber}. Rename it on Team Names. League rules and keepers stay with the commissioner.`
                : 'Claim a team on Home, then you can rename it on Team Names. League rules stay with the commissioner.'}
            </AlertDescription>
          </Alert>
        )}

        <Tabs value={visibleSettingsTab} onValueChange={setSettingsTab} className="space-y-6">
          <TabsList className={cn(
            'grid w-full bg-secondary/50 h-auto gap-1',
            user && selectedLeague ? 'grid-cols-3 sm:grid-cols-6' : 'grid-cols-2 sm:grid-cols-5'
          )}>
            <TabsTrigger value="general" className="gap-2">
              <Settings2 className="w-4 h-4" />
              General
            </TabsTrigger>
            {user && selectedLeague && (
              <TabsTrigger value="members" className="gap-2">
                <UserPlus className="w-4 h-4" />
                Members
              </TabsTrigger>
            )}
            <TabsTrigger value="lineup" className="gap-2">
              <LayoutList className="w-4 h-4" />
              Lineup
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

          {user && selectedLeague && (
            <TabsContent value="members">
              <LeagueMembersPanel
                leagueId={selectedLeague.id}
                leagueName={selectedLeague.name}
                isOwner={canEditLeague}
                onLeftLeague={() => {
                  setSelectedLeague(null);
                  void refreshLeagues();
                  navigate('/dashboard');
                }}
              />
            </TabsContent>
          )}

          <TabsContent value="general" className="relative">
            <Card className="glass-card">
              <CardHeader className="flex flex-row items-start justify-between space-y-0 gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    General Settings
                    {!user && (
                      <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">Local</span>
                    )}
                  </CardTitle>
                  <CardDescription>
                    Configure the basic settings for your league
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button onClick={saveGeneralSettings} disabled={saving || !canEditLeague} className="shrink-0">
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
                    disabled={!canEditLeague}
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
                      disabled={!canEditLeague}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="userPickPosition" className="text-sm font-medium">
                      {canEditLeague ? 'Your Draft Pick Position' : 'Your team'}
                    </Label>
                    {canEditLeague ? (
                      <Select 
                        value={String(userPickPosition)} 
                        onValueChange={(value) => setUserPickPosition(parseInt(value))}
                      >
                        <SelectTrigger id="userPickPosition" className="bg-secondary/50">
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
                    ) : (
                      <Input
                        id="userPickPosition"
                        readOnly
                        className="bg-secondary/50"
                        value={
                          mySeatTeamNumber != null
                            ? `Team ${mySeatTeamNumber}${mySeatTeamName ? ` · ${mySeatTeamName}` : ''}`
                            : 'Claim a team on Home to set your seat'
                        }
                      />
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="draftOrder" className="text-sm font-medium">
                      Draft Order
                    </Label>
                    <Select value={draftOrder} onValueChange={setDraftOrder} disabled={!canEditLeague}>
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
                      {calculateNumRounds()} rounds
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="leagueType" className="text-sm font-medium">
                      League Type
                    </Label>
                    <Select value={leagueType} onValueChange={setLeagueType} disabled={!canEditLeague}>
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
                        disabled={!canEditLeague}
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
                          disabled={!canEditLeague}
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
                    <Select value={scoringFormat} onValueChange={(v) => setScoringFormat(v as 'standard' | 'ppr' | 'half_ppr')} disabled={!canEditLeague}>
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
                      Settings are saved on this device and used for your mock drafts.
                    </p>
                  )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="lineup" className="relative">
            <Card className="glass-card">
              <CardHeader className="flex flex-row items-start justify-between space-y-0 gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    Starting Lineup
                    {!user && (
                      <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">Local</span>
                    )}
                  </CardTitle>
                  <CardDescription>
                    {isRookieOnlyLeague ? (
                      <>
                        Rookie-only drafts use open pick slots. Lineup settings apply when Rookies only is off.
                      </>
                    ) : (
                      <>
                        Extra drafted players go to the bench. Injured reserve (IR) is for hurt players
                        sitting out. IR is not a draft slot; Team Rankings counts those players in the Bench room.
                      </>
                    )}
                  </CardDescription>
                </div>
                <Button onClick={saveStartingLineup} disabled={saving || isRookieOnlyLeague || !canEditLeague} className="shrink-0">
                  <Save className="w-4 h-4 mr-2" />
                  Save Lineup
                </Button>
              </CardHeader>
              <CardContent className="space-y-6">
                {isRookieOnlyLeague && (
                  <Alert className="border-muted-foreground/25 bg-muted/30">
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      Rookie-only leagues ignore starter slots in mock drafts. Uncheck Rookies only on General to use this lineup.
                    </AlertDescription>
                  </Alert>
                )}
                <div
                  className={cn(
                    'grid grid-cols-2 sm:grid-cols-4 gap-4',
                    isRookieOnlyLeague && 'pointer-events-none opacity-50'
                  )}
                >
                  {STARTER_POSITION_ORDER.map((position) => (
                    <div key={position} className="space-y-2">
                      <Label htmlFor={`starter-${position}`} className="text-sm font-medium">
                        {position === 'DEF' ? 'Defense' : position}
                        <span className="text-xs text-muted-foreground ml-1">
                          (0–{STARTER_MAX[position]})
                        </span>
                      </Label>
                      <Input
                        id={`starter-${position}`}
                        type="number"
                        min={STARTER_MIN[position]}
                        max={STARTER_MAX[position]}
                        value={starterCounts[position]}
                        onChange={(e) => handleStarterChange(position, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === '-' || e.key === 'e' || e.key === 'E') e.preventDefault();
                        }}
                        className="bg-secondary/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        disabled={isRookieOnlyLeague || !canEditLeague}
                      />
                    </div>
                  ))}
                  <div className="space-y-2">
                    <Label htmlFor="starter-FLEX" className="text-sm font-medium">
                      Flex
                      <span className="text-xs text-muted-foreground ml-1">(0–6)</span>
                    </Label>
                    <Input
                      id="starter-FLEX"
                      type="number"
                      min={0}
                      max={6}
                      value={positionLimits.FLEX}
                      onChange={(e) => handlePositionLimitChange('FLEX', e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === '-' || e.key === 'e' || e.key === 'E') e.preventDefault();
                      }}
                      className="bg-secondary/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      disabled={isRookieOnlyLeague || !canEditLeague}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="starter-IR" className="text-sm font-medium">
                      IR
                      <span className="text-xs text-muted-foreground ml-1">(0–4)</span>
                    </Label>
                    <Input
                      id="starter-IR"
                      type="number"
                      min={0}
                      max={4}
                      value={positionLimits.IR}
                      onChange={(e) => handlePositionLimitChange('IR', e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === '-' || e.key === 'e' || e.key === 'E') e.preventDefault();
                      }}
                      className="bg-secondary/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      disabled={isRookieOnlyLeague || !canEditLeague}
                    />
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm space-y-2">
                  <p className="font-medium text-foreground">
                    {formatLineupSummary(resolvedStarters(), resolvedFlex(), resolvedIr())}
                  </p>
                  <p className="text-muted-foreground">
                    Draft rounds: {countBaseStarters(resolvedStarters()) + resolvedFlex() + (
                      typeof positionLimits.BENCH === 'number'
                        ? positionLimits.BENCH
                        : parseInt(String(positionLimits.BENCH)) || 0
                    )}{' '}
                    (starters + flex + bench). IR does not add draft rounds. Second RB with 1 RB starter goes to flex or bench.
                  </p>
                  {!user && (
                    <p className="text-muted-foreground">
                      Saved on this device for guest mock drafts. Sign in to store this on a league.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="positions" className="relative">
            <Card className="glass-card">
              <CardHeader className="flex flex-row items-start justify-between space-y-0 gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    Position Limits
                    {!user && (
                      <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">Local</span>
                    )}
                  </CardTitle>
                  <CardDescription>
                    {isRookieOnlyLeague ? (
                      <>
                        With <strong>Rookies only</strong> enabled, mock rookie drafts use a limited rookie pool and open pick slots (any position)—these per-position limits are not used there. Values stay saved if you turn off rookies only later.
                      </>
                    ) : (
                      <>Set the maximum number of players that can be drafted per position. Flex slots are set on the Lineup tab.</>
                    )}
                  </CardDescription>
                </div>
                <Button onClick={savePositionLimits} disabled={saving || isRookieOnlyLeague || !canEditLeague} className="shrink-0">
                  <Save className="w-4 h-4 mr-2" />
                  Save Position Limits
                </Button>
              </CardHeader>
              <CardContent className="space-y-6 relative">
                {isRookieOnlyLeague && (
                  <Alert className="border-muted-foreground/25 bg-muted/30">
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      Rookie-only leagues draft from a finite list of rookies. Position limits do not apply in rookie only drafts. Uncheck <span className="font-medium text-foreground">Rookies only</span> on the General tab to edit limits for full-roster mocks.
                    </AlertDescription>
                  </Alert>
                )}
                <div
                  className={cn(
                    'grid grid-cols-2 sm:grid-cols-3 gap-4',
                    isRookieOnlyLeague && 'pointer-events-none opacity-50'
                  )}
                >
                      {(Object.keys(positionLimits) as Array<keyof Omit<PositionLimits, 'starters'>>)
                        .filter((position) => position !== 'FLEX' && position !== 'IR')
                        .map((position) => {
                        const maxDefLimit = position === 'DEF' ? 29 : 15;
                        const maxValue = position === 'DEF' ? maxDefLimit : position === 'KEEPERS' ? getMaxKeepers() : 15;
                        const label = position === 'DEF' ? 'Defense' : position === 'BENCH' ? 'Bench' : position === 'KEEPERS' ? 'Keepers' : position;
                        return (
                          <div key={position} className="space-y-2">
                            <Label htmlFor={position} className="text-sm font-medium">
                              {label}
                              {position === 'KEEPERS' && (
                                <span className="text-xs text-muted-foreground ml-1">
                                  (max: {getMaxKeepers()} rounds)
                                </span>
                              )}
                            </Label>
                            <Input
                              id={position}
                              type="number"
                              min={0}
                              max={maxValue}
                              maxLength={3}
                              value={positionLimits[position]}
                              onChange={(e) => handlePositionLimitChange(position, e.target.value)}
                              onKeyDown={(e) => { if (e.key === '-' || e.key === 'e' || e.key === 'E') e.preventDefault(); }}
                              className="bg-secondary/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              disabled={isRookieOnlyLeague || !canEditLeague}
                            />
                          </div>
                        );
                      })}
                    </div>
                {isRookieOnlyLeague ? (
                  <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground mb-2">Minimum requirements (full-roster drafts only)</p>
                    <p>
                      The checklist for QB/RB/WR limits and defense rules applies when <strong>Rookies only</strong> is off. Rookie mocks use pool size and round count instead.
                    </p>
                  </div>
                ) : (
                  <div className="bg-muted/50 border border-border rounded-lg p-4 text-sm">
                    <p className="font-medium mb-2">Minimum Requirements:</p>
                    <ul className="space-y-1 text-muted-foreground list-disc list-outside pl-5">
                      <li>Each position max must be at least its starting-lineup count (set on the Lineup tab)</li>
                      <li>RB + WR + TE must cover dedicated starters plus flex (one flex may be QB in superflex)</li>
                      <li>Total roster size must accommodate all starting positions plus bench</li>
                      <li>Keepers: max per team (0 to number of draft rounds). Keeper picks count toward position limits during the draft.</li>
                      <li className="text-primary/50">Bench slots can be filled by any position within the maxes, and cannot exceed remaining capacity after starters.</li>
                      <li className="text-primary/50">Defense: 32 NFL defenses; you can take a DEF only if enough remain for other teams to fill their DEF starter slots.</li>
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="teams" className="relative">
            <Card className="glass-card">
              <CardHeader className="flex flex-row items-start justify-between space-y-0 gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    Team Names
                    {!user && (
                      <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">Local</span>
                    )}
                  </CardTitle>
                  <CardDescription>
                    {myTeamNumber != null
                      ? `Customize team names. Team ${myTeamNumber} is your team.`
                      : user && selectedLeague && !canEditLeague
                        ? 'Claim a team on Home before you can rename yours here.'
                        : 'Customize the names for each team in your league'}
                  </CardDescription>
                </div>
                  <Button onClick={saveTeamNames} disabled={saving || !canSaveTeamNames} className="shrink-0">
                  <Save className="w-4 h-4 mr-2" />
                  {canEditLeague || !mySeatTeamNumber ? 'Save Team Names' : 'Save Team Name'}
                </Button>
              </CardHeader>
              <CardContent className="space-y-4 relative">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin">
                  {teamNames.map((team) => (
                    <div key={team.team_number} className="space-y-2">
                      <Label htmlFor={`team-${team.team_number}`} className="text-sm font-medium flex items-center gap-2">
                        Team {team.team_number}
                        {myTeamNumber != null && team.team_number === myTeamNumber && (
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
                        disabled={!canEditTeamName(team.team_number)}
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="keepers" className="relative">
            <Card className="glass-card">
              <CardHeader className="flex flex-row items-start justify-between space-y-0 gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="flex items-center gap-2">
                      Keepers
                      {!user && (
                        <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">Local</span>
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
                    Assign keepers per team. Use Add keeper for more slots (up to roster rounds); saving updates the Keepers limit.
                  </CardDescription>
                </div>
                {(!user || selectedLeague) && (
                  <Button onClick={saveKeepers} disabled={saving || !canEditLeague} className="shrink-0">
                    <Save className="w-4 h-4 mr-2" />
                    Save Keepers
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-4 relative">
                {!user || selectedLeague ? (
                  <>
                    {(() => {
                      const teamCount =
                        selectedLeague?.num_teams ??
                        (typeof numTeams === 'number' ? numTeams : parseInt(String(numTeams)) || 12);
                      const yourPick = myTeamNumber;
                      const numRounds = calculateNumRounds();
                      const allKeeperPlayerIds = new Set<string>();
                      Object.values(keepersByTeam || {}).flat().forEach((s) => s.player?.id && allKeeperPlayerIds.add(s.player.id));

                      const keeperLimit = getKeeperLimit();
                      const maxKeeperSlots = getMaxKeepers();
                      return Array.from({ length: teamCount }, (_, i) => i + 1).map((teamNum) => {
                        const slots = keepersByTeam[teamNum] ?? (keeperLimit >= 1 ? [{ player: null, round: 1 }] : []);
                        const teamName = teamNames.find((t) => t.team_number === teamNum)?.team_name || `Team ${teamNum}`;
                        const isUserTeam = teamNum === yourPick;

                        return (
                          <div key={teamNum} className="space-y-3 p-4 rounded-lg border border-border bg-secondary/20">
                            <div className="flex items-center gap-2 font-medium">
                              {teamName}
                              {isUserTeam && (
                                <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">You</span>
                              )}
                            </div>
                            {maxKeeperSlots === 0 && (
                              <p className="text-sm text-muted-foreground">No keeper slots available for this roster size.</p>
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
                                      disabled={!canEditLeague}
                                    />
                                  </div>
                                  <Select
                                    value={String(slot.round)}
                                    onValueChange={(v) => updateKeeperSlot(teamNum, idx, { round: parseInt(v) })}
                                    disabled={!canEditLeague}
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
                                    disabled={!canEditLeague}
                                  >
                                    <Trash2 className="w-4 h-4 text-muted-foreground" />
                                  </Button>
                                </div>
                              ))}
                              {slots.length < maxKeeperSlots && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-2"
                                  onClick={() => addKeeperSlot(teamNum)}
                                  disabled={!canEditLeague}
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
