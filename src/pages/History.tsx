import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Navbar } from '@/components/Navbar';
import { tempDraftStorage } from '@/utils/temporaryStorage';
import { PositionBadge } from '@/components/PositionBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Calendar, Users, Layers, ChevronRight, ChevronLeft, Trash2, Loader2, Folder, List, Grid, Star, Search, Filter } from 'lucide-react';
import type { MockDraft, DraftPick, Player, RankedPlayer } from '@/types/database';
import { useLeagues } from '@/hooks/useLeagues';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MyRoster } from '@/components/MyRoster';
import { cn } from '@/lib/utils';
import { getArchetypeForTeam } from '@/utils/archetypeDetection';
import { ArchetypeBadge } from '@/components/ArchetypeBadge';

interface DraftWithPicks extends MockDraft {
  picks: (DraftPick & { player: Player })[];
}

const History = () => {
  const { user, loading: authLoading } = useAuth();
  const { selectedLeague: globalSelectedLeague, leagues } = useLeagues();
  const navigate = useNavigate();
  const [drafts, setDrafts] = useState<DraftWithPicks[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDraft, setSelectedDraft] = useState<DraftWithPicks | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [draftLeagueSettings, setDraftLeagueSettings] = useState<{
    positionLimits?: { QB?: number; RB?: number; WR?: number; TE?: number; K?: number; DEF?: number; BENCH?: number };
    isSuperflex?: boolean;
  } | null>(null);
  const [yourTeamView, setYourTeamView] = useState<'lineup' | 'draft-order'>('lineup');
  const [cpuTeamsView, setCpuTeamsView] = useState<'draft-order' | 'lineup'>('draft-order');
  const [teamNames, setTeamNames] = useState<Map<number, string>>(new Map());
  const [selectedCpuTeam, setSelectedCpuTeam] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  // Don't redirect - allow viewing the page without auth

  const fetchData = useCallback(async () => {
    // For non-logged-in users, load temporary drafts from localStorage
    if (!user) {
      try {
        const tempDraftIds = tempDraftStorage.getDraftList();
        const tempDraftsWithPicks: DraftWithPicks[] = [];
        
        // Collect all unique player IDs from all temporary drafts first
        const allPlayerIds = new Set<string>();
        for (const draftId of tempDraftIds) {
          const tempData = tempDraftStorage.getDraft(draftId);
          if (tempData && tempData.picks) {
            tempData.picks.forEach((pick: DraftPick) => {
              if (pick.player_id) {
                allPlayerIds.add(pick.player_id);
              }
            });
          }
        }
        
        // Fetch only the players we need (more efficient than fetching all)
        const playersMap = new Map();
        if (allPlayerIds.size > 0) {
          // Supabase 'in' filter has a limit, so we need to batch
          const playerIdArray = Array.from(allPlayerIds);
          const batchSize = 100; // Supabase 'in' filter limit
          
          for (let i = 0; i < playerIdArray.length; i += batchSize) {
            const batch = playerIdArray.slice(i, i + batchSize);
            const { data, error } = await supabase
        .from('players')
              .select('*')
              .in('id', batch);
            
            if (error) {
              console.error('Error fetching players batch:', error);
              continue;
            }
            
            if (data) {
              data.forEach((player) => {
                playersMap.set(player.id, player);
              });
            }
          }
          
          console.log(`Loaded ${playersMap.size} players out of ${allPlayerIds.size} requested for temporary drafts`);
        }
        
        for (const draftId of tempDraftIds) {
          const tempData = tempDraftStorage.getDraft(draftId);
          if (tempData) {
            // Convert picks to include player data
            const picksWithPlayers = (tempData.picks || []).map((pick: DraftPick) => {
              const player = playersMap.get(pick.player_id);
              if (!player) {
                console.warn(`Player not found for pick ${pick.id}, player_id: ${pick.player_id}`);
              }
              return {
                ...pick,
                player: player || null,
              };
            }).sort((a, b) => a.pick_number - b.pick_number); // Sort by pick number
            
            // Determine actual completion status based on picks vs total picks
            const totalPicks = tempData.draft.num_teams * tempData.draft.num_rounds;
            const isActuallyComplete = picksWithPlayers.length >= totalPicks && totalPicks > 0;
            
            // Update draft status if it's incorrect
            const actualStatus = isActuallyComplete ? 'completed' : 'in_progress';
            
            // If status is incorrect, update it in localStorage
            if (tempData.draft.status !== actualStatus) {
              const draftWithCorrectStatus = {
                ...tempData.draft,
                status: actualStatus,
              };
              tempDraftStorage.saveDraft(draftWithCorrectStatus, tempData.picks);
            }
            
            const draftWithCorrectStatus = {
              ...tempData.draft,
              status: actualStatus,
            };
            
            tempDraftsWithPicks.push({
              ...draftWithCorrectStatus,
              picks: picksWithPlayers as any,
            });
          }
        }
        
        // Sort by created_at descending
        tempDraftsWithPicks.sort((a, b) => {
          const dateA = new Date(a.created_at).getTime();
          const dateB = new Date(b.created_at).getTime();
          return dateB - dateA;
        });
        
        setDrafts(tempDraftsWithPicks);
        setLoading(false);
      } catch (error) {
        console.error('Error loading temporary drafts:', error);
        setLoading(false);
      }
      return;
    }

    try {
      // Fetch drafts
      const { data: draftsData, error: draftsError } = await supabase
        .from('mock_drafts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (draftsError) throw draftsError;

      const draftIds = (draftsData || []).map((d) => d.id);
      if (draftIds.length === 0) {
        setDrafts([]);
        setPlayers([]);
        setLoading(false);
        return;
      }

      // Single batched picks query (with join) instead of one query per draft
      const picksByDraftId = new Map<string, (DraftPick & { player: Player })[]>();
      const playersMap = new Map<string, Player>();
      const DRAFT_ID_BATCH = 80;
      const PICKS_PAGE_SIZE = 1000;

      for (let b = 0; b < draftIds.length; b += DRAFT_ID_BATCH) {
        const batchIds = draftIds.slice(b, b + DRAFT_ID_BATCH);
        let offset = 0;
        let hasMore = true;
        while (hasMore) {
          const { data: page, error: picksError } = await supabase
            .from('draft_picks')
            .select(`*, players (*)`)
            .in('mock_draft_id', batchIds)
            .order('pick_number', { ascending: true })
            .range(offset, offset + PICKS_PAGE_SIZE - 1);

          if (picksError) {
            console.error('Error fetching picks with join:', picksError);
            break;
          }
          const rows = page || [];
          for (const pick of rows) {
            const player = (pick as any).players ?? playersMap.get(pick.player_id) ?? null;
            if (player && player.id) playersMap.set(player.id, player);
            const entry: DraftPick & { player: Player | null } = {
              id: pick.id,
              mock_draft_id: pick.mock_draft_id,
              player_id: pick.player_id,
              team_number: pick.team_number,
              round_number: pick.round_number,
              pick_number: pick.pick_number,
              created_at: pick.created_at,
              player: player as Player,
            };
            const list = picksByDraftId.get(pick.mock_draft_id) || [];
            list.push(entry as DraftPick & { player: Player });
            picksByDraftId.set(pick.mock_draft_id, list);
          }
          hasMore = rows.length === PICKS_PAGE_SIZE;
          offset += PICKS_PAGE_SIZE;
        }
      }

      // Fetch any players missing from join (e.g. deleted or join failed)
      const missingIds = new Set<string>();
      picksByDraftId.forEach((picks) => {
        picks.forEach((p) => {
          if (p.player_id && !playersMap.has(p.player_id)) missingIds.add(p.player_id);
        });
      });
      if (missingIds.size > 0) {
        const idArr = Array.from(missingIds);
        const playerBatchSize = 100;
        for (let i = 0; i < idArr.length; i += playerBatchSize) {
          const batch = idArr.slice(i, i + playerBatchSize);
          const { data } = await supabase.from('players').select('*').in('id', batch);
          (data || []).forEach((p) => playersMap.set(p.id, p));
        }
        // Re-attach player to picks that had missing player
        picksByDraftId.forEach((picks) => {
          picks.forEach((p) => {
            if (!p.player && p.player_id) (p as any).player = playersMap.get(p.player_id) ?? null;
          });
        });
      }

      const draftsWithPicks: DraftWithPicks[] = (draftsData || []).map((draft) => ({
        ...draft,
        picks: (picksByDraftId.get(draft.id) || [])
          .filter((p): p is DraftPick & { player: Player } => p.player != null)
          .sort((a, b) => a.pick_number - b.pick_number),
      }));

      setPlayers(Array.from(playersMap.values()));
      setDrafts(draftsWithPicks);
    } catch (error) {
      console.error('Error fetching drafts:', error);
      toast.error('Failed to load drafts');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
      fetchData();
  }, [fetchData]);

  const deleteDraft = async (draftId: string) => {
    try {
      if (!user) {
        // For guests, delete from localStorage
        tempDraftStorage.deleteDraft(draftId);
        setDrafts((prev) => prev.filter((d) => d.id !== draftId));
        toast.success('Draft deleted');
      } else {
        // For logged-in users, delete from database
      await supabase.from('mock_drafts').delete().eq('id', draftId);
      setDrafts((prev) => prev.filter((d) => d.id !== draftId));
      toast.success('Draft deleted');
      }
    } catch (error) {
      toast.error('Failed to delete draft');
    }
  };

  const assignDraftToLeague = async (draftId: string, leagueId: string | null) => {
    try {
      await supabase
        .from('mock_drafts')
        .update({ league_id: leagueId })
        .eq('id', draftId);
      
      setDrafts((prev) =>
        prev.map((d) => (d.id === draftId ? { ...d, league_id: leagueId } : d))
      );
      toast.success(leagueId ? 'Draft moved to league' : 'Draft removed from league');
    } catch (error) {
      toast.error('Failed to update draft');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getUserTeamPicks = (draft: DraftWithPicks) => {
    return draft.picks.filter((p) => p.team_number === draft.user_pick_position);
  };

  /** Deduplicate picks so each (round_number, pick_number) appears once per team. Keeps first occurrence. */
  const dedupePicksBySlot = (picks: (DraftPick & { player: Player })[]) => {
    const seen = new Set<string>();
    return picks.filter((p) => {
      const key = `${p.team_number}-${p.round_number}-${p.pick_number}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  // Reset selected CPU team when draft changes so we don't show another draft's team
  useEffect(() => {
    setSelectedCpuTeam(null);
  }, [selectedDraft?.id]);

  // Fetch league settings and team names when a draft is selected
  useEffect(() => {
    if (selectedDraft?.league_id) {
      const fetchLeagueSettings = async () => {
        try {
          const { data: leagueData } = await supabase
            .from('leagues')
            .select('position_limits, is_superflex')
            .eq('id', selectedDraft.league_id)
            .single();
          
          if (leagueData) {
            setDraftLeagueSettings({
              positionLimits: leagueData.position_limits as {
                QB?: number;
                RB?: number;
                WR?: number;
                TE?: number;
                K?: number;
                DEF?: number;
                BENCH?: number;
              },
              isSuperflex: leagueData.is_superflex as boolean | undefined,
            });
          }

          // Fetch team names
          const { data: teamNamesData } = await supabase
            .from('league_teams')
            .select('team_number, team_name')
            .eq('league_id', selectedDraft.league_id)
            .order('team_number');
          
          if (teamNamesData) {
            const namesMap = new Map<number, string>();
            teamNamesData.forEach((team) => {
              if (team.team_name) {
                namesMap.set(team.team_number, team.team_name);
              }
            });
            setTeamNames(namesMap);
          }

          // Set initial selected CPU team (first CPU team)
          const cpuTeams = Array.from({ length: selectedDraft.num_teams }, (_, i) => i + 1)
            .filter((teamNum) => teamNum !== selectedDraft.user_pick_position);
          if (cpuTeams.length > 0 && selectedCpuTeam === null) {
            setSelectedCpuTeam(cpuTeams[0]);
          }
        } catch (error) {
          console.error('Error fetching league settings:', error);
          // Use defaults if league not found
          setDraftLeagueSettings({
            positionLimits: { BENCH: 6 },
            isSuperflex: false,
          });
          setTeamNames(new Map());
          
          // Set initial selected CPU team
          const cpuTeams = Array.from({ length: selectedDraft.num_teams }, (_, i) => i + 1)
            .filter((teamNum) => teamNum !== selectedDraft.user_pick_position);
          if (cpuTeams.length > 0 && selectedCpuTeam === null) {
            setSelectedCpuTeam(cpuTeams[0]);
          }
        }
      };
      
      fetchLeagueSettings();
    } else {
      // No league, use defaults
      setDraftLeagueSettings({
        positionLimits: { BENCH: 6 },
        isSuperflex: false,
      });
      setTeamNames(new Map());
      
      // Set initial selected CPU team
      if (selectedDraft) {
        const cpuTeams = Array.from({ length: selectedDraft.num_teams }, (_, i) => i + 1)
          .filter((teamNum) => teamNum !== selectedDraft.user_pick_position);
        if (cpuTeams.length > 0 && selectedCpuTeam === null) {
          setSelectedCpuTeam(cpuTeams[0]);
        }
      }
    }
  }, [selectedDraft, selectedCpuTeam]);

  const toggleFavorite = async (draftId: string, currentFavorite: boolean) => {
    try {
      await supabase
        .from('mock_drafts')
        .update({ is_favorite: !currentFavorite })
        .eq('id', draftId);
      
      setDrafts((prev) =>
        prev.map((d) => (d.id === draftId ? { ...d, is_favorite: !currentFavorite } : d))
      );
      toast.success(!currentFavorite ? 'Draft favorited' : 'Draft unfavorited');
    } catch (error) {
      toast.error('Failed to update favorite status');
    }
  };

  // Filter drafts by league, search term, and favorites
  const filteredDrafts = drafts.filter((draft) => {
    // Filter by league
    if (globalSelectedLeague !== null && draft.league_id !== globalSelectedLeague.id) {
      return false;
    }
    
    // Filter by favorites
    if (showFavoritesOnly && !draft.is_favorite) {
      return false;
    }
    
    // Filter by search term
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      return draft.name.toLowerCase().includes(searchLower);
    }
    
    return true;
  });

  // Calculate total completed drafts count
  // When on "All leagues": count all completed drafts across all leagues
  // When on a specific league: count only completed drafts for that league
  const getCompletedDraftsCount = (): number => {
    if (globalSelectedLeague === null) {
      // All leagues: count all completed drafts
      return drafts.filter((draft) => draft.status === 'completed').length;
    } else {
      // Specific league: count only completed drafts for this league
      return drafts.filter(
        (draft) => draft.status === 'completed' && draft.league_id === globalSelectedLeague.id
      ).length;
    }
  };

  // Calculate total incomplete drafts count
  // When on "All leagues": count all incomplete drafts across all leagues
  // When on a specific league: count only incomplete drafts for that league
  const getIncompleteDraftsCount = (): number => {
    if (globalSelectedLeague === null) {
      // All leagues: count all incomplete drafts
      return drafts.filter((draft) => draft.status === 'in_progress').length;
    } else {
      // Specific league: count only incomplete drafts for this league
      return drafts.filter(
        (draft) => draft.status === 'in_progress' && draft.league_id === globalSelectedLeague.id
      ).length;
    }
  };

  const getLeagueById = (id: string | null) => leagues.find((l) => l.id === id);

  if (authLoading || (user && loading)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Show preview/teaser for non-authenticated users
  if (!user) {
    // Show temporary drafts if they exist, otherwise show preview
    const tempDrafts = drafts.filter(d => d.id.startsWith('temp_'));
    
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="max-w-4xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="font-display text-4xl tracking-wide">DRAFT HISTORY</h1>
              <p className="text-muted-foreground">View your past mock drafts</p>
            </div>
          </div>

          {/* Teaser Banner */}
          <div className="glass-card p-6 mb-6 bg-gradient-to-r from-primary/10 to-accent/10 border-2 border-primary/20 relative overflow-hidden">
            <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" />
            <div className="relative z-10 flex items-center justify-between">
              <div>
                <h3 className="font-display text-xl mb-2">Unlock Full Draft History</h3>
                <p className="text-sm text-muted-foreground">
                  Sign in to save all your drafts permanently, organize by league, and access advanced analytics
                </p>
              </div>
              <Button variant="hero" onClick={() => navigate('/auth')} className="shrink-0">
                Sign In to Unlock
              </Button>
            </div>
          </div>

          {/* Show temporary drafts with preview overlay */}
          {tempDrafts.length > 0 ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Preview: {tempDrafts.length} temporary draft{tempDrafts.length !== 1 ? 's' : ''} (will be saved when you sign in)
                </p>
              </div>
              {tempDrafts.map((draft) => (
                <div 
                  key={draft.id} 
                  className={cn(
                    "glass-card p-4 relative group",
                    draft.status === 'completed' ? 'opacity-75' : 'opacity-100 cursor-pointer'
                  )}
                  onClick={() => {
                    if (draft.status === 'in_progress') {
                      navigate(`/draft/${draft.id}`);
                    }
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-display text-xl">{draft.name}</h3>
                        <span className={cn(
                          'px-2 py-0.5 rounded text-xs font-medium',
                          draft.status === 'completed'
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-accent/20 text-accent'
                        )}>
                          {draft.status === 'completed' ? 'Completed' : 'In Progress'}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {formatDate(draft.created_at)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          {draft.num_teams} teams
                        </span>
                        <span className="flex items-center gap-1">
                          <Layers className="w-4 h-4" />
                          {draft.num_rounds} rounds
                        </span>
                      </div>
                      {/* User's team preview - same as logged-in view */}
                      {draft.status === 'completed' && (() => {
                        const userPicks = getUserTeamPicks(draft);
                        // Filter to only show picks with valid player data
                        const picksWithPlayers = userPicks.filter(p => p.player && p.player.name);
                        
                        // If we have picks but no player data loaded yet, show a loading message
                        if (userPicks.length > 0 && picksWithPlayers.length === 0) {
                          return (
                            <div className="flex items-center gap-2 mt-3 flex-wrap">
                              <span className="text-xs text-muted-foreground">Your team:</span>
                              <span className="text-xs text-muted-foreground">
                                {userPicks.length} player{userPicks.length !== 1 ? 's' : ''} (loading player data...)
                              </span>
                            </div>
                          );
                        }
                        
                        return picksWithPlayers.length > 0 && (
                          <div className="flex items-center gap-2 mt-3 flex-wrap">
                            <span className="text-xs text-muted-foreground">Your team:</span>
                            {picksWithPlayers.slice(0, 5).map((pick) => (
                              <div key={pick.id} className="flex items-center gap-1">
                                <span className="text-xs">{pick.player?.name}</span>
                                {pick.player?.position && (
                                  <PositionBadge
                                    position={pick.player.position}
                                    className="text-[10px]"
                                  />
                                )}
                              </div>
                            ))}
                            {picksWithPlayers.length > 5 && (
                              <span className="text-xs text-muted-foreground">
                                +{picksWithPlayers.length - 5} more
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                  
                  {/* Action buttons for guest drafts - positioned in corner to avoid overlay */}
                  <div className="absolute top-3 right-3 flex items-center gap-2 z-30">
                    {draft.status === 'in_progress' && (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/draft/${draft.id}`);
                        }}
                      >
                        Continue
                      </Button>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={(e) => e.stopPropagation()}
                          className="relative z-30"
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete this draft?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete "{draft.name}" and all its picks. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => deleteDraft(draft.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                  
                  {/* Only show overlay for completed drafts - covers ~90% but leaves rightmost 10% for delete button */}
                  {draft.status === 'completed' && (
                    <>
                      {/* Overlay that covers left 90% of the card */}
                      <div 
                        className="absolute inset-0 bg-background/40 backdrop-blur-[2px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-lg z-10 pointer-events-none"
                        style={{
                          right: '10%',
                        }}
                      >
                        <div className="pointer-events-auto z-20">
                          <Button variant="hero" onClick={() => navigate('/auth')} className="shadow-lg">
                            Sign In to View Full Details
                          </Button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          ) : (
            /* Preview of what they'll see */
            <div className="space-y-4">
              <div className="glass-card p-4 opacity-60 relative">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-display text-xl">My First Mock Draft</h3>
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-500/20 text-green-400">
                        Completed
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        Jan 15, 2025
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        12 teams
                      </span>
                      <span className="flex items-center gap-1">
                        <Layers className="w-4 h-4" />
                        15 rounds
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      <span className="text-xs text-muted-foreground">Your team preview:</span>
                      <span className="text-xs">C.J. Stroud</span>
                      <PositionBadge position="QB" className="text-[10px]" />
                      <span className="text-xs">Bijan Robinson</span>
                      <PositionBadge position="RB" className="text-[10px]" />
                      <span className="text-xs">+13 more</span>
                    </div>
                  </div>
                </div>
                <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center rounded-lg">
                  <div className="text-center">
                    <p className="text-sm font-medium mb-2">Preview Mode</p>
            <Button variant="hero" onClick={() => navigate('/auth')}>
                      Sign In to View Your Drafts
            </Button>
          </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-4xl tracking-wide">DRAFT HISTORY</h1>
            <div className="text-muted-foreground space-y-0.5">
              <p>
                {getCompletedDraftsCount()} draft{getCompletedDraftsCount() !== 1 ? 's' : ''} completed
                {globalSelectedLeague ? ` in ${globalSelectedLeague.name}` : ' across all leagues'}
              </p>
              <p>
                {getIncompleteDraftsCount()} draft{getIncompleteDraftsCount() !== 1 ? 's' : ''} in progress
                {globalSelectedLeague ? ` in ${globalSelectedLeague.name}` : ' across all leagues'}
              </p>
            </div>
          </div>
          <Button variant="hero" onClick={() => navigate('/mock-draft')}>
            New Draft
          </Button>
        </div>

        {/* League indicator */}
        {globalSelectedLeague && (
          <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
            <Folder className="w-4 h-4" />
            <span>Showing drafts for: <strong className="text-foreground">{globalSelectedLeague.name}</strong></span>
          </div>
        )}

        {/* Search and Filter Controls */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search drafts by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-secondary/50 border-border/50"
            />
          </div>
          <Button
            variant={showFavoritesOnly ? 'default' : 'outline'}
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            className="gap-2"
          >
            <Star className={`w-4 h-4 ${showFavoritesOnly ? 'fill-current' : ''}`} />
            {showFavoritesOnly ? 'Show All' : 'Favorites Only'}
          </Button>
        </div>

        {filteredDrafts.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <p className="text-muted-foreground mb-4">
              {globalSelectedLeague ? 'No drafts in this league yet' : 'No drafts yet'}
            </p>
            <Button variant="default" onClick={() => navigate('/mock-draft')}>
              Start Your First Draft
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredDrafts.map((draft) => (
              <div key={draft.id} className="glass-card p-4 animate-slide-up">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <button
                        onClick={() => toggleFavorite(draft.id, draft.is_favorite || false)}
                        className="p-1 hover:bg-secondary/50 rounded transition-colors"
                        aria-label={draft.is_favorite ? 'Unfavorite' : 'Favorite'}
                      >
                        <Star
                          className={cn(
                            'w-4 h-4 transition-colors',
                            draft.is_favorite
                              ? 'fill-yellow-400 text-yellow-400'
                              : 'text-muted-foreground hover:text-yellow-400'
                          )}
                        />
                      </button>
                      <h3 className="font-display text-xl">{draft.name}</h3>
                      <span
                        className={cn(
                          'px-2 py-0.5 rounded text-xs font-medium',
                          draft.status === 'completed'
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-accent/20 text-accent'
                        )}
                      >
                        {draft.status === 'completed' ? 'Completed' : 'In Progress'}
                      </span>
                      {draft.status === 'completed' && (() => {
                        // Always re-detect from picks so old drafts map to current archetype list (closest match)
                        let archetype: string | null = null;
                        if (draft.picks.length > 0) {
                          const limits = selectedDraft?.id === draft.id ? draftLeagueSettings?.positionLimits : undefined;
                          const flex = limits?.FLEX ?? 1;
                          const bench = limits?.BENCH ?? 6;
                          archetype = getArchetypeForTeam(draft.picks, draft.user_pick_position, {
                            flexSlots: flex,
                            benchSize: bench,
                            numTeams: draft.num_teams,
                          });
                        } else {
                          const stored = (draft as { user_detected_archetype?: string | null }).user_detected_archetype;
                          archetype = stored && stored.trim() ? stored.trim() : null;
                        }
                        return archetype ? (
                          <ArchetypeBadge
                            archetypeName={archetype}
                            iconOnly
                            size="sm"
                            earnedFromDraft={draft.name}
                          />
                        ) : null;
                      })()}
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {formatDate(draft.created_at)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {draft.num_teams} teams
                      </span>
                      <span className="flex items-center gap-1">
                        <Layers className="w-4 h-4" />
                        {draft.num_rounds} rounds
                      </span>
                      <span>Pick #{draft.user_pick_position}</span>
                    </div>

                    {/* User's team preview */}
                    {draft.status === 'completed' && (() => {
                      const userPicks = getUserTeamPicks(draft);
                      return userPicks.length > 0 && (
                      <div className="flex flex-col gap-1 mt-3">
                        <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-muted-foreground">Your team:</span>
                          {userPicks.slice(0, 5).map((pick) => (
                          <div key={pick.id} className="flex items-center gap-1">
                            <span className="text-xs">{pick.player?.name}</span>
                            <PositionBadge
                              position={pick.player?.position || ''}
                              className="text-[10px]"
                            />
                          </div>
                        ))}
                          {userPicks.length > 5 && (
                          <span className="text-xs text-muted-foreground">
                              +{userPicks.length - 5} more
                          </span>
                        )}
                        </div>
                      </div>
                      );
                    })()}

                    {/* Move to league dropdown */}
                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Move to:</span>
                      <select
                        value={draft.league_id || ''}
                        onChange={(e) =>
                          assignDraftToLeague(draft.id, e.target.value || null)
                        }
                        className="text-xs bg-secondary/50 border border-border/50 rounded px-2 py-1 text-foreground"
                      >
                        <option value="">Uncategorized</option>
                        {leagues.map((league) => (
                          <option key={league.id} value={league.id}>
                            {league.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {draft.status === 'in_progress' ? (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => navigate(`/draft/${draft.id}`)}
                      >
                        Continue
                      </Button>
                    ) : null}
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedDraft(draft)}
                    >
                      View <ChevronRight className="w-4 h-4" />
                    </Button>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete this draft?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete "{draft.name}" and all its picks.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteDraft(draft.id)}>
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Draft Details Modal */}
      <Dialog 
        open={!!selectedDraft} 
        onOpenChange={() => {
          setSelectedDraft(null);
          setDraftLeagueSettings(null);
          setTeamNames(new Map());
          setSelectedCpuTeam(null);
        }}
      >
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">
              {selectedDraft?.name}
            </DialogTitle>
          </DialogHeader>

            {selectedDraft && (
            <Tabs defaultValue="your-team" className="flex-1 overflow-hidden flex flex-col">
              <TabsList className="grid w-full grid-cols-3 bg-secondary/50">
                <TabsTrigger value="draft-order">Draft Order</TabsTrigger>
                <TabsTrigger value="your-team">Your Team</TabsTrigger>
                <TabsTrigger value="cpu-teams">Opponent Teams</TabsTrigger>
              </TabsList>

              <TabsContent value="draft-order" className="flex-1 overflow-y-auto mt-4">
                <div className="space-y-2">
                  {selectedDraft.picks.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No picks found for this draft.
                    </div>
                  ) : (
                    selectedDraft.picks.map((pick) => {
                      const isUserTeam = pick.team_number === selectedDraft.user_pick_position;
                      return (
                        <div
                          key={pick.id}
                          className={cn(
                            "flex items-center gap-3 text-sm rounded-lg p-2",
                            isUserTeam
                              ? "bg-accent/10 border border-accent/30"
                              : "bg-secondary/30"
                          )}
                        >
                          <span className="text-muted-foreground w-12 font-mono text-xs">
                            {pick.round_number}.{((pick.pick_number - 1) % selectedDraft.num_teams) + 1}
                          </span>
                        <span className="text-muted-foreground min-w-[80px] max-w-[120px] truncate font-medium">
                          {teamNames.get(pick.team_number) || `Team ${pick.team_number}`}
                        </span>
                          <span className="flex-1 font-medium">
                            {pick.player?.name || 'Unknown Player'}
                          </span>
                          <span className="text-muted-foreground text-xs">
                            {pick.player?.team || 'FA'}
                          </span>
                          {pick.player?.position && (
                            <PositionBadge
                              position={pick.player.position}
                            />
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </TabsContent>

              <TabsContent value="your-team" className="flex-1 overflow-y-auto mt-4 flex flex-col">
                <div className="flex items-center justify-end mb-4">
                  <div className="flex gap-2">
                    <Button
                      variant={yourTeamView === 'lineup' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setYourTeamView('lineup')}
                      className="gap-2"
                    >
                      <Grid className="w-4 h-4" />
                      Lineup
                    </Button>
                    <Button
                      variant={yourTeamView === 'draft-order' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setYourTeamView('draft-order')}
                      className="gap-2"
                    >
                      <List className="w-4 h-4" />
                      Draft Order
                    </Button>
                  </div>
                </div>
                {yourTeamView === 'lineup' ? (
                  (() => {
                    const userPicksRaw = selectedDraft.picks.filter(
                      (pick) => pick.player && pick.team_number === selectedDraft.user_pick_position
                    );
                    const userPicks = dedupePicksBySlot(userPicksRaw).sort((a, b) => a.pick_number - b.pick_number);
                    // Convert picks to RankedPlayer format for MyRoster component
                    const rankedPlayers: RankedPlayer[] = userPicks.map((pick) => ({
                        ...pick.player!,
                        adp: pick.player?.adp || 999,
                        rank: pick.pick_number,
                      }));

                    const picksForRoster = userPicks.map((pick) => ({
                        id: pick.id,
                        mock_draft_id: pick.mock_draft_id,
                        player_id: pick.player_id,
                        team_number: pick.team_number,
                        round_number: pick.round_number,
                        pick_number: pick.pick_number,
                        created_at: pick.created_at || new Date().toISOString(),
                      }));

                    const userTeamName = teamNames.get(selectedDraft.user_pick_position) || `Team ${selectedDraft.user_pick_position}`;
                    // Re-detect from picks so display always matches current archetype list (closest match)
                    const flex = draftLeagueSettings?.positionLimits?.FLEX ?? 1;
                    const bench = draftLeagueSettings?.positionLimits?.BENCH ?? 6;
                    const userArchetype: string = userPicks.length > 0
                      ? getArchetypeForTeam(userPicks, selectedDraft.user_pick_position, {
                          flexSlots: flex,
                          benchSize: bench,
                          numTeams: selectedDraft.num_teams,
                        })
                      : ((selectedDraft as { user_detected_archetype?: string | null }).user_detected_archetype?.trim() || '');
                    return (
                      <div>
                        <div className="mb-3">
                          <ArchetypeBadge
                            archetypeName={userArchetype}
                            iconOnly
                            size="md"
                            earnedFromDraft={selectedDraft.name}
                          />
                        </div>
                      <MyRoster
                        picks={picksForRoster}
                        players={rankedPlayers}
                        userPickPosition={selectedDraft.user_pick_position}
                        positionLimits={draftLeagueSettings?.positionLimits}
                        isSuperflex={draftLeagueSettings?.isSuperflex}
                        teamName={userTeamName}
                      />
                      </div>
                    );
                  })()
                ) : (
                  <div className="space-y-2">
                    {dedupePicksBySlot(
                      selectedDraft.picks.filter((pick) => pick.team_number === selectedDraft.user_pick_position && pick.player)
                    )
                      .sort((a, b) => a.pick_number - b.pick_number)
                      .map((pick) => (
                        <div
                          key={pick.id}
                          className="flex items-center gap-3 text-sm bg-secondary/30 rounded-lg p-2"
                        >
                          <span className="text-muted-foreground w-8 font-mono text-xs">
                            Rd {pick.round_number}
                          </span>
                          <span className="text-muted-foreground w-12 font-mono text-xs">
                            #{pick.pick_number}
                          </span>
                          <span className="flex-1 font-medium">
                            {pick.player?.name}
                          </span>
                          <span className="text-muted-foreground text-xs">
                            {pick.player?.team || 'FA'}
                          </span>
                          {pick.player?.position && (
                            <PositionBadge position={pick.player.position} />
                          )}
                        </div>
                      ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="cpu-teams" className="flex-1 overflow-y-auto mt-4 flex flex-col">
                {(() => {
                  const cpuTeams = Array.from({ length: selectedDraft.num_teams }, (_, i) => i + 1)
                    .filter((teamNum) => teamNum !== selectedDraft.user_pick_position);
                  
                  if (!selectedCpuTeam || !cpuTeams.includes(selectedCpuTeam)) {
                    if (cpuTeams.length > 0 && !selectedCpuTeam) {
                      setSelectedCpuTeam(cpuTeams[0]);
                    }
                    return <div>Loading...</div>;
                  }

                  const currentTeamIndex = cpuTeams.indexOf(selectedCpuTeam);
                  const rawTeamPicks = selectedDraft.picks.filter((p) => p.team_number === selectedCpuTeam && p.player);
                  const teamPicks = dedupePicksBySlot(rawTeamPicks).sort((a, b) => a.pick_number - b.pick_number);
                  const teamPlayers = teamPicks.map((pick) => pick.player!);
                  const teamName = teamNames.get(selectedCpuTeam) || `Team ${selectedCpuTeam}`;
                  const cpuFlex = draftLeagueSettings?.positionLimits?.FLEX ?? 1;
                  const cpuBench = draftLeagueSettings?.positionLimits?.BENCH ?? 6;
                  const cpuArchetype = getArchetypeForTeam(selectedDraft.picks, selectedCpuTeam, {
                    flexSlots: cpuFlex,
                    benchSize: cpuBench,
                    numTeams: selectedDraft.num_teams,
                  });

                  return (
                    <>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const prevIndex = currentTeamIndex > 0 ? currentTeamIndex - 1 : cpuTeams.length - 1;
                                setSelectedCpuTeam(cpuTeams[prevIndex]);
                              }}
                              disabled={cpuTeams.length <= 1}
                            >
                              <ChevronLeft className="w-4 h-4" />
                            </Button>
                            <h3 className="font-display text-lg min-w-[120px] text-center">
                              {teamName}
                            </h3>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const nextIndex = currentTeamIndex < cpuTeams.length - 1 ? currentTeamIndex + 1 : 0;
                                setSelectedCpuTeam(cpuTeams[nextIndex]);
                              }}
                              disabled={cpuTeams.length <= 1}
                            >
                              <ChevronRight className="w-4 h-4" />
                            </Button>
                          </div>
                          <span className="text-xs text-accent text-center">{cpuArchetype}</span>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant={cpuTeamsView === 'lineup' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setCpuTeamsView('lineup')}
                            className="gap-2"
                          >
                            <Grid className="w-4 h-4" />
                            Lineup
                          </Button>
                          <Button
                            variant={cpuTeamsView === 'draft-order' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setCpuTeamsView('draft-order')}
                            className="gap-2"
                          >
                            <List className="w-4 h-4" />
                            Draft Order
                          </Button>
                        </div>
                      </div>
                      <div className="flex-1 overflow-y-auto">
                        {cpuTeamsView === 'draft-order' ? (
                          <div className="space-y-2">
                            {teamPicks.map((pick) => (
                              <div
                                key={pick.id}
                                className="flex items-center gap-3 text-sm bg-secondary/50 rounded-lg p-2"
                              >
                                <span className="text-muted-foreground w-8 font-mono text-xs">
                            Rd {pick.round_number}
                          </span>
                                <span className="text-muted-foreground w-12 font-mono text-xs">
                            #{pick.pick_number}
                          </span>
                          <span className="flex-1 font-medium">
                            {pick.player?.name}
                          </span>
                          <span className="text-muted-foreground text-xs">
                            {pick.player?.team || 'FA'}
                          </span>
                          <PositionBadge
                            position={pick.player?.position || ''}
                          />
                        </div>
                      ))}
                  </div>
                        ) : (
                          <div className="glass-card p-4 space-y-3">
                            {(() => {
                              const flexCount = draftLeagueSettings?.positionLimits?.FLEX ?? (draftLeagueSettings?.isSuperflex ? 2 : 1);
                              const isSuperflex = !!draftLeagueSettings?.isSuperflex;
                              const flexPositions = isSuperflex ? ['QB', 'RB', 'WR', 'TE', 'K', 'DEF', 'D/ST'] : ['RB', 'WR', 'TE'];
                              const startingSlots: { label: string; positions: string[] }[] = [
                                { label: 'QB', positions: ['QB'] },
                                { label: 'RB1', positions: ['RB'] },
                                { label: 'RB2', positions: ['RB'] },
                                { label: 'WR1', positions: ['WR'] },
                                { label: 'WR2', positions: ['WR'] },
                                { label: 'TE', positions: ['TE'] },
                                ...Array.from({ length: flexCount }, () => ({ label: 'FLEX', positions: flexPositions })),
                                { label: 'DEF', positions: ['DEF', 'D/ST'] },
                                { label: 'K', positions: ['K'] },
                              ];
                              
                              const benchCount = draftLeagueSettings?.positionLimits?.BENCH ?? 6;
                              const assignedPlayerIds = new Set<string>();
                              const filledSlots: (Player | null)[] = [];
                              let qbPlacedInFlex = false;
                              
                              startingSlots.forEach((slot) => {
                                const isFlex = slot.label === 'FLEX';
                                const effectivePositions = isFlex && isSuperflex && qbPlacedInFlex ? ['RB', 'WR', 'TE'] : slot.positions;
                                const posMatch = (p: Player) => effectivePositions.includes(p.position);
                                const availablePlayer = teamPlayers.find(
                                  (p) => posMatch(p) && !assignedPlayerIds.has(p.id)
                                );
                                if (availablePlayer) {
                                  assignedPlayerIds.add(availablePlayer.id);
                                  filledSlots.push(availablePlayer);
                                  if (isFlex && availablePlayer.position === 'QB') qbPlacedInFlex = true;
                                } else {
                                  filledSlots.push(null);
                                }
                              });
                              
                              const benchPlayers = teamPlayers.filter((p) => !assignedPlayerIds.has(p.id));
                              
                              return (
                                <>
                                  <div className="space-y-1">
                                    <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Starters</div>
                                    {startingSlots.map((slot, index) => {
                                      const player = filledSlots[index];
                                      return (
                                        <div
                                          key={`${slot.label}-${index}`}
                                          className={cn(
                                            "flex items-center gap-2 p-2 rounded-lg text-sm border",
                                            player ? "bg-secondary/50 border-border/30" : "bg-secondary/30 border-border/30"
                                          )}
                                        >
                                          <div className="w-10 text-xs font-semibold text-muted-foreground">
                                            {slot.label}
                                          </div>
                                          {player ? (
                                            <>
                                              <div className="flex-1 truncate font-medium">{player.name}</div>
                                              <PositionBadge position={player.position} className="text-[10px]" />
                                              <div className="text-xs text-muted-foreground">{player.team || 'FA'}</div>
                                            </>
                                          ) : (
                                            <div className="flex-1 text-muted-foreground/50 italic">Empty</div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                  <div className="space-y-1 pt-2 border-t border-border/30">
                                    <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Bench</div>
                                    {Array.from({ length: benchCount }).map((_, index) => {
                                      const player = benchPlayers[index];
                                      return (
                                        <div
                                          key={`bench-${index}`}
                                          className={cn(
                                            "flex items-center gap-2 p-2 rounded-lg text-sm border",
                                            player ? "bg-secondary/50 border-border/30" : "bg-secondary/20 border-border/20"
                                          )}
                                        >
                                          <div className="w-10 text-xs font-semibold text-muted-foreground">
                                            BN
                                          </div>
                                          {player ? (
                                            <>
                                              <div className="flex-1 truncate font-medium">{player.name}</div>
                                              <PositionBadge position={player.position} className="text-[10px]" />
                                              <div className="text-xs text-muted-foreground">{player.team || 'FA'}</div>
                                            </>
                                          ) : (
                                            <div className="flex-1 text-muted-foreground/50 italic">Empty</div>
                                          )}
                                        </div>
                                      );
                                    })}
                </div>
                                </>
                              );
                            })()}
              </div>
            )}
          </div>
                    </>
                  );
                })()}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default History;