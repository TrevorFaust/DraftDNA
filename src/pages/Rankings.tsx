import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Navbar } from '@/components/Navbar';
import { PlayerCard } from '@/components/PlayerCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Save, RotateCcw, Search, Filter, Loader2 } from 'lucide-react';
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
  const navigate = useNavigate();
  const [players, setPlayers] = useState<RankedPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [positionFilter, setPositionFilter] = useState<string[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

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

      // Fetch user's rankings
      const { data: rankingsData, error: rankingsError } = await supabase
        .from('user_rankings')
        .select('*')
        .eq('user_id', user.id);

      if (rankingsError) throw rankingsError;

      // Merge players with rankings
      const rankingsMap = new Map(
        rankingsData?.map((r) => [r.player_id, r.rank]) || []
      );

      const rankedPlayers: RankedPlayer[] = (playersData || []).map((p, index) => ({
        ...p,
        adp: Number(p.adp),
        rank: rankingsMap.get(p.id) || index + 1,
      }));

      // Sort by rank
      rankedPlayers.sort((a, b) => a.rank - b.rank);

      setPlayers(rankedPlayers);
    } catch (error) {
      toast.error('Failed to load players');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchPlayers();
    }
  }, [user, fetchPlayers]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setPlayers((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        const newItems = arrayMove(items, oldIndex, newIndex);
        return newItems.map((item, index) => ({ ...item, rank: index + 1 }));
      });
      setHasChanges(true);
    }
  };

  const saveRankings = async () => {
    if (!user) return;
    setSaving(true);

    try {
      // Delete existing rankings
      await supabase.from('user_rankings').delete().eq('user_id', user.id);

      // Insert new rankings
      const rankings = players.map((p, index) => ({
        user_id: user.id,
        player_id: p.id,
        rank: index + 1,
      }));

      const { error } = await supabase.from('user_rankings').insert(rankings);

      if (error) throw error;

      toast.success('Rankings saved!');
      setHasChanges(false);
    } catch (error) {
      toast.error('Failed to save rankings');
    } finally {
      setSaving(false);
    }
  };

  const resetToADP = () => {
    const sorted = [...players].sort((a, b) => a.adp - b.adp);
    setPlayers(sorted.map((p, index) => ({ ...p, rank: index + 1 })));
    setHasChanges(true);
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
            <h1 className="font-display text-4xl tracking-wide">MY RANKINGS</h1>
            <p className="text-muted-foreground">Drag players to reorder your board</p>
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
            <Button
              variant="default"
              size="sm"
              onClick={saveRankings}
              disabled={!hasChanges || saving}
              className="gap-2"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save
            </Button>
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

        {hasChanges && (
          <div className="glass-card p-3 mb-4 flex items-center justify-between bg-primary/10 border-primary/30">
            <span className="text-sm text-primary">You have unsaved changes</span>
            <Button size="sm" variant="default" onClick={saveRankings} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Now'}
            </Button>
          </div>
        )}

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
              {filteredPlayers.map((player, index) => (
                <SortablePlayer
                  key={player.id}
                  player={player}
                  rank={players.findIndex((p) => p.id === player.id) + 1}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

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
