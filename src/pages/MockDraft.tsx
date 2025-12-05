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
import { Zap, Users, Layers, Trophy, Loader2 } from 'lucide-react';

const MockDraft = () => {
  const { user, loading: authLoading } = useAuth();
  const { selectedLeague } = useLeagues();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [numTeams, setNumTeams] = useState('12');
  const [numRounds, setNumRounds] = useState('15');
  const [userPickPosition, setUserPickPosition] = useState('1');
  const [draftOrder, setDraftOrder] = useState('snake');

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  const startDraft = async () => {
    if (!user) return;
    if (!draftName.trim()) {
      toast.error('Please enter a draft name');
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('mock_drafts')
        .insert({
          user_id: user.id,
          name: draftName.trim(),
          num_teams: parseInt(numTeams),
          num_rounds: parseInt(numRounds),
          user_pick_position: parseInt(userPickPosition),
          draft_order: draftOrder,
          status: 'in_progress',
          league_id: selectedLeague?.id || null,
        })
        .select()
        .single();

      if (error) throw error;

      navigate(`/draft/${data.id}`);
    } catch (error) {
      toast.error('Failed to create draft');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-2xl bg-gradient-primary flex items-center justify-center mx-auto mb-4 shadow-glow">
            <Zap className="w-10 h-10 text-primary-foreground" />
          </div>
          <h1 className="font-display text-4xl tracking-wide mb-2">NEW MOCK DRAFT</h1>
          <p className="text-muted-foreground">Configure your draft settings</p>
        </div>

        <div className="glass-card p-6 space-y-6">
          <div className="space-y-2">
            <Label htmlFor="draftName">Draft Name</Label>
            <Input
              id="draftName"
              placeholder="e.g., Mock Draft #1"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              className="bg-secondary/50 border-border/50"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Users className="w-4 h-4 text-muted-foreground" />
                Number of Teams
              </Label>
              <Select value={numTeams} onValueChange={setNumTeams}>
                <SelectTrigger className="bg-secondary/50 border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[8, 10, 12, 14, 16].map((n) => (
                    <SelectItem key={n} value={n.toString()}>
                      {n} teams
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-muted-foreground" />
                Number of Rounds
              </Label>
              <Select value={numRounds} onValueChange={setNumRounds}>
                <SelectTrigger className="bg-secondary/50 border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[10, 12, 15, 16, 18, 20].map((n) => (
                    <SelectItem key={n} value={n.toString()}>
                      {n} rounds
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-muted-foreground" />
                Your Pick Position
              </Label>
              <Select value={userPickPosition} onValueChange={setUserPickPosition}>
                <SelectTrigger className="bg-secondary/50 border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: parseInt(numTeams) }, (_, i) => i + 1).map(
                    (n) => (
                      <SelectItem key={n} value={n.toString()}>
                        Pick #{n}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Draft Order</Label>
              <Select value={draftOrder} onValueChange={setDraftOrder}>
                <SelectTrigger className="bg-secondary/50 border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="snake">Snake</SelectItem>
                  <SelectItem value="linear">Linear</SelectItem>
                </SelectContent>
              </Select>
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
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Zap className="w-5 h-5" />
                  Start Draft
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="mt-8 glass-card p-4">
          <h3 className="font-display text-xl mb-3">DRAFT INFO</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>• <strong className="text-foreground">Snake Draft:</strong> Order reverses each round</li>
            <li>• <strong className="text-foreground">Linear Draft:</strong> Same order every round</li>
            <li>• You'll pick for all teams manually</li>
            <li>• Players are sorted by your rankings (or ADP if no rankings)</li>
          </ul>
        </div>
      </main>
    </div>
  );
};

export default MockDraft;
