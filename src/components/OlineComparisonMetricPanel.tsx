import { useCallback, useRef, useState } from "react";
import { HelpCircle } from "lucide-react";
import {
  getOlineMetricLeagueRank,
  getOlineMetricLeagueTier,
  type NflOlineMetricLeagueTier,
  type NflOlineRawMetricId,
  type NflOlineTeamView,
} from "@/types/nflTeamContext2025";
import { useNflTeamContext } from "@/contexts/NflTeamContext";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

type MetricRow = {
  label: string;
  description: string;
  metricId: NflOlineRawMetricId;
  format: (row: NflOlineTeamView) => string;
};

const PASS_METRICS: MetricRow[] = [
  {
    label: "PRESS %",
    description: "Percentage of Dropbacks Under Pressure",
    metricId: "pressurePct",
    format: (r) => `${r.pressurePct.toFixed(1)}%`,
  },
  {
    label: "PrROE",
    description:
      "Pressure rate vs. expected given how quickly the QB throws. Lower is better: 0 is roughly neutral vs expectation; clearly negative means fewer pressures than expected (strong); clearly positive means more pressure than expected (concerning for the line).",
    metricId: "pressureRoe",
    format: (r) => r.pressureRoe.toFixed(2),
  },
  {
    label: "PB PFF",
    description: "Overall Pass-Blocking PFF Grade",
    metricId: "passBlockPff",
    format: (r) => r.passBlockPff.toFixed(1),
  },
  {
    label: "PB WR",
    description: "Pass-Blocking Win Rate",
    metricId: "passBlockWinRatePct",
    format: (r) => `${r.passBlockWinRatePct}%`,
  },
];

const RUN_METRICS: MetricRow[] = [
  {
    label: "ADJ YBC/Att",
    description: "Adjusted Yards Before Contact per Attempt",
    metricId: "adjYbcoPerAtt",
    format: (r) => r.adjYbcoPerAtt.toFixed(2),
  },
  {
    label: "RB PFF",
    description: "Overall Run-Blocking PFF Grade",
    metricId: "runBlockPff",
    format: (r) => r.runBlockPff.toFixed(1),
  },
  {
    label: "RB WR",
    description: "Run-Blocking Win Rate",
    metricId: "runBlockWinRatePct",
    format: (r) => `${r.runBlockWinRatePct}%`,
  },
];

const SUMMARY_RANK_METRICS: MetricRow[] = [
  {
    label: "Unit overall",
    description: "PFF-style composite offensive line unit rank among 32 teams (2025, 1 = best).",
    metricId: "unitOverallRank",
    format: (r) => String(r.unitOverallRank),
  },
  {
    label: "Pass phase rank",
    description: "Overall pass-blocking rank among 32 teams (phase leaderboard).",
    metricId: "passOverallRank",
    format: (r) => String(r.passOverallRank),
  },
  {
    label: "Run phase rank",
    description: "Overall run-blocking rank among 32 teams (phase leaderboard).",
    metricId: "runOverallRank",
    format: (r) => String(r.runOverallRank),
  },
];

const TIER_LABEL: Record<NflOlineMetricLeagueTier, string> = {
  top: "Top tier",
  above: "Above avg",
  average: "Average",
  below: "Below avg",
  bottom: "Bottom tier",
};

const TIER_CLASS: Record<NflOlineMetricLeagueTier, string> = {
  top: "text-emerald-600 dark:text-emerald-500",
  above: "text-sky-600 dark:text-sky-400",
  average: "text-muted-foreground",
  below: "text-amber-600 dark:text-amber-500",
  bottom: "text-rose-600 dark:text-rose-400",
};

function RankedMetricCell({
  data,
  metricId,
  format,
  allOlineRows,
}: {
  data: NflOlineTeamView | null;
  metricId: NflOlineRawMetricId;
  format: (r: NflOlineTeamView) => string;
  allOlineRows: NflOlineTeamView[];
}) {
  if (!data) {
    return <span className="tabular-nums">—</span>;
  }
  const raw = data[metricId];
  const rank = getOlineMetricLeagueRank(allOlineRows, metricId, raw);
  const tier = getOlineMetricLeagueTier(allOlineRows, metricId, raw);
  return (
    <div className="flex flex-col items-center gap-0.5 tabular-nums">
      <span>{format(data)}</span>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <span
            tabIndex={0}
            className={cn(
              "cursor-default text-[10px] font-medium leading-none underline decoration-dotted underline-offset-2 outline-none",
              TIER_CLASS[tier],
            )}
          >
            {TIER_LABEL[tier]}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="z-[760] max-w-[15rem] text-xs leading-snug">
          League rank for this stat: {rank} of 32
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

function MetricDefinitionHint({ label, description }: { label: string; description: string }) {
  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="inline-flex shrink-0 rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label={`What is ${label}?`}
            >
              <HelpCircle className="h-3.5 w-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent side="right" align="start" className="z-[760] w-72 text-sm">
            <p className="font-medium">{label}</p>
            <p className="mt-1.5 text-muted-foreground leading-relaxed">{description}</p>
          </PopoverContent>
        </Popover>
      </TooltipTrigger>
      <TooltipContent side="left" className="z-[760] max-w-[16rem] text-xs leading-snug">
        {description}
      </TooltipContent>
    </Tooltip>
  );
}

function MetricsTable({
  metrics,
  left,
  right,
  leftHeader,
  rightHeader,
  allOlineRows,
}: {
  metrics: MetricRow[];
  left: NflOlineTeamView | null;
  right: NflOlineTeamView | null;
  leftHeader: string;
  rightHeader: string;
  allOlineRows: NflOlineTeamView[];
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[10rem] text-left">Metric</TableHead>
          <TableHead className="text-center tabular-nums">{leftHeader}</TableHead>
          <TableHead className="text-center tabular-nums">{rightHeader}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {metrics.map((m) => (
          <TableRow key={m.label}>
            <TableCell className="text-left text-muted-foreground">
              <div className="flex items-center gap-1">
                <span className="font-medium text-foreground">{m.label}</span>
                <MetricDefinitionHint label={m.label} description={m.description} />
              </div>
            </TableCell>
            <TableCell className="text-center align-top">
              <RankedMetricCell data={left} metricId={m.metricId} format={m.format} allOlineRows={allOlineRows} />
            </TableCell>
            <TableCell className="text-center align-top">
              <RankedMetricCell data={right} metricId={m.metricId} format={m.format} allOlineRows={allOlineRows} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function SingleTeamOlineDetailTables({
  row,
  teamLabel,
  allOlineRows,
}: {
  row: NflOlineTeamView;
  teamLabel: string;
  allOlineRows: NflOlineTeamView[];
}) {
  const blocks: { title: string | null; metrics: MetricRow[] }[] = [
    { title: null, metrics: SUMMARY_RANK_METRICS },
    { title: "Pass blocking", metrics: PASS_METRICS },
    { title: "Run blocking", metrics: RUN_METRICS },
  ];
  return (
    <div className="space-y-3">
      {blocks.map((block) => (
        <div key={block.title ?? "summary"}>
          {block.title ? (
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{block.title}</p>
          ) : null}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[10rem] text-left">Metric</TableHead>
                <TableHead className="text-center tabular-nums">{teamLabel}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {block.metrics.map((m) => (
                <TableRow key={m.label}>
                  <TableCell className="text-left text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <span className="font-medium text-foreground">{m.label}</span>
                      <MetricDefinitionHint label={m.label} description={m.description} />
                    </div>
                  </TableCell>
                  <TableCell className="text-center align-top">
                    <RankedMetricCell
                      data={row}
                      metricId={m.metricId}
                      format={m.format}
                      allOlineRows={allOlineRows}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ))}
    </div>
  );
}

const HOVER_OPEN_MS = 180;
const HOVER_CLOSE_MS = 280;

type OpenMode = "hover" | "click" | null;

type OlineTeamRankStatTriggerProps = {
  mode: "pass" | "run" | "full";
  /** Row label shown in comparison table (e.g. O-line pass rank) */
  label: string;
  teamAbbrLeft: string | null;
  teamAbbrRight: string | null;
  columnHeaderLeft: string;
  columnHeaderRight: string;
};

/**
 * Dotted label opens a panel on hover (after delay) or click; panel shows team O-line inputs for both players.
 */
export function OlineTeamRankStatTrigger({
  mode,
  label,
  teamAbbrLeft,
  teamAbbrRight,
  columnHeaderLeft,
  columnHeaderRight,
}: OlineTeamRankStatTriggerProps) {
  const { getOlineForTeam, allOlineRows } = useNflTeamContext();
  const [open, setOpen] = useState(false);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openModeRef = useRef<OpenMode>(null);

  const clearTimer = useCallback((r: React.MutableRefObject<ReturnType<typeof setTimeout> | null>) => {
    if (r.current != null) {
      clearTimeout(r.current);
      r.current = null;
    }
  }, []);

  const scheduleOpen = useCallback(() => {
    clearTimer(closeTimer);
    clearTimer(openTimer);
    openModeRef.current = "hover";
    openTimer.current = setTimeout(() => setOpen(true), HOVER_OPEN_MS);
  }, [clearTimer]);

  const scheduleClose = useCallback(() => {
    clearTimer(openTimer);
    clearTimer(closeTimer);
    closeTimer.current = setTimeout(() => {
      setOpen(false);
      openModeRef.current = null;
    }, HOVER_CLOSE_MS);
  }, [clearTimer]);

  const cancelClose = useCallback(() => {
    clearTimer(closeTimer);
  }, [clearTimer]);

  const onOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (!next) openModeRef.current = null;
  }, []);

  const left = getOlineForTeam(teamAbbrLeft);
  const right = getOlineForTeam(teamAbbrRight);
  const phaseMetrics = mode === "pass" ? PASS_METRICS : RUN_METRICS;

  return (
    <Popover open={open} onOpenChange={onOpenChange} modal={false}>
      <PopoverAnchor asChild>
        <button
          type="button"
          className="cursor-help border-b border-dotted border-muted-foreground/55 bg-transparent p-0 font-inherit text-inherit hover:text-foreground"
          onMouseEnter={scheduleOpen}
          onMouseLeave={() => {
            if (openModeRef.current === "click") return;
            scheduleClose();
          }}
          onClick={(e) => {
            e.stopPropagation();
            cancelClose();
            clearTimer(openTimer);
            openModeRef.current = "click";
            setOpen((v) => !v);
          }}
        >
          {label}
        </button>
      </PopoverAnchor>
      <PopoverContent
        align="center"
        side="top"
        sideOffset={6}
        className="z-[750] w-auto max-w-[min(100vw-1.5rem,32rem)] max-h-[min(78vh,36rem)] overflow-y-auto p-3"
        onMouseEnter={cancelClose}
        onMouseLeave={() => {
          setOpen(false);
          openModeRef.current = null;
        }}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {mode === "full" ? (
          <div className="space-y-4">
            <MetricsTable
              metrics={SUMMARY_RANK_METRICS}
              left={left}
              right={right}
              leftHeader={columnHeaderLeft}
              rightHeader={columnHeaderRight}
              allOlineRows={allOlineRows}
            />
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pass blocking</p>
              <MetricsTable
                metrics={PASS_METRICS}
                left={left}
                right={right}
                leftHeader={columnHeaderLeft}
                rightHeader={columnHeaderRight}
                allOlineRows={allOlineRows}
              />
            </div>
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Run blocking</p>
              <MetricsTable
                metrics={RUN_METRICS}
                left={left}
                right={right}
                leftHeader={columnHeaderLeft}
                rightHeader={columnHeaderRight}
                allOlineRows={allOlineRows}
              />
            </div>
          </div>
        ) : (
          <MetricsTable
            metrics={phaseMetrics}
            left={left}
            right={right}
            leftHeader={columnHeaderLeft}
            rightHeader={columnHeaderRight}
            allOlineRows={allOlineRows}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}

/** Player stats spreadsheet: dotted unit rank opens full O-line breakdown for one team. */
export function OlineSpreadsheetRankTrigger({
  teamAbbr,
  teamLabel,
  rankDisplay,
}: {
  teamAbbr: string | null;
  teamLabel: string;
  rankDisplay: string;
}) {
  const { getOlineForTeam, allOlineRows } = useNflTeamContext();
  const [open, setOpen] = useState(false);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openModeRef = useRef<OpenMode>(null);

  const clearTimer = useCallback((r: React.MutableRefObject<ReturnType<typeof setTimeout> | null>) => {
    if (r.current != null) {
      clearTimeout(r.current);
      r.current = null;
    }
  }, []);

  const scheduleOpen = useCallback(() => {
    clearTimer(closeTimer);
    clearTimer(openTimer);
    openModeRef.current = "hover";
    openTimer.current = setTimeout(() => setOpen(true), HOVER_OPEN_MS);
  }, [clearTimer]);

  const scheduleClose = useCallback(() => {
    clearTimer(openTimer);
    clearTimer(closeTimer);
    closeTimer.current = setTimeout(() => {
      setOpen(false);
      openModeRef.current = null;
    }, HOVER_CLOSE_MS);
  }, [clearTimer]);

  const cancelClose = useCallback(() => {
    clearTimer(closeTimer);
  }, [clearTimer]);

  const onOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (!next) openModeRef.current = null;
  }, []);

  const row = getOlineForTeam(teamAbbr);
  if (!row) {
    return <span className="tabular-nums text-muted-foreground">—</span>;
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange} modal={false}>
      <PopoverAnchor asChild>
        <button
          type="button"
          className="cursor-help border-b border-dotted border-muted-foreground/55 bg-transparent p-0 font-inherit tabular-nums text-inherit hover:text-foreground"
          onMouseEnter={scheduleOpen}
          onMouseLeave={() => {
            if (openModeRef.current === "click") return;
            scheduleClose();
          }}
          onClick={(e) => {
            e.stopPropagation();
            cancelClose();
            clearTimer(openTimer);
            openModeRef.current = "click";
            setOpen((v) => !v);
          }}
        >
          {rankDisplay}
        </button>
      </PopoverAnchor>
      <PopoverContent
        align="center"
        side="top"
        sideOffset={6}
        className="z-[750] w-auto max-w-[min(100vw-1.5rem,22rem)] max-h-[min(78vh,36rem)] overflow-y-auto p-3"
        onMouseEnter={cancelClose}
        onMouseLeave={() => {
          setOpen(false);
          openModeRef.current = null;
        }}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <SingleTeamOlineDetailTables row={row} teamLabel={teamLabel} allOlineRows={allOlineRows} />
      </PopoverContent>
    </Popover>
  );
}
