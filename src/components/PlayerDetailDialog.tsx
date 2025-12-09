import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PositionBadge } from './PositionBadge';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Calendar, BarChart3 } from 'lucide-react';
import type { Player, PlayerGameStats, NFLSchedule } from '@/types/database';

interface PlayerDetailDialogProps {
  player: Player | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const PlayerDetailDialog = ({ player, open, onOpenChange }: PlayerDetailDialogProps) => {
  const [stats, setStats] = useState<PlayerGameStats[]>([]);
  const [schedule, setSchedule] = useState<NFLSchedule[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (player && open) {
      fetchPlayerData();
    }
  }, [player, open]);

  const fetchPlayerData = async () => {
    if (!player) return;
    setLoading(true);

    try {
      // Fetch past game stats
      const { data: statsData } = await supabase
        .from('player_game_stats')
        .select('*')
        .eq('player_id', player.id)
        .order('season', { ascending: false })
        .order('week', { ascending: false })
        .limit(17);

      setStats((statsData as PlayerGameStats[]) || []);

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
      }
    } catch (error) {
      console.error('Failed to fetch player data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCurrentNFLWeek = () => {
    // Simple approximation - in production you'd want a more accurate method
    const seasonStart = new Date('2025-09-04');
    const now = new Date();
    const diffTime = now.getTime() - seasonStart.getTime();
    const diffWeeks = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 7));
    return Math.max(1, Math.min(diffWeeks, 18));
  };

  const getPositionStats = (position: string) => {
    switch (position) {
      case 'QB':
        return ['passing_yards', 'passing_tds', 'interceptions', 'rushing_yards', 'rushing_tds'];
      case 'RB':
        return ['rushing_yards', 'rushing_tds', 'rushing_attempts', 'receptions', 'receiving_yards'];
      case 'WR':
      case 'TE':
        return ['receptions', 'targets', 'receiving_yards', 'receiving_tds', 'rushing_yards'];
      default:
        return ['fantasy_points'];
    }
  };

  const formatStatLabel = (stat: string) => {
    return stat
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .replace('Tds', 'TDs');
  };

  if (!player) return null;

  const relevantStats = getPositionStats(player.position);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span className="font-display text-2xl">{player.name}</span>
            <PositionBadge position={player.position} />
          </DialogTitle>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>{player.team || 'Free Agent'}</span>
            <span>ADP: {player.adp}</span>
            {player.bye_week && <span>BYE: Week {player.bye_week}</span>}
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
                Past Games
              </TabsTrigger>
              <TabsTrigger value="schedule" className="gap-2">
                <Calendar className="w-4 h-4" />
                Schedule
              </TabsTrigger>
            </TabsList>

            <TabsContent value="stats" className="flex-1 overflow-auto mt-4">
              {stats.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Week</TableHead>
                      <TableHead className="w-16">Opp</TableHead>
                      <TableHead className="w-16 text-right">Pts</TableHead>
                      {relevantStats.map((stat) => (
                        <TableHead key={stat} className="text-right">
                          {formatStatLabel(stat).replace('Yards', 'Yds').replace('Attempts', 'Att')}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.map((game) => (
                      <TableRow key={game.id}>
                        <TableCell className="font-medium">
                          W{game.week}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {game.opponent}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-primary">
                          {game.fantasy_points}
                        </TableCell>
                        {relevantStats.map((stat) => (
                          <TableCell key={stat} className="text-right">
                            {game[stat as keyof PlayerGameStats]}
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