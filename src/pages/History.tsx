import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Navbar } from '@/components/Navbar';
import { PositionBadge } from '@/components/PositionBadge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Calendar, Users, Layers, ChevronRight, Trash2, Loader2 } from 'lucide-react';
import type { MockDraft, DraftPick, Player } from '@/types/database';
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
import { cn } from '@/lib/utils';

interface DraftWithPicks extends MockDraft {
  picks: (DraftPick & { player: Player })[];
}

const History = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [drafts, setDrafts] = useState<DraftWithPicks[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDraft, setSelectedDraft] = useState<DraftWithPicks | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  const fetchDrafts = useCallback(async () => {
    if (!user) return;

    try {
      // Fetch all players first
      const { data: playersData } = await supabase
        .from('players')
        .select('*');

      setPlayers(playersData || []);

      // Fetch drafts
      const { data: draftsData, error: draftsError } = await supabase
        .from('mock_drafts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (draftsError) throw draftsError;

      // Fetch picks for each draft
      const draftsWithPicks: DraftWithPicks[] = await Promise.all(
        (draftsData || []).map(async (draft) => {
          const { data: picksData } = await supabase
            .from('draft_picks')
            .select('*')
            .eq('mock_draft_id', draft.id)
            .order('pick_number', { ascending: true });

          const picksWithPlayers = (picksData || []).map((pick) => ({
            ...pick,
            player: playersData?.find((p) => p.id === pick.player_id) as Player,
          }));

          return {
            ...draft,
            picks: picksWithPlayers,
          };
        })
      );

      setDrafts(draftsWithPicks);
    } catch (error) {
      toast.error('Failed to load drafts');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchDrafts();
    }
  }, [user, fetchDrafts]);

  const deleteDraft = async (draftId: string) => {
    try {
      await supabase.from('mock_drafts').delete().eq('id', draftId);
      setDrafts((prev) => prev.filter((d) => d.id !== draftId));
      toast.success('Draft deleted');
    } catch (error) {
      toast.error('Failed to delete draft');
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
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-4xl tracking-wide">DRAFT HISTORY</h1>
            <p className="text-muted-foreground">View your past mock drafts</p>
          </div>
          <Button variant="hero" onClick={() => navigate('/mock-draft')}>
            New Draft
          </Button>
        </div>

        {drafts.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <p className="text-muted-foreground mb-4">No drafts yet</p>
            <Button variant="default" onClick={() => navigate('/mock-draft')}>
              Start Your First Draft
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {drafts.map((draft) => (
              <div key={draft.id} className="glass-card p-4 animate-slide-up">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
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
                    {draft.status === 'completed' && (
                      <div className="flex items-center gap-2 mt-3 flex-wrap">
                        <span className="text-xs text-muted-foreground">Your team:</span>
                        {getUserTeamPicks(draft).slice(0, 5).map((pick) => (
                          <div key={pick.id} className="flex items-center gap-1">
                            <span className="text-xs">{pick.player?.name}</span>
                            <PositionBadge
                              position={pick.player?.position || ''}
                              className="text-[10px]"
                            />
                          </div>
                        ))}
                        {getUserTeamPicks(draft).length > 5 && (
                          <span className="text-xs text-muted-foreground">
                            +{getUserTeamPicks(draft).length - 5} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {draft.status === 'in_progress' && (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => navigate(`/draft/${draft.id}`)}
                      >
                        Continue
                      </Button>
                    )}
                    
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
      <Dialog open={!!selectedDraft} onOpenChange={() => setSelectedDraft(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">
              {selectedDraft?.name}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto">
            {/* Team roster sections */}
            {selectedDraft && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                {Array.from({ length: selectedDraft.num_teams }, (_, i) => i + 1).map(
                  (teamNum) => {
                    const teamPicks = selectedDraft.picks.filter(
                      (p) => p.team_number === teamNum
                    );
                    const isUserTeam = teamNum === selectedDraft.user_pick_position;

                    return (
                      <div
                        key={teamNum}
                        className={cn(
                          'rounded-lg p-3',
                          isUserTeam
                            ? 'bg-accent/10 border border-accent/30'
                            : 'bg-secondary/30'
                        )}
                      >
                        <h4 className="font-display text-sm mb-2">
                          Team {teamNum} {isUserTeam && '(YOU)'}
                        </h4>
                        <div className="space-y-1">
                          {teamPicks.map((pick) => (
                            <div
                              key={pick.id}
                              className="flex items-center gap-2 text-sm"
                            >
                              <span className="text-muted-foreground w-6">
                                R{pick.round_number}
                              </span>
                              <span className="flex-1 truncate">
                                {pick.player?.name}
                              </span>
                              <PositionBadge
                                position={pick.player?.position || ''}
                                className="text-[10px]"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default History;
