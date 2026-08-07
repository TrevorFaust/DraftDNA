import { PositionBadge } from '@/components/PositionBadge';
import { fillDraftTeamLineup } from '@/components/DraftTeamResultDialog';
import type { RankedPlayer, DraftPick } from '@/types/database';
import { displayTeamAbbrevOrFa } from '@/utils/teamMapping';
import { cn } from '@/lib/utils';
import {
  buildStartingSlots,
  getBenchCount,
  type PositionLimitsLike,
} from '@/utils/rosterSlots';

type PositionLimits = PositionLimitsLike;

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

function KeeperBadge({
  round,
  drafted,
}: {
  round: number;
  drafted: boolean;
}) {
  return (
    <span
      className="shrink-0 text-[10px] font-medium text-primary/90 bg-primary/20 px-1.5 py-0.5 rounded"
      title="Keeper"
    >
      {drafted ? 'K' : `Rd ${round}`}
    </span>
  );
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

  const keeperRoundByPlayerId = new Map(
    (userKeepers || []).map((k) => [k.player_id, k.round_number])
  );
  const keeperPlayerIds = new Set(keeperRoundByPlayerId.keys());

  // Keepers not yet drafted (round in the future): include in roster display so user sees them from the start
  const draftedIds = new Set(draftedPlayers.map((p) => p.id));
  const keeperPlayersNotYetDrafted = (userKeepers || [])
    .filter((k) => k.round_number > currentRound && !draftedIds.has(k.player_id))
    .map((k) => ({ player: players.find((p) => p.id === k.player_id), round: k.round_number }))
    .filter((e): e is { player: RankedPlayer; round: number } => !!e.player);

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
                    <KeeperBadge round={e.round} drafted={false} />
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
                          <KeeperBadge round={keeperRound} drafted={draftedIds.has(player.id)} />
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

  // Combined roster: drafted + future keepers. Keepers claim starter slots first.
  const combinedRoster = [...draftedPlayers, ...keeperPlayersNotYetDrafted.map((e) => e.player)];

  const benchCount = getBenchCount(positionLimits);
  const startingSlots = buildStartingSlots(positionLimits, isSuperflex);

  const { filledSlots, benchPlayers } = fillDraftTeamLineup(
    combinedRoster,
    startingSlots,
    benchCount,
    { keeperPlayerIds, isSuperflex }
  );

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
                        <KeeperBadge
                          round={keeperRound}
                          drafted={draftedIds.has(player.id)}
                        />
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
                        <KeeperBadge
                          round={keeperRound}
                          drafted={draftedIds.has(player.id)}
                        />
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
