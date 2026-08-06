import { memo, type ReactNode } from 'react';
import { PositionBadge } from '@/components/PositionBadge';
import { PlayerHeaderStatsLine } from '@/components/PlayerHeaderStatsLine';
import { RankingsPosRankCompare } from '@/components/rankings/RankingsPosRankCompare';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getTierTone } from '@/utils/positionTiers';
import type { RankedPlayer } from '@/types/database';
import { Check } from 'lucide-react';

function positionRankClass(position: string): string {
  switch (position.toUpperCase()) {
    case 'QB':
      return 'bg-qb/20 text-qb border border-qb/50';
    case 'RB':
      return 'bg-rb/20 text-rb border border-rb/50';
    case 'WR':
      return 'bg-wr/20 text-wr border border-wr/50';
    case 'TE':
      return 'bg-te/20 text-te border border-te/50';
    case 'K':
      return 'bg-k/20 text-k border border-k/50';
    case 'DEF':
    case 'D/ST':
      return 'bg-def/20 text-def border border-def/50';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

export type DraftAvailablePlayerRowProps = {
  player: RankedPlayer;
  /** Overall rank shown in the badge — personal board when available */
  displayRank: number;
  myPosRank?: number | null;
  tier?: number | null;
  hasTierBreakBefore?: boolean;
  /**
   * Per-player T1/T2 badge. Off for All Positions (breaks + left border only);
   * on for position filters.
   */
  showPlayerTier?: boolean;
  highlighted?: boolean;
  draftDisabled?: boolean;
  draftLabel?: string;
  onNameClick?: (player: RankedPlayer) => void;
  onDraft: (player: RankedPlayer) => void;
  /** Extra meta under the name (team / ADP). Defaults to compact ADP+bye line. */
  meta?: ReactNode;
};

/** Available-player row for solo + multiplayer mock drafts (personal rank + tier). */
export const DraftAvailablePlayerRow = memo(function DraftAvailablePlayerRow({
  player,
  displayRank,
  myPosRank = null,
  tier = null,
  hasTierBreakBefore = false,
  showPlayerTier = false,
  highlighted = false,
  draftDisabled = false,
  draftLabel = 'Draft',
  onNameClick,
  onDraft,
  meta,
}: DraftAvailablePlayerRowProps) {
  // Left border always follows the player's tier; T-badge is position-filter only.
  const borderTone = tier != null && tier >= 1 ? getTierTone(tier) : null;
  const badgeTone = showPlayerTier ? borderTone : null;
  // Label the tier that just ended (first Tier 3 player → "Tier 2" break).
  const breakTone =
    hasTierBreakBefore && tier != null && tier >= 2
      ? getTierTone(tier - 1)
      : null;

  return (
    <div className="[content-visibility:auto] [contain-intrinsic-size:0_60px]">
      {breakTone != null && (
        <div
          className="flex items-center gap-2 px-1 py-1 mb-0.5"
          role="separator"
          aria-label={`End of tier ${breakTone.tier}`}
        >
          <span
            className="h-[2px] flex-1 rounded-full opacity-90"
            style={{ backgroundColor: breakTone.color }}
          />
          <span
            className="shrink-0 text-[11px] uppercase tracking-[0.14em] font-display font-bold px-2 py-0.5 rounded-md border"
            style={{
              color: breakTone.color,
              backgroundColor: breakTone.bgColor,
              borderColor: breakTone.color,
            }}
          >
            Tier {breakTone.tier}
          </span>
          <span
            className="h-[2px] flex-1 rounded-full opacity-90"
            style={{ backgroundColor: breakTone.color }}
          />
        </div>
      )}

      <div
        className={cn(
          'flex items-center gap-2 sm:gap-2.5 px-2 py-1.5 rounded-lg hover:bg-secondary/50 transition-colors group',
          highlighted && 'bg-accent/20 border-2 border-accent/50 ring-2 ring-accent/30',
          borderTone && 'border-l-4',
          !borderTone && 'border-l-4 border-l-transparent'
        )}
        style={borderTone ? { borderLeftColor: borderTone.color } : undefined}
      >
        <div
          className={cn(
            'w-7 h-7 rounded flex items-center justify-center text-xs font-bold shrink-0',
            positionRankClass(player.position)
          )}
          title="Your overall ranking"
        >
          {displayRank}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className={cn(
                'font-medium truncate text-sm',
                onNameClick && 'cursor-pointer hover:text-primary transition-colors'
              )}
              onClick={
                onNameClick
                  ? () => {
                      onNameClick(player);
                    }
                  : undefined
              }
            >
              {player.name}
            </span>
            <PositionBadge position={player.position} />
          </div>
          {meta ?? (
            <PlayerHeaderStatsLine
              position={player.position}
              team={player.team}
              adp={player.adp}
              byeWeek={player.bye_week}
              layout="compact"
              className="text-[11px] mt-0 leading-tight"
            />
          )}
        </div>

        <RankingsPosRankCompare
          position={player.position}
          myPosRank={myPosRank}
          tier={showPlayerTier ? tier : null}
          tierSource="personal"
          className="hidden md:flex"
        />
        {badgeTone != null && (
          <span
            className="md:hidden inline-flex items-center justify-center min-w-[1.75rem] h-6 px-1.5 rounded-md border border-border/60 text-[11px] font-display font-bold tracking-wide shrink-0"
            style={{ color: badgeTone.color, backgroundColor: badgeTone.bgColor }}
            title={`Your tier ${badgeTone.tier}`}
          >
            {badgeTone.label}
          </span>
        )}

        <Button
          size="sm"
          variant="ghost"
          disabled={draftDisabled}
          onClick={(e) => {
            e.stopPropagation();
            onDraft(player);
          }}
        >
          <Check className="w-4 h-4" /> {draftLabel}
        </Button>
      </div>
    </div>
  );
});
