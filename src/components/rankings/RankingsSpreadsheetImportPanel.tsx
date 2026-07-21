import { useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { BrandedLoader } from '@/components/BrandedLoader';
import { UploadCloud, FileSpreadsheet, ClipboardList, X, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RankedPlayer } from '@/types/database';
import {
  parseSpreadsheetFile,
  parsePastedRankingsText,
  SpreadsheetParseError,
  SPREADSHEET_IMPORT_ACCEPT,
} from '@/utils/rankingsSpreadsheet/parseFile';
import {
  detectColumnMapping,
  dataRowsForMapping,
  type SpreadsheetColumnMapping,
} from '@/utils/rankingsSpreadsheet/columnMapping';
import {
  matchImportRows,
  finalizeImportRows,
  annotateDuplicateRows,
  summarizeImportRows,
  type ImportMatchResult,
  type ImportRowResult,
  type FinalizedImportSummary,
} from '@/utils/rankingsSpreadsheet/matchPlayers';
import { RankingsImportReviewRow } from './RankingsImportReviewRow';

interface RankingsSpreadsheetImportPanelProps {
  /** Full player pool for the current rankings bucket; only these players can be matched/assigned. */
  pool: RankedPlayer[];
  onApply: (orderedPlayerIds: string[], summary: FinalizedImportSummary) => void;
}

type ColumnField = 'nameCol' | 'rankCol' | 'positionCol' | 'teamCol';
type InputMode = 'file' | 'paste';

const NONE_VALUE = '__none__';
/** Defensive cap so a malformed row (e.g. an entire list pasted into one cell) can never blow out the layout. */
const MAX_PREVIEW_CELL_LENGTH = 40;

function columnPreview(rows: string[][], hasHeaderRow: boolean, colIndex: number): string {
  const dataRows = hasHeaderRow ? rows.slice(1) : rows;
  for (const row of dataRows) {
    const cell = row[colIndex]?.replace(/\s+/g, ' ').trim();
    if (cell) return cell.length > MAX_PREVIEW_CELL_LENGTH ? `${cell.slice(0, MAX_PREVIEW_CELL_LENGTH)}…` : cell;
  }
  return '(empty)';
}

function mappingSummary(mapping: SpreadsheetColumnMapping): string {
  const parts: string[] = [];
  if (mapping.nameCol !== null) parts.push(`names in col ${mapping.nameCol + 1}`);
  if (mapping.rankCol !== null) parts.push(`rank in col ${mapping.rankCol + 1}`);
  if (mapping.positionCol !== null) parts.push(`position in col ${mapping.positionCol + 1}`);
  if (mapping.teamCol !== null) parts.push(`team in col ${mapping.teamCol + 1}`);
  if (parts.length === 0) return 'Could not detect columns automatically';
  return `Detected ${parts.join(', ')}. Rank order still follows the order of rows in your file.`;
}

export function RankingsSpreadsheetImportPanel({ pool, onApply }: RankingsSpreadsheetImportPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [inputMode, setInputMode] = useState<InputMode>('file');
  const [pastedText, setPastedText] = useState('');
  const [sourceLabel, setSourceLabel] = useState<string | null>(null);
  const [allRows, setAllRows] = useState<string[][] | null>(null);
  const [mapping, setMapping] = useState<SpreadsheetColumnMapping | null>(null);
  const [matchResult, setMatchResult] = useState<ImportMatchResult | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);
  const [mappingOpen, setMappingOpen] = useState(false);

  const columnCount = useMemo(() => {
    if (!allRows || allRows.length === 0) return 0;
    return Math.max(...allRows.map((r) => r.length));
  }, [allRows]);

  const runMatch = (rows: string[][], map: SpreadsheetColumnMapping) => {
    if (map.nameCol === null) {
      setMatchResult(null);
      return;
    }
    const dataRows = dataRowsForMapping(rows, map);
    setMatchResult(matchImportRows(dataRows, map, pool));
  };

  const resetPanel = () => {
    setSourceLabel(null);
    setAllRows(null);
    setMapping(null);
    setMatchResult(null);
    setParseError(null);
    setPastedText('');
    setMappingOpen(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const applyParsedRows = (rows: string[][], label: string) => {
    if (rows.length === 0) {
      setParseError("That didn't contain any rows. Check the format and try again.");
      return;
    }
    const detected = detectColumnMapping(rows);
    setSourceLabel(label);
    setAllRows(rows);
    setMapping(detected);
    // Auto-detect columns; only open the override UI when we couldn't find a name column.
    setMappingOpen(detected.nameCol === null);
    runMatch(rows, detected);
  };

  const handleFileSelected = async (file: File) => {
    setIsParsing(true);
    setParseError(null);
    try {
      const { rows } = await parseSpreadsheetFile(file);
      applyParsedRows(rows, file.name);
    } catch (e) {
      console.error('Failed to parse rankings file:', e);
      setParseError(
        e instanceof SpreadsheetParseError
          ? e.message
          : 'Could not read that file. Try exporting it as CSV and uploading again.'
      );
    } finally {
      setIsParsing(false);
    }
  };

  const handlePasteParse = () => {
    setParseError(null);
    if (!pastedText.trim()) {
      setParseError('Paste your list first, one player per line.');
      return;
    }
    try {
      const { rows } = parsePastedRankingsText(pastedText);
      applyParsedRows(rows, `Pasted list (${rows.length} lines)`);
    } catch (e) {
      console.error('Failed to parse pasted rankings text:', e);
      setParseError('Could not read that list. Make sure each player is on its own line.');
    }
  };

  const updateMapping = (field: ColumnField, value: string) => {
    if (!allRows || !mapping) return;
    const next: SpreadsheetColumnMapping = {
      ...mapping,
      [field]: value === NONE_VALUE ? null : parseInt(value, 10),
    };
    setMapping(next);
    runMatch(allRows, next);
  };

  const assignRowPlayer = (rowIndex: number, player: RankedPlayer | null) => {
    setMatchResult((prev) => {
      if (!prev) return prev;
      const nextRows = prev.rows.map((r) => {
        if (r.rowIndex !== rowIndex) return r;
        // User picked someone (or cleared). Treat as confirmed/manual unless annotate demotes to duplicate.
        const status = player ? ('matched' as const) : ('not_found' as const);
        return { ...r, player, status, suggestions: r.suggestions };
      });
      return summarizeImportRows(annotateDuplicateRows(nextRows));
    });
  };

  const reviewRows: ImportRowResult[] =
    matchResult?.rows.filter((r) => r.status !== 'matched') ?? [];

  const handleApply = () => {
    if (!matchResult) return;
    const summary = finalizeImportRows(matchResult.rows);
    if (summary.orderedPlayerIds.length === 0) {
      setParseError('No players could be matched from that list, so there is nothing to import.');
      return;
    }
    onApply(summary.orderedPlayerIds, summary);
    resetPanel();
  };

  const hasParsedSource = Boolean(sourceLabel && allRows && mapping);
  const showColumnOverrides = columnCount > 1;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Upload or paste any ranked list you have, from a short top 50 to a full draft board. Players you leave out get
        appended after your list in community order. Only players in our database can be included.
      </p>

      <Collapsible open={howItWorksOpen} onOpenChange={setHowItWorksOpen}>
        <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-left text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
          How order gets figured out from messy lists
          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', howItWorksOpen && 'rotate-180')} />
        </CollapsibleTrigger>
        <CollapsibleContent className="px-3 pt-2 text-xs text-muted-foreground space-y-1.5">
          <p>
            <span className="text-foreground font-medium">Whoever is listed first is #1.</span> Headers, extra columns,
            and printed rank numbers only help find the right player. They never reorder your list.
          </p>
          <ul className="list-disc pl-4 space-y-1">
            <li>CSV/Excel files with headers (Rank, Player, Position, Team...) are read column by column automatically.</li>
            <li>
              One-cell dumps like "1 Joe Burrow QB CIN 6 3" are still read player by player in row order.
            </li>
            <li>
              Plain text works numbered ("1. Justin Jefferson"), one name per line, or comma-separated.
            </li>
            <li>
              Defenses match on team however you write them: "Eagles," "Philadelphia," "PHI D/ST," "PHL DEF," or
              "Jaguars D/ST."
            </li>
          </ul>
        </CollapsibleContent>
      </Collapsible>

      <p className="text-xs text-muted-foreground">
        Cheat-sheet PDFs like ESPN's printable Top 300 work too. Upload the PDF or copy-paste from it. Multi-column
        layouts that pack several ranks onto one line are handled, tags like "(RB1)" included.
      </p>

      {!hasParsedSource && (
        <div className="flex gap-2 rounded-md bg-muted/40 p-1">
          <button
            type="button"
            onClick={() => setInputMode('file')}
            className={cn(
              'flex-1 rounded-sm py-1.5 text-sm font-medium transition-colors',
              inputMode === 'file' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Upload file
          </button>
          <button
            type="button"
            onClick={() => setInputMode('paste')}
            className={cn(
              'flex-1 rounded-sm py-1.5 text-sm font-medium transition-colors',
              inputMode === 'paste' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Paste a list
          </button>
        </div>
      )}

      {!hasParsedSource && inputMode === 'file' && (
        <div className="rounded-md border-2 border-dashed border-border/80 p-6 text-center space-y-3">
          <UploadCloud className="mx-auto h-8 w-8 text-muted-foreground" />
          <div>
            <Button type="button" variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
              Choose file
            </Button>
            <p className="mt-2 text-xs text-muted-foreground">CSV, TSV, Excel (.xlsx, .xls), or PDF</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept={SPREADSHEET_IMPORT_ACCEPT}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFileSelected(file);
            }}
          />
        </div>
      )}

      {!hasParsedSource && inputMode === 'paste' && (
        <div className="space-y-2">
          <Textarea
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            placeholder={
              "One player per line, in your ranked order:\n1. Ja'Marr Chase\n2. Bijan Robinson\n3. Justin Jefferson\n..."
            }
            className="min-h-[160px] font-mono text-xs"
          />
          <Button type="button" size="sm" className="w-full" onClick={handlePasteParse}>
            <ClipboardList className="h-4 w-4 mr-2" />
            Parse list
          </Button>
        </div>
      )}

      {isParsing && (
        <div className="flex justify-center py-6">
          <BrandedLoader size={36} />
        </div>
      )}

      {parseError && <p className="text-sm text-destructive">{parseError}</p>}

      {hasParsedSource && allRows && mapping && !isParsing && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-3 py-2">
            <span className="flex items-center gap-2 min-w-0 text-sm">
              <FileSpreadsheet className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate font-medium">{sourceLabel}</span>
              <span className="text-xs text-muted-foreground shrink-0">
                {dataRowsForMapping(allRows, mapping).length} rows
              </span>
            </span>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={resetPanel}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {showColumnOverrides ? (
            <Collapsible open={mappingOpen} onOpenChange={setMappingOpen}>
              <div className="rounded-md bg-muted/40 px-3 py-2 space-y-2">
                <p className="text-xs text-muted-foreground">{mappingSummary(mapping)}</p>
                <CollapsibleTrigger className="flex w-full items-center justify-between text-left text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
                  Adjust columns (optional)
                  <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', mappingOpen && 'rotate-180')} />
                </CollapsibleTrigger>
              </div>
              <CollapsibleContent className="pt-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Player name column *</Label>
                    <Select
                      value={mapping.nameCol?.toString() ?? ''}
                      onValueChange={(v) => updateMapping('nameCol', v)}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Choose column" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: columnCount }).map((_, idx) => (
                          <SelectItem key={idx} value={idx.toString()}>
                            Col {idx + 1}: {columnPreview(allRows, mapping.hasHeaderRow, idx)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Rank column</Label>
                    <Select
                      value={mapping.rankCol?.toString() ?? NONE_VALUE}
                      onValueChange={(v) => updateMapping('rankCol', v)}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE_VALUE}>None (use row order)</SelectItem>
                        {Array.from({ length: columnCount }).map((_, idx) => (
                          <SelectItem key={idx} value={idx.toString()}>
                            Col {idx + 1}: {columnPreview(allRows, mapping.hasHeaderRow, idx)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Position column</Label>
                    <Select
                      value={mapping.positionCol?.toString() ?? NONE_VALUE}
                      onValueChange={(v) => updateMapping('positionCol', v)}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE_VALUE}>None</SelectItem>
                        {Array.from({ length: columnCount }).map((_, idx) => (
                          <SelectItem key={idx} value={idx.toString()}>
                            Col {idx + 1}: {columnPreview(allRows, mapping.hasHeaderRow, idx)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Team column</Label>
                    <Select
                      value={mapping.teamCol?.toString() ?? NONE_VALUE}
                      onValueChange={(v) => updateMapping('teamCol', v)}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE_VALUE}>None</SelectItem>
                        {Array.from({ length: columnCount }).map((_, idx) => (
                          <SelectItem key={idx} value={idx.toString()}>
                            Col {idx + 1}: {columnPreview(allRows, mapping.hasHeaderRow, idx)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          ) : (
            <p className="text-xs text-muted-foreground rounded-md bg-muted/40 px-3 py-2">
              Read as a plain list of names in the order they appear. No column mapping needed.
            </p>
          )}

          {matchResult && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="text-emerald-500 font-medium">{matchResult.matchedCount} matched</span>
                {matchResult.needsReviewCount > 0 && (
                  <span className="text-amber-500 font-medium">{matchResult.needsReviewCount} need confirmation</span>
                )}
                {matchResult.duplicateCount > 0 && (
                  <span className="text-amber-500 font-medium">{matchResult.duplicateCount} duplicate</span>
                )}
                {matchResult.notFoundCount > 0 && (
                  <span className="text-destructive font-medium">
                    {matchResult.notFoundCount} not in our database (excluded)
                  </span>
                )}
              </div>

              {matchResult.duplicateCount > 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Duplicate players are listed below. The first occurrence keeps its spot; later copies are skipped on
                  import unless you clear them or point them at someone else.
                </p>
              )}

              {reviewRows.length > 0 && (
                <div className="max-h-[min(45vh,360px)] overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                  {reviewRows.map((row) => (
                    <RankingsImportReviewRow
                      key={row.rowIndex}
                      row={row}
                      pool={pool}
                      onAssign={(player) => assignRowPlayer(row.rowIndex, player)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          <Button type="button" className="w-full" onClick={handleApply} disabled={!matchResult}>
            Apply import
          </Button>
        </div>
      )}
    </div>
  );
}
