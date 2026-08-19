import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useLeagues } from '@/hooks/useLeagues';
import { supabase } from '@/integrations/supabase/client';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Users, Layers, Trophy, Target, Timer } from 'lucide-react';
import { ClipboardList } from 'lucide-react';
import { tempDraftStorage, generateTempDraftId, tempSettingsStorage } from '@/utils/temporaryStorage';
import { BrandedLoader } from '@/components/BrandedLoader';
import type { MockDraft } from '@/types/database';
import { assignRandomNamedArchetypesForDraft } from '@/utils/cpuDraftLogic';
import { fetchRookiesRankings } from '@/utils/rookiesFilter';
import { fetchMergedPlayerPool } from '@/utils/playerPoolFetch';
import {
  buildDraftRankingsFromCommunity,
  fetchCommunityRankingsForDraft,
} from '@/utils/communityRankingsMerge';
import {
  fetchGuestActiveMpDrafts,
  fetchMyActiveMpDrafts,
  mpCreateDraft,
} from '@/utils/multiplayerDraftApi';
import { OpenMpLobbiesPanel } from '@/components/OpenMpLobbiesPanel';
import { getOrCreateGuestSessionId, resetGuestSessionId } from '@/utils/temporaryStorage';
import { resolveNextMockDraftName } from '@/utils/mockDraftDefaultName';
import { userFacingErrorMessage } from '@/utils/userFacingError';
import { getRosterRounds, type PositionLimitsLike } from '@/utils/rosterSlots';
import {
  boardSourceLabel,
  draftAgainstOptions,
  writeMpYourBoardSource,
  yourBoardOptions,
} from '@/constants/adpRankingSources';
import { applyNamedBoardToPlayers, fetchAdpSourceBoardForBucket } from '@/utils/adpSourceBoards';
import type { MultiplayerDraftVisibility } from '@/types/multiplayerDraft';

const MockDraft = () => {
  const { user, loading: authLoading } = useAuth();
  const { selectedLeague } = useLeagues();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [draftMode, setDraftMode] = useState<'solo' | 'multiplayer'>('solo');
  const [lobbyVisibility, setLobbyVisibility] =
    useState<MultiplayerDraftVisibility>('invite');
  const [draftName, setDraftName] = useState('');
  const [numTeams, setNumTeams] = useState('12');
  const [userPickPosition, setUserPickPosition] = useState('1');
  const [pickTimer, setPickTimer] = useState('30');
  const [cpuSpeed, setCpuSpeed] = useState<'slow' | 'normal' | 'fast' | 'rapid'>('rapid');
  const [playerPool, setPlayerPool] = useState('all');
  const [yourBoardSource, setYourBoardSource] = useState('yours');
  const [cpuBoardSource, setCpuBoardSource] = useState('consensus');
  const [boardSourceOptions, setBoardSourceOptions] = useState<string[]>([]);
  const [activeMpDrafts, setActiveMpDrafts] = useState<
    Array<{
      draft_id: string;
      invite_code: string;
      name: string;
      status: string;
      team_number: number | null;
    }>
  >([]);
  const [rejoinInviteCode, setRejoinInviteCode] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = user
          ? await fetchMyActiveMpDrafts(user.id)
          : await fetchGuestActiveMpDrafts(getOrCreateGuestSessionId());
        if (!cancelled) setActiveMpDrafts(rows);
      } catch {
        if (!cancelled) setActiveMpDrafts([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // For guests: derive dynasty + rookies from tempSettings
  const tempSettings = !user ? tempSettingsStorage.get() : null;
  const isDynasty = (selectedLeague as any)?.league_type === 'dynasty' || tempSettings?.leagueType === 'dynasty';
  const isRookiesOnlyFromLeague = (selectedLeague as any)?.rookies_only || tempSettings?.rookiesOnly;
  
  // Rounds = dedicated starters + flex + bench (from league lineup settings).
  const calculateRounds = (): number => {
    if (user && selectedLeague?.position_limits) {
      const isSuperflex = (selectedLeague as any)?.is_superflex as boolean || false;
      return getRosterRounds(selectedLeague.position_limits as PositionLimitsLike, isSuperflex);
    }
    if (!user) {
      const tempSettings = tempSettingsStorage.get();
      return getRosterRounds(tempSettings?.positionLimits as PositionLimitsLike, !!tempSettings?.isSuperflex);
    }
    return getRosterRounds(null, false);
  };

  useEffect(() => {
    const scoringFormat =
      (selectedLeague as { scoring_format?: string } | null)?.scoring_format ||
      tempSettings?.scoringFormat ||
      'ppr';
    const leagueType =
      (selectedLeague as { league_type?: string } | null)?.league_type ||
      tempSettings?.leagueType ||
      'season';
    const isSuperflex = Boolean(
      (selectedLeague as { is_superflex?: boolean } | null)?.is_superflex ?? tempSettings?.isSuperflex
    );
    const rookiesOnly = Boolean(
      ((selectedLeague as { rookies_only?: boolean } | null)?.rookies_only || tempSettings?.rookiesOnly) &&
        leagueType === 'dynasty'
    );
    void fetchAdpSourceBoardForBucket({ scoringFormat, leagueType, isSuperflex, rookiesOnly }).then((board) => {
      const sources = board?.sources ?? [];
      setBoardSourceOptions(sources);
      const yourOpts = yourBoardOptions(sources);
      const againstOpts = draftAgainstOptions(sources);
      setYourBoardSource((prev) => (yourOpts.includes(prev as (typeof yourOpts)[number]) ? prev : 'yours'));
      setCpuBoardSource((prev) => (againstOpts.includes(prev as (typeof againstOpts)[number]) ? prev : 'consensus'));
    });
  }, [selectedLeague, tempSettings?.scoringFormat, tempSettings?.leagueType, tempSettings?.isSuperflex, tempSettings?.rookiesOnly]);
  
  // Prefill settings from selected league or localStorage
  useEffect(() => {
    if (selectedLeague) {
      // For logged-in users, use selected league settings
      setNumTeams(selectedLeague.num_teams.toString());
      setUserPickPosition(selectedLeague.user_pick_position.toString());
      if ((selectedLeague as any)?.rookies_only && (selectedLeague as any)?.league_type === 'dynasty') {
        setPlayerPool('rookies');
      }
    } else if (!user) {
      // For guests, load from localStorage
      const tempSettings = tempSettingsStorage.get();
      if (tempSettings) {
        if (tempSettings.numTeams) {
          // Ensure minimum of 4 teams for guests
          const numTeamsValue = Math.max(4, Math.min(32, tempSettings.numTeams));
          setNumTeams(numTeamsValue.toString());
        }
        if (tempSettings.userPickPosition) {
          setUserPickPosition(tempSettings.userPickPosition.toString());
        } else {
          // Default to 1 if not set
          setUserPickPosition('1');
        }
        if (tempSettings.pickTimer !== undefined) {
          setPickTimer(tempSettings.pickTimer === 0 ? '0' : tempSettings.pickTimer.toString());
        }
        if (tempSettings.cpuSpeed) {
          setCpuSpeed(tempSettings.cpuSpeed);
        }
        if (tempSettings.rookiesOnly && tempSettings.leagueType === 'dynasty') {
          setPlayerPool('rookies');
        }
      } else {
        // No settings found, default to 1
        setUserPickPosition('1');
      }
    }
  }, [selectedLeague, user]);

  // Ensure userPickPosition is always valid when numTeams changes
  useEffect(() => {
    const numTeamsValue = parseInt(numTeams) || 12;
    const pickPositionValue = parseInt(userPickPosition) || 1;
    
    // If pick position is empty, invalid, or exceeds numTeams, default to 1
    if (!userPickPosition || userPickPosition === '' || isNaN(pickPositionValue) || pickPositionValue < 1 || pickPositionValue > numTeamsValue) {
      setUserPickPosition('1');
    } else if (pickPositionValue > numTeamsValue) {
      // If numTeams decreased and pick position is now invalid, clamp to max
      setUserPickPosition(numTeamsValue.toString());
    }
  }, [numTeams, userPickPosition]);
  
  // Don't redirect - allow viewing the page without auth

  const resolveDraftName = async (): Promise<string> => {
    const trimmed = draftName.trim();
    if (trimmed) return trimmed;
    return resolveNextMockDraftName({
      userId: user?.id ?? null,
      leagueId: selectedLeague?.id ?? null,
    });
  };

  const startDraft = async () => {
    if (draftMode === 'multiplayer' && !user) {
      toast.error('Sign in to host a multiplayer mock draft');
      return;
    }

    setLoading(true);

    try {
      const resolvedName = await resolveDraftName();

      // Validate and clamp numTeams between 4 and 32
      let validatedNumTeams = parseInt(numTeams) || 12;
      if (validatedNumTeams < 4) {
        validatedNumTeams = 4;
        setNumTeams('4');
      } else if (validatedNumTeams > 32) {
        validatedNumTeams = 32;
        setNumTeams('32');
      }

      // Validate and ensure userPickPosition is always valid (default to 1 if empty or invalid)
      let validatedPickPosition = parseInt(userPickPosition) || 1;
      if (isNaN(validatedPickPosition) || validatedPickPosition < 1) {
        validatedPickPosition = 1;
        setUserPickPosition('1');
      } else if (validatedPickPosition > validatedNumTeams) {
        validatedPickPosition = validatedNumTeams;
        setUserPickPosition(validatedNumTeams.toString());
      }

      // Get settings from selectedLeague for logged-in users, or tempSettingsStorage for guests
      let draftOrder = 'snake';
      let scoringFormat = 'ppr';
      let leagueType = 'season';
      let isSuperflex = false;
      let positionLimits: any = undefined;
      let effectivePlayerPool = playerPool;

      if (user && selectedLeague) {
        draftOrder = (selectedLeague as any)?.draft_order || 'snake';
        scoringFormat = (selectedLeague as any)?.scoring_format || 'ppr';
        leagueType = (selectedLeague as any)?.league_type || 'season';
        isSuperflex = (selectedLeague as any)?.is_superflex || false;
        positionLimits = selectedLeague?.position_limits as any;
        // If league has rookies_only, force player pool to rookies
        if ((selectedLeague as any)?.rookies_only && leagueType === 'dynasty') {
          effectivePlayerPool = 'rookies';
          setPlayerPool('rookies');
        }
        
        // Validate position limits against number of teams (especially DEF limit)
        if (positionLimits) {
          const defLimit = positionLimits.DEF || 3;
          const maxDefLimit = Math.floor(32 / validatedNumTeams);
          
          // If DEF limit would prevent all teams from getting a defense, adjust it
          if (defLimit * validatedNumTeams > 32) {
            const adjustedDefLimit = Math.max(1, maxDefLimit);
            positionLimits = {
              ...positionLimits,
              DEF: adjustedDefLimit,
            };
          }
        }
      } else if (!user) {
        const tempSettings = tempSettingsStorage.get();
        draftOrder = tempSettings?.draftOrder || 'snake';
        scoringFormat = tempSettings?.scoringFormat || 'ppr';
        leagueType = tempSettings?.leagueType || 'season';
        isSuperflex = tempSettings?.isSuperflex || false;
        positionLimits = tempSettings?.positionLimits;
        if (tempSettings?.rookiesOnly && leagueType === 'dynasty') {
          effectivePlayerPool = 'rookies';
          setPlayerPool('rookies');
        }
        
        // Validate position limits against number of teams (especially DEF limit)
        if (positionLimits) {
          const defLimit = positionLimits.DEF || 3;
          const maxDefLimit = Math.floor(32 / validatedNumTeams);
          
          // If DEF limit would prevent all teams from getting a defense, adjust it
          if (defLimit * validatedNumTeams > 32) {
            const adjustedDefLimit = Math.max(1, maxDefLimit);
            positionLimits = {
              ...positionLimits,
              DEF: adjustedDefLimit,
            };
          }
        }
      }
      
      const isDynasty = leagueType === 'dynasty';

      let numRounds = calculateRounds();
      if (isDynasty && effectivePlayerPool === 'rookies') {
        const rookieRows = await fetchRookiesRankings({
          scoringFormat,
          leagueType,
          isSuperflex,
        });
        const rookieCount = rookieRows.length;
        const maxRoundsByPool = Math.floor(rookieCount / validatedNumTeams);
        if (maxRoundsByPool < 1) {
          toast.error(
            `Not enough rookies in the pool (${rookieCount}) for ${validatedNumTeams} teams. At least one rookie per team is required.`
          );
          setLoading(false);
          return;
        }
        const rosterRounds = numRounds;
        numRounds = Math.min(rosterRounds, maxRoundsByPool);
      }
      
      // Multiplayer: create lobby with frozen board, then wait for invitees
      if (draftMode === 'multiplayer' && user) {
        const rookiesOnly = isDynasty && effectivePlayerPool === 'rookies';
        let boardPlayers: Array<{ id: string; position: string }> = [];
        if (rookiesOnly) {
          const rookieRows = await fetchRookiesRankings({
            scoringFormat,
            leagueType,
            isSuperflex,
          });
          boardPlayers = rookieRows.map((r: any) => ({
            id: r.player_id,
            position: r.position || 'FLEX',
          }));
        } else {
          const pool = await fetchMergedPlayerPool();
          const community = await fetchCommunityRankingsForDraft(
            supabase,
            {
              scoringFormat,
              leagueType,
              isSuperflex,
              rookiesOnly: false,
            },
            { excludeUserId: user.id, excludeGuestSessionId: null }
          );
          const ranked = await buildDraftRankingsFromCommunity(
            supabase,
            pool as any,
            community
          );
          const adpBoard = await fetchAdpSourceBoardForBucket({
            scoringFormat,
            leagueType,
            isSuperflex,
            rookiesOnly: false,
          });
          const ordered = applyNamedBoardToPlayers(ranked, adpBoard, cpuBoardSource);
          boardPlayers = ordered.map((p) => ({ id: p.id, position: p.position }));
          // Guarantee every team can draft a DEF and K (community board can bury them)
          const have = new Set(boardPlayers.map((p) => p.id));
          const needDef = validatedNumTeams;
          const needK = validatedNumTeams;
          let defCount = boardPlayers.filter((p) =>
            ['DEF', 'D/ST', 'DST'].includes((p.position || '').toUpperCase())
          ).length;
          let kCount = boardPlayers.filter((p) => (p.position || '').toUpperCase() === 'K').length;
          for (const p of pool as Array<{ id: string; position?: string }>) {
            if (defCount >= needDef && kCount >= needK) break;
            if (have.has(p.id)) continue;
            const pos = (p.position || '').toUpperCase();
            if (defCount < needDef && (pos === 'DEF' || pos === 'D/ST' || pos === 'DST')) {
              boardPlayers.push({ id: p.id, position: p.position || 'DEF' });
              have.add(p.id);
              defCount += 1;
            } else if (kCount < needK && pos === 'K') {
              boardPlayers.push({ id: p.id, position: 'K' });
              have.add(p.id);
              kCount += 1;
            }
          }
        }

        if (boardPlayers.length < validatedNumTeams * numRounds) {
          toast.error('Not enough players in the board for this league size');
          setLoading(false);
          return;
        }

        let keepers: Array<{ team_number: number; player_id: string; round_number: number }> = [];
        let teamNames: Record<string, string> = {};
        if (selectedLeague?.id) {
          const [{ data: leagueKeepers }, { data: leagueTeams }] = await Promise.all([
            (supabase as any)
              .from('league_keepers')
              .select('team_number, player_id, round_number')
              .eq('league_id', selectedLeague.id),
            (supabase as any)
              .from('league_teams')
              .select('team_number, team_name')
              .eq('league_id', selectedLeague.id),
          ]);
          keepers = (leagueKeepers || []).map((k: any) => ({
            team_number: k.team_number,
            player_id: k.player_id,
            round_number: k.round_number,
          }));
          for (const row of leagueTeams || []) {
            if (row?.team_number != null && row?.team_name) {
              teamNames[String(row.team_number)] = String(row.team_name);
            }
          }
        }

        const mpPositionLimits = positionLimits || {
          QB: 4,
          RB: 8,
          WR: 8,
          TE: 3,
          DEF: 1,
          K: 1,
          FLEX: isSuperflex ? 2 : 1,
          BENCH: 6,
        };

        const created = await mpCreateDraft({
          name: resolvedName,
          numTeams: validatedNumTeams,
          numRounds,
          hostTeamNumber: validatedPickPosition,
          draftOrder,
          pickTimer: pickTimer === '0' ? 0 : parseInt(pickTimer),
          cpuSpeed,
          scoringFormat,
          leagueType,
          isSuperflex,
          positionLimits: mpPositionLimits,
          playerPool: isDynasty ? effectivePlayerPool : 'all',
          teamNames,
          sourceLeagueId: selectedLeague?.id || null,
          boardPlayerIds: boardPlayers.map((p) => p.id),
          boardPlayerPositions: boardPlayers.map((p) => p.position),
          keepers,
          visibility: lobbyVisibility,
          boardSource: cpuBoardSource,
          displayName: (
            await supabase
              .from('profiles')
              .select('username')
              .eq('id', user.id)
              .maybeSingle()
          ).data?.username?.trim() || user.email?.split('@')[0] || 'Host',
        });
        writeMpYourBoardSource(created.draft_id, yourBoardSource);
        const keeperN = created.keeper_count ?? keepers.length;
        const openLobby = lobbyVisibility === 'open';
        toast.success(
          keeperN > 0
            ? openLobby
              ? `Open lobby ready — ${keeperN} keeper${keeperN === 1 ? '' : 's'} locked in. Others can join from Live open lobbies.`
              : `Lobby created — ${keeperN} keeper${keeperN === 1 ? '' : 's'} locked in. Share the invite link.`
            : openLobby
              ? 'Open lobby listed — others can join from Live open lobbies'
              : 'Lobby created — share the invite link'
        );
        navigate(`/lobby/${created.invite_code}`);
        return;
      }

      // Save settings to localStorage for non-logged-in users
      if (!user) {
        tempSettingsStorage.save({
          numTeams: validatedNumTeams,
          userPickPosition: validatedPickPosition,
          pickTimer: pickTimer === '0' ? 0 : parseInt(pickTimer),
          cpuSpeed,
          playerPool: isDynasty ? effectivePlayerPool : undefined,
          rookiesOnly: isDynasty && effectivePlayerPool === 'rookies',
          positionLimits: positionLimits,
          isSuperflex: isSuperflex,
          draftOrder,
          scoringFormat,
          leagueType,
        });
      }

      // For non-logged-in users, create a temporary draft
      if (!user) {
        const tempDraftId = generateTempDraftId();
        const tempDraft: MockDraft = {
          id: tempDraftId,
          user_id: 'temp_user',
          name: resolvedName,
          num_teams: validatedNumTeams,
          num_rounds: numRounds,
          user_pick_position: validatedPickPosition,
          draft_order: draftOrder,
          scoring_format: scoringFormat,
          status: 'in_progress',
          created_at: new Date().toISOString(),
          completed_at: null,
          league_id: null,
          pick_timer: pickTimer === '0' ? 0 : parseInt(pickTimer),
          cpu_speed: cpuSpeed,
          player_pool: isDynasty ? effectivePlayerPool : undefined,
          cpu_archetypes: assignRandomNamedArchetypesForDraft(validatedNumTeams, validatedPickPosition),
          board_source: yourBoardSource,
          cpu_board_source: cpuBoardSource,
        } as MockDraft;

        // Save temporary draft
        tempDraftStorage.saveDraft(tempDraft, []);
        
        toast.info('Draft started! Note: This draft will not be saved when you leave the page.');
        navigate(`/draft/${tempDraftId}`);
        return;
      }

      // For logged-in users, create draft in database
      console.log('Creating draft with cpu_speed:', cpuSpeed);
      const { data, error } = await supabase
        .from('mock_drafts')
        .insert({
          user_id: user.id,
          name: resolvedName,
          num_teams: validatedNumTeams,
          num_rounds: numRounds,
          user_pick_position: validatedPickPosition,
          draft_order: draftOrder,
          scoring_format: scoringFormat,
          status: 'in_progress',
          league_id: selectedLeague?.id || null,
          pick_timer: pickTimer === '0' ? 0 : parseInt(pickTimer),
          player_pool: isDynasty ? effectivePlayerPool : null,
          cpu_speed: cpuSpeed, // Always include cpu_speed
          board_source: yourBoardSource,
          cpu_board_source: cpuBoardSource,
        } as any)
        .select()
        .single();
      
      if (error) {
        console.error('Error creating draft with cpu_speed:', error);
        console.error('Error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
      }

      if (error) {
        // Check if error is related to cpu_speed (column missing or constraint violation)
        const isCpuSpeedError = 
          error.message?.includes('cpu_speed') || 
          error.message?.includes('cup_speed') ||
          error.message?.includes('check constraint') ||
          error.message?.includes('mock_drafts_cpu_speed_check') ||
          (error.code === '23514' && error.message?.includes('cpu_speed')); // PostgreSQL check constraint violation
        
        if (isCpuSpeedError) {
          console.warn('cpu_speed column/constraint issue:', error.message);
          console.warn('Attempted cpu_speed value:', cpuSpeed);
          console.warn('This usually means the migration needs to be updated to include "rapid" in the constraint');
          
          // If it's a constraint violation for 'rapid', try with 'normal' instead
          if (cpuSpeed === 'rapid' && error.message?.includes('check constraint')) {
            console.warn('Constraint violation for "rapid", trying with "normal" instead');
            const { data: retryData, error: retryError } = await supabase
              .from('mock_drafts')
              .insert({
                user_id: user.id,
                name: resolvedName,
                num_teams: validatedNumTeams,
                num_rounds: numRounds,
                user_pick_position: validatedPickPosition,
                draft_order: draftOrder,
                scoring_format: scoringFormat,
                status: 'in_progress',
                league_id: selectedLeague?.id || null,
                pick_timer: pickTimer === '0' ? 0 : parseInt(pickTimer),
                player_pool: isDynasty ? effectivePlayerPool : null,
                cpu_speed: 'normal', // Fallback to normal if rapid isn't allowed
              } as any)
              .select()
              .single();
            
            if (retryError) throw retryError;
            toast.warning('CPU speed "rapid" not available. Using "normal" instead. Please update the database constraint to include "rapid".');
            navigate(`/draft/${retryData.id}`);
            return;
          }
          
          // Column doesn't exist, retry without cpu_speed
          console.warn('Creating draft without cpu_speed. Please apply migration.');
          const { data: retryData, error: retryError } = await supabase
            .from('mock_drafts')
            .insert({
              user_id: user.id,
              name: resolvedName,
              num_teams: validatedNumTeams,
              num_rounds: numRounds,
              user_pick_position: validatedPickPosition,
              draft_order: draftOrder,
              scoring_format: scoringFormat,
              status: 'in_progress',
            league_id: selectedLeague?.id || null,
            pick_timer: pickTimer === '0' ? 0 : parseInt(pickTimer),
            player_pool: isDynasty ? effectivePlayerPool : null,
          } as any)
            .select()
            .single();
          
          if (retryError) throw retryError;
          navigate(`/draft/${retryData.id}`);
          return;
        }
        throw error;
      }
      
      console.log('Draft created successfully with cpu_speed:', cpuSpeed, 'data:', data);

      navigate(`/draft/${data.id}`);
    } catch (error: any) {
      console.error('Error creating draft:', error);
      toast.error(userFacingErrorMessage(error, "Couldn't create draft. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="flex min-h-[70vh] items-center justify-center px-4">
          <BrandedLoader />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-2xl bg-gradient-primary flex items-center justify-center mx-auto mb-4 shadow-glow">
            <ClipboardList className="w-10 h-10 text-primary-foreground" />
          </div>
          <h1 className="font-display text-4xl tracking-wide mb-2">NEW MOCK DRAFT</h1>
          <p className="text-muted-foreground">Configure your draft settings</p>
        </div>

        <div className="glass-card p-6 space-y-6">
          {selectedLeague && (
            <div className="bg-primary/10 border border-primary/30 rounded-lg p-3 mb-4">
              <p className="text-sm text-primary font-medium">
                Using settings from: <span className="font-semibold">{selectedLeague.name}</span>
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Draft mode</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={draftMode === 'solo' ? 'default' : 'secondary'}
                onClick={() => setDraftMode('solo')}
              >
                Solo vs CPU
              </Button>
              <Button
                type="button"
                variant={draftMode === 'multiplayer' ? 'default' : 'secondary'}
                onClick={() => setDraftMode('multiplayer')}
              >
                Multiplayer
              </Button>
            </div>
            {draftMode === 'multiplayer' && (
              <p className="text-xs text-muted-foreground">
                Host a friends-only lobby with an invite code, or list an open lobby so anyone
                on the site can join. Up to {Math.max(0, (parseInt(numTeams) || 12) - 1)} other
                humans; empty seats stay CPU when you start.
                {!user ? ' Sign in required to host.' : ''}
              </p>
            )}
            {draftMode === 'multiplayer' && (
              <div className="space-y-2">
                <Label>Lobby visibility</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={lobbyVisibility === 'invite' ? 'default' : 'secondary'}
                    onClick={() => setLobbyVisibility('invite')}
                  >
                    Invite only
                  </Button>
                  <Button
                    type="button"
                    variant={lobbyVisibility === 'open' ? 'default' : 'secondary'}
                    onClick={() => setLobbyVisibility('open')}
                  >
                    Open to site
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {lobbyVisibility === 'open'
                    ? 'Your lobby appears under Live open lobbies for anyone to join. It closes after 10 minutes of inactivity.'
                    : 'Only people with your invite code can find this lobby.'}
                </p>
              </div>
            )}
            {draftMode === 'multiplayer' && <OpenMpLobbiesPanel />}
            {draftMode === 'multiplayer' && (
              <div className="rounded-lg border border-border/50 bg-secondary/30 p-3 space-y-2">
                <p className="text-sm font-medium">Rejoin a draft</p>
                {!user && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      resetGuestSessionId();
                      toast.success('New guest session — join a lobby to enter as a different user');
                    }}
                  >
                    New guest session
                  </Button>
                )}
                {activeMpDrafts.map((d) => (
                  <div
                    key={d.draft_id}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium">{d.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {d.status === 'lobby' ? 'Lobby' : 'In progress'} · {d.invite_code}
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        navigate(
                          d.status === 'lobby'
                            ? `/lobby/${d.invite_code}`
                            : `/multiplayer-draft/${d.draft_id}`
                        )
                      }
                    >
                      Rejoin
                    </Button>
                  </div>
                ))}
                <div className="flex gap-2 pt-1">
                  <Input
                    value={rejoinInviteCode}
                    onChange={(e) => setRejoinInviteCode(e.target.value.toUpperCase())}
                    placeholder="Invite code"
                    className="bg-background/50"
                    autoComplete="off"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={!rejoinInviteCode.trim()}
                    onClick={() => {
                      // Always land on the lobby so guests can enter a display name
                      // (and signed-in users join with their profile username there).
                      const code = rejoinInviteCode.trim().toUpperCase();
                      navigate(`/lobby/${code}`);
                    }}
                  >
                    Go
                  </Button>
                </div>
              </div>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="draftName">Draft Name <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input
              id="draftName"
              name="draftName"
              placeholder="Leave blank for Mock Draft #…"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              className="bg-secondary/50 border-border/50"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2" htmlFor="numTeams">
                <Users className="w-4 h-4 text-muted-foreground" />
                Number of Teams
                {selectedLeague && (
                  <span className="text-xs text-primary ml-1">(from league)</span>
                )}
                <span className="text-xs text-muted-foreground ml-1">(4-32)</span>
              </Label>
              <Input
                id="numTeams"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                value={numTeams}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '') {
                    setNumTeams('');
                    return;
                  }
                  const cleanedValue = value.replace(/[^0-9]/g, '');
                  if (cleanedValue === '') {
                    setNumTeams('');
                    return;
                  }
                  if (cleanedValue.length > 2) {
                    setNumTeams('32');
                    return;
                  }
                  const numValue = parseInt(cleanedValue, 10);
                  if (!isNaN(numValue) && numValue > 32) {
                    setNumTeams('32');
                    return;
                  }
                  if (!isNaN(numValue)) {
                    setNumTeams(cleanedValue);
                  }
                }}
                onPaste={(e) => {
                  e.preventDefault();
                  const pastedText = e.clipboardData.getData('text');
                  const cleanedValue = pastedText.replace(/[^0-9]/g, '');
                  if (cleanedValue.length > 2) {
                    setNumTeams('32');
                    return;
                  }
                  if (cleanedValue) {
                    const numValue = parseInt(cleanedValue, 10);
                    if (!isNaN(numValue)) {
                      const clampedValue = Math.max(4, Math.min(32, numValue));
                      setNumTeams(clampedValue.toString());
                    }
                  }
                }}
                onBlur={(e) => {
                  const value = e.target.value;
                  if (value === '') {
                    setNumTeams('12');
                    return;
                  }
                  const numValue = parseInt(value);
                  if (isNaN(numValue) || numValue < 4) {
                    setNumTeams('4');
                  } else if (numValue > 32) {
                    setNumTeams('32');
                  } else {
                    setNumTeams(numValue.toString());
                  }
                }}
                className="bg-secondary/50 border-border/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                placeholder="12"
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-muted-foreground" />
                Your Pick Position
                {selectedLeague && (
                  <span className="text-xs text-primary ml-1">(from league)</span>
                )}
              </Label>
              <Select 
                value={userPickPosition || '1'} 
                onValueChange={(value) => {
                  // Ensure value is always valid
                  const numValue = parseInt(value) || 1;
                  const numTeamsValue = parseInt(numTeams) || 12;
                  const clampedValue = Math.max(1, Math.min(numTeamsValue, numValue));
                  setUserPickPosition(clampedValue.toString());
                }}
              >
                <SelectTrigger className="bg-secondary/50 border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: parseInt(numTeams) || 12 }, (_, i) => i + 1).map(
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
            {isDynasty && !isRookiesOnlyFromLeague && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-muted-foreground" />
                  Player Pool
                </Label>
                <Select value={playerPool} onValueChange={setPlayerPool}>
                  <SelectTrigger className="bg-secondary/50 border-border/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Players</SelectItem>
                    <SelectItem value="rookies">Rookies Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {isDynasty && isRookiesOnlyFromLeague && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-muted-foreground">
                  <Target className="w-4 h-4" />
                  Player Pool
                </Label>
                <div className="flex h-10 items-center rounded-md border border-input bg-secondary/50 px-3 py-2 text-sm">
                  Rookies only (from league settings)
                </div>
              </div>
            )}

            <div className="col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Timer className="w-4 h-4 text-muted-foreground" />
                Pick Timer
              </Label>
              <Select value={pickTimer} onValueChange={setPickTimer}>
                <SelectTrigger className="bg-secondary/50 border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">None</SelectItem>
                  <SelectItem value="15">15 seconds</SelectItem>
                  <SelectItem value="30">30 seconds</SelectItem>
                  <SelectItem value="45">45 seconds</SelectItem>
                  <SelectItem value="60">60 seconds</SelectItem>
                  <SelectItem value="90">90 seconds</SelectItem>
                  <SelectItem value="120">120 seconds</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-muted-foreground" />
                CPU Selection Speed
              </Label>
              <Select value={cpuSpeed} onValueChange={(value: 'slow' | 'normal' | 'fast' | 'rapid') => setCpuSpeed(value)}>
                <SelectTrigger className="bg-secondary/50 border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="slow">Slow</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="fast">Fast</SelectItem>
                  <SelectItem value="rapid">Rapid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            </div>

            <div className="col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-muted-foreground" />
                Your board
              </Label>
              <Select value={yourBoardSource} onValueChange={setYourBoardSource}>
                <SelectTrigger className="bg-secondary/50 border-border/50 min-h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yourBoardOptions(boardSourceOptions).map((src) => (
                    <SelectItem key={src} value={src}>
                      {boardSourceLabel(src)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Order of the available list on your screen. Drafted players leave this list the same as everyone else.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-muted-foreground" />
                Draft against
              </Label>
              <Select value={cpuBoardSource} onValueChange={setCpuBoardSource}>
                <SelectTrigger className="bg-secondary/50 border-border/50 min-h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {draftAgainstOptions(boardSourceOptions).map((src) => (
                    <SelectItem key={src} value={src}>
                      {boardSourceLabel(src)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {draftMode === 'multiplayer'
                  ? 'Room board for CPU seats and the frozen pick order. Your available list uses Your board.'
                  : 'CPUs pick from this board. Your board can stay on Your rankings.'}
              </p>
            </div>
            </div>
          </div>

          <div className="pt-4">
            <Button
              variant="hero"
              size="xl"
              className="w-full"
              onClick={startDraft}
              disabled={loading}
            >
              {loading ? (
                <BrandedLoader size={34} />
              ) : (
                <>
                  <ClipboardList className="w-5 h-5" />
                  {draftMode === 'multiplayer'
                    ? lobbyVisibility === 'open'
                      ? 'Create open lobby'
                      : 'Create lobby'
                    : 'Start Draft'}
                </>
              )}
            </Button>
            {!user && draftMode === 'solo' && (
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Note: Drafts created without signing in will not be saved when you leave the page.
              </p>
            )}
          </div>
        </div>

        <div className="mt-8 glass-card p-4">
          <h3 className="font-display text-xl mb-3">DRAFT INFO</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>• <strong className="text-foreground">Snake Draft:</strong> Order reverses each round</li>
            <li>• <strong className="text-foreground">Linear Draft:</strong> Same order every round</li>
            <li>• <strong className="text-foreground">Multiplayer:</strong> Invite link, claim seats, ready up, host starts</li>
            <li>• In multiplayer, Your board is only your available list. Draft against is the room board CPUs pick from.</li>
          </ul>
        </div>
      </main>
    </div>
  );
};

export default MockDraft;
