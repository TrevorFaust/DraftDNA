import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Navbar } from '@/components/Navbar';
import { PositionBadge } from '@/components/PositionBadge';
import { MyRoster } from '@/components/MyRoster';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Search, Check, Loader2, X, Trophy, LogOut } from 'lucide-react';
import type { Player, MockDraft, DraftPick, RankedPlayer } from '@/types/database';
import { cn } from '@/lib/utils';

const DraftRoom = () => {
  const { draftId } = useParams<{ draftId: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  const [draft, setDraft] = useState<MockDraft | null>(null);
  const [players, setPlayers] = useState<RankedPlayer[]>([]);
  const [picks, setPicks] = useState<DraftPick[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPick, setCurrentPick] = useState(1);
  const [isDrafting, setIsDrafting] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  const fetchDraftData = useCallback(async () => {
    if (!user || !draftId) return;

    try {
      // Fetch draft details
      const { data: draftData, error: draftError } = await supabase
        .from('mock_drafts')
        .select('*')
        .eq('id', draftId)
        .eq('user_id', user.id)
        .single();

      if (draftError) throw draftError;
      setDraft(draftData);

      // Fetch players with user rankings
      const { data: playersData } = await supabase
        .from('players')
        .select('*')
        .order('adp', { ascending: true });

      const { data: rankingsData } = await supabase
        .from('user_rankings')
        .select('*')
        .eq('user_id', user.id);

      const rankingsMap = new Map(
        rankingsData?.map((r) => [r.player_id, r.rank]) || []
      );

      const rankedPlayers: RankedPlayer[] = (playersData || []).map((p, index) => ({
        ...p,
        adp: Number(p.adp),
        rank: rankingsMap.get(p.id) || index + 1,
      }));

      rankedPlayers.sort((a, b) => a.rank - b.rank);
      setPlayers(rankedPlayers);

      // Fetch existing picks
      const { data: picksData } = await supabase
        .from('draft_picks')
        .select('*')
        .eq('mock_draft_id', draftId)
        .order('pick_number', { ascending: true });

      setPicks(picksData || []);
      setCurrentPick((picksData?.length || 0) + 1);
    } catch (error) {
      toast.error('Failed to load draft');
      navigate('/mock-draft');
    } finally {
      setLoading(false);
    }
  }, [user, draftId, navigate]);

  useEffect(() => {
    if (user && draftId) {
      fetchDraftData();
    }
  }, [user, draftId, fetchDraftData]);

  const getCurrentTeam = () => {
    if (!draft) return 1;
    const totalTeams = draft.num_teams;
    const round = Math.ceil(currentPick / totalTeams);
    const pickInRound = ((currentPick - 1) % totalTeams) + 1;

    if (draft.draft_order === 'snake' && round % 2 === 0) {
      return totalTeams - pickInRound + 1;
    }
    return pickInRound;
  };

  const getCurrentRound = () => {
    if (!draft) return 1;
    return Math.ceil(currentPick / draft.num_teams);
  };

  const draftPlayer = async (player: RankedPlayer, pickNumber: number, teamNumber: number, roundNumber: number) => {
    if (!draft || !draftId) return;

    const totalPicks = draft.num_teams * draft.num_rounds;
    if (pickNumber > totalPicks) {
      return;
    }

    const newPick: Omit<DraftPick, 'id' | 'created_at'> = {
      mock_draft_id: draftId,
      player_id: player.id,
      team_number: teamNumber,
      round_number: roundNumber,
      pick_number: pickNumber,
    };

    const { data, error } = await supabase
      .from('draft_picks')
      .insert(newPick)
      .select()
      .single();

    if (error) throw error;

    return data;
  };

  const handleUserDraft = async (player: RankedPlayer) => {
    if (!draft || !draftId || isDrafting) return;
    
    const isUserTurn = getCurrentTeam() === draft.user_pick_position;
    if (!isUserTurn) {
      toast.error("It's not your turn to pick!");
      return;
    }

    const totalPicks = draft.num_teams * draft.num_rounds;
    if (currentPick > totalPicks) {
      toast.info('Draft is complete!');
      return;
    }

    setIsDrafting(true);

    try {
      const data = await draftPlayer(player, currentPick, getCurrentTeam(), getCurrentRound());
      if (data) {
        setPicks((prev) => [...prev, data]);
        setCurrentPick((prev) => prev + 1);
      }

      // Check if draft is complete
      if (currentPick === totalPicks) {
        await supabase
          .from('mock_drafts')
          .update({ status: 'completed', completed_at: new Date().toISOString() })
          .eq('id', draftId);
        
        setDraft((prev) => prev ? { ...prev, status: 'completed' } : prev);
        toast.success('Draft complete!');
      }
    } catch (error) {
      toast.error('Failed to make pick');
    } finally {
      setIsDrafting(false);
    }
  };

  // CPU auto-draft logic
  useEffect(() => {
    const runCpuDraft = async () => {
      if (!draft || !draftId || isDrafting) return;
      
      const totalPicks = draft.num_teams * draft.num_rounds;
      if (currentPick > totalPicks) return;
      
      const currentTeam = getCurrentTeam();
      const isUserTurn = currentTeam === draft.user_pick_position;
      
      if (isUserTurn) return; // Wait for user to pick
      
      setIsDrafting(true);
      
      try {
        // Get available players (not yet drafted)
        const draftedIds = new Set(picks.map((p) => p.player_id));
        const available = players.filter((p) => !draftedIds.has(p.id));
        
        if (available.length === 0) return;
        
        // Pick randomly from top 5 available
        const top5 = available.slice(0, Math.min(5, available.length));
        const randomIndex = Math.floor(Math.random() * top5.length);
        const cpuPick = top5[randomIndex];
        
        // Small delay for UX
        await new Promise((resolve) => setTimeout(resolve, 500));
        
        const data = await draftPlayer(cpuPick, currentPick, currentTeam, getCurrentRound());
        if (data) {
          setPicks((prev) => [...prev, data]);
          setCurrentPick((prev) => prev + 1);
        }

        // Check if draft is complete
        if (currentPick === totalPicks) {
          await supabase
            .from('mock_drafts')
            .update({ status: 'completed', completed_at: new Date().toISOString() })
            .eq('id', draftId);
          
          setDraft((prev) => prev ? { ...prev, status: 'completed' } : prev);
          toast.success('Draft complete!');
        }
      } catch (error) {
        console.error('CPU draft error:', error);
      } finally {
        setIsDrafting(false);
      }
    };
    
    runCpuDraft();
  }, [currentPick, draft, draftId, isDrafting, picks, players]);

  const undoPick = async () => {
    if (picks.length === 0) return;

    const lastPick = picks[picks.length - 1];

    try {
      await supabase.from('draft_picks').delete().eq('id', lastPick.id);
      setPicks((prev) => prev.slice(0, -1));
      setCurrentPick((prev) => prev - 1);
      toast.info('Pick undone');
    } catch (error) {
      toast.error('Failed to undo pick');
    }
  };

  const draftedPlayerIds = new Set(picks.map((p) => p.player_id));
  const availablePlayers = players.filter((p) => !draftedPlayerIds.has(p.id));

  const filteredPlayers = availablePlayers.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.position.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.team?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isUserPick = draft && getCurrentTeam() === draft.user_pick_position;
  const totalPicks = draft ? draft.num_teams * draft.num_rounds : 0;
  const isDraftComplete = currentPick > totalPicks || draft?.status === 'completed';

  // Handle showing completion screen when draft was already completed
  useEffect(() => {
    if (draft && picks.length >= totalPicks && totalPicks > 0 && draft.status !== 'completed') {
      // Draft is complete but status not updated - update it
      supabase
        .from('mock_drafts')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', draftId);
    }
  }, [draft, picks.length, totalPicks, draftId]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isDraftComplete) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="max-w-4xl mx-auto px-4 py-8 text-center">
          <div className="glass-card p-8">
            <Trophy className="w-16 h-16 text-accent mx-auto mb-4" />
            <h1 className="font-display text-4xl mb-4">DRAFT COMPLETE!</h1>
            <p className="text-muted-foreground mb-6">
              {draft?.name} has been completed and saved to your history.
            </p>
            <div className="flex justify-center gap-4">
              <Button variant="outline" onClick={() => navigate('/history')}>
                View History
              </Button>
              <Button variant="hero" onClick={() => navigate('/mock-draft')}>
                Start New Draft
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 py-4">
        {/* Draft Header */}
        <div className="glass-card p-4 mb-4 flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl">{draft?.name}</h1>
            <p className="text-sm text-muted-foreground">
              {draft?.num_teams} teams • {draft?.num_rounds} rounds • {draft?.draft_order} draft
            </p>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="text-sm text-muted-foreground">Round</div>
              <div className="font-display text-3xl text-gradient">{getCurrentRound()}</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-muted-foreground">Pick</div>
              <div className="font-display text-3xl text-gradient">{currentPick}</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-muted-foreground">On the Clock</div>
              <div className={cn(
                "font-display text-3xl",
                isUserPick ? "text-accent" : "text-foreground"
              )}>
                Team {getCurrentTeam()}
                {isUserPick && <span className="text-sm ml-2">(YOU)</span>}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {currentPick === totalPicks && (
              <Button 
                variant="gold" 
                size="sm" 
                onClick={async () => {
                  await supabase
                    .from('mock_drafts')
                    .update({ status: 'completed', completed_at: new Date().toISOString() })
                    .eq('id', draftId);
                  setDraft((prev) => prev ? { ...prev, status: 'completed' } : prev);
                  toast.success('Draft complete!');
                }}
              >
                <Trophy className="w-4 h-4 mr-1" /> Finish Draft
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={undoPick} disabled={picks.length === 0}>
              <X className="w-4 h-4 mr-1" /> Undo
            </Button>
            <Button 
              variant="destructive" 
              size="sm" 
              onClick={() => navigate('/mock-draft')}
            >
              <LogOut className="w-4 h-4 mr-1" /> Exit Draft
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* My Roster */}
          <div className="lg:col-span-1">
            <MyRoster 
              picks={picks} 
              players={players} 
              userPickPosition={draft?.user_pick_position || 1} 
            />
          </div>

          {/* Available Players */}
          <div className="lg:col-span-2 glass-card p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-xl">AVAILABLE PLAYERS</h2>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-secondary/50 border-border/50 h-9"
                />
              </div>
            </div>

            <div className="space-y-1 max-h-[calc(100vh-280px)] overflow-y-auto pr-2">
              {filteredPlayers.map((player) => (
                <div
                  key={player.id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50 transition-colors group cursor-pointer"
                  onClick={() => handleUserDraft(player)}
                >
                  <div className="w-8 h-8 rounded bg-muted flex items-center justify-center text-sm font-medium text-muted-foreground">
                    {player.rank}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{player.name}</span>
                      <PositionBadge position={player.position} />
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {player.team || 'FA'} • ADP: {player.adp}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Check className="w-4 h-4" /> Draft
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Draft Board */}
          <div className="glass-card p-4">
            <h2 className="font-display text-xl mb-4">DRAFT BOARD</h2>
            <div className="space-y-1 max-h-[calc(100vh-280px)] overflow-y-auto pr-2">
              {picks.map((pick) => {
                const player = players.find((p) => p.id === pick.player_id);
                if (!player) return null;

                return (
                  <div
                    key={pick.id}
                    className={cn(
                      "flex items-center gap-2 p-2 rounded-lg text-sm",
                      pick.team_number === draft?.user_pick_position
                        ? "bg-accent/10 border border-accent/30"
                        : "bg-secondary/30"
                    )}
                  >
                    <div className="w-6 text-muted-foreground text-xs">
                      {pick.round_number}.{((pick.pick_number - 1) % (draft?.num_teams || 12)) + 1}
                    </div>
                    <div className="font-medium">Team {pick.team_number}</div>
                    <div className="flex-1 truncate text-muted-foreground">
                      {player.name}
                    </div>
                    <PositionBadge position={player.position} className="text-[10px]" />
                  </div>
                );
              })}

              {picks.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No picks yet. Click a player to draft them.
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default DraftRoom;
