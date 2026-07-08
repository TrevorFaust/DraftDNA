import { memo, type ReactNode } from 'react';
import type { RankedPlayer } from '@/types/database';
import type { CommunityRankTrend } from '@/utils/communityRankTrend';
import { RankingsDragRow } from '@/components/rankings/RankingsDragRow';

/** Slim insert line height — gap indicator sits between rows. */
export const COMPARE_DROP_INDICATOR_PX = 10;

type Player2025StatsEntry = {
  avgPointsPerGame: number | null;
  gamesPlayed?: number;
  totalFantasyPoints?: number;
};

type PlainRowProps = {
  player: RankedPlayer;
  displayAdp: number;
  communityPosRank?: number | null;
  myPosRank?: number | null;
  communityTrend?: CommunityRankTrend | null;
  stats2025?: Player2025StatsEntry;
  onPlayerClick: (player: RankedPlayer) => void;
  onHandlePointerDown: (player: RankedPlayer, event: React.PointerEvent<HTMLButtonElement>) => void;
};

const PlainRow = memo(function PlainRow({
  player,
  displayAdp,
  communityPosRank,
  myPosRank,
  communityTrend,
  stats2025,
  onPlayerClick,
  onHandlePointerDown,
}: PlainRowProps) {
  return (
    <RankingsDragRow
      player={player}
      rank={player.rank}
      displayAdp={displayAdp}
      communityPosRank={communityPosRank}
      myPosRank={myPosRank}
      communityTrend={communityTrend}
      stats2025={stats2025}
      onPlayerClick={onPlayerClick}
      onHandlePointerDown={(event) => onHandlePointerDown(player, event)}
      className="mb-2"
    />
  );
});

/** Preserves row height at the pickup spot so rows below do not jump under the overlay. */
const SourceSpacerRow = memo(function SourceSpacerRow({ playerId }: { playerId: string }) {
  return (
    <div
      data-rankings-drag-row
      data-rankings-spacer
      data-player-id={playerId}
      aria-hidden
      className="mb-2 min-h-[84px] rounded-lg border-2 border-dashed border-primary/25 bg-primary/[0.03]"
    />
  );
});

export type RankingsCompareScrollListProps = {
  players: RankedPlayer[];
  activeDragId: string | null;
  getDisplayAdp: (playerId: string, fallback: number) => number;
  getPlayerRankCardMeta: (playerId: string) => {
    communityPosRank: number | null;
    myPosRank: number | null;
    communityTrend: CommunityRankTrend | null;
  };
  player2025Stats: Map<string, Player2025StatsEntry>;
  onPlayerClick: (player: RankedPlayer) => void;
  onHandlePointerDown: (player: RankedPlayer, event: React.PointerEvent<HTMLButtonElement>) => void;
};

/** Plain DOM list — native scroll like the Community column (no virtualizer). */
export function RankingsCompareScrollList({
  players,
  activeDragId,
  getDisplayAdp,
  getPlayerRankCardMeta,
  player2025Stats,
  onPlayerClick,
  onHandlePointerDown,
}: RankingsCompareScrollListProps): ReactNode {
  if (players.length === 0) {
    return null;
  }

  return players.map((player) => {
    if (activeDragId === player.id) {
      return <SourceSpacerRow key={player.id} playerId={player.id} />;
    }
    return (
      <PlainRow
        key={player.id}
        player={player}
        displayAdp={getDisplayAdp(player.id, player.adp)}
        {...getPlayerRankCardMeta(player.id)}
        stats2025={player2025Stats.get(player.id)}
        onPlayerClick={onPlayerClick}
        onHandlePointerDown={onHandlePointerDown}
      />
    );
  });
}

/** Insert slot in the list with `activeId` removed (0 = before first row). */
export function buildOrderFromDropSlot(
  orderedIds: readonly string[],
  activeId: string,
  slot: number
): string[] {
  const without = orderedIds.filter((id) => id !== activeId);
  const insertAt = Math.max(0, Math.min(without.length, slot));
  return [...without.slice(0, insertAt), activeId, ...without.slice(insertAt)];
}

function sameIdOrder(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function getCompareDropTargetRows(listRoot: HTMLElement): HTMLElement[] {
  return Array.from(
    listRoot.querySelectorAll('[data-rankings-drag-row]:not([data-rankings-spacer])')
  ) as HTMLElement[];
}

/** Card center vs row midpoint — matches edit-mode dnd preview behavior. */
export function computeDropSlotFromDom(
  listRoot: HTMLElement,
  dropCenterY: number
): number {
  const rowEls = getCompareDropTargetRows(listRoot);
  if (rowEls.length === 0) return 0;

  for (let i = 0; i < rowEls.length; i++) {
    const rect = rowEls[i].getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    if (dropCenterY < midY) return i;
  }

  return rowEls.length;
}

export function rowTopWithinList(row: HTMLElement, listRoot: HTMLElement): number {
  let top = 0;
  let el: HTMLElement | null = row;
  while (el && el !== listRoot) {
    top += el.offsetTop;
    el = el.parentElement;
  }
  return top;
}

/** Vertical position for a slim indicator between rows (not on top of a row). */
export function gapTopForDropSlot(
  rowEls: HTMLElement[],
  listRoot: HTMLElement,
  slot: number,
  indicatorPx: number = COMPARE_DROP_INDICATOR_PX
): number {
  if (rowEls.length === 0) return 0;

  const half = indicatorPx / 2;

  if (slot <= 0) {
    const firstTop = rowTopWithinList(rowEls[0], listRoot);
    return Math.max(0, firstTop - half);
  }

  if (slot >= rowEls.length) {
    const last = rowEls[rowEls.length - 1];
    return rowTopWithinList(last, listRoot) + last.offsetHeight - half;
  }

  const prev = rowEls[slot - 1];
  const next = rowEls[slot];
  const prevBottom = rowTopWithinList(prev, listRoot) + prev.offsetHeight;
  const nextTop = rowTopWithinList(next, listRoot);
  return (prevBottom + nextTop) / 2 - half;
}

export function orderPlayersByPreviewIds(
  players: RankedPlayer[],
  previewIds: readonly string[]
): RankedPlayer[] {
  const byId = new Map(players.map((p) => [p.id, p]));
  return previewIds
    .map((id, index) => {
      const player = byId.get(id);
      return player ? { ...player, rank: index + 1 } : null;
    })
    .filter((p): p is RankedPlayer => p != null);
}

export { sameIdOrder };
