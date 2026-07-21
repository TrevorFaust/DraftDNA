import { Download, FileSpreadsheet, FileText, Table2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { RankedPlayer } from '@/types/database';
import type { UserRankingBucketDb } from '@/utils/userRankingsBucket';
import {
  exportRankingsToCsv,
  exportRankingsToPdf,
  exportRankingsToXlsx,
} from '@/utils/rankingsSpreadsheet/exportRankings';

interface RankingsColumnExportMenuProps {
  players: RankedPlayer[];
  bucket: UserRankingBucketDb;
  /** Short label for aria, e.g. "Community" or "My" */
  boardLabel: string;
}

/** Compact export control for column headers on the Rankings compare view. */
export function RankingsColumnExportMenu({
  players,
  bucket,
  boardLabel,
}: RankingsColumnExportMenuProps) {
  const disabled = players.length === 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 shrink-0"
          disabled={disabled}
          aria-label={`Export ${boardLabel} rankings`}
        >
          <Download className="h-3.5 w-3.5" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem
          disabled={disabled}
          onClick={() => exportRankingsToXlsx(players, bucket)}
          className="gap-2"
        >
          <FileSpreadsheet className="h-4 w-4" />
          Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={disabled}
          onClick={() => exportRankingsToCsv(players, bucket)}
          className="gap-2"
        >
          <Table2 className="h-4 w-4" />
          CSV
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={disabled}
          onClick={() => exportRankingsToPdf(players, bucket)}
          className="gap-2"
        >
          <FileText className="h-4 w-4" />
          PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
