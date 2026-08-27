import { useEffect, useMemo, useState, type ClipboardEvent } from 'react';
import { formatTrimmedRoster, parseRosterPaste } from '../parser';
import {
  applyLineupRoster,
  formatBenchCapLabel,
  type LineupSlotKey,
} from '../lineupRooms';
import {
  describeUnresolved,
  isOnRoster,
  playerFromPoolRow,
  resolveAgainstPool,
  toRankedPool,
} from '../matchRoster';
import { LineupRosterView } from './LineupRosterView';
import { ROOM_SHORT, type Player, type Team } from '../types';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PlayerSearchCombobox } from '@/components/PlayerSearchCombobox';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useMergedPlayerPool } from '@/hooks/useMergedPlayerPool';
import type { Player as PoolPlayer } from '@/types/database';
import {
  countBaseStarters,
  formatLineupSummary,
  getFlexCount,
  getIrCount,
  parseStarters,
  type PositionLimitsLike,
} from '@/utils/rosterSlots';

/** A paste that could fill the starting lineup is treated as a full roster dump. */
function pasteRosterMode(
  incomingCount: number,
  existingCount: number,
  starterSlots: number,
): 'replace' | 'append' {
  if (existingCount === 0) return 'append';
  if (incomingCount >= starterSlots) return 'replace';
  return 'append';
}

type Props = {
  teams: Team[];
  activeTeamId: string;
  canEdit?: boolean;
  canSwap?: boolean;
  yourTeamId?: string | null;
  lineupLimits?: PositionLimitsLike | null;
  isSuperflex?: boolean;
  onSelectTeam: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onSetRoster: (id: string, players: Player[], mode: 'replace' | 'append') => void;
  onRemovePlayer: (teamId: string, playerId: string) => void;
  onResetTeam: (teamId: string) => void;
  onSwapLineup?: (teamId: string, from: LineupSlotKey, to: LineupSlotKey) => void;
};

export function RosterEditor({
  teams,
  activeTeamId,
  canEdit = true,
  canSwap = false,
  yourTeamId,
  lineupLimits,
  isSuperflex = false,
  onSelectTeam,
  onRename,
  onSetRoster,
  onRemovePlayer,
  onResetTeam,
  onSwapLineup,
}: Props) {
  const team = teams.find((item) => item.id === activeTeamId) ?? teams[0];
  const [paste, setPaste] = useState('');
  const [message, setMessage] = useState('');
  const [pick, setPick] = useState<PoolPlayer | null>(null);
  const [manualIr, setManualIr] = useState(false);
  const { data: poolRows, isLoading: poolLoading, isError: poolError } = useMergedPlayerPool();
  const rankedPool = useMemo(() => (poolRows ? toRankedPool(poolRows) : []), [poolRows]);
  const rosterPlayerIds = useMemo(
    () => new Set(team.players.map((player) => player.id)),
    [team.players],
  );

  useEffect(() => {
    setMessage('');
    setPaste('');
    setPick(null);
    setManualIr(false);
  }, [team.id]);

  const unsorted = useMemo(
    () => team.players.filter((player) => player.unassigned),
    [team.players],
  );

  const lineupLabel = useMemo(() => {
    const starters = parseStarters(lineupLimits);
    const flex = getFlexCount(lineupLimits, isSuperflex);
    const summary = formatLineupSummary(starters, flex, getIrCount(lineupLimits));
    return isSuperflex ? `${summary} · Superflex` : summary;
  }, [isSuperflex, lineupLimits]);

  const preview = useMemo(() => {
    if (!paste.trim()) return null;
    const parsed = parseRosterPaste(paste);
    if (!parsed.players.length) return parsed;
    if (!rankedPool.length) {
      return { ...parsed, players: [] as Player[], dropped: [] as Player[], pendingPool: true };
    }
    const resolved = resolveAgainstPool(parsed.players, rankedPool);
    const { players, dropped } = applyLineupRoster(resolved.matched, lineupLimits, isSuperflex);
    return { ...parsed, players, dropped, resolved };
  }, [isSuperflex, lineupLimits, paste, rankedPool]);

  const capLabel = formatBenchCapLabel(lineupLimits);

  function commitPlayers(incoming: Player[], mode: 'replace' | 'append') {
    const existing = mode === 'append' ? team.players : [];
    const unique = incoming.filter((player) => !isOnRoster(existing, player));
    const rosterDupes = incoming.filter((player) => isOnRoster(existing, player)).map((player) => player.name);
    const merged = mode === 'append' ? [...team.players, ...unique] : unique;
    const { players, dropped } = applyLineupRoster(merged, lineupLimits, isSuperflex);
    onSetRoster(team.id, players, 'replace');
    return { players, dropped, rosterDupes };
  }

  function applyPaste() {
    const result = parseRosterPaste(paste);
    if (!result.players.length) {
      setMessage('No player names found. Copy a roster from ESPN My Team, or type name, team, and position on each line.');
      return;
    }
    if (!rankedPool.length) {
      setMessage(poolError ? 'Could not load the NFL player list. Try again in a moment.' : 'Still loading the NFL player list.');
      return;
    }
    const resolved = resolveAgainstPool(result.players, rankedPool);
    if (!resolved.matched.length) {
      setMessage(describeUnresolved(resolved) ?? 'None of those names are in the NFL player list.');
      return;
    }
    const starterSlots =
      countBaseStarters(parseStarters(lineupLimits)) + getFlexCount(lineupLimits, isSuperflex);
    const mode = pasteRosterMode(resolved.matched.length, team.players.length, starterSlots);
    const { players, dropped, rosterDupes } = commitPlayers(resolved.matched, mode);
    const unresolved = describeUnresolved({
      ...resolved,
      duplicates: [...resolved.duplicates, ...rosterDupes],
    });
    const notes = [
      dropped.length
        ? `Bench is full (${capLabel}), left off: ${dropped.map((player) => player.name).join(', ')}`
        : null,
      unresolved,
    ].filter(Boolean);
    const summary =
      mode === 'replace'
        ? `Replaced this roster with ${players.length} player${players.length === 1 ? '' : 's'}`
        : `Added ${resolved.matched.length} player${resolved.matched.length === 1 ? '' : 's'}`;
    setMessage(notes.length ? `${summary}. ${notes.join('. ')}.` : `${summary}. Starters filled first, extras on the bench.`);
    setPaste('');
  }

  function onPasteRoster(event: ClipboardEvent<HTMLTextAreaElement>) {
    const text = event.clipboardData.getData('text');
    const result = parseRosterPaste(text);
    if (result.source !== 'espn' || !result.players.length) return;
    event.preventDefault();
    setPaste(formatTrimmedRoster(result.players));
    setMessage(
      `Trimmed ESPN paste to ${result.players.length} player${result.players.length === 1 ? '' : 's'} (name, position, team).`,
    );
  }

  function addResolved(incoming: Player) {
    if (isOnRoster(team.players, incoming)) {
      setMessage(`${incoming.name} is already on this roster.`);
      return;
    }
    const { players, dropped } = applyLineupRoster([...team.players, incoming], lineupLimits, isSuperflex);
    if (dropped.some((player) => player.id === incoming.id)) {
      setMessage(`Bench is full (${capLabel}). Remove a bench or IR player first.`);
      return;
    }
    onSetRoster(team.id, players, 'replace');
    setPick(null);
    setManualIr(false);
    setMessage(`Added ${incoming.name}.`);
  }

  function addPicked() {
    if (!pick) return;
    addResolved(playerFromPoolRow(pick, manualIr));
  }

  return (
    <section className="space-y-4" aria-label="Roster editor">
      <div>
        <h2 className="font-display text-3xl tracking-wide">Rosters</h2>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">
          {canEdit ? (
            <>
              Starters follow the Lineup tab. Change those slots in{' '}
              <Link to="/league-settings" className="text-primary underline-offset-2 hover:underline">
                League Settings
              </Link>
              . Names must match a player in the NFL list.
            </>
          ) : canSwap ? (
            `Move someone already on this roster into a starting slot or the bench (${lineupLabel}). The rest of the league sees the new rooms.`
          ) : yourTeamId && team.id !== yourTeamId ? (
            `This is someone else's roster. Open yours to move starters (${lineupLabel}).`
          ) : (
            `Same starter slots as a draft (${lineupLabel}). Empty slots stay blank. Bench and IR sit at the bottom.`
          )}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
        {teams.map((item, index) => (
          <Button
            key={item.id}
            type="button"
            size="sm"
            variant={item.id === team.id ? 'default' : 'outline'}
            className="h-11 justify-start truncate px-2 text-left text-xs uppercase tracking-wide"
            aria-pressed={item.id === team.id}
            onClick={() => onSelectTeam(item.id)}
          >
            {String(index + 1).padStart(2, '0')} {item.name}
            {item.id === yourTeamId ? (
              <span
                className={cn(
                  'ml-1 font-semibold normal-case tracking-wide',
                  item.id === team.id ? 'text-primary-foreground/80' : 'text-muted-foreground',
                )}
              >
                You
              </span>
            ) : null}
          </Button>
        ))}
      </div>
      {canEdit ? (
        <div className="space-y-3 rounded-lg border border-border/60 bg-card p-4">
          <div className="space-y-1.5">
            <Label htmlFor="team-name">Team name</Label>
            <Input
              id="team-name"
              value={team.name}
              onChange={(event) => onRename(team.id, event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="roster-paste">Paste players</Label>
            <p className="text-sm text-muted-foreground">
              Paste a whole ESPN roster or extra names. Starters fill first, extras go to the bench.
            </p>
            <Textarea
              id="roster-paste"
              className="min-h-[140px] font-mono text-sm"
              value={paste}
              onChange={(event) => setPaste(event.target.value)}
              onPaste={onPasteRoster}
              placeholder={'Tyler Shough NO QB\nChase Brown CIN RB'}
            />
            {preview && 'pendingPool' in preview && preview.pendingPool ? (
              <p className="text-sm text-muted-foreground">
                {poolError ? 'Could not load the NFL player list.' : 'Checking names against the NFL player list…'}
              </p>
            ) : null}
            {preview?.players.length ? (
              <div className="rounded-md border border-border/60 bg-background/60 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  NFL matches ({preview.players.length})
                  {'dropped' in preview && preview.dropped?.length
                    ? ` · ${preview.dropped.length} over bench/IR cap`
                    : ''}
                </p>
                <ul className="mt-2 grid gap-1 font-mono text-xs sm:grid-cols-2">
                  {preview.players.map((player) => (
                    <li key={player.id} className="flex min-w-0 items-baseline gap-2">
                      <span className="min-w-0 truncate text-foreground">{player.name}</span>
                      <span className="shrink-0 text-muted-foreground">
                        {player.ir ? 'IR' : player.room === 'DST' ? (player.position ?? ROOM_SHORT.DST) : ROOM_SHORT[player.room]}
                        {player.nflTeam ? ` · ${player.nflTeam}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
                {'resolved' in preview && preview.resolved && describeUnresolved(preview.resolved) ? (
                  <p className="mt-2 text-xs text-destructive">{describeUnresolved(preview.resolved)}</p>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              className="h-11"
              onClick={() => applyPaste()}
              disabled={poolLoading || poolError || !paste.trim()}
            >
              Apply paste
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="h-11"
              onClick={() => {
                if (!team.players.length && team.gutBump === 0) {
                  setMessage('This roster is already empty.');
                  return;
                }
                if (!window.confirm(`Clear every player on ${team.name}? Room ranks stay.`)) return;
                onResetTeam(team.id);
                setPaste('');
                setMessage(`Cleared ${team.name}.`);
              }}
            >
              Reset team
            </Button>
          </div>
        </div>
      ) : null}

      {canEdit ? (
        <div className="space-y-3 rounded-lg border border-border/60 bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Add one player</p>
          <p className="text-sm text-muted-foreground">
            Search by name. Position comes from the player list.
          </p>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
            <PlayerSearchCombobox
              value={pick}
              onChange={(player) => {
                setPick(player);
                setMessage('');
                if (player) addResolved(playerFromPoolRow(player, manualIr));
              }}
              excludePlayerIds={rosterPlayerIds}
              placeholder="Search a player..."
              popoverModal
            />
            <label className="flex h-11 min-w-[2.75rem] cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 text-sm">
              <Checkbox
                checked={manualIr}
                onCheckedChange={(checked) => setManualIr(checked === true)}
                aria-label="Injured reserve"
              />
              IR
            </label>
            <Button
              type="button"
              variant="outline"
              className="h-11"
              onClick={addPicked}
              disabled={!pick}
            >
              Add
            </Button>
          </div>
        </div>
      ) : null}

      {message ? (
        <p className={cn('text-sm', message.startsWith('No ') || message.includes('full') || message.includes('not in the NFL') || message.includes('Could not') ? 'text-destructive' : 'text-muted-foreground')}>{message}</p>
      ) : null}

      {unsorted.length ? (
        <div className="space-y-2 rounded-lg border border-border/60 bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Unsorted ({unsorted.length})
          </p>
          <ul className="grid gap-2">
            {unsorted.map((player) => (
              <li key={player.id} className="flex min-h-11 items-center justify-between gap-2">
                <span className="min-w-0 truncate text-sm text-accent">{player.name}</span>
                {canEdit ? (
                  <Button type="button" size="sm" variant="ghost" onClick={() => onRemovePlayer(team.id, player.id)}>
                    Remove
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="rounded-lg border border-border/60 bg-card p-4">
        <LineupRosterView
          players={team.players}
          lineupLimits={lineupLimits}
          isSuperflex={isSuperflex}
          canSwap={canSwap}
          onRemove={canEdit ? (playerId) => onRemovePlayer(team.id, playerId) : undefined}
          onSwap={canSwap && onSwapLineup ? (from, to) => onSwapLineup(team.id, from, to) : undefined}
        />
      </div>
    </section>
  );
}
