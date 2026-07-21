import type { RankedPlayer } from '@/types/database';
import type { ImportRowResult } from '@/utils/rankingsSpreadsheet/matchPlayers';
import { RankingsLocalPlayerPicker } from './RankingsLocalPlayerPicker';
import { Check, Copy, HelpCircle, XCircle } from 'lucide-react';

interface RankingsImportReviewRowProps {
  row: ImportRowResult;
  pool: RankedPlayer[];
  onAssign: (player: RankedPlayer | null) => void;
}

/** Defensive cap so a malformed row can never blow out the layout. */
const MAX_DISPLAY_LENGTH = 60;

function displayRawName(raw: string): string {
  const collapsed = raw.replace(/\s+/g, ' ').trim();
  return collapsed.length > MAX_DISPLAY_LENGTH ? `${collapsed.slice(0, MAX_DISPLAY_LENGTH)}…` : collapsed;
}

function duplicateSourceLabel(row: ImportRowResult): string {
  const bits: string[] = [];
  if (row.duplicateOfRank != null) bits.push(`rank ${row.duplicateOfRank}`);
  if (row.duplicateOfRawName) bits.push(`"${displayRawName(row.duplicateOfRawName)}"`);
  if (bits.length === 0 && row.duplicateOfRowIndex != null) bits.push(`row ${row.duplicateOfRowIndex + 1}`);
  return bits.join(' · ') || 'an earlier row';
}

export function RankingsImportReviewRow({ row, pool, onAssign }: RankingsImportReviewRowProps) {
  const isNotFound = row.status === 'not_found';
  const isDuplicate = row.status === 'duplicate';

  return (
    <div className="rounded-md border border-border/70 bg-muted/20 p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground truncate" title={row.rawName}>
            "{displayRawName(row.rawName)}"
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {[row.rawRank ? `Rank ${row.rawRank}` : null, row.rawPosition, row.rawTeam].filter(Boolean).join(' · ') ||
              'From your file'}
          </p>
        </div>
        {isDuplicate ? (
          <span className="flex items-center gap-1 text-[11px] text-amber-500 shrink-0 mt-0.5">
            <Copy className="h-3.5 w-3.5" />
            Duplicate
          </span>
        ) : isNotFound ? (
          <span className="flex items-center gap-1 text-[11px] text-destructive shrink-0 mt-0.5">
            <HelpCircle className="h-3.5 w-3.5" />
            No match found
          </span>
        ) : (
          <span className="flex items-center gap-1 text-[11px] text-amber-500 shrink-0 mt-0.5">
            <HelpCircle className="h-3.5 w-3.5" />
            Needs confirmation
          </span>
        )}
      </div>

      {isDuplicate && row.player && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          Same as {row.player.name}, already listed at {duplicateSourceLabel(row)}. This copy will be skipped on
          import. Clear it to drop the row, or pick a different player if the match was wrong.
        </p>
      )}

      <RankingsLocalPlayerPicker
        pool={pool}
        value={row.player}
        onChange={onAssign}
        suggestions={row.suggestions}
        placeholder={
          isDuplicate
            ? 'Clear or choose a different player'
            : isNotFound
              ? 'Type a name to fix, or leave blank to exclude'
              : 'Type to choose the correct player'
        }
      />

      <p className="text-xs flex items-center gap-1.5">
        {isDuplicate && row.player ? (
          <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
            <Copy className="h-3.5 w-3.5" /> Will be skipped (already ranked as {row.player.name})
          </span>
        ) : row.player ? (
          <span className="flex items-center gap-1 text-emerald-500">
            <Check className="h-3.5 w-3.5" /> Will be ranked as {row.player.name}
          </span>
        ) : (
          <span className="flex items-center gap-1 text-muted-foreground">
            <XCircle className="h-3.5 w-3.5" /> Will be excluded from your imported rankings
          </span>
        )}
      </p>
    </div>
  );
}
