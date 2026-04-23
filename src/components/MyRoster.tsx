import { PositionBadge } from '@/components/PositionBadge';
import type { RankedPlayer, DraftPick } from '@/types/database';
import { displayTeamAbbrevOrFa } from '@/utils/teamMapping';
import { cn } from '@/lib/utils';

interface PositionLimits {
  QB?: number;
  RB?: number;
  WR?: number;
  TE?: number;
  FLEX?: number;
  K?: number;
  DEF?: number;
  BENCH?: number;
}

interface UserKeeper {
  player_id: string;
  round_number: number;
}

interface MyRosterProps {
  picks: DraftPick[];
  players: RankedPlayer[];
  userPickPosition: number;
  positionLimits?: PositionLimits;
  isSuperflex?: boolean;
  teamName?: string;
  /** User's keepers (team_number matches userPickPosition). Show on roster until drafted in that round. */
  userKeepers?: UserKeeper[];
  /** Current draft round; keepers with round_number > currentRound are shown as "Rd X" on roster. */
  currentRound?: number;
  /** Rookie-only mock: show N ordered pick slots (any position), not starters/bench. */
  rookieDraftSlots?: number;
}

export const MyRoster = ({
  picks,
  players,
  userPickPosition,
  positionLimits,
  isSuperflex = false,
  teamName,
  userKeepers,
  currentRound = 0,
  rookieDraftSlots,
}: MyRosterProps) => {
  const userPicks = picks.filter((p) => p.team_number === userPickPosition);
  const draftedPlayers = userPicks
    .map((pick) => players.find((p) => p.id === pick.player_id))
    .filter((p): p is RankedPlayer => !!p);

  // Keepers not yet drafted (round in the future): include in roster display so user sees them from the start
  const keeperEntries = (userKeepers || [])
    .filter((k) => k.round_number > currentRound)
    .map((k) => ({ player: players.find((p) => p.id === k.player_id), round: k.round_number }))
    .filter((e): e is { player: RankedPlayer; round: number } => !!e.player);
  const draftedIds = new Set(draftedPlayers.map((p) => p.id));
  const keeperPlayersNotYetDrafted = keeperEntries.filter((e) => !draftedIds.has(e.player.id));
  const keeperRoundByPlayerId = new Map(keeperPlayersNotYetDrafted.map((e) => [e.player.id, e.round]));
  const sortedUserPicks = [...userPicks].sort((a, b) => a.pick_number - b.pick_number);

  if (rookieDraftSlots != null && rookieDraftSlots > 0) {
    return (
      <div className="glass-card p-4 w-full">
        <h2 className="font-display text-xl mb-4">{teamName || 'MY TEAM'}</h2>
        <p className="text-xs text-muted-foreground mb-3">
          Rookie draft — {rookieDraftSlots} pick{rookieDraftSlots !== 1 ? 's' : ''}, any position per slot.
        </p>
        <div className="space-y-3">
          {keeperPlayersNotYetDrafted.length > 0 && (
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Keepers</div>
              {keeperPlayersNotYetDrafted.map((e) => (
                <div
                  key={e.player.id}
                  className="flex items-center gap-2 p-2 rounded-lg text-sm border bg-secondary/50 border-border/30"
                >
                  <div className="flex-1 min-w-0 flex items-center gap-1.5">
                    <span className="truncate font-medium">{e.player.name}</span>
                    <span
                      className="shrink-0 text-[10px] font-medium text-primary/90 bg-primary/20 px-1.5 py-0.5 rounded"
                      title="Keeper"
                    >
                      Rd {e.round}
                    </span>
                  </div>
                  <PositionBadge position={e.player.position} className="text-[10px]" />
                </div>
              ))}
            </div>
          )}
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Your picks</div>
            {Array.from({ length: rookieDraftSlots }, (_, index) => {
              const pick = sortedUserPicks[index];
              const player = pick ? players.find((p) => p.id === pick.player_id) : undefined;
              const keeperRound = player ? keeperRoundByPlayerId.get(player.id) : undefined;
              return (
                <div
                  key={pick?.id ?? `slot-${index}`}
                  className={cn(
                    'flex items-center gap-2 p-2 rounded-lg text-sm border',
                    player ? 'bg-secondary/50 border-border/30' : 'bg-secondary/30 border-border/30'
                  )}
                >
                  <div className="w-14 text-xs font-semibold text-muted-foreground shrink-0">
                    Pick {index + 1}
                  </div>
                  {player ? (
                    <>
                      <div className="flex-1 min-w-0 flex items-center gap-1.5">
                        <span className="truncate font-medium">{player.name}</span>
                        {keeperRound !== undefined && (
                          <span
                            className="shrink-0 text-[10px] font-medium text-primary/90 bg-primary/20 px-1.5 py-0.5 rounded"
                            title="Keeper"
                          >
                            Rd {keeperRound}
                          </span>
                        )}
                      </div>
                      <PositionBadge position={player.position} className="text-[10px]" />
                      <div className="text-xs text-muted-foreground shrink-0">{displayTeamAbbrevOrFa(player.team, player.position, player.name)}</div>
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
  }

  // Combined roster for slot assignment: drafted + keepers (so lineup shows keepers in position)
  const combinedRoster = [...draftedPlayers, ...keeperPlayersNotYetDrafted.map((e) => e.player)];

  const benchCount = positionLimits?.BENCH ?? 6;
  const flexCount = positionLimits?.FLEX ?? (isSuperflex ? 2 : 1);

  const flexPositions = isSuperflex ? ['QB', 'RB', 'WR', 'TE', 'K', 'DEF', 'D/ST'] : ['RB', 'WR', 'TE'];
  const startingSlots: { label: string; positions: string[] }[] = [
    { label: 'QB', positions: ['QB'] },
    { label: 'RB1', positions: ['RB'] },
    { label: 'RB2', positions: ['RB'] },
    { label: 'WR1', positions: ['WR'] },
    { label: 'WR2', positions: ['WR'] },
    { label: 'TE', positions: ['TE'] },
    ...Array.from({ length: flexCount }, () => ({ label: 'FLEX' as const, positions: flexPositions as string[] })),
    { label: 'DEF', positions: ['DEF', 'D/ST'] },
    { label: 'K', positions: ['K'] },
  ];

  const assignedPlayerIds = new Set<string>();
  const filledSlots: (RankedPlayer | null)[] = [];
  let qbPlacedInFlex = false;

  startingSlots.forEach((slot) => {
    const isFlex = slot.label === 'FLEX';
    const effectivePositions = isFlex && isSuperflex && qbPlacedInFlex ? ['RB', 'WR', 'TE'] : slot.positions;
    const posMatch = (p: RankedPlayer) => {
      const pos = p.position === 'D/ST' ? 'DEF' : p.position;
      return effectivePositions.includes(p.position) || effectivePositions.includes(pos);
    };
    const availablePlayer = combinedRoster.find(
      (p) => posMatch(p) && !assignedPlayerIds.has(p.id)
    );
    if (availablePlayer) {
      assignedPlayerIds.add(availablePlayer.id);
      filledSlots.push(availablePlayer);
      if (isFlex && (availablePlayer.position === 'QB' || availablePlayer.position === 'qb')) {
        qbPlacedInFlex = true;
      }
    } else {
      filledSlots.push(null);
    }
  });

  // Remaining players go to bench
  const benchPlayers = combinedRoster.filter((p) => !assignedPlayerIds.has(p.id));

  return (
    <div className="glass-card p-4 w-full">
      <h2 className="font-display text-xl mb-4">{teamName || 'MY TEAM'}</h2>
      
      <div className="space-y-3">
        {/* Starting Lineup */}
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Starters</div>
          {startingSlots.map((slot, index) => {
            const player = filledSlots[index];
            const keeperRound = player ? keeperRoundByPlayerId.get(player.id) : undefined;
            return (
              <div
                key={`${slot.label}-${index}`}
                className={cn(
                  "flex items-center gap-2 p-2 rounded-lg text-sm border",
                  player ? "bg-secondary/50 border-border/30" : "bg-secondary/30 border-border/30"
                )}
              >
                <div className="w-10 text-xs font-semibold text-muted-foreground">
                  {slot.label}
                </div>
                {player ? (
                  <>
                    <div className="flex-1 min-w-0 flex items-center gap-1.5">
                      <span className="truncate font-medium">{player.name}</span>
                      {keeperRound !== undefined && (
                        <span className="shrink-0 text-[10px] font-medium text-primary/90 bg-primary/20 px-1.5 py-0.5 rounded" title="Keeper">Rd {keeperRound}</span>
                      )}
                    </div>
                    <PositionBadge position={player.position} className="text-[10px]" />
                    <div className="text-xs text-muted-foreground shrink-0">{displayTeamAbbrevOrFa(player.team, player.position, player.name)}</div>
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
            const keeperRound = player ? keeperRoundByPlayerId.get(player.id) : undefined;
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
                    <div className="flex-1 min-w-0 flex items-center gap-1.5">
                      <span className="truncate font-medium">{player.name}</span>
                      {keeperRound !== undefined && (
                        <span className="shrink-0 text-[10px] font-medium text-primary/90 bg-primary/20 px-1.5 py-0.5 rounded" title="Keeper">Rd {keeperRound}</span>
                      )}
                    </div>
                    <PositionBadge position={player.position} className="text-[10px]" />
                    <div className="text-xs text-muted-foreground shrink-0">{displayTeamAbbrevOrFa(player.team, player.position, player.name)}</div>
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
