import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useLeagues } from '@/hooks/useLeagues';
import { supabase } from '@/integrations/supabase/client';
import { Navbar } from '@/components/Navbar';
import { PlayerCard } from '@/components/PlayerCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { RotateCcw, Search, Filter, Loader2 } from 'lucide-react';
import type { Player, RankedPlayer } from '@/types/database';
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

const SortablePlayer = ({ player, rank }: { player: RankedPlayer; rank: number }) => {
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
      />
    </div>
  );
};

const Rankings = () => {
  const { user, loading: authLoading } = useAuth();
  const { selectedLeague, leagues } = useLeagues();
  const navigate = useNavigate();
  const [players, setPlayers] = useState<RankedPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [positionFilter, setPositionFilter] = useState<string[]>([]);

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
        // For "All Leagues", calculate average rank across all leagues
        const { data: allRankingsData, error: rankingsError } = await supabase
          .from('user_rankings')
          .select('*')
          .eq('user_id', user.id)
          .not('league_id', 'is', null);

        if (rankingsError) throw rankingsError;

        // Group rankings by player_id and calculate average
        const playerRankings = new Map<string, number[]>();
        allRankingsData?.forEach((r) => {
          const existing = playerRankings.get(r.player_id) || [];
          existing.push(r.rank);
          playerRankings.set(r.player_id, existing);
        });

        // Calculate average ranks
        const avgRankingsMap = new Map<string, number>();
        playerRankings.forEach((ranks, playerId) => {
          const avg = ranks.reduce((a, b) => a + b, 0) / ranks.length;
          avgRankingsMap.set(playerId, avg);
        });

        const rankedPlayers: RankedPlayer[] = (playersData || []).map((p, index) => ({
          ...p,
          adp: Number(p.adp),
          rank: avgRankingsMap.get(p.id) || Number(p.adp) || index + 1,
        }));

        // Sort by calculated average rank
        rankedPlayers.sort((a, b) => a.rank - b.rank);
        
        // Reassign sequential ranks after sorting
        const sortedPlayers = rankedPlayers.map((p, index) => ({
          ...p,
          rank: index + 1,
        }));

        setPlayers(sortedPlayers);
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

  const saveRankings = useCallback(async (playersToSave: RankedPlayer[]) => {
    if (!user || isAllLeagues || !selectedLeague) return;
    setSaving(true);

    try {
      // Delete existing rankings for this league
      await supabase
        .from('user_rankings')
        .delete()
        .eq('user_id', user.id)
        .eq('league_id', selectedLeague.id);

      // Insert new rankings for this league
      const rankings = playersToSave.map((p, index) => ({
        user_id: user.id,
        player_id: p.id,
        rank: index + 1,
        league_id: selectedLeague.id,
      }));

      const { error } = await supabase.from('user_rankings').insert(rankings);

      if (error) throw error;

      toast.success('Rankings saved!');
    } catch (error) {
      toast.error('Failed to save rankings');
    } finally {
      setSaving(false);
    }
  }, [user, isAllLeagues, selectedLeague]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = players.findIndex((item) => item.id === active.id);
      const newIndex = players.findIndex((item) => item.id === over.id);
      const newItems = arrayMove(players, oldIndex, newIndex);
      const updatedPlayers = newItems.map((item, index) => ({ ...item, rank: index + 1 }));
      setPlayers(updatedPlayers);
      saveRankings(updatedPlayers);
    }
  };

  const resetToADP = () => {
    const sorted = [...players].sort((a, b) => a.adp - b.adp);
    const resetPlayers = sorted.map((p, index) => ({ ...p, rank: index + 1 }));
    setPlayers(resetPlayers);
    saveRankings(resetPlayers);
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
      
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="font-display text-4xl tracking-wide">
              {isAllLeagues ? 'COMMUNITY ADP' : 'MY RANKINGS'}
            </h1>
            <p className="text-muted-foreground">
              {isAllLeagues 
                ? 'Average rankings across all your leagues' 
                : 'Drag players to reorder your board'}
            </p>
          </div>

          {!isAllLeagues && (
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
          )}
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
          <div className="space-y-2">
            {filteredPlayers.map((player) => (
              <PlayerCard
                key={player.id}
                player={player}
                rank={players.findIndex((p) => p.id === player.id) + 1}
              />
            ))}
          </div>
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
    </div>
  );
};

export default Rankings;
