import { Button } from '@/components/ui/button';
import { FileSpreadsheet, FileText, Table2 } from 'lucide-react';
import type { RankedPlayer } from '@/types/database';
import type { UserRankingBucketDb } from '@/utils/userRankingsBucket';
import {
  exportRankingsToCsv,
  exportRankingsToPdf,
  exportRankingsToXlsx,
} from '@/utils/rankingsSpreadsheet/exportRankings';

interface RankingsExportButtonsProps {
  players: RankedPlayer[];
  bucket: UserRankingBucketDb;
  bucketLabel: string;
}

export function RankingsExportButtons({ players, bucket, bucketLabel }: RankingsExportButtonsProps) {
  const hasPlayers = players.length > 0;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Download your current <span className="text-foreground font-medium">{bucketLabel}</span> board (
        {players.length} players) in the order you have it now.
      </p>
      <div className="grid grid-cols-1 gap-2">
        <Button
          type="button"
          variant="secondary"
          className="justify-start gap-2"
          disabled={!hasPlayers}
          onClick={() => exportRankingsToXlsx(players, bucket)}
        >
          <FileSpreadsheet className="h-4 w-4" />
          Download Excel (.xlsx)
          <span className="ml-auto text-xs text-muted-foreground">Opens in Excel or Google Sheets</span>
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="justify-start gap-2"
          disabled={!hasPlayers}
          onClick={() => exportRankingsToCsv(players, bucket)}
        >
          <Table2 className="h-4 w-4" />
          Download CSV
          <span className="ml-auto text-xs text-muted-foreground">Universal spreadsheet format</span>
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="justify-start gap-2"
          disabled={!hasPlayers}
          onClick={() => exportRankingsToPdf(players, bucket)}
        >
          <FileText className="h-4 w-4" />
          Download PDF
          <span className="ml-auto text-xs text-muted-foreground">Printable cheat sheet</span>
        </Button>
      </div>
    </div>
  );
}
