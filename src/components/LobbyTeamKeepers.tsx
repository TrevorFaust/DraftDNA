import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PlayerSearchCombobox } from '@/components/PlayerSearchCombobox';
import { PositionBadge } from '@/components/PositionBadge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { MultiplayerKeeper } from '@/types/multiplayerDraft';
import type { Player } from '@/types/database';
import { cn } from '@/lib/utils';

export type LobbyKeeperPlayer = Pick<Player, 'id' | 'name' | 'position' | 'team'>;

type Props = {
  teamNumber: number;
  keepers: MultiplayerKeeper[];
  playersById: Record<string, LobbyKeeperPlayer>;
  /** All keeper player ids in the lobby (for exclude list). */
  allKeeperPlayerIds: Set<string>;
  numRounds: number;
  maxKeepersPerTeam: number;
  canEdit: boolean;
  busy?: boolean;
  onAdd: (player: Player, round: number) => void | Promise<void>;
  onRemove: (keeperId: string) => void | Promise<void>;
  className?: string;
};

export function LobbyTeamKeepers({
  teamNumber,
  keepers,
  playersById,
  allKeeperPlayerIds,
  numRounds,
  maxKeepersPerTeam,
  canEdit,
  busy,
  onAdd,
  onRemove,
  className,
}: Props) {
  const teamKeepers = useMemo(
    () =>
      [...keepers]
        .filter((k) => k.team_number === teamNumber)
        .sort((a, b) => a.round_number - b.round_number || a.created_at.localeCompare(b.created_at)),
    [keepers, teamNumber]
  );

  const usedRounds = useMemo(
    () => new Set(teamKeepers.map((k) => k.round_number)),
    [teamKeepers]
  );

  const firstOpenRound = useMemo(() => {
    for (let r = 1; r <= numRounds; r += 1) {
      if (!usedRounds.has(r)) return r;
    }
    return 1;
  }, [numRounds, usedRounds]);

  const [adding, setAdding] = useState(false);
  const [round, setRound] = useState(String(firstOpenRound));
  const [pick, setPick] = useState<Player | null>(null);

  const canAddMore = teamKeepers.length < maxKeepersPerTeam && usedRounds.size < numRounds;

  const resetAdd = () => {
    setAdding(false);
    setPick(null);
    setRound(String(firstOpenRound));
  };

  const submitAdd = async () => {
    if (!pick) return;
    const rd = parseInt(round, 10);
    if (!rd || usedRounds.has(rd)) return;
    await onAdd(pick, rd);
    resetAdd();
  };

  if (teamKeepers.length === 0 && !canEdit) {
    return (
      <p className={cn('text-[11px] text-muted-foreground/80', className)}>No keepers</p>
    );
  }

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Keepers
      </div>
      {teamKeepers.length === 0 && canEdit && !adding && (
        <p className="text-[11px] text-muted-foreground">None yet</p>
      )}
      <ul className="space-y-1">
        {teamKeepers.map((k) => {
          const player = playersById[k.player_id];
          return (
            <li
              key={k.id}
              className="flex items-center gap-1.5 text-xs min-w-0"
            >
              <span className="shrink-0 text-muted-foreground tabular-nums">Rd {k.round_number}</span>
              {player ? (
                <>
                  <PositionBadge position={player.position} className="scale-90 origin-left" />
                  <span className="truncate font-medium">{player.name}</span>
                </>
              ) : (
                <span className="truncate text-muted-foreground">Player…</span>
              )}
              {canEdit && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0 ml-auto"
                  disabled={busy}
                  title="Remove keeper"
                  onClick={() => void onRemove(k.id)}
                >
                  <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                </Button>
              )}
            </li>
          );
        })}
      </ul>

      {canEdit && canAddMore && !adding && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1"
          disabled={busy}
          onClick={() => {
            setRound(String(firstOpenRound));
            setAdding(true);
          }}
        >
          <Plus className="w-3.5 h-3.5" />
          Add keeper
        </Button>
      )}

      {canEdit && adding && (
        <div className="space-y-2 rounded-md border border-border/50 bg-background/50 p-2">
          <PlayerSearchCombobox
            value={pick}
            onChange={setPick}
            excludePlayerIds={allKeeperPlayerIds}
            disabled={busy}
            placeholder="Search player…"
            className="w-full"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Select value={round} onValueChange={setRound} disabled={busy}>
              <SelectTrigger className="h-8 w-[5.5rem] text-xs">
                <SelectValue placeholder="Round" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: numRounds }, (_, i) => i + 1)
                  .filter((r) => !usedRounds.has(r))
                  .map((r) => (
                    <SelectItem key={r} value={String(r)}>
                      Rd {r}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              size="sm"
              className="h-8"
              disabled={busy || !pick}
              onClick={() => void submitAdd()}
            >
              Save
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8"
              disabled={busy}
              onClick={resetAdd}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
