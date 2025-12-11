import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useLeagues } from '@/hooks/useLeagues';
import { supabase } from '@/integrations/supabase/client';
import { Navbar } from '@/components/Navbar';
import { PlayerCard } from '@/components/PlayerCard';
import { PlayerDetailDialog } from '@/components/PlayerDetailDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { RotateCcw, Search, Filter, Loader2, Users, User } from 'lucide-react';
import type { RankedPlayer } from '@/types/database';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const SortablePlayer = ({ 
  player, 
  rank, 
  onPlayerClick 
}: { 
  player: RankedPlayer; 
  rank: number;
  onPlayerClick: (player: RankedPlayer) => void;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: player.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <PlayerCard
        player={player}
        rank={rank}
        isDragging={isDragging}
        dragHandleProps={listeners}
        onClick={() => onPlayerClick(player)}
      />
    </div>
  );
};

const Rankings = () => {
  const { user, loading: authLoading } = useAuth();
  const { selectedLeague } = useLeagues();
  const navigate = useNavigate();
  const [players, setPlayers] = useState<RankedPlayer[]>([]);
  const [communityPlayers, setCommunityPlayers] = useState<RankedPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [positionFilter, setPositionFilter] = useState<string[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<RankedPlayer | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  const handlePlayerClick = (player: RankedPlayer) => {
    setSelectedPlayer(player);
    setDetailDialogOpen(true);
  };

  const isAllLeagues = !selectedLeague;

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const positions = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  const fetchPlayers = useCallback(async () => {
    if (!user) return;

    try {
      // Fetch all players
      const { data: playersData, error: playersError } = await supabase
        .from('players')
        .select('*')
        .order('adp', { ascending: true });

      if (playersError) throw playersError;

      if (isAllLeagues) {
        // Fetch personal rankings (league_id is null)
        const { data: personalRankingsData, error: personalError } = await supabase
          .from('user_rankings')
          .select('*')
          .eq('user_id', user.id)
          .is('league_id', null);

        if (personalError) throw personalError;

        // Create personal rankings map
        const personalRankingsMap = new Map(
          personalRankingsData?.map((r) => [r.player_id, r.rank]) || []
        );

        // Build personal ranked players
        const personalPlayers: RankedPlayer[] = (playersData || []).map((p, index) => ({
          ...p,
          adp: Number(p.adp),
          rank: personalRankingsMap.get(p.id) || Number(p.adp) || index + 1,
        }));

        // Sort by rank
        personalPlayers.sort((a, b) => a.rank - b.rank);
        const sortedPersonal = personalPlayers.map((p, index) => ({
          ...p,
          rank: index + 1,
        }));
        setPlayers(sortedPersonal);

        // Fetch community rankings (all users' rankings)
        const { data: allCommunityRankings, error: communityError } = await supabase
          .from('user_rankings')
          .select('player_id, rank');

        if (communityError) throw communityError;

        // Group rankings by player_id and calculate average across all users
        const communityRankingsMap = new Map<string, number[]>();
        allCommunityRankings?.forEach((r) => {
          const existing = communityRankingsMap.get(r.player_id) || [];
          existing.push(r.rank);
          communityRankingsMap.set(r.player_id, existing);
        });

        // Calculate average ranks
        const avgRankingsMap = new Map<string, number>();
        communityRankingsMap.forEach((ranks, playerId) => {
          const avg = ranks.reduce((a, b) => a + b, 0) / ranks.length;
          avgRankingsMap.set(playerId, avg);
        });

        // Build community ranked players
        const communityPlayersList: RankedPlayer[] = (playersData || []).map((p, index) => ({
          ...p,
          adp: Number(p.adp),
          rank: avgRankingsMap.get(p.id) || Number(p.adp) || index + 1,
        }));

        // Sort by average rank (lower is better)
        communityPlayersList.sort((a, b) => a.rank - b.rank);
        const sortedCommunity = communityPlayersList.map((p, index) => ({
          ...p,
          rank: index + 1,
        }));
        setCommunityPlayers(sortedCommunity);
      } else {
        // Fetch league-specific rankings
        const { data: rankingsData, error: rankingsError } = await supabase
          .from('user_rankings')
          .select('*')
          .eq('user_id', user.id)
          .eq('league_id', selectedLeague.id);

        if (rankingsError) throw rankingsError;

        // Merge players with rankings
        const rankingsMap = new Map(
          rankingsData?.map((r) => [r.player_id, r.rank]) || []
        );

        const rankedPlayers: RankedPlayer[] = (playersData || []).map((p, index) => ({
          ...p,
          adp: Number(p.adp),
          rank: rankingsMap.get(p.id) || Number(p.adp) || index + 1,
        }));

        // Sort by rank
        rankedPlayers.sort((a, b) => a.rank - b.rank);
        
        // Reassign sequential ranks after sorting
        const sortedPlayers = rankedPlayers.map((p, index) => ({
          ...p,
          rank: index + 1,
        }));

        setPlayers(sortedPlayers);
      }
    } catch (error) {
      toast.error('Failed to load players');
    } finally {
      setLoading(false);
    }
  }, [user, selectedLeague, isAllLeagues]);

  useEffect(() => {
    if (user) {
      setLoading(true);
      fetchPlayers();
    }
  }, [user, fetchPlayers]);

  const saveRankings = useCallback(async (playersToSave: RankedPlayer[], leagueId: string | null) => {
    if (!user) return;
    setSaving(true);

    try {
      // Delete existing rankings
      if (leagueId) {
        await supabase
          .from('user_rankings')
          .delete()
          .eq('user_id', user.id)
          .eq('league_id', leagueId);
      } else {
        await supabase
          .from('user_rankings')
          .delete()
          .eq('user_id', user.id)
          .is('league_id', null);
      }

      // Insert new rankings
      const rankings = playersToSave.map((p, index) => ({
        user_id: user.id,
        player_id: p.id,
        rank: index + 1,
        league_id: leagueId,
      }));

      const { error } = await supabase.from('user_rankings').insert(rankings);

      if (error) throw error;

      toast.success('Rankings saved!');
    } catch (error) {
      toast.error('Failed to save rankings');
    } finally {
      setSaving(false);
    }
  }, [user]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = players.findIndex((item) => item.id === active.id);
      const newIndex = players.findIndex((item) => item.id === over.id);
      const newItems = arrayMove(players, oldIndex, newIndex);
      const updatedPlayers = newItems.map((item, index) => ({ ...item, rank: index + 1 }));
      setPlayers(updatedPlayers);
      saveRankings(updatedPlayers, isAllLeagues ? null : selectedLeague?.id ?? null);
    }
  };

  const resetToADP = () => {
    const sorted = [...players].sort((a, b) => a.adp - b.adp);
    const resetPlayers = sorted.map((p, index) => ({ ...p, rank: index + 1 }));
    setPlayers(resetPlayers);
    saveRankings(resetPlayers, isAllLeagues ? null : selectedLeague?.id ?? null);
    toast.info('Rankings reset to ADP');
  };

  const filteredPlayers = players.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.team?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPosition =
      positionFilter.length === 0 || positionFilter.includes(p.position);
    return matchesSearch && matchesPosition;
  });

  const filteredCommunityPlayers = communityPlayers.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.team?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPosition =
      positionFilter.length === 0 || positionFilter.includes(p.position);
    return matchesSearch && matchesPosition;
  });

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="font-display text-4xl tracking-wide">
              {isAllLeagues ? 'RANKINGS' : 'MY RANKINGS'}
            </h1>
            <p className="text-muted-foreground">
              {isAllLeagues 
                ? 'Your personal rankings vs community consensus' 
                : 'Drag players to reorder your board'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={resetToADP}
              className="gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Reset to ADP
            </Button>
            {saving && (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search players..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-secondary/50 border-border/50"
            />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="shrink-0">
                <Filter className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuCheckboxItem
                checked={positionFilter.length === 0}
                onCheckedChange={() => setPositionFilter([])}
              >
                All
              </DropdownMenuCheckboxItem>
              {positions.map((pos) => (
                <DropdownMenuCheckboxItem
                  key={pos}
                  checked={positionFilter.includes(pos)}
                  onCheckedChange={(checked) => {
                    setPositionFilter((prev) =>
                      checked
                        ? [...prev, pos]
                        : prev.filter((p) => p !== pos)
                    );
                  }}
                >
                  {pos}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {isAllLeagues ? (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Community Rankings Column */}
              <div className="bg-secondary/30 rounded-lg border border-border/50 p-4">
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
                  <Users className="w-5 h-5 text-accent" />
                  <h2 className="font-display text-xl tracking-wide">COMMUNITY RANKINGS</h2>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  Average rankings across all users
                </p>
                <div className="h-[480px] overflow-y-auto pr-2 scrollbar-thin">
                  <div className="space-y-2">
                    {filteredCommunityPlayers.map((player) => (
                      <PlayerCard
                        key={player.id}
                        player={player}
                        rank={communityPlayers.findIndex((p) => p.id === player.id) + 1}
                        onClick={() => handlePlayerClick(player)}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* My Rankings Column */}
              <div className="bg-secondary/30 rounded-lg border border-border/50 p-4">
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
                  <User className="w-5 h-5 text-primary" />
                  <h2 className="font-display text-xl tracking-wide">MY RANKINGS</h2>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  Drag to reorder your personal rankings
                </p>
                <div className="h-[480px] overflow-y-auto pr-2 scrollbar-thin">
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={filteredPlayers.map((p) => p.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-2">
                        {filteredPlayers.map((player) => (
                          <SortablePlayer
                            key={player.id}
                            player={player}
                            rank={players.findIndex((p) => p.id === player.id) + 1}
                            onPlayerClick={handlePlayerClick}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                </div>
              </div>
            </div>

            {/* Differential Analysis Section */}
            {players.length > 0 && communityPlayers.length > 0 && (
              <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Your Studs */}
                <div className="bg-green-500/10 rounded-lg border border-green-500/30 p-4">
                  <div className="flex items-center gap-2 mb-4 pb-2 border-b border-green-500/30">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <h2 className="font-display text-xl tracking-wide text-green-400">YOUR STUDS</h2>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Players you rank higher than the community
                  </p>
                  <div className="space-y-2">
                    {(() => {
                      const diffs = players.map((myPlayer) => {
                        const myRank = players.findIndex((p) => p.id === myPlayer.id) + 1;
                        const communityRank = communityPlayers.findIndex((p) => p.id === myPlayer.id) + 1;
                        return { player: myPlayer, myRank, communityRank, diff: communityRank - myRank };
                      });
                      return diffs
                        .filter((d) => d.diff > 0)
                        .sort((a, b) => b.diff - a.diff)
                        .slice(0, 5)
                        .map(({ player, myRank, communityRank, diff }) => (
                          <div
                            key={player.id}
                            className="flex items-center justify-between bg-background/50 rounded-md p-3 cursor-pointer hover:bg-background/70 transition-colors"
                            onClick={() => handlePlayerClick(player)}
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-lg font-bold text-green-400">+{diff}</span>
                              <div>
                                <p className="font-medium">{player.name}</p>
                                <p className="text-xs text-muted-foreground">{player.team} • {player.position}</p>
                              </div>
                            </div>
                            <div className="text-right text-sm">
                              <p className="text-green-400">#{myRank} <span className="text-muted-foreground">vs</span> #{communityRank}</p>
                            </div>
                          </div>
                        ));
                    })()}
                  </div>
                </div>

                {/* Your Duds */}
                <div className="bg-red-500/10 rounded-lg border border-red-500/30 p-4">
                  <div className="flex items-center gap-2 mb-4 pb-2 border-b border-red-500/30">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <h2 className="font-display text-xl tracking-wide text-red-400">YOUR DUDS</h2>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Players you rank lower than the community
                  </p>
                  <div className="space-y-2">
                    {(() => {
                      const diffs = players.map((myPlayer) => {
                        const myRank = players.findIndex((p) => p.id === myPlayer.id) + 1;
                        const communityRank = communityPlayers.findIndex((p) => p.id === myPlayer.id) + 1;
                        return { player: myPlayer, myRank, communityRank, diff: communityRank - myRank };
                      });
                      return diffs
                        .filter((d) => d.diff < 0)
                        .sort((a, b) => a.diff - b.diff)
                        .slice(0, 5)
                        .map(({ player, myRank, communityRank, diff }) => (
                          <div
                            key={player.id}
                            className="flex items-center justify-between bg-background/50 rounded-md p-3 cursor-pointer hover:bg-background/70 transition-colors"
                            onClick={() => handlePlayerClick(player)}
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-lg font-bold text-red-400">{diff}</span>
                              <div>
                                <p className="font-medium">{player.name}</p>
                                <p className="text-xs text-muted-foreground">{player.team} • {player.position}</p>
                              </div>
                            </div>
                            <div className="text-right text-sm">
                              <p className="text-red-400">#{myRank} <span className="text-muted-foreground">vs</span> #{communityRank}</p>
                            </div>
                          </div>
                        ));
                    })()}
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={filteredPlayers.map((p) => p.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {filteredPlayers.map((player) => (
                  <SortablePlayer
                    key={player.id}
                    player={player}
                    rank={players.findIndex((p) => p.id === player.id) + 1}
                    onPlayerClick={handlePlayerClick}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        {filteredPlayers.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            No players found matching your criteria
          </div>
        )}
      </main>

      <PlayerDetailDialog
        player={selectedPlayer}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
      />
    </div>
  );
};

export default Rankings;
