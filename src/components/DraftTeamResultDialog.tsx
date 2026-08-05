import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PositionBadge } from '@/components/PositionBadge';
import { ArchetypeBadge } from '@/components/ArchetypeBadge';
import { DraftGradeBanner } from '@/components/DraftGradeDisplay';
import { getArchetypeByNameOrImproviser } from '@/constants/archetypeListWithImproviser';
import { getChaosArchetypeByName, isChaosReplace } from '@/constants/chaosArchetypes';
import { cn } from '@/lib/utils';
import { displayTeamAbbrevOrFa } from '@/utils/teamMapping';
import type { DraftGradeResult } from '@/utils/draftGrade';
import type { RankedPlayer } from '@/types/database';

export type DraftTeamSlot = { label: string; positions: string[] };

export function fillDraftTeamLineup(
  draftedPlayers: RankedPlayer[],
  startingSlots: DraftTeamSlot[],
  benchCount: number
): { filledSlots: (RankedPlayer | null)[]; benchPlayers: RankedPlayer[] } {
  const assignedPlayerIds = new Set<string>();
  const filledSlots: (RankedPlayer | null)[] = [];
  for (const slot of startingSlots) {
    const availablePlayer = draftedPlayers.find((p) => {
      const pos = p.position === 'D/ST' ? 'DEF' : p.position;
      return slot.positions.includes(pos) && !assignedPlayerIds.has(p.id);
    });
    if (availablePlayer) {
      assignedPlayerIds.add(availablePlayer.id);
      filledSlots.push(availablePlayer);
    } else {
      filledSlots.push(null);
    }
  }
  const benchPlayers = draftedPlayers
    .filter((p) => !assignedPlayerIds.has(p.id))
    .slice(0, benchCount);
  return { filledSlots, benchPlayers };
}

function RosterSlotRow({
  label,
  player,
}: {
  label: string;
  player: RankedPlayer | null;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 p-3 rounded-lg text-sm border',
        player ? 'bg-secondary/50 border-border/30' : 'bg-secondary/30 border-border/30'
      )}
    >
      <div className="w-14 text-xs font-semibold text-muted-foreground shrink-0">{label}</div>
      {player ? (
        <>
          <div className="flex-1 truncate font-medium">{player.name}</div>
          <PositionBadge position={player.position} className="text-[10px]" />
          <div className="text-xs text-muted-foreground shrink-0">
            {displayTeamAbbrevOrFa(player.team, player.position, player.name)}
          </div>
        </>
      ) : (
        <div className="flex-1 text-muted-foreground/50 italic">Empty</div>
      )}
    </div>
  );
}

interface DraftTeamResultDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamLabel: string;
  isYou?: boolean;
  /** When true, show archetype/chaos badges for this drafter. */
  showBadges: boolean;
  grade: DraftGradeResult | null;
  gradeLetter?: string | null;
  detectedArchetype?: string | null;
  detectedArchetypeIndex?: number | null;
  detectedChaosArchetype?: string | null;
  startingSlots: DraftTeamSlot[];
  filledSlots: (RankedPlayer | null)[];
  benchPlayers: RankedPlayer[];
  benchCount: number;
}

export function DraftTeamResultDialog({
  open,
  onOpenChange,
  teamLabel,
  isYou = false,
  showBadges,
  grade,
  gradeLetter,
  detectedArchetype,
  detectedArchetypeIndex,
  detectedChaosArchetype,
  startingSlots,
  filledSlots,
  benchPlayers,
  benchCount,
}: DraftTeamResultDialogProps) {
  const chaosName = detectedChaosArchetype ?? null;
  const chaosMeta = chaosName ? getChaosArchetypeByName(chaosName) : null;
  const isReplaceChaos = chaosName != null && isChaosReplace(chaosName);
  const archetypeName = detectedArchetype || '';
  const archetypeMeta = archetypeName ? getArchetypeByNameOrImproviser(archetypeName) : null;
  const mainFlavor = archetypeMeta?.flavorText;
  const flavorText = isReplaceChaos ? (chaosMeta?.flavorText ?? null) : mainFlavor;

  const badgeChildren =
    showBadges &&
    (isReplaceChaos && chaosMeta ? (
      <ArchetypeBadge
        archetypeName={chaosName!}
        iconOnly
        size="lg"
        flavorText={chaosMeta.flavorText}
        locked={false}
        className="shrink-0"
      />
    ) : !isReplaceChaos && chaosName && chaosMeta ? (
      <>
        {archetypeName ? (
          <ArchetypeBadge
            archetypeName={archetypeName}
            archetypeIndex={
              typeof detectedArchetypeIndex === 'number' ? detectedArchetypeIndex : undefined
            }
            iconOnly
            size="lg"
            flavorText={mainFlavor}
            locked={false}
            className="shrink-0"
          />
        ) : null}
        <ArchetypeBadge
          archetypeName={chaosName}
          iconOnly
          size="lg"
          flavorText={chaosMeta.flavorText}
          locked={false}
          className="shrink-0"
        />
      </>
    ) : archetypeName ? (
      <ArchetypeBadge
        archetypeName={archetypeName}
        archetypeIndex={
          typeof detectedArchetypeIndex === 'number' ? detectedArchetypeIndex : undefined
        }
        iconOnly
        size="lg"
        flavorText={flavorText ?? undefined}
        locked={false}
        className="shrink-0"
      />
    ) : null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-3xl w-[95vw] max-h-[90vh] overflow-y-auto overflow-x-hidden pr-2 scrollbar-thin"
        aria-describedby={undefined}
      >
        <DialogHeader>
          <DialogTitle className="font-display text-2xl tracking-wide">
            {teamLabel}
            {isYou ? ' (you)' : ''}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {grade ? (
            <DraftGradeBanner compact result={grade} className="text-left">
              {badgeChildren || undefined}
            </DraftGradeBanner>
          ) : (
            <div className="rounded-xl border border-border/50 bg-secondary/25 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm text-muted-foreground">Grade</div>
                <div className="font-display text-3xl">{gradeLetter || '—'}</div>
              </div>
              {badgeChildren ? <div className="flex items-center gap-3">{badgeChildren}</div> : null}
            </div>
          )}

          {!showBadges && (
            <p className="text-xs text-muted-foreground">Guest seat — badges not awarded.</p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="text-sm text-muted-foreground uppercase tracking-wider mb-3 font-semibold">
                Starting Lineup
              </div>
              <div className="space-y-2">
                {startingSlots.map((slot, index) => (
                  <RosterSlotRow
                    key={`${slot.label}-${index}`}
                    label={slot.label}
                    player={filledSlots[index] ?? null}
                  />
                ))}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground uppercase tracking-wider mb-3 font-semibold">
                Bench
              </div>
              <div className="space-y-2">
                {Array.from({ length: benchCount }, (_, index) => (
                  <RosterSlotRow
                    key={`bench-${index}`}
                    label="BN"
                    player={benchPlayers[index] ?? null}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
