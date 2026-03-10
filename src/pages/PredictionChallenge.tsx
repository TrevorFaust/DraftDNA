import { useEffect, useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { PlayerSearchCombobox } from '@/components/PlayerSearchCombobox';
import { PositionBadge } from '@/components/PositionBadge';
import { ShareCard } from '@/components/ShareCard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ArrowLeft, Loader2, CheckCircle2, Target, ChevronUp, ChevronDown, Instagram, Medal, Pencil, Lock, Info } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import type { Player } from '@/types/database';
import { toast } from 'sonner';
import { usePlayer2025Stats } from '@/hooks/usePlayer2025Stats';
import { OfficialRulesContent } from '@/components/OfficialRulesContent';
import { SITE_NAME, SEASON } from '@/constants/contest';
import { cn } from '@/lib/utils';

const TOP_N = 6;
const TERMS_STORAGE_KEY = 'pick_six_terms_accepted_v1';
// NFL 2026 season typically starts early September; entries close 8pm ET on first Sunday
const SEASON_START_DATE = new Date(`${SEASON}-09-01`);
const SEASON_STARTED = new Date() >= SEASON_START_DATE;
// 8:00 PM ET, Thursday September 3, 2026 (EDT = UTC-4)
const ENTRY_DEADLINE_ET = new Date('2026-09-03T20:00:00-04:00');
const SUBMISSIONS_LOCKED = new Date() >= ENTRY_DEADLINE_ET || SEASON_STARTED;
const POSITIONS = ['QB', 'RB', 'WR', 'TE', 'K', 'D/ST'] as const;

const POSITION_SUBHEADERS: Record<string, string> = {
  QB: 'The Signal Caller Sequence',
  RB: 'Bell-Cow Bruisers',
  WR: 'Target Share Titans',
  TE: 'The Red Zone Rippers',
  K: 'Mega Leg Longshots',
  'D/ST': 'Defensive Dawgs',
};

type PositionKey = (typeof POSITIONS)[number];

/** Tiebreaker placeholder template: (name) => full question. Uses SEASON. */
function getTiebreakerPlaceholder(position: string, name: string): string {
  const n = name || '...';
  const s = SEASON;
  const templates: Record<string, string> = {
    QB: `How many yards will ${n} throw for in the ${s} season`,
    RB: `How many yards will ${n} rush for in the ${s} season`,
    WR: `How many receiving yards will ${n} have in the ${s} season`,
    TE: `How many receiving yards will ${n} have in the ${s} season`,
    K: `How many field goals will ${n} make in the ${s} season`,
    'D/ST': `How many points will ${n} allow in the ${s} season`,
  };
  return templates[position] ?? `Tiebreaker for ${n} in the ${s} season`;
}

type PredictionsState = Record<PositionKey, (Player | null)[]>;
type TiebreakersState = Record<PositionKey, number | null>;

const initialPredictions = (): PredictionsState =>
  Object.fromEntries(POSITIONS.map((p) => [p, Array(TOP_N).fill(null)])) as PredictionsState;

const initialTiebreakers = (): TiebreakersState =>
  Object.fromEntries(POSITIONS.map((p) => [p, null])) as TiebreakersState;

export default function PredictionChallenge() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [predictions, setPredictions] = useState<PredictionsState>(initialPredictions);
  const [tiebreakers, setTiebreakers] = useState<TiebreakersState>(initialTiebreakers);
  const [tiebreakerFocused, setTiebreakerFocused] = useState<PositionKey | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingPosition, setSavingPosition] = useState<PositionKey | null>(null);
  const [savedPositions, setSavedPositions] = useState<Set<PositionKey>>(new Set());
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [sharePosition, setSharePosition] = useState<PositionKey | null>(null);
  const [editingPosition, setEditingPosition] = useState<PositionKey | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState<boolean | null>(null);
  const [termsAgeChecked, setTermsAgeChecked] = useState(false);
  const [termsRulesChecked, setTermsRulesChecked] = useState(false);
  const [termsBotChecked, setTermsBotChecked] = useState(false);
  const playerStats = usePlayer2025Stats();

  const termsDialogOpen = user != null && termsAccepted === false;

  useEffect(() => {
    if (!authLoading && !user) {
      setLoading(false);
    }
  }, [authLoading, user]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const accepted = localStorage.getItem(TERMS_STORAGE_KEY) === 'true';
    setTermsAccepted(accepted);
  }, [user]);

  const loadExisting = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_season_predictions')
        .select('position, rank, players(id, name, position, team)')
        .eq('user_id', user.id)
        .eq('season', SEASON);

      if (error) {
        if ((error as { code?: string }).code === '42P01') {
          setSavedPositions(new Set());
          setPredictions(initialPredictions());
          setTiebreakers(initialTiebreakers());
          return;
        }
        throw error;
      }

      if (!data || data.length === 0) {
        setSavedPositions(new Set());
        setPredictions(initialPredictions());
        setTiebreakers(initialTiebreakers());
        return;
      }

      const saved = new Set<PositionKey>();
      data.forEach((row: { position: string }) => {
        if (POSITIONS.includes(row.position as PositionKey)) {
          saved.add(row.position as PositionKey);
        }
      });
      setSavedPositions(saved);
      const next = initialPredictions();
      data.forEach((row: { position: string; rank: number; players: Player | null }) => {
        const pos = row.position as PositionKey;
        if (POSITIONS.includes(pos) && row.rank >= 1 && row.rank <= TOP_N && row.players) {
          next[pos][row.rank - 1] = row.players as Player;
        }
      });
      setPredictions(next);

      const { data: tbData, error: tbErr } = await supabase
        .from('user_season_tiebreakers')
        .select('position, tiebreaker_value')
        .eq('user_id', user.id)
        .eq('season', SEASON);
      if (!tbErr && tbData && tbData.length > 0) {
        const tbNext = { ...initialTiebreakers() };
        tbData.forEach((row: { position: string; tiebreaker_value: number }) => {
          if (POSITIONS.includes(row.position as PositionKey)) {
            tbNext[row.position as PositionKey] = Number(row.tiebreaker_value);
          }
        });
        setTiebreakers(tbNext);
      } else {
        setTiebreakers(initialTiebreakers());
      }
    } catch (err) {
      console.error('Failed to load predictions:', err);
      toast.error('Could not load your existing predictions.');
      setTiebreakers(initialTiebreakers());
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadExisting();
  }, [loadExisting]);

  const setSlot = (position: PositionKey, rankIndex: number, player: Player | null) => {
    setPredictions((prev) => {
      const arr = [...prev[position]];
      arr[rankIndex] = player;
      return { ...prev, [position]: arr };
    });
  };

  const moveSlot = (position: PositionKey, fromIndex: number, direction: 'up' | 'down') => {
    const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= TOP_N) return;
    setPredictions((prev) => {
      const arr = [...prev[position]];
      [arr[fromIndex], arr[toIndex]] = [arr[toIndex], arr[fromIndex]];
      return { ...prev, [position]: arr };
    });
  };

  const excludeIdsForPosition = (position: PositionKey, currentSlotIndex?: number) => {
    const arr = predictions[position].filter(Boolean) as Player[];
    if (currentSlotIndex == null) return new Set(arr.map((p) => p.id));
    // Exclude other slots so we can pick/swap with them; allow current slot's player
    const others = arr.filter((_, i) => i !== currentSlotIndex);
    return new Set(others.map((p) => p.id));
  };

  const allFilled = (position: PositionKey) =>
    predictions[position].every((p) => p != null) && tiebreakers[position] != null;

  const setTiebreaker = (position: PositionKey, value: number | null) => {
    setTiebreakers((prev) => ({ ...prev, [position]: value }));
  };

  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/prediction-challenge`
    : '/prediction-challenge';

  const getShareCaption = useCallback(
    (variant: 'expert' | 'trash-talker', position: PositionKey) => {
      const topPlayer = predictions[position]?.[0];
      if (variant === 'expert') {
        return `80 million people play fantasy, but only a handful know the game this well. 🧠 My Top 6 ${position} Sequence is LOCKED. 🔒 Think you can beat my order?

${shareUrl}

#FantasyFootball #PerfectSequence #Top6`;
      }
      return `If you aren't picking ${topPlayer?.name ?? 'my #1'} as the #1 overall, you're living in 2025. 📉 My Perfect 6 is set. Come take my spot on the leaderboard if you're so smart. 😤

${shareUrl}`;
    },
    [predictions, shareUrl]
  );

  const handleCopyCaption = useCallback(
    async (variant: 'expert' | 'trash-talker') => {
      if (!sharePosition) return;
      const caption = getShareCaption(variant, sharePosition);
      try {
        await navigator.clipboard.writeText(caption);
        toast.success(
          variant === 'expert'
            ? 'Caption copied! Paste into X/Twitter.'
            : 'Caption copied! Paste into Instagram Stories.'
        );
      } catch {
        toast.error('Could not copy. Try selecting and copying manually.');
      }
    },
    [sharePosition, getShareCaption]
  );

  const handleAcceptTerms = () => {
    if (!termsAgeChecked || !termsRulesChecked || !termsBotChecked) return;
    localStorage.setItem(TERMS_STORAGE_KEY, 'true');
    setTermsAccepted(true);
    setTermsAgeChecked(false);
    setTermsRulesChecked(false);
    setTermsBotChecked(false);
  };

  const handleSavePosition = async (position: PositionKey) => {
    if (!user) return;
    if (!predictions[position].every((p) => p != null)) {
      toast.error(`Fill all 6 ${position} slots before submitting.`);
      return;
    }
    if (tiebreakers[position] == null) {
      toast.error('Enter the tiebreaker before submitting.');
      return;
    }
    setSavingPosition(position);
    try {
      // One entry per user per position: delete existing for this position then insert new rows.
      // This ensures edits override the previous entry and the user still has only 1 entry per position group.
      const { error: delErr } = await supabase
        .from('user_season_predictions')
        .delete()
        .eq('user_id', user.id)
        .eq('season', SEASON)
        .eq('position', position);

      if (delErr) throw delErr;

      const rows: { user_id: string; season: number; position: string; rank: number; player_id: string }[] = [];
      predictions[position].forEach((player, i) => {
        if (player) {
          rows.push({
            user_id: user.id,
            season: SEASON,
            position,
            rank: i + 1,
            player_id: player.id,
          });
        }
      });

      if (rows.length > 0) {
        const { error } = await supabase.from('user_season_predictions').insert(rows);
        if (error) throw error;
      }

      const tbVal = tiebreakers[position];
      if (tbVal != null) {
        const { error: tbError } = await supabase
          .from('user_season_tiebreakers')
          .upsert(
            { user_id: user.id, season: SEASON, position, tiebreaker_value: tbVal },
            { onConflict: ['user_id', 'season', 'position'] }
          );
        if (tbError) throw tbError;
      }

      setSavedPositions((prev) => new Set([...prev, position]));
      setEditingPosition((prev) => (prev === position ? null : prev));
      toast.success(`Saved top ${position} picks.`);
      setSharePosition(position);
      setShareDialogOpen(true);
    } catch (err) {
      console.error('Failed to save predictions:', err);
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('42P01')) {
        toast.error('Predictions are not available yet. Please run the database migration and try again.');
      } else {
        toast.error('Failed to save. Please try again.');
      }
    } finally {
      setSavingPosition(null);
    }
  };

  if (authLoading || (user && loading)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className={cn('relative', !user && 'min-h-[60vh]')}>
          {!user && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-background/85 backdrop-blur-[2px]">
              <div className="glass-card p-8 max-w-sm text-center space-y-4 mx-4">
                <p className="text-muted-foreground font-medium">
                  Sign in to access this feature.
                </p>
                <p className="text-sm text-muted-foreground">
                  You must be signed in to enter the Pick Six Challenge.
                </p>
                <Button onClick={() => navigate('/auth')} className="bg-primary text-primary-foreground">
                  Sign In
                </Button>
              </div>
            </div>
          )}
          <div className={cn(!user && 'opacity-50 pointer-events-none select-none')}>
        <div className="mb-8">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm mb-4"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </Link>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
              <Target className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-display text-3xl tracking-wide">
                Pick Six Challenge
              </h1>
              <p className="text-muted-foreground text-sm mt-1">
                Pick the top {TOP_N} fantasy finishers (in order) per position. Win $5k per position if you’re right!
              </p>
            </div>
          </div>
        </div>

        {/* Rules & How it Works */}
        <Collapsible open={rulesOpen} onOpenChange={setRulesOpen} className="glass-card mb-8">
          <CollapsibleTrigger className="flex w-full items-center justify-between p-6 text-left hover:opacity-90 transition-opacity">
            <h2 className="font-display text-lg flex items-center gap-2">
              <Info className="w-5 h-5 text-amber-500" />
              Rules & How it Works
            </h2>
            <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform ${rulesOpen ? 'rotate-180' : ''}`} />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="space-y-4 text-sm text-muted-foreground px-6 pb-6 pt-0 -mt-2">
            <div>
              <h3 className="font-medium text-foreground mb-1">Fantasy Scoring</h3>
              <p className="mb-2">Actual rankings are based on fantasy points scored. All points use half PPR (0.5 per reception).</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="space-y-1">
                  <h4 className="text-foreground font-semibold">Passing</h4>
                  <ul className="text-muted-foreground space-y-0.5">
                    <li>Per passing yard: 0.04</li>
                    <li>TD pass: 4</li>
                    <li>Interception: -2</li>
                    <li>2pt passing conversion: 2</li>
                  </ul>
                </div>
                <div className="space-y-1">
                  <h4 className="text-foreground font-semibold">Rushing</h4>
                  <ul className="text-muted-foreground space-y-0.5">
                    <li>Per rushing yard: 0.1</li>
                    <li>TD rush: 6</li>
                    <li>2pt rushing conversion: 2</li>
                  </ul>
                </div>
                <div className="space-y-1">
                  <h4 className="text-foreground font-semibold">Receiving</h4>
                  <ul className="text-muted-foreground space-y-0.5">
                    <li>Per receiving yard: 0.1</li>
                    <li>Per reception: 0.5</li>
                    <li>TD reception: 6</li>
                    <li>2pt receiving conversion: 2</li>
                  </ul>
                </div>
                <div className="space-y-1">
                  <h4 className="text-foreground font-semibold">Kicking</h4>
                  <ul className="text-muted-foreground space-y-0.5">
                    <li>PAT made: 1</li>
                    <li>FG missed: -1</li>
                    <li>FG made (0–39 yards): 3</li>
                    <li>FG made (40–49 yards): 4</li>
                    <li>FG made (50–59 yards): 5</li>
                    <li>FG made (60+ yards): 6</li>
                  </ul>
                </div>
                <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <h4 className="text-foreground font-semibold">Team Defense / Special Teams</h4>
                    <p className="text-muted-foreground text-xs font-medium mb-1">Points allowed</p>
                    <ul className="text-muted-foreground space-y-0.5">
                      <li>0 points allowed: 5</li>
                      <li>1–6 points allowed: 4</li>
                      <li>7–13 points allowed: 3</li>
                      <li>14–17 points allowed: 1</li>
                      <li>28–34 points allowed: -1</li>
                      <li>35–45 points allowed: -3</li>
                      <li>46+ points allowed: -5</li>
                    </ul>
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-foreground font-semibold sm:invisible">&#8203;</h4>
                    <p className="text-muted-foreground text-xs font-medium mb-1">Yards allowed</p>
                    <ul className="text-muted-foreground space-y-0.5">
                      <li>&lt;100 yards allowed: 5</li>
                      <li>100–199 yards allowed: 3</li>
                      <li>200–299 yards allowed: 2</li>
                      <li>350–399 yards allowed: -1</li>
                      <li>400–449 yards allowed: -3</li>
                      <li>450–499 yards allowed: -5</li>
                      <li>500–549 yards allowed: -6</li>
                      <li>550+ yards allowed: -7</li>
                    </ul>
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-foreground font-semibold sm:invisible">&#8203;</h4>
                    <p className="text-muted-foreground text-xs font-medium mb-1">Sacks, turnovers, return TDs</p>
                    <ul className="text-muted-foreground space-y-0.5">
                      <li>Kickoff return TD: 6</li>
                      <li>Punt return TD: 6</li>
                      <li>Interception return TD: 6</li>
                      <li>Fumble return TD: 6</li>
                      <li>Blocked punt/FG return TD: 6</li>
                      <li>2pt return: 2</li>
                      <li>1pt safety: 1</li>
                      <li>Sack: 1</li>
                      <li>Blocked punt/PAT/FG: 2</li>
                      <li>Interception: 2</li>
                      <li>Fumble recovered: 2</li>
                      <li>Safety: 2</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
            <div>
              <h3 className="font-medium text-foreground mb-1">Per-Position Leaderboards</h3>
              <p>You have 6 separate ranks — one per position (QB, RB, WR, TE, K, D/ST). Each position has its own leaderboard.</p>
            </div>
            <div>
              <h3 className="font-medium text-foreground mb-1">Leaderboard Scoring</h3>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li><strong>Exact match</strong> (correct rank) = 1 point</li>
                <li><strong>1 off</strong> (e.g. you ranked 4th, actual 3rd) = ½ point</li>
                <li><strong>2 off</strong> = ⅓ point</li>
                <li><strong>3 off</strong> = ¼ point</li>
                <li><strong>4 off</strong> = ⅕ point</li>
                <li><strong>5 off</strong> = ⅙ point</li>
                <li><strong>6+ off</strong> = 0 points</li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium text-foreground mb-1">Weekly Updates</h3>
              <p>Leaderboards are updated weekly based on current fantasy leaders (typically from ESPN). Your score is calculated from your submitted picks vs. the current top 6 in fantasy points.</p>
            </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <Tabs defaultValue={POSITIONS[0]} className="space-y-6">
          <TabsList className="grid w-full grid-cols-6 h-auto">
            {POSITIONS.map((pos) => (
              <TabsTrigger key={pos} value={pos} className="text-xs sm:text-sm">
                <PositionBadge position={pos} />
              </TabsTrigger>
            ))}
          </TabsList>

          {POSITIONS.map((position) => (
            <TabsContent key={position} value={position} className="space-y-4 mt-6">
              <p className="text-amber-600 dark:text-amber-400 text-base font-bold tracking-wide text-center w-full">
                {POSITION_SUBHEADERS[position] ?? `The ${position} Order`}
              </p>

              {savedPositions.has(position) && editingPosition !== position ? (
                <div className="flex flex-col md:flex-row gap-6">
                  <div className="flex-1 md:max-w-[50%] glass-card p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-display text-lg flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                        Your Top {TOP_N}
                      </h3>
                      {!SUBMISSIONS_LOCKED ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          onClick={() => setEditingPosition(position)}
                        >
                          <Pencil className="w-4 h-4" />
                          Edit
                        </Button>
                      ) : (
                        <span className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Lock className="w-4 h-4" />
                          Locked
                        </span>
                      )}
                    </div>
                    <div className="space-y-2">
                      {predictions[position].filter(Boolean).map((player, i) => (
                        <div key={player!.id} className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
                          <span className="text-muted-foreground font-mono w-6 shrink-0 text-sm">
                            #{i + 1}
                          </span>
                          <PositionBadge position={player!.position} className="shrink-0" />
                          <span className="font-medium truncate">{player!.name}</span>
                          {player!.team && (
                            <span className="text-sm text-muted-foreground shrink-0">{player!.team}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex-1 md:max-w-[50%] glass-card p-6 flex flex-col justify-center">
                    {SUBMISSIONS_LOCKED && (
                      <p className="text-sm text-muted-foreground mb-4 flex items-center gap-2">
                        <Lock className="w-4 h-4 shrink-0" />
                        Predictions are locked. The NFL season has started.
                      </p>
                    )}
                    {SUBMISSIONS_LOCKED ? (
                      <div>
                        <h3 className="font-display text-lg mb-2 flex items-center gap-2">
                          <Medal className="w-5 h-5 text-amber-500" />
                          Leaderboard
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Position leaderboard will be available once the {SEASON} season is complete.
                        </p>
                      </div>
                    ) : (
                      <div>
                        <h3 className="font-display text-lg mb-2 flex items-center gap-2">
                          <Medal className="w-5 h-5 text-amber-500" />
                          Leaderboard
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          The leaderboard will be available when the {SEASON} season starts.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  {SUBMISSIONS_LOCKED && (
                    <p className="text-sm text-amber-600 dark:text-amber-400 text-center mb-4 flex items-center justify-center gap-2">
                      <Lock className="w-4 h-4 shrink-0" />
                      Predictions are locked. The NFL season has started.
                    </p>
                  )}
                  <p className="text-muted-foreground text-sm text-center">
                    Select your top {TOP_N} {position === 'D/ST' ? 'Defenses' : `${position}s`} for the {SEASON} season in order for a chance to win.
                  </p>
                  <div className="flex flex-col items-center">
                    <div className="space-y-2 w-full max-w-md">
                      {Array.from({ length: TOP_N }, (_, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-muted-foreground font-mono w-6 shrink-0 text-sm">
                            #{i + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <PlayerSearchCombobox
                              value={predictions[position][i]}
                              onChange={(p) => setSlot(position, i, p)}
                              positionFilter={position}
                              excludePlayerIds={excludeIdsForPosition(position, i)}
                              placeholder={`Search ${position}...`}
                              className="h-9 text-sm"
                            />
                          </div>
                          <div className="flex shrink-0">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              disabled={!predictions[position][i] || i === 0}
                              onClick={() => moveSlot(position, i, 'up')}
                              aria-label="Move up"
                            >
                              <ChevronUp className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              disabled={!predictions[position][i] || i === TOP_N - 1}
                              onClick={() => moveSlot(position, i, 'down')}
                              aria-label="Move down"
                            >
                              <ChevronDown className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                      <div className="mt-4 pt-4 border-t border-border space-y-1 w-full">
                        <label htmlFor={`tiebreaker-${position}`} className="text-xs font-medium text-muted-foreground">
                          Tiebreaker
                        </label>
                        <p className="text-sm text-muted-foreground">
                          {getTiebreakerPlaceholder(position, predictions[position]?.[0]?.name ?? '...')}
                        </p>
                        <Input
                          id={`tiebreaker-${position}`}
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          autoComplete="off"
                          value={
                            tiebreakerFocused === position
                              ? tiebreakers[position] != null ? String(tiebreakers[position]) : ''
                              : tiebreakers[position] != null ? tiebreakers[position]!.toLocaleString() : ''
                          }
                          onFocus={() => setTiebreakerFocused(position)}
                          onBlur={() => setTiebreakerFocused(null)}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/\D/g, '');
                            const num = raw === '' ? null : Math.min(9999, parseInt(raw, 10));
                            setTiebreaker(position, num);
                          }}
                          className="h-9 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="pt-4 flex items-center justify-center gap-3">
                    {savedPositions.has(position) && !SUBMISSIONS_LOCKED && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingPosition(null)}
                      >
                        Cancel
                      </Button>
                    )}
                    <Button
                      onClick={() => handleSavePosition(position)}
                      disabled={savingPosition === position || !allFilled(position) || SUBMISSIONS_LOCKED}
                      variant="default"
                      size="sm"
                      className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white"
                    >
                      {savingPosition === position ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        `Submit ${position} picks`
                      )}
                    </Button>
                  </div>
                </>
              )}
            </TabsContent>
          ))}
        </Tabs>
          </div>
        </div>

        {/* Legal / Terms Dialog - First-time only */}
        <Dialog
          open={termsDialogOpen}
          onOpenChange={(open) => {
            if (!open && termsAccepted !== true) {
              navigate('/dashboard');
            }
          }}
        >
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="text-xl font-display">
                Pick Six Challenge: Official Rules
              </DialogTitle>
            </DialogHeader>
            <OfficialRulesContent siteName={SITE_NAME} season={SEASON} />
            <div className="space-y-3 pt-4 border-t border-border shrink-0">
              <div className="flex items-center gap-3">
                <Checkbox
                  id="terms-age-checkbox"
                  checked={termsAgeChecked}
                  onCheckedChange={(c) => setTermsAgeChecked(c === true)}
                />
                <label htmlFor="terms-age-checkbox" className="text-sm font-medium leading-none cursor-pointer">
                  I am 18+ (19+ in AL/NE; 21+ in AZ/MA/VA) and not a resident of a Void State.
                </label>
              </div>
              <div className="flex items-center gap-3">
                <Checkbox
                  id="terms-rules-checkbox"
                  checked={termsRulesChecked}
                  onCheckedChange={(c) => setTermsRulesChecked(c === true)}
                />
                <label htmlFor="terms-rules-checkbox" className="text-sm font-medium leading-none cursor-pointer">
                  I agree to the Official Rules and the Arbitration Agreement.
                </label>
              </div>
              <div className="flex items-center gap-3">
                <Checkbox
                  id="terms-bot-checkbox"
                  checked={termsBotChecked}
                  onCheckedChange={(c) => setTermsBotChecked(c === true)}
                />
                <label htmlFor="terms-bot-checkbox" className="text-sm font-medium leading-none cursor-pointer">
                  (RECAPTCHA BOT CHECK)
                </label>
              </div>
            </div>
            <div className="flex justify-end pt-2 shrink-0">
              <Button
                onClick={handleAcceptTerms}
                disabled={!termsAgeChecked || !termsRulesChecked || !termsBotChecked}
                className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white"
              >
                Accept &amp; Continue
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Share Card Dialog - Centered trading-card style */}
        <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
          <DialogContent className="max-w-[560px] sm:max-w-[560px] max-h-[90vh] overflow-y-auto flex flex-col items-center p-0 rounded-2xl border-2 shadow-2xl">
            <DialogHeader className="sr-only">
              <DialogTitle>Share your Top 6</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col items-center justify-center gap-2 w-full shrink-0 px-5 pt-4 pb-6">
              {sharePosition && (
                <ShareCard
                  position={sharePosition}
                  season={SEASON}
                  players={predictions[sharePosition].filter(Boolean) as Player[]}
                  playerStats={
                    playerStats.size > 0
                      ? new Map(
                          [...playerStats.entries()].map(([id, s]) => [
                            id,
                            { totalFantasyPoints: s.totalFantasyPoints },
                          ])
                        )
                      : undefined
                  }
                  shareUrl={shareUrl}
                />
              )}
              <div className="flex items-center justify-center gap-3 w-full shrink-0">
                <span className="text-xs font-semibold text-muted-foreground">Share</span>
                <button
                  type="button"
                  onClick={() => handleCopyCaption('expert')}
                  className="p-2 rounded-lg border border-border hover:border-cyan-500/50 hover:bg-cyan-500/10 transition-colors"
                  aria-label="Copy caption for X"
                >
                  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current text-foreground" aria-hidden>
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => handleCopyCaption('trash-talker')}
                  className="p-2 rounded-lg border border-border hover:border-pink-500/50 hover:bg-pink-500/10 transition-colors"
                  aria-label="Copy caption for Instagram"
                >
                  <Instagram className="w-5 h-5 text-foreground" />
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
