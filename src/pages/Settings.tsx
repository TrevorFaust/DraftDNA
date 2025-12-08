import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useLeagues } from '@/hooks/useLeagues';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Bell, Palette, HelpCircle, MessageSquare, User, Mail, ArrowLeft, Trophy, Plus, Trash2, Loader2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const Settings = () => {
  const { user, loading: authLoading } = useAuth();
  const { leagues, refreshLeagues } = useLeagues();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [newLeagueName, setNewLeagueName] = useState('');
  const [newLeagueTeams, setNewLeagueTeams] = useState(12);
  const [newLeaguePosition, setNewLeaguePosition] = useState(1);
  const [isCreatingLeague, setIsCreatingLeague] = useState(false);
  const [deletingLeagueId, setDeletingLeagueId] = useState<string | null>(null);

  const [notifications, setNotifications] = useState({
    draftReminders: true,
    weeklyUpdates: false,
    playerNews: true,
  });

  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof document !== 'undefined') {
      return document.documentElement.classList.contains('light') ? 'light' : 'dark';
    }
    return 'dark';
  });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  const handleThemeChange = (newTheme: 'dark' | 'light') => {
    setTheme(newTheme);
    if (newTheme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
    toast({
      title: 'Theme updated',
      description: `Switched to ${newTheme} mode`,
    });
  };

  const handleSendFeedback = () => {
    window.location.href = 'mailto:feedback@draftboard.app?subject=Draft Board Feedback';
  };

  const handleGetHelp = () => {
    toast({
      title: 'Help Center',
      description: 'Our help center is coming soon. For now, please use the feedback option to contact us.',
    });
  };

  const handleCreateLeague = async () => {
    if (!user || !newLeagueName.trim()) return;
    
    setIsCreatingLeague(true);
    try {
      const { error } = await supabase
        .from('leagues')
        .insert({
          user_id: user.id,
          name: newLeagueName.trim(),
          num_teams: newLeagueTeams,
          user_pick_position: newLeaguePosition,
        });

      if (error) throw error;

      toast({
        title: 'League created',
        description: `${newLeagueName} has been created successfully`,
      });

      setNewLeagueName('');
      setNewLeagueTeams(12);
      setNewLeaguePosition(1);
      await refreshLeagues();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create league',
        variant: 'destructive',
      });
    } finally {
      setIsCreatingLeague(false);
    }
  };

  const handleDeleteLeague = async (leagueId: string, leagueName: string) => {
    setDeletingLeagueId(leagueId);
    try {
      const { error } = await supabase
        .from('leagues')
        .delete()
        .eq('id', leagueId);

      if (error) throw error;

      toast({
        title: 'League deleted',
        description: `${leagueName} has been deleted`,
      });

      await refreshLeagues();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete league',
        variant: 'destructive',
      });
    } finally {
      setDeletingLeagueId(null);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-8">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="mb-6 gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>

        <h1 className="font-display text-3xl mb-8 text-gradient">Settings</h1>

        <div className="space-y-6">
          {/* League Management */}
          <Card className="glass-card border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-primary" />
                League Management
              </CardTitle>
              <CardDescription>Create and manage your fantasy leagues</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Create New League */}
              <div className="space-y-4 p-4 rounded-lg bg-secondary/30 border border-border/50">
                <h4 className="font-medium">Create New League</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="leagueName">League Name</Label>
                    <Input
                      id="leagueName"
                      placeholder="My Fantasy League"
                      value={newLeagueName}
                      onChange={(e) => setNewLeagueName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="numTeams">Number of Teams</Label>
                    <Select 
                      value={newLeagueTeams.toString()} 
                      onValueChange={(val) => setNewLeagueTeams(Number(val))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[8, 10, 12, 14, 16].map((num) => (
                          <SelectItem key={num} value={num.toString()}>
                            {num} teams
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pickPosition">Your Pick Position</Label>
                    <Select 
                      value={newLeaguePosition.toString()} 
                      onValueChange={(val) => setNewLeaguePosition(Number(val))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: newLeagueTeams }, (_, i) => i + 1).map((num) => (
                          <SelectItem key={num} value={num.toString()}>
                            Pick #{num}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button 
                  onClick={handleCreateLeague} 
                  disabled={!newLeagueName.trim() || isCreatingLeague}
                  className="w-full sm:w-auto"
                >
                  {isCreatingLeague ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4 mr-2" />
                  )}
                  Create League
                </Button>
              </div>

              <Separator />

              {/* Existing Leagues */}
              <div className="space-y-3">
                <h4 className="font-medium">Your Leagues</h4>
                {leagues.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No leagues yet. Create one above to get started.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {leagues.map((league) => (
                      <div 
                        key={league.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/50"
                      >
                        <div>
                          <div className="font-medium">{league.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {league.num_teams} teams • Pick #{league.user_pick_position}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteLeague(league.id, league.name)}
                          disabled={deletingLeagueId === league.id}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          {deletingLeagueId === league.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Account Information */}
          <Card className="glass-card border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5 text-primary" />
                Account Information
              </CardTitle>
              <CardDescription>Manage your account details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  value={user?.email || ''}
                  disabled
                  className="bg-muted/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="displayName">Display Name</Label>
                <Input
                  id="displayName"
                  placeholder="Enter display name"
                  defaultValue={user?.email?.split('@')[0] || ''}
                />
              </div>
            </CardContent>
          </Card>

          {/* Notification Preferences */}
          <Card className="glass-card border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-primary" />
                Notification Preferences
              </CardTitle>
              <CardDescription>Choose what notifications you receive</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Draft Reminders</Label>
                  <p className="text-sm text-muted-foreground">Get notified about upcoming drafts</p>
                </div>
                <Switch
                  checked={notifications.draftReminders}
                  onCheckedChange={(checked) =>
                    setNotifications({ ...notifications, draftReminders: checked })
                  }
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Weekly Updates</Label>
                  <p className="text-sm text-muted-foreground">Receive weekly ranking updates</p>
                </div>
                <Switch
                  checked={notifications.weeklyUpdates}
                  onCheckedChange={(checked) =>
                    setNotifications({ ...notifications, weeklyUpdates: checked })
                  }
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Player News</Label>
                  <p className="text-sm text-muted-foreground">Get alerts about player injuries and updates</p>
                </div>
                <Switch
                  checked={notifications.playerNews}
                  onCheckedChange={(checked) =>
                    setNotifications({ ...notifications, playerNews: checked })
                  }
                />
              </div>
            </CardContent>
          </Card>

          {/* Display Theme */}
          <Card className="glass-card border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="w-5 h-5 text-primary" />
                Display Theme
              </CardTitle>
              <CardDescription>Customize your viewing experience</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Theme</Label>
                  <p className="text-sm text-muted-foreground">Choose between dark or light mode</p>
                </div>
                <Select value={theme} onValueChange={(value: 'dark' | 'light') => handleThemeChange(value)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="light">Light</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Help & Support */}
          <Card className="glass-card border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-primary" />
                Help & Support
              </CardTitle>
              <CardDescription>Get assistance or share your thoughts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={handleGetHelp}
              >
                <HelpCircle className="w-4 h-4" />
                Get Help
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={handleSendFeedback}
              >
                <MessageSquare className="w-4 h-4" />
                Send Feedback
                <Mail className="w-4 h-4 ml-auto text-muted-foreground" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Settings;
