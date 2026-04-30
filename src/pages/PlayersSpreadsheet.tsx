import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { usePlayer2025Stats, type Player2025Stats } from "@/hooks/usePlayer2025Stats";
import { ArrowDown, ArrowUp, Lightbulb, Loader2 } from "lucide-react";
import type { RankedPlayer } from "@/types/database";
import { displayTeamAbbrevOrFa } from "@/utils/teamMapping";
import { PlayerDetailDialog } from "@/components/PlayerDetailDialog";
import { cn } from "@/lib/utils";
import { getAgeFromBirthDate } from "@/utils/playerAge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { NFL_DEFENSE_TEAM_NAMES } from "@/constants/nflDefenses";
import {
  PLAYER_POOL_PRIOR_SEASON,
  PLAYER_POOL_CURRENT_SEASON,
} from "@/constants/playerPoolSeason";
import { mergePlayerPoolAcrossSeasons } from "@/utils/playerDeduplication";
import { useNflTeams } from "@/hooks/useNflTeams";
import { useAuth } from "@/hooks/useAuth";
import { useLeagues } from "@/hooks/useLeagues";
import { useCommunityRankingsBucket } from "@/hooks/useCommunityRankingsBucket";
import { allLeaguesBucketStorage } from "@/utils/temporaryStorage";
import { fetchRookiesRankings, filterPlayersToRookieIds } from "@/utils/rookiesFilter";
import type { ScoringFormat } from "@/utils/fantasyPoints";

type CommunityRow = { player_id: string; rank_position: number };
type AgeRow = { espn_id: string; birth_date: string | null };

type StatColumn = {
  key: string;
  label: string;
  isSortable: boolean;
  getSortValue: (stats: Player2025Stats | null | undefined) => number | null;
  render: (stats: Player2025Stats | null | undefined) => string;
};
type SortDirection = "desc" | "asc";
type SortConfig = { key: string; direction: SortDirection };
const ALLOWED_POSITIONS = new Set(["QB", "RB", "WR", "TE", "K", "D/ST"]);

type StatsBucket = {
  scoringFormat: ScoringFormat;
  leagueType: "season" | "dynasty";
  isSuperflex: boolean;
  rookiesOnly: boolean;
};

function scoringFormatLabel(fmt: string): string {
  if (fmt === "half_ppr") return "Half PPR";
  if (fmt === "ppr") return "Full PPR";
  if (fmt === "standard") return "Standard";
  return fmt;
}

function normalizeFantasyPosition(position: string | null | undefined): string {
  const raw = String(position ?? "").trim().toUpperCase();
  if (raw === "FB") return "RB";
  if (raw === "DEF" || raw === "DST") return "D/ST";
  return raw;
}

function formatOneDecimal(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "-";
  return value.toFixed(1);
}

function formatWhole(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "-";
  return Math.round(value).toLocaleString();
}

/** Made vs attempted; use en dash when attempts are missing or not tracked in source data. */
function formatMadeAtt(made: number | null | undefined, att: number | null | undefined): string {
  const m = made != null && Number.isFinite(made) ? Math.round(made) : 0;
  const a = att != null && Number.isFinite(att) ? Math.round(att) : null;
  if (m === 0 && (a == null || a === 0)) return "-";
  if (a == null || (a === 0 && m > 0)) return `${m}/–`;
  return `${m}/${a}`;
}

function buildCommunityFromRpc(allPlayersData: any[], communityData: CommunityRow[]): RankedPlayer[] {
  const playerById = new Map(allPlayersData.map((p) => [p.id, p]));
  const seenIds = new Set<string>();
  const result: RankedPlayer[] = [];

  for (const row of communityData) {
    const player = playerById.get(row.player_id);
    if (!player || seenIds.has(row.player_id)) continue;
    seenIds.add(row.player_id);
    result.push({
      ...player,
      adp: Number(row.rank_position),
      rank: result.length + 1,
    } as RankedPlayer);
  }

  const remaining = allPlayersData.filter((p) => !seenIds.has(p.id));
  remaining.forEach((player) => {
    result.push({
      ...player,
      adp: Number(player.adp) || result.length + 1,
      rank: result.length + 1,
    } as RankedPlayer);
  });

  return result.map((player, index) => ({ ...player, rank: index + 1 }));
}

const columnsByPosition: Record<string, StatColumn[]> = {
  QB: [
    {
      key: "passYds",
      label: "Pass Yds",
      isSortable: true,
      getSortValue: (s) => s?.totalPassYards ?? null,
      render: (s) => formatWhole(s?.totalPassYards),
    },
    {
      key: "rushYds",
      label: "Rush Yds",
      isSortable: true,
      getSortValue: (s) => s?.totalRushYards ?? null,
      render: (s) => formatWhole(s?.totalRushYards),
    },
    {
      key: "passTds",
      label: "Pass TDs",
      isSortable: true,
      getSortValue: (s) => s?.totalPassTds ?? null,
      render: (s) => formatWhole(s?.totalPassTds),
    },
    {
      key: "rushTds",
      label: "Rush TDs",
      isSortable: true,
      getSortValue: (s) => s?.totalRushTds ?? null,
      render: (s) => formatWhole(s?.totalRushTds),
    },
    {
      key: "ints",
      label: "INT",
      isSortable: true,
      getSortValue: (s) => s?.totalInterceptions ?? null,
      render: (s) => formatWhole(s?.totalInterceptions),
    },
  ],
  RB: [
    {
      key: "rushYds",
      label: "Rush Yds",
      isSortable: true,
      getSortValue: (s) => s?.totalRushYards ?? null,
      render: (s) => formatWhole(s?.totalRushYards),
    },
    {
      key: "receptions",
      label: "Receptions",
      isSortable: true,
      getSortValue: (s) => s?.totalReceptions ?? null,
      render: (s) => formatWhole(s?.totalReceptions),
    },
    {
      key: "recYds",
      label: "Rec Yds",
      isSortable: true,
      getSortValue: (s) => s?.totalRecYards ?? null,
      render: (s) => formatWhole(s?.totalRecYards),
    },
    {
      key: "totalTds",
      label: "Total TDs",
      isSortable: true,
      getSortValue: (s) => (s ? (s.totalPassTds ?? 0) + (s.totalRushTds ?? 0) + (s.totalRecTds ?? 0) : null),
      render: (s) => formatWhole((s?.totalPassTds ?? 0) + (s?.totalRushTds ?? 0) + (s?.totalRecTds ?? 0)),
    },
  ],
  WR: [
    {
      key: "recYds",
      label: "Rec Yds",
      isSortable: true,
      getSortValue: (s) => s?.totalRecYards ?? null,
      render: (s) => formatWhole(s?.totalRecYards),
    },
    {
      key: "receptions",
      label: "Receptions",
      isSortable: true,
      getSortValue: (s) => s?.totalReceptions ?? null,
      render: (s) => formatWhole(s?.totalReceptions),
    },
    {
      key: "targets",
      label: "Targets",
      isSortable: true,
      getSortValue: (s) => s?.totalTargets ?? null,
      render: (s) => formatWhole(s?.totalTargets),
    },
    {
      key: "totalTds",
      label: "Total TDs",
      isSortable: true,
      getSortValue: (s) => (s ? (s.totalPassTds ?? 0) + (s.totalRushTds ?? 0) + (s.totalRecTds ?? 0) : null),
      render: (s) => formatWhole((s?.totalPassTds ?? 0) + (s?.totalRushTds ?? 0) + (s?.totalRecTds ?? 0)),
    },
  ],
  TE: [
    {
      key: "recYds",
      label: "Rec Yds",
      isSortable: true,
      getSortValue: (s) => s?.totalRecYards ?? null,
      render: (s) => formatWhole(s?.totalRecYards),
    },
    {
      key: "targets",
      label: "Targets",
      isSortable: true,
      getSortValue: (s) => s?.totalTargets ?? null,
      render: (s) => formatWhole(s?.totalTargets),
    },
    {
      key: "receptions",
      label: "Receptions",
      isSortable: true,
      getSortValue: (s) => s?.totalReceptions ?? null,
      render: (s) => formatWhole(s?.totalReceptions),
    },
    {
      key: "totalTds",
      label: "Total TDs",
      isSortable: true,
      getSortValue: (s) => (s ? (s.totalPassTds ?? 0) + (s.totalRushTds ?? 0) + (s.totalRecTds ?? 0) : null),
      render: (s) => formatWhole((s?.totalPassTds ?? 0) + (s?.totalRushTds ?? 0) + (s?.totalRecTds ?? 0)),
    },
  ],
  K: [
    {
      key: "kPatMa",
      label: "XPM/XPA",
      isSortable: true,
      getSortValue: (s) => s?.kickerSeason?.patMade ?? null,
      render: (s) => formatMadeAtt(s?.kickerSeason?.patMade, s?.kickerSeason?.patAtt),
    },
    {
      key: "kFg0039",
      label: "FG 1–39",
      isSortable: true,
      getSortValue: (s) => s?.kickerSeason?.fgMade0To39 ?? null,
      render: (s) => formatMadeAtt(s?.kickerSeason?.fgMade0To39, s?.kickerSeason?.fgAtt0To39),
    },
    {
      key: "kFg4049",
      label: "FG 40–49",
      isSortable: true,
      getSortValue: (s) => s?.kickerSeason?.fgMade40To49 ?? null,
      render: (s) => formatMadeAtt(s?.kickerSeason?.fgMade40To49, s?.kickerSeason?.fgAtt40To49),
    },
    {
      key: "kFg5059",
      label: "FG 50–59",
      isSortable: true,
      getSortValue: (s) => s?.kickerSeason?.fgMade50To59 ?? null,
      render: (s) => formatMadeAtt(s?.kickerSeason?.fgMade50To59, s?.kickerSeason?.fgAtt50To59),
    },
    {
      key: "kFg60",
      label: "FG 60+",
      isSortable: true,
      getSortValue: (s) => s?.kickerSeason?.fgMade60Plus ?? null,
      render: (s) => formatMadeAtt(s?.kickerSeason?.fgMade60Plus, s?.kickerSeason?.fgAtt60Plus),
    },
    {
      key: "kFgMpa",
      label: "FGM/FGA",
      isSortable: true,
      getSortValue: (s) => s?.kickerSeason?.fgMade ?? null,
      render: (s) => formatMadeAtt(s?.kickerSeason?.fgMade, s?.kickerSeason?.fgAtt),
    },
  ],
  "D/ST": [
    {
      key: "sacks",
      label: "Sacks",
      isSortable: true,
      getSortValue: (s) => s?.totalDefSacks ?? null,
      render: (s) => formatWhole(s?.totalDefSacks),
    },
    {
      key: "ints",
      label: "INT",
      isSortable: true,
      getSortValue: (s) => s?.totalDefInterceptions ?? null,
      render: (s) => formatWhole(s?.totalDefInterceptions),
    },
    {
      key: "fr",
      label: "FR",
      isSortable: true,
      getSortValue: (s) => s?.totalDefFumbleRecoveries ?? null,
      render: (s) => formatWhole(s?.totalDefFumbleRecoveries),
    },
    {
      key: "tds",
      label: "TDs",
      isSortable: true,
      getSortValue: (s) => s?.totalDefTds ?? null,
      render: (s) => formatWhole(s?.totalDefTds),
    },
  ],
};

function getPositionBadgeClass(pos: string): string {
  switch (pos.toUpperCase()) {
    case "QB":
      return "position-qb";
    case "RB":
      return "position-rb";
    case "WR":
      return "position-wr";
    case "TE":
      return "position-te";
    case "K":
      return "position-k";
    case "DEF":
    case "D/ST":
      return "position-def";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export default function PlayersSpreadsheet() {
  const { user } = useAuth();
  const { selectedLeague } = useLeagues();
  const location = useLocation();
  const fallbackBucket = useCommunityRankingsBucket();
  const [players, setPlayers] = useState<RankedPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [positionFilter, setPositionFilter] = useState("all");
  const [teamFilter, setTeamFilter] = useState("all");
  const [selectedPlayer, setSelectedPlayer] = useState<RankedPlayer | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [ageByEspnId, setAgeByEspnId] = useState<Map<string, number>>(new Map());
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: "adp", direction: "asc" });
  const { teams: nflTeams } = useNflTeams();

  const displayBucket = useMemo((): StatsBucket => {
    if (user && selectedLeague) {
      return {
        scoringFormat: ((selectedLeague.scoring_format as string) || "ppr") as ScoringFormat,
        leagueType: ((selectedLeague.league_type as string) || "season") as "season" | "dynasty",
        isSuperflex: Boolean(selectedLeague.is_superflex),
        rookiesOnly: Boolean((selectedLeague as { rookies_only?: boolean }).rookies_only) && selectedLeague.league_type === "dynasty",
      };
    }
    if (user && !selectedLeague && typeof window !== "undefined") {
      const saved = allLeaguesBucketStorage.get();
      if (saved) {
        return {
          scoringFormat: (saved.scoringFormat as ScoringFormat) || "ppr",
          leagueType: (saved.leagueType as "season" | "dynasty") || "season",
          isSuperflex: Boolean(saved.isSuperflex),
          rookiesOnly: saved.leagueType === "dynasty" && Boolean(saved.rookiesOnly),
        };
      }
    }
    return {
      scoringFormat: fallbackBucket.scoringFormat as ScoringFormat,
      leagueType: fallbackBucket.leagueType as "season" | "dynasty",
      isSuperflex: Boolean(fallbackBucket.isSuperflex),
      rookiesOnly: Boolean(fallbackBucket.rookiesOnly),
    };
  }, [
    user,
    selectedLeague?.id,
    selectedLeague?.scoring_format,
    selectedLeague?.league_type,
    selectedLeague?.is_superflex,
    (selectedLeague as { rookies_only?: boolean } | undefined)?.rookies_only,
    fallbackBucket.scoringFormat,
    fallbackBucket.leagueType,
    fallbackBucket.isSuperflex,
    fallbackBucket.rookiesOnly,
    location.pathname,
    location.key,
  ]);

  const statsMap = usePlayer2025Stats(displayBucket.scoringFormat);

  const scoringPhrase = scoringFormatLabel(displayBucket.scoringFormat);
  const bucketBadgeLine = useMemo(() => {
    const parts = [
      scoringPhrase,
      displayBucket.leagueType === "dynasty" ? "Dynasty" : "Season",
      displayBucket.isSuperflex ? "Superflex" : "Non-superflex",
    ];
    if (displayBucket.leagueType === "dynasty" && displayBucket.rookiesOnly) parts.push("Rookies only");
    return parts.join(" · ");
  }, [displayBucket.scoringFormat, displayBucket.leagueType, displayBucket.isSuperflex, displayBucket.rookiesOnly]);

  const headerTooltips = useMemo(
    () => ({
      adp: `Average draft position from community consensus for ${bucketBadgeLine.toLowerCase()}. Lower is drafted earlier.`,
      posRank: `Fantasy rank within this position for the 2025 season, ordered by total fantasy points using ${scoringPhrase} scoring.`,
      totalPts: `Total fantasy points for the 2025 season using ${scoringPhrase} scoring.`,
      ppg: `Average fantasy points per game played in 2025 using ${scoringPhrase} scoring.`,
    }),
    [bucketBadgeLine, scoringPhrase]
  );

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const fmt = displayBucket.scoringFormat;
        const leagueType = displayBucket.leagueType;
        const isSf = displayBucket.isSuperflex;
        const rookiesOnly = displayBucket.rookiesOnly && leagueType === "dynasty";

        let allPlayersData: any[] = [];
        let from = 0;
        const pageSize = 1000;
        let hasMore = true;
        while (hasMore) {
          const { data, error } = await supabase
            .from("players")
            .select("*")
            .in("season", [PLAYER_POOL_PRIOR_SEASON, PLAYER_POOL_CURRENT_SEASON])
            .order("adp", { ascending: true })
            .range(from, from + pageSize - 1);
          if (error) throw error;
          if (data && data.length > 0) {
            allPlayersData = [...allPlayersData, ...data];
            from += pageSize;
            hasMore = data.length === pageSize;
          } else {
            hasMore = false;
          }
        }

        allPlayersData = mergePlayerPoolAcrossSeasons(
          allPlayersData,
          PLAYER_POOL_PRIOR_SEASON,
          PLAYER_POOL_CURRENT_SEASON
        );

        const defenseTeamAbbrByName = new Map(
          (nflTeams || [])
            .filter((t) => t.team_name && t.team_abbr)
            .map((t) => [String(t.team_name), String(t.team_abbr)])
        );
        const existingDefenseNames = new Set(
          allPlayersData
            .filter((p) => normalizeFantasyPosition(p.position) === "D/ST")
            .map((p) => String(p.name))
        );
        const syntheticDefenses = rookiesOnly
          ? []
          : NFL_DEFENSE_TEAM_NAMES.filter((teamName) => !existingDefenseNames.has(teamName)).map((teamName, index) => ({
              id: `defense-${teamName.replace(/\s/g, "-").toLowerCase()}`,
              name: teamName,
              position: "D/ST",
              team: defenseTeamAbbrByName.get(teamName) ?? null,
              season: PLAYER_POOL_PRIOR_SEASON,
              adp: 160 + index,
              bye_week: null,
              jersey_number: null,
              created_at: new Date().toISOString(),
              espn_id: null,
              sleeper_id: null,
            }));

        let safePlayers = [...allPlayersData, ...syntheticDefenses]
          .map((p) => ({ ...p, position: normalizeFantasyPosition(p.position) }))
          .filter((p) => ALLOWED_POSITIONS.has(p.position));

        let communityRows: CommunityRow[] = [];
        if (rookiesOnly) {
          const rookiesRows = await fetchRookiesRankings({
            scoringFormat: fmt,
            leagueType,
            isSuperflex: isSf,
          });
          const rookieIds = new Set(rookiesRows.map((r) => r.player_id));
          safePlayers = filterPlayersToRookieIds(safePlayers, rookieIds);
          communityRows = rookiesRows.map((r) => ({
            player_id: r.player_id,
            rank_position: r.rank,
          }));
        } else {
          const { data: communityData } = (await supabase.rpc("get_community_rankings" as any, {
            p_scoring_format: fmt,
            p_league_type: leagueType,
            p_is_superflex: isSf,
            p_exclude_user_id: null,
            p_exclude_guest_session_id: null,
          })) as { data: CommunityRow[] | null };
          communityRows = Array.isArray(communityData) ? communityData : [];
        }

        const ordered =
          communityRows.length > 0
            ? buildCommunityFromRpc(safePlayers, communityRows)
            : (safePlayers.map((p, index) => ({ ...p, rank: index + 1 })) as RankedPlayer[]);

        setPlayers(ordered);

        const espnIds = Array.from(
          new Set(
            ordered
              .map((p) => (p.espn_id != null ? String(p.espn_id) : null))
              .filter((id): id is string => Boolean(id))
          )
        );
        const ageMap = new Map<string, number>();
        const batchSize = 100;
        for (let i = 0; i < espnIds.length; i += batchSize) {
          const batch = espnIds.slice(i, i + batchSize);
          const { data: rows } = await supabase.from("players_info").select("espn_id, birth_date").in("espn_id", batch);
          (rows as AgeRow[] | null)?.forEach((row) => {
            const age = getAgeFromBirthDate(row.birth_date);
            if (age != null) ageMap.set(String(row.espn_id), age);
          });
        }
        setAgeByEspnId(ageMap);
      } catch (error) {
        console.error("Failed to load spreadsheet players:", error);
        setPlayers([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [
    nflTeams,
    displayBucket.scoringFormat,
    displayBucket.leagueType,
    displayBucket.isSuperflex,
    displayBucket.rookiesOnly,
    location.pathname,
  ]);

  const teamOptions = useMemo(() => {
    const teams = new Set<string>();
    players.forEach((player) => {
      const team = displayTeamAbbrevOrFa(player.team, player.position, player.name);
      if (team) teams.add(team);
    });
    return Array.from(teams).sort((a, b) => a.localeCompare(b));
  }, [players]);

  const activeStatColumns = useMemo(() => {
    if (positionFilter === "all") return [];
    return columnsByPosition[positionFilter] ?? [];
  }, [positionFilter]);

  const hideAgeGpForDstView = positionFilter === "D/ST";

  const normalizedPosRankByPlayerId = useMemo(() => {
    const byPosition = new Map<string, Array<{ id: string; totalPoints: number | null; adp: number }>>();
    players.forEach((player) => {
      const pos = normalizeFantasyPosition(player.position);
      if (!ALLOWED_POSITIONS.has(pos)) return;
      const totalPoints = statsMap.get(player.id)?.totalFantasyPoints ?? null;
      const bucket = byPosition.get(pos) ?? [];
      bucket.push({ id: player.id, totalPoints, adp: Number(player.adp) || Number(player.rank) || 9999 });
      byPosition.set(pos, bucket);
    });

    const rankMap = new Map<string, string>();
    byPosition.forEach((entries, pos) => {
      entries.sort((a, b) => {
        const aTotal = a.totalPoints ?? -Infinity;
        const bTotal = b.totalPoints ?? -Infinity;
        if (aTotal === bTotal) return a.adp - b.adp;
        return bTotal - aTotal;
      });
      entries.forEach((entry, index) => {
        rankMap.set(entry.id, `${pos}${index + 1}`);
      });
    });
    return rankMap;
  }, [players, statsMap]);

  const getSortValue = (player: RankedPlayer, sortKey: string): number | string | null => {
    const stats = statsMap.get(player.id);
    const normalizedPosition = normalizeFantasyPosition(player.position);
    const espnId = player.espn_id != null ? String(player.espn_id) : null;
    const age = espnId ? ageByEspnId.get(espnId) ?? null : null;
    if (sortKey === "adp") return player.adp ?? player.rank;
    if (sortKey === "age") return normalizedPosition === "D/ST" ? null : age;
    if (sortKey === "ppg") return stats?.avgPointsPerGame ?? null;
    if (sortKey === "gp") return stats?.gamesPlayed ?? null;
    if (sortKey === "totalPoints") return stats?.totalFantasyPoints ?? null;
    if (sortKey === "posRank") {
      const match = normalizedPosRankByPlayerId.get(player.id)?.match(/(\d+)$/);
      return match ? Number(match[1]) : null;
    }
    const dynamicCol = activeStatColumns.find((col) => col.key === sortKey);
    if (dynamicCol) return dynamicCol.getSortValue(stats);
    return null;
  };

  const filteredPlayers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const filtered = players.filter((player) => {
      const team = displayTeamAbbrevOrFa(player.team, player.position, player.name);
      const matchesName = q.length === 0 || player.name.toLowerCase().includes(q);
      const matchesPosition = positionFilter === "all" || normalizeFantasyPosition(player.position) === positionFilter;
      const matchesTeam = teamFilter === "all" || team === teamFilter;
      return matchesName && matchesPosition && matchesTeam;
    });
    filtered.sort((a, b) => {
      const aValue = getSortValue(a, sortConfig.key);
      const bValue = getSortValue(b, sortConfig.key);
      if (aValue == null && bValue == null) return a.rank - b.rank;
      if (aValue == null) return 1;
      if (bValue == null) return -1;
      let cmp = 0;
      if (typeof aValue === "number" && typeof bValue === "number") cmp = aValue - bValue;
      else cmp = String(aValue).localeCompare(String(bValue));
      if (cmp === 0) return a.rank - b.rank;
      return sortConfig.direction === "asc" ? cmp : -cmp;
    });
    return filtered;
  }, [players, searchTerm, positionFilter, teamFilter, sortConfig, statsMap, ageByEspnId, activeStatColumns, normalizedPosRankByPlayerId]);

  const onSort = (key: string, sortable: boolean) => {
    if (!sortable) return;
    setSortConfig((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === "desc" ? "asc" : "desc" };
      }
      return { key, direction: "desc" };
    });
  };

  const SortableHeader = ({
    label,
    sortKey,
    className,
    sortable,
    tooltip,
  }: {
    label: string;
    sortKey: string;
    className?: string;
    sortable: boolean;
    /** Hover explanation for abbreviated headers */
    tooltip?: string;
  }) => {
    const active = sortConfig.key === sortKey;
    const justify =
      className?.includes("text-right")
        ? "justify-end"
        : className?.includes("text-center")
          ? "justify-center"
          : "justify-start";
    const triggerClass = cn(
      "inline-flex items-center gap-1 w-full text-inherit",
      justify,
      sortable && "cursor-pointer select-none bg-transparent border-0 p-0 font-inherit hover:opacity-90"
    );
    const body = (
      <>
        {label}
        {active && sortConfig.direction === "desc" && <ArrowDown className="h-3.5 w-3.5 shrink-0" />}
        {active && sortConfig.direction === "asc" && <ArrowUp className="h-3.5 w-3.5 shrink-0" />}
      </>
    );
    const trigger = sortable ? (
      <button type="button" className={triggerClass} onClick={() => onSort(sortKey, true)}>
        {body}
      </button>
    ) : (
      <span className={triggerClass}>{body}</span>
    );
    const cell = (
      <TableHead
        className={cn(
          "sticky top-[var(--nav-sticky-offset)] z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80",
          className
        )}
      >
        {tooltip ? (
          <Tooltip delayDuration={200}>
            <TooltipTrigger asChild>{trigger}</TooltipTrigger>
            <TooltipContent side="top" className="max-w-[260px] text-left leading-snug">
              {tooltip}
            </TooltipContent>
          </Tooltip>
        ) : (
          trigger
        )}
      </TableHead>
    );
    return cell;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-screen-2xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="font-display text-4xl tracking-wide">PLAYER STATS</h1>
          <p className="text-muted-foreground mt-1">ADP reflects community consensus for current league format.</p>
          <p className="text-sm text-muted-foreground/90 mt-2 font-medium">{bucketBadgeLine}</p>
        </div>

        <div
          className="mb-6 flex w-max max-w-full items-start gap-2 rounded-lg border border-primary/25 bg-primary/5 py-2.5 pl-3 pr-8 text-sm text-muted-foreground"
          role="note"
        >
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
          <p className="min-w-0 leading-snug">
            <span className="font-medium text-foreground">Tip:</span> Filter by a position to show extra stat columns related to that group.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-6">
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search player name..."
            className="w-[220px] md:w-[240px] bg-secondary/50 border-border/50"
          />
          <Select value={positionFilter} onValueChange={setPositionFilter}>
            <SelectTrigger className="w-[135px] bg-secondary/50 border-border/50">
              <SelectValue placeholder="Position" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Positions</SelectItem>
              <SelectItem value="QB">QB</SelectItem>
              <SelectItem value="RB">RB</SelectItem>
              <SelectItem value="WR">WR</SelectItem>
              <SelectItem value="TE">TE</SelectItem>
              <SelectItem value="K">K</SelectItem>
              <SelectItem value="D/ST">D/ST</SelectItem>
            </SelectContent>
          </Select>
          <Select value={teamFilter} onValueChange={setTeamFilter}>
            <SelectTrigger className="w-[115px] bg-secondary/50 border-border/50">
              <SelectValue placeholder="Team" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Teams</SelectItem>
              {teamOptions.map((team) => (
                <SelectItem key={team} value={team}>
                  {team}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-lg border border-border/50 bg-secondary/20 min-w-0">
          <Table disableInnerScroll>
            <TableHeader className="shadow-[inset_0_-1px_0_0_hsl(var(--border))]">
              <TableRow>
                <SortableHeader
                  label="ADP"
                  sortKey="adp"
                  sortable
                  className="text-center"
                  tooltip={headerTooltips.adp}
                />
                <SortableHeader label="Player" sortKey="player" sortable={false} className="text-left w-[220px]" />
                <SortableHeader label="Team" sortKey="team" sortable={false} className="text-left" />
                {!hideAgeGpForDstView && (
                  <SortableHeader label="Age" sortKey="age" sortable className="text-center" />
                )}
                <SortableHeader
                  label="Pos Rk"
                  sortKey="posRank"
                  sortable
                  className="text-center"
                  tooltip={headerTooltips.posRank}
                />
                <SortableHeader
                  label="Total Pts"
                  sortKey="totalPoints"
                  sortable
                  className="text-center"
                  tooltip={headerTooltips.totalPts}
                />
                <SortableHeader
                  label="PPG"
                  sortKey="ppg"
                  sortable
                  className="text-center"
                  tooltip={headerTooltips.ppg}
                />
                {activeStatColumns.map((col) => (
                  <SortableHeader key={col.key} label={col.label} sortKey={col.key} sortable={col.isSortable} className="text-center" />
                ))}
                {!hideAgeGpForDstView && (
                  <SortableHeader label="GP" sortKey="gp" sortable className="text-center" tooltip="Regular season games played." />
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPlayers.map((player) => {
                const stats = statsMap.get(player.id);
                const team = displayTeamAbbrevOrFa(player.team, player.position, player.name);
                const espnId = player.espn_id != null ? String(player.espn_id) : null;
                const normalizedPosition = normalizeFantasyPosition(player.position);
                const age = normalizedPosition === "D/ST" ? null : (espnId ? ageByEspnId.get(espnId) ?? null : null);
                const displayPosRank = normalizedPosRankByPlayerId.get(player.id) ?? "-";
                return (
                  <TableRow
                    key={player.id}
                    className="cursor-pointer"
                    onClick={() => {
                      setSelectedPlayer(player);
                      setDetailDialogOpen(true);
                    }}
                  >
                    <TableCell className="text-center">{player.adp ?? player.rank}</TableCell>
                    <TableCell className="w-[220px]">
                      <span className={cn("position-badge", getPositionBadgeClass(normalizedPosition), "inline-block max-w-full truncate text-sm px-2.5 py-1")}>
                        {player.name}
                      </span>
                    </TableCell>
                    <TableCell>{team}</TableCell>
                    {!hideAgeGpForDstView && (
                      <TableCell className="text-center">{age == null ? "-" : age}</TableCell>
                    )}
                    <TableCell className="text-center">{displayPosRank}</TableCell>
                    <TableCell className="text-center">{formatOneDecimal(stats?.totalFantasyPoints)}</TableCell>
                    <TableCell className="text-center font-semibold">{formatOneDecimal(stats?.avgPointsPerGame)}</TableCell>
                    {activeStatColumns.map((col) => (
                      <TableCell key={col.key} className="text-center">
                        {col.render(stats)}
                      </TableCell>
                    ))}
                    {!hideAgeGpForDstView && (
                      <TableCell className="text-center">{formatWhole(stats?.gamesPlayed)}</TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <PlayerDetailDialog
          player={selectedPlayer}
          open={detailDialogOpen}
          onOpenChange={setDetailDialogOpen}
          stats2025={selectedPlayer ? statsMap.get(selectedPlayer.id) : undefined}
        />
      </main>
    </div>
  );
}
