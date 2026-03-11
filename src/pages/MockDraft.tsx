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
import { Users, Layers, Trophy, Loader2, Target, Timer } from 'lucide-react';
import { FootballHelmetIcon } from '@/components/icons/FootballHelmetIcon';
import { tempDraftStorage, generateTempDraftId, tempSettingsStorage } from '@/utils/temporaryStorage';
import type { MockDraft } from '@/types/database';
import { assignRandomNamedArchetypesForDraft } from '@/utils/cpuDraftLogic';

const MockDraft = () => {
  const { user, loading: authLoading } = useAuth();
  const { selectedLeague } = useLeagues();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [numTeams, setNumTeams] = useState('12');
  const [userPickPosition, setUserPickPosition] = useState('1');
  const [pickTimer, setPickTimer] = useState('30');
  const [cpuSpeed, setCpuSpeed] = useState<'slow' | 'normal' | 'fast' | 'rapid'>('rapid');
  const [playerPool, setPlayerPool] = useState('all');
  
  // For guests: derive dynasty + rookies from tempSettings
  const tempSettings = !user ? tempSettingsStorage.get() : null;
  const isDynasty = (selectedLeague as any)?.league_type === 'dynasty' || tempSettings?.leagueType === 'dynasty';
  const isRookiesOnlyFromLeague = (selectedLeague as any)?.rookies_only || tempSettings?.rookiesOnly;
  
  // Calculate number of rounds based on roster size
  // Starters: QB(1) + RB(2) + WR(2) + TE(1) + FLEX(N) + DEF(1) + K(1) = 8 + N. Plus bench.
  const calculateRounds = (): number => {
    let isSuperflex = false;
    let flexCount = 1;
    let bench = 6;
    if (user && selectedLeague?.position_limits) {
      const limits = selectedLeague.position_limits as { BENCH?: number; FLEX?: number };
      isSuperflex = (selectedLeague as any)?.is_superflex as boolean || false;
      flexCount = limits.FLEX ?? (isSuperflex ? 2 : 1);
      bench = limits.BENCH ?? 6;
    } else if (!user) {
      const tempSettings = tempSettingsStorage.get();
      isSuperflex = tempSettings?.isSuperflex || false;
      flexCount = (tempSettings?.positionLimits as { FLEX?: number })?.FLEX ?? (isSuperflex ? 2 : 1);
      if (tempSettings?.positionLimits?.BENCH !== undefined) {
        bench = typeof tempSettings.positionLimits.BENCH === 'number'
          ? tempSettings.positionLimits.BENCH
          : parseInt(String(tempSettings.positionLimits.BENCH)) || 6;
      }
    }
    const rosterSize = 8 + flexCount + bench;
    return rosterSize;
  };
  
  // Prefill settings from selected league or localStorage
  useEffect(() => {
    if (selectedLeague) {
      // For logged-in users, use selected league settings
      setNumTeams(selectedLeague.num_teams.toString());
      setUserPickPosition(selectedLeague.user_pick_position.toString());
      if ((selectedLeague as any)?.rookies_only && (selectedLeague as any)?.league_type === 'dynasty') {
        setPlayerPool('rookies');
      }
    } else if (!user) {
      // For guests, load from localStorage
      const tempSettings = tempSettingsStorage.get();
      if (tempSettings) {
        if (tempSettings.numTeams) {
          // Ensure minimum of 4 teams for guests
          const numTeamsValue = Math.max(4, Math.min(32, tempSettings.numTeams));
          setNumTeams(numTeamsValue.toString());
        }
        if (tempSettings.userPickPosition) {
          setUserPickPosition(tempSettings.userPickPosition.toString());
        } else {
          // Default to 1 if not set
          setUserPickPosition('1');
        }
        if (tempSettings.pickTimer !== undefined) {
          setPickTimer(tempSettings.pickTimer === 0 ? '0' : tempSettings.pickTimer.toString());
        }
        if (tempSettings.cpuSpeed) {
          setCpuSpeed(tempSettings.cpuSpeed);
        }
        if (tempSettings.rookiesOnly && tempSettings.leagueType === 'dynasty') {
          setPlayerPool('rookies');
        }
      } else {
        // No settings found, default to 1
        setUserPickPosition('1');
      }
    }
  }, [selectedLeague, user]);

  // Ensure userPickPosition is always valid when numTeams changes
  useEffect(() => {
    const numTeamsValue = parseInt(numTeams) || 12;
    const pickPositionValue = parseInt(userPickPosition) || 1;
    
    // If pick position is empty, invalid, or exceeds numTeams, default to 1
    if (!userPickPosition || userPickPosition === '' || isNaN(pickPositionValue) || pickPositionValue < 1 || pickPositionValue > numTeamsValue) {
      setUserPickPosition('1');
    } else if (pickPositionValue > numTeamsValue) {
      // If numTeams decreased and pick position is now invalid, clamp to max
      setUserPickPosition(numTeamsValue.toString());
    }
  }, [numTeams, userPickPosition]);
  
  // Don't redirect - allow viewing the page without auth

  const startDraft = async () => {
    if (!draftName.trim()) {
      toast.error('Please enter a draft name');
      return;
    }

    setLoading(true);

    try {
      // Validate and clamp numTeams between 4 and 32
      let validatedNumTeams = parseInt(numTeams) || 12;
      if (validatedNumTeams < 4) {
        validatedNumTeams = 4;
        setNumTeams('4');
      } else if (validatedNumTeams > 32) {
        validatedNumTeams = 32;
        setNumTeams('32');
      }

      // Validate and ensure userPickPosition is always valid (default to 1 if empty or invalid)
      let validatedPickPosition = parseInt(userPickPosition) || 1;
      if (isNaN(validatedPickPosition) || validatedPickPosition < 1) {
        validatedPickPosition = 1;
        setUserPickPosition('1');
      } else if (validatedPickPosition > validatedNumTeams) {
        validatedPickPosition = validatedNumTeams;
        setUserPickPosition(validatedNumTeams.toString());
      }

      const numRounds = calculateRounds();
      
      // Get settings from selectedLeague for logged-in users, or tempSettingsStorage for guests
      let draftOrder = 'snake';
      let scoringFormat = 'ppr';
      let leagueType = 'season';
      let isSuperflex = false;
      let positionLimits: any = undefined;
      let effectivePlayerPool = playerPool;

      if (user && selectedLeague) {
        draftOrder = (selectedLeague as any)?.draft_order || 'snake';
        scoringFormat = (selectedLeague as any)?.scoring_format || 'ppr';
        leagueType = (selectedLeague as any)?.league_type || 'season';
        isSuperflex = (selectedLeague as any)?.is_superflex || false;
        positionLimits = selectedLeague?.position_limits as any;
        // If league has rookies_only, force player pool to rookies
        if ((selectedLeague as any)?.rookies_only && leagueType === 'dynasty') {
          effectivePlayerPool = 'rookies';
          setPlayerPool('rookies');
        }
        
        // Validate position limits against number of teams (especially DEF limit)
        if (positionLimits) {
          const defLimit = positionLimits.DEF || 3;
          const maxDefLimit = Math.floor(32 / validatedNumTeams);
          
          // If DEF limit would prevent all teams from getting a defense, adjust it
          if (defLimit * validatedNumTeams > 32) {
            const adjustedDefLimit = Math.max(1, maxDefLimit);
            positionLimits = {
              ...positionLimits,
              DEF: adjustedDefLimit,
            };
          }
        }
      } else if (!user) {
        const tempSettings = tempSettingsStorage.get();
        draftOrder = tempSettings?.draftOrder || 'snake';
        scoringFormat = tempSettings?.scoringFormat || 'ppr';
        leagueType = tempSettings?.leagueType || 'season';
        isSuperflex = tempSettings?.isSuperflex || false;
        positionLimits = tempSettings?.positionLimits;
        if (tempSettings?.rookiesOnly && leagueType === 'dynasty') {
          effectivePlayerPool = 'rookies';
          setPlayerPool('rookies');
        }
        
        // Validate position limits against number of teams (especially DEF limit)
        if (positionLimits) {
          const defLimit = positionLimits.DEF || 3;
          const maxDefLimit = Math.floor(32 / validatedNumTeams);
          
          // If DEF limit would prevent all teams from getting a defense, adjust it
          if (defLimit * validatedNumTeams > 32) {
            const adjustedDefLimit = Math.max(1, maxDefLimit);
            positionLimits = {
              ...positionLimits,
              DEF: adjustedDefLimit,
            };
          }
        }
      }
      
      const isDynasty = leagueType === 'dynasty';
      
      // Save settings to localStorage for non-logged-in users
      if (!user) {
        tempSettingsStorage.save({
          numTeams: validatedNumTeams,
          userPickPosition: validatedPickPosition,
          pickTimer: pickTimer === '0' ? 0 : parseInt(pickTimer),
          cpuSpeed,
          playerPool: isDynasty ? effectivePlayerPool : undefined,
          rookiesOnly: isDynasty && effectivePlayerPool === 'rookies',
          positionLimits: positionLimits,
          isSuperflex: isSuperflex,
          draftOrder,
          scoringFormat,
          leagueType,
        });
      }

      // For non-logged-in users, create a temporary draft
      if (!user) {
        const tempDraftId = generateTempDraftId();
        const tempDraft: MockDraft = {
          id: tempDraftId,
          user_id: 'temp_user',
          name: draftName.trim(),
          num_teams: validatedNumTeams,
          num_rounds: numRounds,
          user_pick_position: validatedPickPosition,
          draft_order: draftOrder,
          scoring_format: scoringFormat,
          status: 'in_progress',
          created_at: new Date().toISOString(),
          completed_at: null,
          league_id: null,
          pick_timer: pickTimer === '0' ? 0 : parseInt(pickTimer),
          cpu_speed: cpuSpeed,
          player_pool: isDynasty ? effectivePlayerPool : undefined,
          cpu_archetypes: assignRandomNamedArchetypesForDraft(validatedNumTeams, validatedPickPosition),
        } as MockDraft;

        // Save temporary draft
        tempDraftStorage.saveDraft(tempDraft, []);
        
        toast.info('Draft started! Note: This draft will not be saved when you leave the page.');
        navigate(`/draft/${tempDraftId}`);
        return;
      }

      // For logged-in users, create draft in database
      console.log('Creating draft with cpu_speed:', cpuSpeed);
      const { data, error } = await supabase
        .from('mock_drafts')
        .insert({
          user_id: user.id,
          name: draftName.trim(),
          num_teams: validatedNumTeams,
          num_rounds: numRounds,
          user_pick_position: validatedPickPosition,
          draft_order: draftOrder,
          scoring_format: scoringFormat,
          status: 'in_progress',
          league_id: selectedLeague?.id || null,
          pick_timer: pickTimer === '0' ? 0 : parseInt(pickTimer),
          player_pool: isDynasty ? effectivePlayerPool : null,
          cpu_speed: cpuSpeed, // Always include cpu_speed
        } as any)
        .select()
        .single();
      
      if (error) {
        console.error('Error creating draft with cpu_speed:', error);
        console.error('Error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
      }

      if (error) {
        // Check if error is related to cpu_speed (column missing or constraint violation)
        const isCpuSpeedError = 
          error.message?.includes('cpu_speed') || 
          error.message?.includes('cup_speed') ||
          error.message?.includes('check constraint') ||
          error.message?.includes('mock_drafts_cpu_speed_check') ||
          (error.code === '23514' && error.message?.includes('cpu_speed')); // PostgreSQL check constraint violation
        
        if (isCpuSpeedError) {
          console.warn('cpu_speed column/constraint issue:', error.message);
          console.warn('Attempted cpu_speed value:', cpuSpeed);
          console.warn('This usually means the migration needs to be updated to include "rapid" in the constraint');
          
          // If it's a constraint violation for 'rapid', try with 'normal' instead
          if (cpuSpeed === 'rapid' && error.message?.includes('check constraint')) {
            console.warn('Constraint violation for "rapid", trying with "normal" instead');
            const { data: retryData, error: retryError } = await supabase
              .from('mock_drafts')
              .insert({
                user_id: user.id,
                name: draftName.trim(),
                num_teams: validatedNumTeams,
                num_rounds: numRounds,
                user_pick_position: validatedPickPosition,
                draft_order: draftOrder,
                scoring_format: scoringFormat,
                status: 'in_progress',
                league_id: selectedLeague?.id || null,
                pick_timer: pickTimer === '0' ? 0 : parseInt(pickTimer),
                player_pool: isDynasty ? effectivePlayerPool : null,
                cpu_speed: 'normal', // Fallback to normal if rapid isn't allowed
              } as any)
              .select()
              .single();
            
            if (retryError) throw retryError;
            toast.warning('CPU speed "rapid" not available. Using "normal" instead. Please update the database constraint to include "rapid".');
            navigate(`/draft/${retryData.id}`);
            return;
          }
          
          // Column doesn't exist, retry without cpu_speed
          console.warn('Creating draft without cpu_speed. Please apply migration.');
          const { data: retryData, error: retryError } = await supabase
            .from('mock_drafts')
            .insert({
              user_id: user.id,
              name: draftName.trim(),
              num_teams: validatedNumTeams,
              num_rounds: numRounds,
              user_pick_position: validatedPickPosition,
              draft_order: draftOrder,
              scoring_format: scoringFormat,
              status: 'in_progress',
            league_id: selectedLeague?.id || null,
            pick_timer: pickTimer === '0' ? 0 : parseInt(pickTimer),
            player_pool: isDynasty ? effectivePlayerPool : null,
          } as any)
            .select()
            .single();
          
          if (retryError) throw retryError;
          navigate(`/draft/${retryData.id}`);
          return;
        }
        throw error;
      }
      
      console.log('Draft created successfully with cpu_speed:', cpuSpeed, 'data:', data);

      navigate(`/draft/${data.id}`);
    } catch (error: any) {
      console.error('Error creating draft:', error);
      toast.error(`Failed to create draft: ${error?.message || 'Unknown error'}`);
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
            <FootballHelmetIcon className="w-10 h-10 text-primary-foreground" />
          </div>
          <h1 className="font-display text-4xl tracking-wide mb-2">NEW MOCK DRAFT</h1>
          <p className="text-muted-foreground">Configure your draft settings</p>
        </div>

        <div className="glass-card p-6 space-y-6">
          {selectedLeague && (
            <div className="bg-primary/10 border border-primary/30 rounded-lg p-3 mb-4">
              <p className="text-sm text-primary font-medium">
                Using settings from: <span className="font-semibold">{selectedLeague.name}</span>
              </p>
            </div>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="draftName">Draft Name</Label>
            <Input
              id="draftName"
              name="draftName"
              placeholder="e.g., Mock Draft #1"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              className="bg-secondary/50 border-border/50"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2" htmlFor="numTeams">
                <Users className="w-4 h-4 text-muted-foreground" />
                Number of Teams
                {selectedLeague && (
                  <span className="text-xs text-primary ml-1">(from league)</span>
                )}
                <span className="text-xs text-muted-foreground ml-1">(4-32)</span>
              </Label>
              <Input
                id="numTeams"
                type="number"
                min={4}
                max={32}
                value={numTeams}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '') {
                    setNumTeams('');
                    return;
                  }
                  // Remove any non-numeric characters
                  const cleanedValue = value.replace(/[^0-9]/g, '');
                  if (cleanedValue === '') {
                    setNumTeams('');
                    return;
                  }
                  
                  // CRITICAL: Prevent more than 2 digits - if user tries to type a 3rd digit, immediately set to 32
                  if (cleanedValue.length > 2) {
                    setNumTeams('32');
                    return;
                  }
                  
                  const numValue = parseInt(cleanedValue);
                  
                  // If value is > 32, clamp to 32
                  if (!isNaN(numValue) && numValue > 32) {
                    setNumTeams('32');
                    return;
                  }
                  
                  // Allow typing any number, validation happens on blur
                  if (!isNaN(numValue)) {
                    setNumTeams(cleanedValue);
                  }
                }}
                onKeyDown={(e) => {
                  const input = e.currentTarget;
                  const currentValue = input.value.replace(/[^0-9]/g, ''); // Get only digits
                  const key = e.key;
                  
                  // Allow: backspace, delete, tab, escape, enter, arrow keys
                  if (['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(key)) {
                    return;
                  }
                  
                  // Allow: Ctrl/Cmd + A, C, V, X
                  if ((e.ctrlKey || e.metaKey) && ['a', 'c', 'v', 'x'].includes(key.toLowerCase())) {
                    return;
                  }
                  
                  // If it's a number key
                  if (/[0-9]/.test(key)) {
                    // CRITICAL: If current value already has 2 digits, prevent typing a 3rd digit
                    if (currentValue.length >= 2) {
                      e.preventDefault();
                      // Immediately set to 32 if they try to type a 3rd digit
                      setNumTeams('32');
                      return;
                    }
                    
                    // Check if adding this digit would exceed 32
                    const newValue = currentValue === '' ? key : currentValue + key;
                    const numValue = parseInt(newValue);
                    
                    // If the new value would exceed 32, prevent the input and set to 32
                    if (!isNaN(numValue) && numValue > 32) {
                      e.preventDefault();
                      setNumTeams('32');
                      return;
                    }
                  }
                  
                  // Block any other characters (non-numeric)
                  if (!/[0-9]/.test(key)) {
                    e.preventDefault();
                  }
                }}
                onPaste={(e) => {
                  // Handle paste to prevent pasting large numbers
                  e.preventDefault();
                  const pastedText = e.clipboardData.getData('text');
                  const cleanedValue = pastedText.replace(/[^0-9]/g, '');
                  
                  // CRITICAL: If pasted value has more than 2 digits, immediately set to 32
                  if (cleanedValue.length > 2) {
                    setNumTeams('32');
                    // Force the input value to 32 immediately to prevent freezing
                    const target = e.currentTarget;
                    setTimeout(() => {
                      target.value = '32';
                      setNumTeams('32');
                    }, 0);
                    return;
                  }
                  
                  if (cleanedValue) {
                    const numValue = parseInt(cleanedValue);
                    if (!isNaN(numValue)) {
                      // Clamp to 4-32 range
                      const clampedValue = Math.max(4, Math.min(32, numValue));
                      setNumTeams(clampedValue.toString());
                    }
                  }
                }}
                onInput={(e) => {
                  // Additional safeguard: check on input event
                  const target = e.currentTarget;
                  const value = target.value.replace(/[^0-9]/g, '');
                  
                  // CRITICAL: If value has more than 2 digits, immediately set to 32
                  if (value.length > 2) {
                    setNumTeams('32');
                    // Force the input value to 32 immediately
                    setTimeout(() => {
                      target.value = '32';
                      setNumTeams('32');
                    }, 0);
                  } else {
                    // Also check if the numeric value exceeds 32
                    const numValue = parseInt(value);
                    if (!isNaN(numValue) && numValue > 32) {
                      setNumTeams('32');
                      setTimeout(() => {
                        target.value = '32';
                        setNumTeams('32');
                      }, 0);
                    }
                  }
                }}
                onBlur={(e) => {
                  const value = e.target.value;
                  if (value === '') {
                    setNumTeams('12');
                    return;
                  }
                  const numValue = parseInt(value);
                  if (isNaN(numValue) || numValue < 4) {
                    setNumTeams('4');
                  } else if (numValue > 32) {
                    setNumTeams('32');
                  } else {
                    setNumTeams(numValue.toString());
                  }
                }}
                className="bg-secondary/50 border-border/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                placeholder="12"
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-muted-foreground" />
                Your Pick Position
                {selectedLeague && (
                  <span className="text-xs text-primary ml-1">(from league)</span>
                )}
              </Label>
              <Select 
                value={userPickPosition || '1'} 
                onValueChange={(value) => {
                  // Ensure value is always valid
                  const numValue = parseInt(value) || 1;
                  const numTeamsValue = parseInt(numTeams) || 12;
                  const clampedValue = Math.max(1, Math.min(numTeamsValue, numValue));
                  setUserPickPosition(clampedValue.toString());
                }}
              >
                <SelectTrigger className="bg-secondary/50 border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: parseInt(numTeams) || 12 }, (_, i) => i + 1).map(
                    (n) => (
                      <SelectItem key={n} value={n.toString()}>
                        Pick #{n}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>
            
          </div>

          <div className="grid grid-cols-2 gap-4">
            {isDynasty && !isRookiesOnlyFromLeague && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-muted-foreground" />
                  Player Pool
                </Label>
                <Select value={playerPool} onValueChange={setPlayerPool}>
                  <SelectTrigger className="bg-secondary/50 border-border/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Players</SelectItem>
                    <SelectItem value="rookies">Rookies Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {isDynasty && isRookiesOnlyFromLeague && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-muted-foreground">
                  <Target className="w-4 h-4" />
                  Player Pool
                </Label>
                <div className="flex h-10 items-center rounded-md border border-input bg-secondary/50 px-3 py-2 text-sm">
                  Rookies only (from league settings)
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Timer className="w-4 h-4 text-muted-foreground" />
                Pick Timer
              </Label>
              <Select value={pickTimer} onValueChange={setPickTimer}>
                <SelectTrigger className="bg-secondary/50 border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">None</SelectItem>
                  <SelectItem value="15">15 seconds</SelectItem>
                  <SelectItem value="30">30 seconds</SelectItem>
                  <SelectItem value="45">45 seconds</SelectItem>
                  <SelectItem value="60">60 seconds</SelectItem>
                  <SelectItem value="90">90 seconds</SelectItem>
                  <SelectItem value="120">120 seconds</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <FootballHelmetIcon className="w-4 h-4 text-muted-foreground" />
                CPU Selection Speed
              </Label>
              <Select value={cpuSpeed} onValueChange={(value: 'slow' | 'normal' | 'fast' | 'rapid') => setCpuSpeed(value)}>
                <SelectTrigger className="bg-secondary/50 border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="slow">Slow</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="fast">Fast</SelectItem>
                  <SelectItem value="rapid">Rapid</SelectItem>
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
                  <FootballHelmetIcon className="w-5 h-5" />
                  Start Draft
                </>
              )}
            </Button>
            {!user && (
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Note: Drafts created without signing in will not be saved when you leave the page.
              </p>
            )}
          </div>
        </div>

        <div className="mt-8 glass-card p-4">
          <h3 className="font-display text-xl mb-3">DRAFT INFO</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>• <strong className="text-foreground">Snake Draft:</strong> Order reverses each round</li>
            <li>• <strong className="text-foreground">Linear Draft:</strong> Same order every round</li>
            <li>• Players are sorted by your rankings (or ADP if no rankings)</li>
          </ul>
        </div>
      </main>
    </div>
  );
};

export default MockDraft;
