import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useScoringFormat } from '@/hooks/useScoringFormat';
import { getFantasyPointsForFormat, getFantasyPointsBreakdown, type FantasyBreakdownInput } from '@/utils/fantasyPoints';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { PositionBadge } from './PositionBadge';
import { JerseyIcon } from './JerseyIcon';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Calendar, BarChart3 } from 'lucide-react';
import type { Player, NFLSchedule } from '@/types/database';
import { getFullTeamName } from '@/utils/teamMapping';
import type { Player2025Stats } from '@/hooks/usePlayer2025Stats';
import type { ScoringFormat } from '@/utils/fantasyPoints';
import { getAgeFromBirthDate } from '@/utils/playerAge';

function FantasyPointsWithBreakdown({
  displayValue,
  stats,
  scoringFormat,
}: {
  displayValue: string;
  stats: FantasyBreakdownInput;
  scoringFormat: ScoringFormat;
}) {
  const breakdown = getFantasyPointsBreakdown(stats, scoringFormat);
  if (breakdown.length === 0) {
    return <span className="font-semibold text-primary">{displayValue}</span>;
  }
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="font-semibold text-primary hover:underline cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary rounded"
        >
          {displayValue}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto max-w-xs p-3">
        <p className="text-xs font-semibold text-muted-foreground mb-2">Points breakdown</p>
        <div className="space-y-1.5 text-sm">
          {breakdown.map((item, i) => (
            <div key={i} className="flex justify-between gap-6 items-baseline">
              <span className="font-medium tabular-nums">
                {item.points >= 0 ? '+' : ''}{item.points.toFixed(1)} pts
              </span>
              <span className="text-muted-foreground">
                {item.statValue} {item.label}
              </span>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface PlayerDetailDialogProps {
  player: Player | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 2025 season fantasy points and position rank (e.g. QB1, RB9) - shown next to name in header */
  stats2025?: Player2025Stats | null;
}

interface TeamColors {
  team_color: string | null;
  team_color2: string | null;
  team_color3: string | null;
}

interface WeeklyStats {
  week: number;
  opponent_team: string | null;
  fantasy_points: number | null;
  fantasy_points_ppr: number | null;
  // Passing stats
  passing_yards: number | null;
  passing_tds: number | null;
  passing_interceptions: number | null;
  // Rushing stats
  rushing_yards: number | null;
  rushing_tds: number | null;
  carries: number | null;
  // Receiving stats
  receptions: number | null;
  receiving_yards: number | null;
  receiving_tds: number | null;
  targets: number | null;
  // Kicker stats
  fg_made: number | null;
  fg_att: number | null;
  pat_made: number | null;
  // Defense stats
  def_tds: number | null;
  def_interceptions: number | null;
  def_fumbles: number | null;
  def_sacks: number | null;
  // Fumbles (for QB Int/Fum display)
  fumbles: number | null;
  receiving_fumbles: number | null;
  rushing_fumbles: number | null;
  sack_fumbles: number | null;
  fumble_recovery_opp: number | null;
  [key: string]: any;
}

export const PlayerDetailDialog = ({ player, open, onOpenChange, stats2025 }: PlayerDetailDialogProps) => {
  const scoringFormat = useScoringFormat();
  const [stats, setStats] = useState<WeeklyStats[]>([]);
  const [schedule, setSchedule] = useState<NFLSchedule[]>([]);
  const [teamColors, setTeamColors] = useState<TeamColors | null>(null);
  const [playerAge, setPlayerAge] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState<2025 | 2026>(2025);
  // For RBs/WRs: 'rushing' or 'receiving', for QBs: 'passing' or 'rushing'
  const [statView, setStatView] = useState<'rushing' | 'receiving' | 'passing'>('rushing');

  useEffect(() => {
    if (player && open) {
      // Set default stat view based on position
      if (player.position === 'WR' || player.position === 'TE') {
        setStatView('receiving');
      } else if (player.position === 'QB') {
        setStatView('passing');
      } else {
        setStatView('rushing');
      }
      fetchPlayerData();
    }
  }, [player, open, selectedSeason]);

  const fetchPlayerData = async () => {
    if (!player) return;
    setLoading(true);
    setPlayerAge(null);

    try {
      // Fetch birth_date to calculate age (from nfl_players_historical or players_info)
      const espnId = player.espn_id != null ? String(player.espn_id) : null;
      let birthDateFound: string | null = null;
      if (espnId) {
        const { data: nflHist } = await supabase
          .from('nfl_players_historical')
          .select('birth_date')
          .eq('espn_id', espnId)
          .not('birth_date', 'is', null)
          .order('season', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (nflHist?.birth_date) birthDateFound = nflHist.birth_date;
        if (!birthDateFound) {
          const { data: pi } = await (supabase as any)
            .from('players_info')
            .select('birth_date')
            .eq('espn_id', espnId)
            .not('birth_date', 'is', null)
            .limit(1)
            .maybeSingle();
          if (pi?.birth_date) birthDateFound = pi.birth_date;
        }
        if (!birthDateFound) {
          const { data: pc } = await (supabase as any)
            .from('players_clean')
            .select('birth_date')
            .eq('espn_id', espnId)
            .not('birth_date', 'is', null)
            .limit(1)
            .maybeSingle();
          if (pc?.birth_date) birthDateFound = pc.birth_date;
        }
        if (birthDateFound) {
          const age = getAgeFromBirthDate(birthDateFound);
          if (age != null) setPlayerAge(age);
        }
      }
      if (selectedSeason === 2025) {
        // 1. Resolve gsis_id (weekly_stats uses GSIS format, not espn_id)
        let gsisId: string | null = null;
        if (player.espn_id) {
          const { data: dc } = await supabase
            .from('depth_charts_2025')
            .select('gsis_id')
            .eq('espn_id', player.espn_id)
            .limit(1)
            .maybeSingle();
          if (dc?.gsis_id) gsisId = dc.gsis_id;
          else {
            const { data: r } = await supabase
              .from('rosters_2025')
              .select('gsis_id')
              .eq('espn_id', player.espn_id)
              .limit(1)
              .maybeSingle();
            if (r?.gsis_id) gsisId = r.gsis_id;
          }
        }

        // 2. Get team for schedule: rosters_2025 (current team) or player.team
        let scheduleTeam: string | null = player.team ?? null;
        if (player.espn_id) {
          const { data: roster } = await supabase
            .from('rosters_2025')
            .select('team')
            .eq('espn_id', player.espn_id)
            .order('week', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (roster?.team) scheduleTeam = roster.team;
        }

        // 3. Fetch weekly_stats by gsis_id (or espn_id fallback)
        const statsId = gsisId || player.espn_id;
        let statsData: any[] = [];
        if (statsId) {
          const { data } = await supabase
            .from('weekly_stats_2025')
            .select('*')
            .eq('player_id', statsId)
            .lte('week', 18)
            .order('week', { ascending: true });
          statsData = data ?? [];
        }
        if (statsData.length === 0 && player.espn_id) {
          const { data } = await supabase
            .from('weekly_stats_2025')
            .select('*')
            .eq('player_id', player.espn_id)
            .lte('week', 18)
            .order('week', { ascending: true });
          statsData = data ?? [];
        }
        if (statsData.length === 0) {
          const lastName = player.name.split(' ').pop() || '';
          let query = supabase
            .from('weekly_stats_2025')
            .select('*')
            .ilike('player_name', `%${lastName}%`)
            .lte('week', 18);
          if (player.team) query = query.eq('team', player.team);
          const { data } = await query.order('week', { ascending: true });
          statsData = data ?? [];
        }

        // 4. Build per-week team map for traded players (use team from weekly_stats when available)
        const teamByWeek = new Map<number, string>();
        let lastTeam = scheduleTeam;
        for (let w = 1; w <= 18; w++) {
          const s = statsData.find((x: any) => x.week === w);
          if (s?.team) {
            lastTeam = s.team;
            teamByWeek.set(w, s.team);
          } else if (lastTeam) {
            teamByWeek.set(w, lastTeam);
          } else if (scheduleTeam) {
            teamByWeek.set(w, scheduleTeam);
            lastTeam = scheduleTeam;
          }
        }
        const teams = [...new Set(teamByWeek.values())].filter(Boolean);
        const teamsToFetch = teams.length > 0 ? teams : (scheduleTeam ? [scheduleTeam] : []);

        // 5. Fetch games from games_2025 for the player's team(s)
        const teamGames = new Map<number, { opponent: string; gameday: string | null }>();
        if (teamsToFetch.length > 0) {
          const { data: games } = await supabase
            .from('games_2025')
            .select('week, home_team, away_team, gameday')
            .eq('season', 2025)
            .eq('game_type', 'REG')
            .lte('week', 18)
            .or(teamsToFetch.map(t => `home_team.eq.${t},away_team.eq.${t}`).join(','));
          if (games) {
            for (const g of games) {
              const team = teamByWeek.get(g.week!) || scheduleTeam;
              const home = g.home_team === team;
              const away = g.away_team === team;
              if (home || away) {
                const opponent = home ? g.away_team : g.home_team;
                teamGames.set(g.week!, { opponent: opponent ?? '', gameday: g.gameday ?? null });
              }
            }
          }
        }

        // 6. Merge: build allWeeks from team games + stats
        const statsByWeek = new Map(statsData.map((s: any) => [s.week, s]));
        const allWeeks: WeeklyStats[] = [];
        for (let week = 1; week <= 18; week++) {
          const game = teamGames.get(week);
          const opponent = game?.opponent || null;
          const isByeWeek = !opponent || opponent === '';
          const weekStat = statsByWeek.get(week);

          const mapStat = (s: any) => ({
            week,
            opponent_team: s.opponent_team || opponent || (isByeWeek ? 'BYE' : null),
            fantasy_points: s.fantasy_points,
            fantasy_points_ppr: s.fantasy_points_ppr,
            passing_yards: s.passing_yards,
            passing_tds: s.passing_tds,
            passing_interceptions: s.passing_interceptions,
            rushing_yards: s.rushing_yards,
            rushing_tds: s.rushing_tds,
            carries: s.carries,
            receptions: s.receptions,
            receiving_yards: s.receiving_yards,
            receiving_tds: s.receiving_tds,
            targets: s.targets,
            fg_made: s.fg_made,
            fg_att: s.fg_att,
            pat_made: s.pat_made,
            def_tds: s.def_tds,
            def_interceptions: s.def_interceptions,
            def_fumbles: s.def_fumbles,
            def_sacks: s.def_sacks,
            fumbles: ((s.receiving_fumbles || 0) + (s.rushing_fumbles || 0) + (s.sack_fumbles || 0)),
            receiving_fumbles: s.receiving_fumbles,
            rushing_fumbles: s.rushing_fumbles,
            sack_fumbles: s.sack_fumbles,
            fumble_recovery_opp: s.fumble_recovery_opp,
          });

          if (weekStat) {
            allWeeks.push(mapStat(weekStat));
          } else if (isByeWeek) {
            allWeeks.push({
              week,
              opponent_team: 'BYE',
              fantasy_points: null,
              fantasy_points_ppr: null,
              passing_yards: null,
              passing_tds: null,
              passing_interceptions: null,
              rushing_yards: null,
              rushing_tds: null,
              carries: null,
              receptions: null,
              receiving_yards: null,
              receiving_tds: null,
              targets: null,
              fg_made: null,
              fg_att: null,
              pat_made: null,
              def_tds: null,
              def_interceptions: null,
              def_fumbles: null,
              def_sacks: null,
              fumbles: null,
              receiving_fumbles: null,
              rushing_fumbles: null,
              sack_fumbles: null,
              fumble_recovery_opp: null,
            });
          } else {
            allWeeks.push({
              week,
              opponent_team: opponent,
              fantasy_points: null,
              fantasy_points_ppr: null,
              passing_yards: null,
              passing_tds: null,
              passing_interceptions: null,
              rushing_yards: null,
              rushing_tds: null,
              carries: null,
              receptions: null,
              receiving_yards: null,
              receiving_tds: null,
              targets: null,
              fg_made: null,
              fg_att: null,
              pat_made: null,
              def_tds: null,
              def_interceptions: null,
              def_fumbles: null,
              def_sacks: null,
              fumbles: null,
              receiving_fumbles: null,
              rushing_fumbles: null,
              sack_fumbles: null,
              fumble_recovery_opp: null,
            });
          }
        }

        setStats(allWeeks);
      } else {
        // 2026 - leave blank for now
        setStats([]);
      }

      // Fetch future schedule for player's team
      if (player.team) {
        const currentWeek = getCurrentNFLWeek();
        const { data: scheduleData } = await supabase
          .from('nfl_schedule')
          .select('*')
          .or(`home_team.eq.${player.team},away_team.eq.${player.team}`)
          .gte('week', currentWeek)
          .order('week', { ascending: true })
          .limit(10);

        setSchedule((scheduleData as NFLSchedule[]) || []);

        // Fetch team colors
        const fullTeamName = getFullTeamName(player.team);
        if (fullTeamName) {
          const { data: teamData } = await supabase
            .from('teams')
            .select('team_color, team_color2, team_color3')
            .eq('team_name', fullTeamName)
            .single();

          if (teamData) {
            setTeamColors({
              team_color: teamData.team_color,
              team_color2: teamData.team_color2,
              team_color3: teamData.team_color3,
            });
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch player data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCurrentNFLWeek = () => {
    const seasonStart = new Date('2025-09-04');
    const now = new Date();
    const diffTime = now.getTime() - seasonStart.getTime();
    const diffWeeks = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 7));
    return Math.max(1, Math.min(diffWeeks, 18));
  };

  const getStatsForView = (position: string, view: string) => {
    if (position === 'QB') {
      if (view === 'passing') {
        return [
          { key: 'passing_yards', label: 'Yds' },
          { key: 'passing_tds', label: 'TDs' },
          { key: 'int_fum', label: 'Int/Fum' }, // Combined stat
        ];
      } else {
        return [
          { key: 'rushing_yards', label: 'Yds' },
          { key: 'rushing_tds', label: 'TDs' },
        ];
      }
    } else if (position === 'RB' || position === 'FB') {
      if (view === 'rushing') {
        return [
          { key: 'carries', label: 'Att' },
          { key: 'rushing_yards', label: 'Yds' },
          { key: 'rushing_tds', label: 'TDs' },
        ];
      } else {
        return [
          { key: 'receptions', label: 'Rec' },
          { key: 'receiving_yards', label: 'Yds' },
          { key: 'receiving_tds', label: 'TDs' },
        ];
      }
    } else if (position === 'WR' || position === 'TE') {
      if (view === 'receiving') {
        return [
          { key: 'receptions', label: 'Rec' },
          { key: 'targets', label: 'Tgt' },
          { key: 'receiving_yards', label: 'Yds' },
          { key: 'receiving_tds', label: 'TDs' },
        ];
      } else {
        return [
          { key: 'carries', label: 'Att' },
          { key: 'rushing_yards', label: 'Yds' },
          { key: 'rushing_tds', label: 'TDs' },
        ];
      }
    } else if (position === 'K') {
      return [
        { key: 'fg_made', label: 'FGM' },
        { key: 'fg_att', label: 'FGA' },
        { key: 'pat_made', label: 'XPM' },
      ];
    } else if (position === 'D/ST') {
      return [
        { key: 'def_pa', label: 'PA' }, // Points allowed - placeholder for now
        { key: 'def_interceptions', label: 'INT' },
        { key: 'fumble_recovery_opp', label: 'FR' },
        { key: 'def_sacks', label: 'Sck' },
        { key: 'def_tds', label: 'TD' },
      ];
    }
    return [];
  };

  const getStatValue = (game: WeeklyStats, statKey: string) => {
    if (game.opponent_team === 'BYE') return '-';
    
    if (statKey === 'int_fum') {
      const ints = game.passing_interceptions || 0;
      const fums = game.fumbles || 0;
      if (ints === 0 && fums === 0) return '0/0';
      return `${ints}/${fums}`;
    }
    
    if (statKey === 'def_pa') {
      // Points allowed - placeholder for now (would need to fetch from game data)
      return '-';
    }
    
    const value = game[statKey];
    return value !== null && value !== undefined ? value : '-';
  };

  if (!player) return null;

  const statsForView = getStatsForView(player.position, statView);
  const showStatTabs = (player.position === 'QB' || player.position === 'RB' || player.position === 'FB' || player.position === 'WR' || player.position === 'TE');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col" aria-describedby={undefined}>
        <DialogHeader className="relative">
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="flex items-center gap-3 flex-wrap">
                <JerseyIcon
                  jerseyNumber={player.jersey_number}
                  primaryColor={teamColors?.team_color}
                  secondaryColor={teamColors?.team_color2}
                  tertiaryColor={teamColors?.team_color3}
                  size="md"
                />
                <span className="font-display text-2xl">{player.name}</span>
                <PositionBadge position={player.position} />
              </DialogTitle>
              <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap mt-1">
                <span>{player.team || 'Free Agent'}</span>
                <span>ADP: {player.adp}</span>
                {player.bye_week && <span>BYE: Week {player.bye_week}</span>}
                {playerAge != null && <span>Age: {playerAge}</span>}
              </div>
            </div>
            {stats2025 && (
              <div className="shrink-0 rounded-lg border-2 border-primary/30 bg-primary/5 px-5 py-4 min-w-[200px]">
                <p className="text-sm font-semibold text-foreground mb-3">2025 Stats</p>
                <div className="flex items-center justify-between gap-6 text-base mb-3">
                  <span><span className="text-muted-foreground">Pos Rk:</span> <span className="font-semibold">{stats2025.positionRank}</span></span>
                  <span>
                    <span className="text-muted-foreground">Pts:</span>{' '}
                    <FantasyPointsWithBreakdown
                      displayValue={stats2025.totalFantasyPoints.toFixed(1)}
                      stats={{
                        passing_yards: stats2025.totalPassYards,
                        passing_tds: stats2025.totalPassTds,
                        passing_interceptions: stats2025.totalInterceptions,
                        rushing_yards: stats2025.totalRushYards,
                        rushing_tds: stats2025.totalRushTds,
                        receptions: stats2025.totalReceptions,
                        receiving_yards: stats2025.totalRecYards,
                        receiving_tds: stats2025.totalRecTds,
                      }}
                      scoringFormat={scoringFormat}
                    />
                  </span>
                </div>
                <div className="pt-2 border-t border-border/50 space-y-1.5 text-sm">
                  {(player.position === 'QB') && (
                    <>
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Pass Yds</span>
                        <span className="font-medium">{stats2025.totalPassYards.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Rush Yds</span>
                        <span className="font-medium">{stats2025.totalRushYards.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">INT</span>
                        <span className="font-medium">{stats2025.totalInterceptions.toLocaleString()}</span>
                      </div>
                    </>
                  )}
                  {(player.position === 'WR' || player.position === 'TE') && (
                    <>
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Rec Yds</span>
                        <span className="font-medium">{stats2025.totalRecYards.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Targets</span>
                        <span className="font-medium">{stats2025.totalTargets.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Receptions</span>
                        <span className="font-medium">{stats2025.totalReceptions.toLocaleString()}</span>
                      </div>
                    </>
                  )}
                  {(player.position === 'RB' || player.position === 'FB') && (
                    <>
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Rush Yds</span>
                        <span className="font-medium">{stats2025.totalRushYards.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Rec Yds</span>
                        <span className="font-medium">{stats2025.totalRecYards.toLocaleString()}</span>
                      </div>
                    </>
                  )}
                  {(player.position === 'QB' || player.position === 'RB' || player.position === 'FB' || player.position === 'WR' || player.position === 'TE') && (
                    <div className="flex justify-between gap-4 pt-1">
                      <span className="text-muted-foreground">Total TDs</span>
                      <span className="font-medium">
                        {(stats2025.totalPassTds + stats2025.totalRushTds + stats2025.totalRecTds).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <Tabs defaultValue="stats" className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="stats" className="gap-2">
                <BarChart3 className="w-4 h-4" />
                Game Stats
              </TabsTrigger>
              <TabsTrigger value="schedule" className="gap-2">
                <Calendar className="w-4 h-4" />
                Schedule
              </TabsTrigger>
            </TabsList>

            <TabsContent value="stats" className="flex-1 overflow-auto mt-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Season Stats</h3>
                <div className="flex gap-2">
                  <Button
                    variant={selectedSeason === 2025 ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedSeason(2025)}
                  >
                    2025
                  </Button>
                  <Button
                    variant={selectedSeason === 2026 ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedSeason(2026)}
                  >
                    2026
                  </Button>
                </div>
              </div>
              
              {showStatTabs && (
                <div className="flex gap-2 mb-4">
                  {player.position === 'QB' && (
                    <>
                      <Button
                        variant={statView === 'passing' ? "default" : "outline"}
                        size="sm"
                        onClick={() => setStatView('passing')}
                      >
                        Passing
                      </Button>
                      <Button
                        variant={statView === 'rushing' ? "default" : "outline"}
                        size="sm"
                        onClick={() => setStatView('rushing')}
                      >
                        Rushing
                      </Button>
                    </>
                  )}
                  {(player.position === 'RB' || player.position === 'FB') && (
                    <>
                      <Button
                        variant={statView === 'rushing' ? "default" : "outline"}
                        size="sm"
                        onClick={() => setStatView('rushing')}
                      >
                        Rushing
                      </Button>
                      <Button
                        variant={statView === 'receiving' ? "default" : "outline"}
                        size="sm"
                        onClick={() => setStatView('receiving')}
                      >
                        Receiving
                      </Button>
                    </>
                  )}
                  {(player.position === 'WR' || player.position === 'TE') && (
                    <>
                      <Button
                        variant={statView === 'receiving' ? "default" : "outline"}
                        size="sm"
                        onClick={() => setStatView('receiving')}
                      >
                        Receiving
                      </Button>
                      <Button
                        variant={statView === 'rushing' ? "default" : "outline"}
                        size="sm"
                        onClick={() => setStatView('rushing')}
                      >
                        Rushing
                      </Button>
                    </>
                  )}
                </div>
              )}
              
              {stats.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Week</TableHead>
                      <TableHead className="w-16">Opp</TableHead>
                      <TableHead className="w-16 text-right">Pts</TableHead>
                      {statsForView.map((stat) => (
                        <TableHead key={stat.key} className="text-right">
                          {stat.label}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.map((game, index) => (
                      <TableRow key={`${selectedSeason}-${game.week}-${index}`}>
                        <TableCell className="font-medium">
                          W{game.week}
                        </TableCell>
                        <TableCell className={game.opponent_team === 'BYE' ? 'text-muted-foreground italic' : 'text-muted-foreground'}>
                          {game.opponent_team === 'BYE' ? 'BYE' : (game.opponent_team || 'TBD')}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-primary">
                          {game.opponent_team === 'BYE' ? '-' : (() => {
                            const pts = getFantasyPointsForFormat(
                              scoringFormat,
                              game.fantasy_points ?? null,
                              game.fantasy_points_ppr ?? null,
                              game.receptions ?? null
                            );
                            if (pts == null) return '-';
                            const useTwoDecimals = player.position === 'QB' || (game.passing_yards ?? 0) > 0;
                            const displayPts = pts.toFixed(useTwoDecimals ? 2 : 1);
                            return (
                              <FantasyPointsWithBreakdown
                                displayValue={displayPts}
                                stats={{
                                  passing_yards: game.passing_yards,
                                  passing_tds: game.passing_tds,
                                  passing_interceptions: game.passing_interceptions,
                                  rushing_yards: game.rushing_yards,
                                  rushing_tds: game.rushing_tds,
                                  receptions: game.receptions,
                                  receiving_yards: game.receiving_yards,
                                  receiving_tds: game.receiving_tds,
                                  fumbles: game.fumbles,
                                }}
                                scoringFormat={scoringFormat}
                              />
                            );
                          })()}
                        </TableCell>
                        {statsForView.map((stat) => (
                          <TableCell key={stat.key} className="text-right">
                            {getStatValue(game, stat.key)}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No game stats available yet</p>
                  <p className="text-sm">Stats will appear here once games are played</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="schedule" className="flex-1 overflow-auto mt-4">
              {schedule.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Week</TableHead>
                      <TableHead>Opponent</TableHead>
                      <TableHead className="w-24">Home/Away</TableHead>
                      <TableHead className="text-right">Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {schedule.map((game) => {
                      const isHome = game.home_team === player.team;
                      const opponent = isHome ? game.away_team : game.home_team;
                      return (
                        <TableRow key={game.id}>
                          <TableCell className="font-medium">W{game.week}</TableCell>
                          <TableCell>
                            {isHome ? '' : '@'}{opponent}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {isHome ? 'Home' : 'Away'}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {game.game_date
                              ? new Date(game.game_date).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                })
                              : 'TBD'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No upcoming games scheduled</p>
                  <p className="text-sm">Schedule will appear here when available</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
};
