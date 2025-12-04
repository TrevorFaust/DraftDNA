import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Bell, Palette, HelpCircle, MessageSquare, User, Mail, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const Settings = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [notifications, setNotifications] = useState({
    draftReminders: true,
    weeklyUpdates: false,
    playerNews: true,
  });

  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  const handleThemeChange = (isDark: boolean) => {
    const newTheme = isDark ? 'dark' : 'light';
    setTheme(newTheme);
    document.documentElement.classList.toggle('dark', isDark);
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
                  <Label>Dark Mode</Label>
                  <p className="text-sm text-muted-foreground">Use dark theme for better night viewing</p>
                </div>
                <Switch
                  checked={theme === 'dark'}
                  onCheckedChange={handleThemeChange}
                />
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
