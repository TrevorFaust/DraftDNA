import type { ReactNode } from 'react';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

import { getNflTeamByeWeek2026 } from '@/constants/nflTeamByeWeek2026';

import { canonicalTeamAbbr, displayPlayerCardTeamName, teamFieldToAbbr } from '@/utils/teamMapping';

import { isDefenseLikePosition } from '@/utils/pickSixScoring';

import {

  formatPositionalAdpRankLabel,

  positionalAdpTooltip,

  positionalListRankTooltip,

  showsPositionalAdpRank,

} from '@/utils/positionAdpRank';

import { cn } from '@/lib/utils';



interface PlayerHeaderStatsLineProps {

  position: string;

  team: string | null | undefined;

  playerName?: string | null;

  adp: number | null | undefined;

  byeWeek?: number | null;

  age?: number | null;

  positionAdpRank?: number | null;

  className?: string;

  /** `compact` = list row (ADP + bye). `stacked` = dialog (team, ADP, Pos ADP, bye · age). */

  layout?: 'compact' | 'stacked';

}



function StatTip({

  tip,

  children,

}: {

  tip: string;

  children: ReactNode;

}) {

  return (

    <Tooltip>

      <TooltipTrigger asChild>

        <span className="cursor-default tabular-nums">{children}</span>

      </TooltipTrigger>

      <TooltipContent side="bottom" className="max-w-xs text-xs">

        {tip}

      </TooltipContent>

    </Tooltip>

  );

}



function resolveByeWeek(

  team: string | null | undefined,

  byeWeek?: number | null

): number | null {

  const abbr = canonicalTeamAbbr(teamFieldToAbbr(team));

  if (byeWeek != null && byeWeek > 0) return byeWeek;

  return abbr ? getNflTeamByeWeek2026(abbr) : null;

}



export function PlayerHeaderStatsLine({

  position,

  team,

  playerName,

  adp,

  byeWeek,

  age,

  positionAdpRank,

  className,

  layout = 'stacked',

}: PlayerHeaderStatsLineProps) {

  const pos = position.trim().toUpperCase();

  const resolvedBye = resolveByeWeek(team, byeWeek);

  const teamLabel = displayPlayerCardTeamName(team, position, playerName);

  const isDefense = isDefenseLikePosition(pos);



  const showAdp = adp != null && Number(adp) > 0;

  const showBye = resolvedBye != null;

  const showTeam = layout === 'stacked' && teamLabel != null;

  const showPosAdp =

    layout === 'stacked' && positionAdpRank != null && showsPositionalAdpRank(pos);

  const showAge = layout === 'stacked' && age != null;

  const showMetaRow = showBye || showAge;



  const posAdpTip = isDefense

    ? positionalListRankTooltip(pos, positionAdpRank!)

    : positionalAdpTooltip(pos, positionAdpRank!);



  if (layout === 'compact') {

    if (!showAdp && !showBye) return null;

    return (

      <div

        className={cn(

          'flex flex-wrap items-center gap-x-3 text-sm text-muted-foreground leading-snug',

          className

        )}

      >

        {showAdp && <span className="tabular-nums">ADP: {adp}</span>}

        {showAdp && showBye && (

          <span className="text-border select-none" aria-hidden>

            ·

          </span>

        )}

        {showBye && (

          <StatTip tip={`Team bye in week ${resolvedBye}`}>

            Bye: W{resolvedBye}

          </StatTip>

        )}

      </div>

    );

  }



  if (!showTeam && !showAdp && !showPosAdp && !showMetaRow) return null;



  const rowClass = 'text-muted-foreground leading-snug';



  return (

    <div className={cn('flex flex-col gap-1.5 mt-1 text-sm', className)}>

      {showTeam && (

        <div className={rowClass}>

          <span className="truncate">{teamLabel}</span>

        </div>

      )}

      {showAdp && (

        <div className={rowClass}>

          <span className="tabular-nums">ADP: {adp}</span>

        </div>

      )}

      {showPosAdp && (

        <div className={rowClass}>

          <StatTip tip={posAdpTip}>

            Pos ADP: {formatPositionalAdpRankLabel(pos, positionAdpRank!)}

          </StatTip>

        </div>

      )}

      {showMetaRow && (

        <div className={cn(rowClass, 'flex flex-wrap items-center gap-x-3 gap-y-0')}>

          {showBye && (

            <StatTip tip={`Team bye in week ${resolvedBye}`}>

              Bye: W{resolvedBye}

            </StatTip>

          )}

          {showAge && <span className="tabular-nums">Age: {age}</span>}

        </div>

      )}

    </div>

  );

}


