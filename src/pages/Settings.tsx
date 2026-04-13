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
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Bell, Palette, HelpCircle, MessageSquare, User, Mail, ArrowLeft, Trophy, Plus, Trash2, Loader2, GripVertical, Lock, Eye, EyeOff, AlertTriangle, Database } from 'lucide-react';
import { SyncPlayersButton } from '@/components/admin/SyncPlayersButton';
import { isSyncAdminUser } from '@/constants/adminSync';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { useToast } from '@/hooks/use-toast';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
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
import { Tables } from '@/integrations/supabase/types';

type League = Tables<'leagues'>;

/** Fast, smooth auto-scroll when dragging near edges */
const autoScrollConfig = {
  acceleration: 100,
  interval: 1,
  thresholds: { x: 0.1, y: 0.45 },
};

// Sortable league component with drag handle
const SortableLeague = ({ 
  league, 
  onDelete,
  deletingLeagueId,
}: { 
  league: League; 
  onDelete: (leagueId: string, leagueName: string) => void;
  deletingLeagueId: string | null;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: league.id,
    animateLayoutChanges: () => false,
  });

  const style: React.CSSProperties = {
    transform: transform ? `translate3d(0px, ${transform.y || 0}px, 0)` : undefined,
    transition: isDragging ? 'none' : undefined,
    touchAction: 'none',
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style}
      className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/50"
    >
      <div className="flex items-center gap-3 flex-1">
        <div 
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing flex items-center justify-center p-1 hover:bg-secondary/50 rounded"
          style={{ touchAction: 'none' }}
        >
          <GripVertical className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="flex-1">
          <div className="font-medium">{league.name}</div>
          <div className="text-sm text-muted-foreground">
            {league.num_teams} teams • Pick #{league.user_pick_position}
          </div>
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onDelete(league.id, league.name)}
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
  );
};

const Settings = () => {
  const { user, session, loading: authLoading, changePassword, signIn, signOut } = useAuth();
  const { leagues, refreshLeagues, selectedLeague, setSelectedLeague } = useLeagues();
  const navigate = useNavigate();
  const { toast } = useToast();

  const specialCharacters = '(! @ # $ % ^ & * ( ) _ - + = { [ } ] | : ; < , > . ? / ~)';

  const [newLeagueName, setNewLeagueName] = useState('');
  const [newLeagueTeams, setNewLeagueTeams] = useState<number | string>(12);
  const [newLeaguePosition, setNewLeaguePosition] = useState(1);
  const [newLeagueScoringFormat, setNewLeagueScoringFormat] = useState<'standard' | 'ppr' | 'half_ppr'>('ppr');
  const [newLeagueType, setNewLeagueType] = useState<'season' | 'dynasty'>('season');
  const [newLeagueSuperflex, setNewLeagueSuperflex] = useState(false);
  const [newLeagueRookiesOnly, setNewLeagueRookiesOnly] = useState(false);
  const [isCreatingLeague, setIsCreatingLeague] = useState(false);
  const [deletingLeagueId, setDeletingLeagueId] = useState<string | null>(null);
  const [orderedLeagues, setOrderedLeagues] = useState<League[]>([]);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [currentPasswordError, setCurrentPasswordError] = useState('');
  const [profileUsername, setProfileUsername] = useState('');
  const [profileUsernameSaving, setProfileUsernameSaving] = useState(false);
  const [deleteAccountLoading, setDeleteAccountLoading] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 0,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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

  // Don't redirect - allow non-logged-in users to access basic settings

  // Update pick position when number of teams changes
  useEffect(() => {
    const numTeams = typeof newLeagueTeams === 'number' ? newLeagueTeams : (parseInt(String(newLeagueTeams)) || 12);
    if (newLeaguePosition > numTeams) {
      setNewLeaguePosition(1);
    }
  }, [newLeagueTeams, newLeaguePosition]);

  // Load profile username when user is available
  useEffect(() => {
    if (!user?.id) return;
    const loadProfile = async () => {
      const { data } = await supabase.from('profiles').select('username').eq('id', user.id).maybeSingle();
      if (data?.username) setProfileUsername(data.username);
    };
    loadProfile();
  }, [user?.id]);

  // Initialize ordered leagues when leagues change
  useEffect(() => {
    if (leagues.length > 0) {
      // Sort leagues by display_order, then by created_at as fallback
      const sorted = [...leagues].sort((a, b) => {
        const orderA = a.display_order ?? (a.created_at ? new Date(a.created_at).getTime() : 0);
        const orderB = b.display_order ?? (b.created_at ? new Date(b.created_at).getTime() : 0);
        return orderA - orderB;
      });
      setOrderedLeagues(sorted);
    } else {
      setOrderedLeagues([]);
    }
  }, [leagues]);

  const handleSaveUsername = async () => {
    if (!user?.id) return;
    const trimmed = profileUsername.trim();
    if (trimmed.length < 2 || trimmed.length > 30) {
      toast({ title: 'Invalid username', description: 'Username must be 2–30 characters.', variant: 'destructive' });
      return;
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
      toast({ title: 'Invalid username', description: 'Only letters, numbers, underscores, and hyphens allowed.', variant: 'destructive' });
      return;
    }
    setProfileUsernameSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({ id: user.id, username: trimmed }, { onConflict: 'id' });
      if (error) {
        if (error.code === '23505') {
          toast({ title: 'Username taken', description: 'That username is already in use.', variant: 'destructive' });
        } else {
          toast({ title: 'Error', description: error.message, variant: 'destructive' });
        }
        return;
      }
      toast({ title: 'Saved', description: 'Username updated.' });
    } finally {
      setProfileUsernameSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    setDeleteAccountLoading(true);
    try {
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      const accessToken =
        refreshData.session?.access_token ?? session?.access_token;
      if (!accessToken) {
        toast({
          title: 'Error',
          description:
            refreshError?.message ??
            'Your session expired. Sign in again, then try deleting your account.',
          variant: 'destructive',
        });
        return;
      }
      const { error, response } = await supabase.functions.invoke('delete-user', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: {},
      });
      if (error) {
        let msg = error.message;
        if (error instanceof FunctionsHttpError && response) {
          const status = response.status;
          try {
            const ct = response.headers.get('Content-Type') ?? '';
            if (ct.includes('application/json')) {
              const body: unknown = await response.json();
              if (
                body &&
                typeof body === 'object' &&
                'error' in body &&
                typeof (body as { error: unknown }).error === 'string'
              ) {
                msg = (body as { error: string }).error;
              }
            } else {
              const text = (await response.text()).trim();
              if (text) msg = text.length > 240 ? `${text.slice(0, 240)}…` : text;
            }
          } catch {
            /* keep generic FunctionsHttpError message */
          }
          if (status === 401 && msg === error.message) {
            msg =
              'Could not verify your session. Sign out, sign in again, then try deleting your account.';
          }
        }
        toast({
          title: 'Error',
          description: msg || 'Could not delete account. Please try again.',
          variant: 'destructive',
        });
        return;
      }
      await signOut();
      navigate('/auth');
      toast({ title: 'Account deleted', description: 'Your account has been permanently deleted.' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not delete account. Please try again.';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setDeleteAccountLoading(false);
    }
  };

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

  const validatePassword = (password: string): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
    if (password.length < 10) {
      errors.push('At least 10 characters');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('At least one uppercase letter');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('At least one lowercase letter');
    }
    if (!/[0-9]/.test(password)) {
      errors.push('At least one number');
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('At least one special character');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
    };
  };

  const handleChangePassword = async () => {
    if (!user?.email) return;

    // Clear previous errors
    setCurrentPasswordError('');

    // Validate inputs
    if (!currentPassword) {
      setCurrentPasswordError('Please enter your current password');
      return;
    }

    // Validate new password requirements
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      toast({
        title: 'Password Requirements Not Met',
        description: passwordValidation.errors.join(', '),
        variant: 'destructive',
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: 'Error',
        description: 'New passwords do not match',
        variant: 'destructive',
      });
      return;
    }

    if (currentPassword === newPassword) {
      toast({
        title: 'Error',
        description: 'New password must be different from current password',
        variant: 'destructive',
      });
      return;
    }

    setIsChangingPassword(true);
    try {
      // First, verify current password by attempting to sign in
      const { error: verifyError } = await signIn(user.email, currentPassword);
      if (verifyError) {
        setCurrentPasswordError('Current password is incorrect');
        setIsChangingPassword(false);
        return;
      }

      // If verification succeeds, update password
      const { error } = await changePassword(newPassword);
      if (error) {
        toast({
          title: 'Error',
          description: `Failed to change password: ${error.message}`,
          variant: 'destructive',
        });
        setIsChangingPassword(false);
        return;
      }

      toast({
        title: 'Success',
        description: 'Password changed successfully',
      });

      // Clear form
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setCurrentPasswordError('');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: `Failed to change password: ${error?.message || 'Unknown error'}`,
        variant: 'destructive',
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleCreateLeague = async () => {
    if (!user || !newLeagueName.trim()) return;
    
    // Validate and clamp number of teams - allow typing but enforce limits on create
    let numTeamsValue = typeof newLeagueTeams === 'number' ? newLeagueTeams : parseInt(String(newLeagueTeams));
    
    // Handle empty or invalid values
    if (!numTeamsValue || isNaN(numTeamsValue)) {
      numTeamsValue = 12; // Default to 12
    }
    
    // Clamp to valid range (4-32) when creating
    const finalNumTeams = Math.max(4, Math.min(32, numTeamsValue));
    
    // Show a message if value was adjusted
    if (numTeamsValue !== finalNumTeams) {
      toast({
        title: 'Number of teams adjusted',
        description: `Number of teams adjusted from ${numTeamsValue} to ${finalNumTeams} (must be between 4 and 32)`,
      });
    }
    
    // Ensure pick position is valid for the number of teams
    const finalPickPosition = Math.max(1, Math.min(finalNumTeams, newLeaguePosition));
    
    // Calculate defense limit based on number of teams
    // Rule: DEF limit × number of teams ≤ 32 (there are only 32 NFL defenses)
    // So DEF limit = floor(32 / num_teams)
    const calculatedDefLimit = Math.max(1, Math.floor(32 / finalNumTeams));
    
    const leagueNameToCreate = newLeagueName.trim();
    
    setIsCreatingLeague(true);
    try {
      // Try to calculate display_order if the column exists
      let insertData: any = {
        user_id: user.id,
        name: leagueNameToCreate,
        num_teams: finalNumTeams,
        user_pick_position: finalPickPosition,
        scoring_format: newLeagueScoringFormat,
        league_type: newLeagueType,
        is_superflex: newLeagueSuperflex,
        rookies_only: newLeagueType === 'dynasty' ? newLeagueRookiesOnly : false,
        // Set position_limits with calculated DEF limit
        position_limits: {
          QB: 4,
          RB: 8,
          WR: 8,
          TE: 3,
          K: 3,
          DEF: calculatedDefLimit,
          BENCH: 7,
        },
      };

      // Only add display_order if we have ordered leagues (column exists)
      if (orderedLeagues.length > 0 && orderedLeagues.some(l => l.display_order !== null && l.display_order !== undefined)) {
        const maxOrder = Math.max(...orderedLeagues.map(l => l.display_order ?? 0), 0);
        insertData.display_order = maxOrder + 1;
      }

      const { data: createdLeague, error } = await supabase
        .from('leagues')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'League created',
        description: `${leagueNameToCreate} has been created successfully`,
      });

      setNewLeagueName('');
      setNewLeagueTeams(12);
      setNewLeaguePosition(1);
      setNewLeagueScoringFormat('ppr');
      setNewLeagueType('season');
      setNewLeagueSuperflex(false);
      setNewLeagueRookiesOnly(false);
      await refreshLeagues();

      // Select the new league and navigate to rankings.
      // Pass leagueForBucket so Rankings uses the correct bucket immediately (avoids race with selectedLeague).
      if (createdLeague) {
        setSelectedLeague(createdLeague);
        navigate('/rankings', { state: { leagueForBucket: createdLeague } });
      }
    } catch (error: any) {
      console.error('Error creating league:', error);
      toast({
        title: 'Error',
        description: `Failed to create league: ${error?.message || 'Unknown error'}`,
        variant: 'destructive',
      });
    } finally {
      setIsCreatingLeague(false);
    }
  };

  const handleDeleteLeague = async (leagueId: string, leagueName: string) => {
    setDeletingLeagueId(leagueId);
    try {
      // Check if the deleted league is the currently selected league
      const isCurrentlySelected = selectedLeague?.id === leagueId;

      const { error } = await supabase
        .from('leagues')
        .delete()
        .eq('id', leagueId);

      if (error) throw error;

      toast({
        title: 'League deleted',
        description: `${leagueName} has been deleted`,
      });

      // If the deleted league was the currently selected one, switch to "All leagues"
      if (isCurrentlySelected) {
        setSelectedLeague(null);
        localStorage.setItem('selectedLeagueId', 'null');
      }

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

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = orderedLeagues.findIndex((item) => item.id === active.id);
      const newIndex = orderedLeagues.findIndex((item) => item.id === over.id);
      const newOrderedLeagues = arrayMove(orderedLeagues, oldIndex, newIndex);
      setOrderedLeagues(newOrderedLeagues);

      // Save the new order to the database
      setIsSavingOrder(true);
      try {
        // Check if display_order column exists by checking if any league has it
        const hasDisplayOrder = orderedLeagues.some(l => l.display_order !== null && l.display_order !== undefined);
        
        if (!hasDisplayOrder) {
          // Column doesn't exist yet - show helpful message
          toast({
            title: 'Migration Required',
            description: 'Please apply the database migration to enable league reordering. Check the migration file: supabase/migrations/20260115000000_add_league_display_order.sql',
            variant: 'destructive',
          });
          // Revert to original order
          setOrderedLeagues(leagues);
          return;
        }

        // Update display_order for all affected leagues
        const updates = newOrderedLeagues.map((league, index) => ({
          id: league.id,
          display_order: index + 1,
        }));

        // Update each league's display_order
        for (const update of updates) {
          const { error } = await supabase
            .from('leagues')
            .update({ display_order: update.display_order })
            .eq('id', update.id);

          if (error) throw error;
        }

        // Refresh leagues to get updated order
        await refreshLeagues();
      } catch (error: any) {
        console.error('Error saving league order:', error);
        toast({
          title: 'Error',
          description: error?.message?.includes('display_order') 
            ? 'Please apply the database migration first. Check: supabase/migrations/20260115000000_add_league_display_order.sql'
            : 'Failed to save league order',
          variant: 'destructive',
        });
        // Revert to original order on error
        setOrderedLeagues(leagues);
      } finally {
        setIsSavingOrder(false);
      }
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // For non-logged-in users, show simplified settings
  if (!user) {
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

            {/* Sign In Prompt */}
            <Card className="glass-card border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5 text-primary" />
                  Sign In for Full Features
                </CardTitle>
                <CardDescription>Create an account to access all settings and save your data</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Sign in to access league management, account settings, and more. Your current settings will not be saved.
                </p>
                <Button onClick={() => navigate('/auth')} className="w-full sm:w-auto">
                  Sign In
                </Button>
              </CardContent>
            </Card>
          </div>
        </main>
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
          {/* League Management - Only for logged-in users */}
          {user && (
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
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck="false"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="numTeams">Number of Teams</Label>
                    <Input
                      id="numTeams"
                      type="number"
                      value={newLeagueTeams}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === '') {
                          setNewLeagueTeams('');
                          return;
                        }
                        // Remove any non-numeric characters (including negative signs)
                        const cleanedValue = value.replace(/[^0-9]/g, '');
                        if (cleanedValue === '') {
                          setNewLeagueTeams('');
                          return;
                        }
                        const numValue = parseInt(cleanedValue);
                        if (!isNaN(numValue) && numValue >= 1) {
                          // Automatically clamp to 32 if > 32
                          if (numValue > 32) {
                            setNewLeagueTeams(32);
                          } else {
                            setNewLeagueTeams(numValue);
                          }
                        }
                      }}
                      onBlur={(e) => {
                        const value = e.target.value;
                        if (value === '') {
                          setNewLeagueTeams(12);
                          return;
                        }
                        const numValue = parseInt(value);
                        if (!isNaN(numValue)) {
                          // Clamp to valid range on blur
                          if (numValue < 4) {
                            setNewLeagueTeams(4);
                          } else if (numValue > 32) {
                            setNewLeagueTeams(32);
                          }
                        }
                      }}
                      onKeyDown={(e) => {
                        // Prevent typing negative sign, 'e', 'E', '+', '.'
                        if (e.key === '-' || e.key === 'e' || e.key === 'E' || e.key === '+' || e.key === '.') {
                          e.preventDefault();
                        }
                      }}
                      className="max-w-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    {(() => {
                      const numValue = typeof newLeagueTeams === 'number' ? newLeagueTeams : parseInt(String(newLeagueTeams)) || 12;
                      if (numValue < 4) {
                        return (
                          <p className="text-xs text-destructive/80 mt-1">
                            Minimum 4 teams required. Will default to 4 when creating league.
                          </p>
                        );
                      }
                      return null;
                    })()}
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
                        {Array.from({ length: typeof newLeagueTeams === 'number' ? newLeagueTeams : (parseInt(String(newLeagueTeams)) || 12) }, (_, i) => i + 1).map((num) => (
                          <SelectItem key={num} value={num.toString()}>
                            Pick #{num}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="scoringFormat">Scoring Format</Label>
                    <Select 
                      value={newLeagueScoringFormat} 
                      onValueChange={(val) => setNewLeagueScoringFormat(val as 'standard' | 'ppr' | 'half_ppr')}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="standard">Standard (Non-PPR)</SelectItem>
                        <SelectItem value="ppr">PPR (1 pt per reception)</SelectItem>
                        <SelectItem value="half_ppr">Half PPR (0.5 pt per reception)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="leagueType">League Type</Label>
                    <Select 
                      value={newLeagueType} 
                      onValueChange={(val) => {
                        const next = val as 'season' | 'dynasty';
                        setNewLeagueType(next);
                        if (next !== 'dynasty') setNewLeagueRookiesOnly(false);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="season">2026 Season Redraft</SelectItem>
                        <SelectItem value="dynasty">Dynasty</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 flex flex-col justify-end">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="newLeagueSuperflex"
                        checked={newLeagueSuperflex}
                        onCheckedChange={(checked) => setNewLeagueSuperflex(checked === true)}
                      />
                      <Label htmlFor="newLeagueSuperflex" className="text-sm font-medium cursor-pointer">
                        Superflex (allows QB in flex position)
                      </Label>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center pt-2">
                  <div>
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
                  <div className="hidden sm:block" />
                  <div className="flex items-center">
                    {newLeagueType === 'dynasty' && (
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="newLeagueRookiesOnly"
                          checked={newLeagueRookiesOnly}
                          onCheckedChange={(checked) => setNewLeagueRookiesOnly(checked === true)}
                        />
                        <Label htmlFor="newLeagueRookiesOnly" className="text-sm font-medium cursor-pointer">
                          Rookies only
                        </Label>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <Separator />

              {/* Existing Leagues */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Your Leagues</h4>
                  {isSavingOrder && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving order...
                    </div>
                  )}
                </div>
                {orderedLeagues.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No leagues yet. Create one above to get started.
                  </p>
                ) : (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                    autoScroll={autoScrollConfig}
                  >
                    <SortableContext
                      items={orderedLeagues.map((l) => l.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-2" style={{ touchAction: 'none' }}>
                        {orderedLeagues.map((league) => (
                          <SortableLeague
                            key={league.id}
                            league={league}
                            onDelete={handleDeleteLeague}
                            deletingLeagueId={deletingLeagueId}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                )}
              </div>
            </CardContent>
          </Card>
          )}

          {/* Account Information */}
          {user && (
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
                <Label htmlFor="username">Username</Label>
                <div className="flex gap-2">
                  <Input
                    id="username"
                    placeholder="Enter username"
                    value={profileUsername}
                    onChange={(e) => setProfileUsername(e.target.value)}
                    className="bg-muted/50 flex-1"
                    autoComplete="off"
                  />
                  <Button
                    type="button"
                    onClick={handleSaveUsername}
                    disabled={profileUsernameSaving || !profileUsername.trim()}
                  >
                    {profileUsernameSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Letters, numbers, underscores, and hyphens. 2–30 characters.</p>
              </div>

              <Separator />

              {/* Change Password Section */}
              <div className="space-y-4 p-4 rounded-lg bg-secondary/30 border border-border/50">
                <div>
                  <h4 className="font-medium mb-1">Change Password</h4>
                  <p className="text-sm text-muted-foreground">
                    Update your password to keep your account secure
                  </p>
                </div>

                {/* Password Requirements */}
                <div className="p-3 rounded-md bg-muted/50 border border-border/50">
                  <p className="text-sm font-medium mb-2">Password Requirements:</p>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li>At least 10 characters</li>
                    <li>At least one uppercase letter</li>
                    <li>At least one lowercase letter</li>
                    <li>At least one number</li>
                    <li>
                      At least one special character {specialCharacters}
                    </li>
                  </ul>
                </div>
                
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">Current Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="currentPassword"
                        type="password"
                        placeholder="Enter current password"
                        value={currentPassword}
                        autoComplete="off"
                        onChange={(e) => {
                          setCurrentPassword(e.target.value);
                          setCurrentPasswordError('');
                        }}
                        className={`pl-10 bg-secondary/50 border-border/50 ${
                          currentPasswordError ? 'border-destructive' : ''
                        }`}
                      />
                    </div>
                    {currentPasswordError && (
                      <p className="text-sm text-destructive">{currentPasswordError}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="newPassword">New Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="newPassword"
                        type={showNewPassword ? 'text' : 'password'}
                        placeholder="Enter new password"
                        value={newPassword}
                        autoComplete="new-password"
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="pl-10 pr-10 bg-secondary/50 border-border/50"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showNewPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? 'text' : 'password'}
                        placeholder="Confirm new password"
                        value={confirmPassword}
                        autoComplete="new-password"
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="pl-10 pr-10 bg-secondary/50 border-border/50"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <Button
                    onClick={handleChangePassword}
                    disabled={isChangingPassword || !currentPassword || !newPassword || !confirmPassword}
                    className="w-full sm:w-auto"
                  >
                    {isChangingPassword ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Changing Password...
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4 mr-2" />
                        Change Password
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
          )}

          {/* Notification Preferences */}
          {user && (
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
          )}

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

          {user && isSyncAdminUser(user.id) && (
            <Card className="glass-card border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="w-5 h-5 text-primary" />
                  Player data (admin)
                </CardTitle>
                <CardDescription>
                  Refresh NFL team and jersey from Sleeper for players that have a{' '}
                  <code className="text-xs">sleeper_id</code>. Server checks{' '}
                  <code className="text-xs">ADMIN_SYNC_USER_IDS</code>; this card only shows for your
                  account (<code className="text-xs">VITE_SYNC_ADMIN_USER_ID</code>).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SyncPlayersButton userId={user.id} />
              </CardContent>
            </Card>
          )}

          {/* Delete Account - at the very bottom */}
          {user && (
          <Card className="glass-card border-border/50 border-destructive/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="w-5 h-5" />
                Delete Account
              </CardTitle>
              <CardDescription>
                Permanently delete your account. This will remove your username and email from our database. This action cannot be undone.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="gap-2" disabled={deleteAccountLoading}>
                    {deleteAccountLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    Delete my account
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure you want to delete your account?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently remove your account, username, and email from our database. Any leagues, drafts, and other data associated with your account may also be removed. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteAccount}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      disabled={deleteAccountLoading}
                    >
                      {deleteAccountLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Yes, delete my account'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
          )}
        </div>
      </main>
    </div>
  );
};

export default Settings;
