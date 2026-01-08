import { useState, useEffect } from 'react';
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
import { toast } from 'sonner';
import { Save, Users, Settings2, ArrowLeft, Layers } from 'lucide-react';

interface PositionLimits {
  QB: number;
  RB: number;
  WR: number;
  TE: number;
  K: number;
  DEF: number;
  BENCH: number;
}

interface TeamName {
  team_number: number;
  team_name: string;
}

export default function LeagueSettings() {
  const { user, loading: authLoading } = useAuth();
  const { selectedLeague, refreshLeagues } = useLeagues();
  const navigate = useNavigate();
  
  const [positionLimits, setPositionLimits] = useState<Record<keyof PositionLimits, number | string>>({
    QB: 4, RB: 8, WR: 8, TE: 3, K: 3, DEF: 3, BENCH: 7
  });
  
  const defaultMinimums: PositionLimits = {
    QB: 1, RB: 2, WR: 2, TE: 1, K: 1, DEF: 1, BENCH: 1
  };
  const [teamNames, setTeamNames] = useState<TeamName[]>([]);
  const [numTeams, setNumTeams] = useState(12);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (selectedLeague) {
      // Load position limits
      const limits = selectedLeague.position_limits as unknown as PositionLimits | null;
      if (limits && typeof limits === 'object') {
        setPositionLimits({
          QB: limits.QB ?? 4,
          RB: limits.RB ?? 8,
          WR: limits.WR ?? 8,
          TE: limits.TE ?? 3,
          K: limits.K ?? 3,
          DEF: limits.DEF ?? 3,
          BENCH: (limits as PositionLimits).BENCH ?? 7,
        });
      }

      // Load num teams
      setNumTeams(selectedLeague.num_teams);

      // Load team names
      loadTeamNames();
    }
  }, [selectedLeague]);

  const loadTeamNames = async (teamCount?: number) => {
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
  };

  const handlePositionLimitChange = (position: keyof PositionLimits, value: string) => {
    if (value === '') {
      setPositionLimits(prev => ({ ...prev, [position]: '' }));
    } else {
      const numValue = parseInt(value);
      if (!isNaN(numValue)) {
        setPositionLimits(prev => ({
          ...prev,
          [position]: Math.max(1, Math.min(15, numValue))
        }));
      }
    }
  };

  const handleNumTeamsChange = (value: string) => {
    if (value === '') {
      setNumTeams('' as unknown as number);
      return;
    }
    const numValue = parseInt(value);
    if (!isNaN(numValue)) {
      setNumTeams(Math.max(2, Math.min(32, numValue)));
    }
  };

  const saveNumTeams = async () => {
    if (!selectedLeague) return;
    const finalNumTeams = typeof numTeams === 'number' && numTeams >= 2 ? numTeams : 2;
    
    setSaving(true);
    const { error } = await supabase
      .from('leagues')
      .update({ num_teams: finalNumTeams })
      .eq('id', selectedLeague.id);

    if (error) {
      toast.error('Failed to update number of teams');
      console.error(error);
    } else {
      toast.success('Number of teams updated');
      setNumTeams(finalNumTeams);
      refreshLeagues();
      loadTeamNames(finalNumTeams);
    }
    setSaving(false);
  };

  const handleTeamNameChange = (teamNumber: number, name: string) => {
    setTeamNames(prev => prev.map(t => 
      t.team_number === teamNumber ? { ...t, team_name: name } : t
    ));
  };

  const savePositionLimits = async () => {
    if (!selectedLeague) return;

    setSaving(true);
    
    // Apply default minimums for empty values
    const finalLimits: PositionLimits = {
      QB: positionLimits.QB === '' ? defaultMinimums.QB : Number(positionLimits.QB),
      RB: positionLimits.RB === '' ? defaultMinimums.RB : Number(positionLimits.RB),
      WR: positionLimits.WR === '' ? defaultMinimums.WR : Number(positionLimits.WR),
      TE: positionLimits.TE === '' ? defaultMinimums.TE : Number(positionLimits.TE),
      K: positionLimits.K === '' ? defaultMinimums.K : Number(positionLimits.K),
      DEF: positionLimits.DEF === '' ? defaultMinimums.DEF : Number(positionLimits.DEF),
      BENCH: positionLimits.BENCH === '' ? defaultMinimums.BENCH : Number(positionLimits.BENCH),
    };
    
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
      refreshLeagues();
    }
    setSaving(false);
  };

  const saveTeamNames = async () => {
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

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!selectedLeague) {
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
            <p className="text-muted-foreground">{selectedLeague.name}</p>
          </div>
        </div>

        <Tabs defaultValue="general" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 bg-secondary/50">
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
          </TabsList>

          <TabsContent value="general">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  General Settings
                  <span className="text-sm font-normal text-muted-foreground">(max 32)</span>
                </CardTitle>
                <CardDescription>
                  Configure the basic settings for your league
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="numTeams" className="text-sm font-medium">
                    Number of Teams
                  </Label>
                  <Input
                    id="numTeams"
                    type="number"
                    min={2}
                    max={32}
                    value={numTeams}
                    onChange={(e) => handleNumTeamsChange(e.target.value)}
                    className="bg-secondary/50 max-w-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
                <Button onClick={saveNumTeams} disabled={saving} className="w-full sm:w-auto">
                  <Save className="w-4 h-4 mr-2" />
                  Save
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="positions">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Position Limits
                  <span className="text-sm font-normal text-muted-foreground">(max 15)</span>
                </CardTitle>
                <CardDescription>
                  Set the maximum number of players that can be drafted per position
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {(Object.keys(positionLimits) as Array<keyof PositionLimits>).map((position) => (
                    <div key={position} className="space-y-2">
                      <Label htmlFor={position} className="text-sm font-medium">
                        {position === 'DEF' ? 'Defense' : position === 'BENCH' ? 'Bench' : position}
                      </Label>
                      <Input
                        id={position}
                        type="number"
                        min={1}
                        max={15}
                        value={positionLimits[position]}
                        onChange={(e) => handlePositionLimitChange(position, e.target.value)}
                        className="bg-secondary/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                  ))}
                </div>
                <Button onClick={savePositionLimits} disabled={saving} className="w-full sm:w-auto">
                  <Save className="w-4 h-4 mr-2" />
                  Save Position Limits
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="teams">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Team Names</CardTitle>
                <CardDescription>
                  Customize the names for each team in your league (Team {selectedLeague.user_pick_position} is your team)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin">
                  {teamNames.map((team) => (
                    <div key={team.team_number} className="space-y-2">
                      <Label htmlFor={`team-${team.team_number}`} className="text-sm font-medium flex items-center gap-2">
                        Team {team.team_number}
                        {team.team_number === selectedLeague.user_pick_position && (
                          <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">You</span>
                        )}
                      </Label>
                      <Input
                        id={`team-${team.team_number}`}
                        placeholder={`Team ${team.team_number}`}
                        value={team.team_name}
                        onChange={(e) => handleTeamNameChange(team.team_number, e.target.value)}
                        className="bg-secondary/50"
                        maxLength={50}
                      />
                    </div>
                  ))}
                </div>
                <Button onClick={saveTeamNames} disabled={saving} className="w-full sm:w-auto">
                  <Save className="w-4 h-4 mr-2" />
                  Save Team Names
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
