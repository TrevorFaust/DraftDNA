import { PositionBadge } from '@/components/PositionBadge';
import type { RankedPlayer, DraftPick } from '@/types/database';
import { cn } from '@/lib/utils';

interface RosterSlot {
  label: string;
  position: string;
  filled?: RankedPlayer;
}

interface MyRosterProps {
  picks: DraftPick[];
  players: RankedPlayer[];
  userPickPosition: number;
  benchCount?: number;
}

export const MyRoster = ({ picks, players, userPickPosition, benchCount = 6 }: MyRosterProps) => {
  const userPicks = picks.filter((p) => p.team_number === userPickPosition);
  const draftedPlayers = userPicks
    .map((pick) => players.find((p) => p.id === pick.player_id))
    .filter((p): p is RankedPlayer => !!p);

  // Roster slots configuration
  const startingSlots: { label: string; positions: string[] }[] = [
    { label: 'QB', positions: ['QB'] },
    { label: 'RB1', positions: ['RB'] },
    { label: 'RB2', positions: ['RB'] },
    { label: 'WR1', positions: ['WR'] },
    { label: 'WR2', positions: ['WR'] },
    { label: 'TE', positions: ['TE'] },
    { label: 'FLEX', positions: ['RB', 'WR', 'TE'] },
    { label: 'DEF', positions: ['DEF'] },
    { label: 'K', positions: ['K'] },
  ];

  // Assign players to slots
  const assignedPlayerIds = new Set<string>();
  const filledSlots: (RankedPlayer | null)[] = [];

  // Fill starting slots
  startingSlots.forEach((slot) => {
    const availablePlayer = draftedPlayers.find(
      (p) => slot.positions.includes(p.position) && !assignedPlayerIds.has(p.id)
    );
    if (availablePlayer) {
      assignedPlayerIds.add(availablePlayer.id);
      filledSlots.push(availablePlayer);
    } else {
      filledSlots.push(null);
    }
  });

  // Remaining players go to bench
  const benchPlayers = draftedPlayers.filter((p) => !assignedPlayerIds.has(p.id));

  return (
    <div className="glass-card p-4 h-full">
      <h2 className="font-display text-xl mb-4">MY TEAM</h2>
      
      <div className="space-y-3">
        {/* Starting Lineup */}
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Starters</div>
          {startingSlots.map((slot, index) => {
            const player = filledSlots[index];
            return (
              <div
                key={slot.label}
                className={cn(
                  "flex items-center gap-2 p-2 rounded-lg text-sm border",
                  player ? "bg-accent/10 border-accent/30" : "bg-secondary/30 border-border/30"
                )}
              >
                <div className="w-10 text-xs font-semibold text-muted-foreground">
                  {slot.label}
                </div>
                {player ? (
                  <>
                    <div className="flex-1 truncate font-medium">{player.name}</div>
                    <PositionBadge position={player.position} className="text-[10px]" />
                    <div className="text-xs text-muted-foreground">{player.team || 'FA'}</div>
                  </>
                ) : (
                  <div className="flex-1 text-muted-foreground/50 italic">Empty</div>
                )}
              </div>
            );
          })}
        </div>

        {/* Bench */}
        <div className="space-y-1 pt-2 border-t border-border/30">
          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Bench</div>
          {Array.from({ length: benchCount }).map((_, index) => {
            const player = benchPlayers[index];
            return (
              <div
                key={`bench-${index}`}
                className={cn(
                  "flex items-center gap-2 p-2 rounded-lg text-sm border",
                  player ? "bg-secondary/50 border-border/30" : "bg-secondary/20 border-border/20"
                )}
              >
                <div className="w-10 text-xs font-semibold text-muted-foreground">
                  BN
                </div>
                {player ? (
                  <>
                    <div className="flex-1 truncate font-medium">{player.name}</div>
                    <PositionBadge position={player.position} className="text-[10px]" />
                    <div className="text-xs text-muted-foreground">{player.team || 'FA'}</div>
                  </>
                ) : (
                  <div className="flex-1 text-muted-foreground/50 italic">Empty</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
