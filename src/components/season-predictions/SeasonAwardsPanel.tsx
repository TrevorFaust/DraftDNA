import { Fragment, useEffect, useState, type ReactNode } from 'react';
import { PlayerSearchCombobox } from '@/components/PlayerSearchCombobox';
import { PositionBadge } from '@/components/PositionBadge';
import { CoachSearchCombobox } from '@/components/season-predictions/CoachSearchCombobox';
import { DefensivePlayerSearchCombobox } from '@/components/season-predictions/DefensivePlayerSearchCombobox';
import { DefensiveRookieSearchCombobox } from '@/components/season-predictions/DefensiveRookieSearchCombobox';
import {
  SEASON_AWARD_DEFS,
  type SeasonAwardId,
  type SeasonAwardPick,
  type SeasonAwardsPicks,
} from '@/constants/seasonAwards';
import { newsletterDb } from '@/lib/newsletter/db';
import { getTeams } from '@/lib/newsletter/teams';
import { displayTeamAbbrevOrFa } from '@/utils/teamMapping';
import type { DefensiveAwardPlayer } from '@/utils/defensivePlayersAwardsPool';
import type { DefensiveRookie } from '@/utils/defensiveRookiesPool';
import type { Player } from '@/types/database';
import { cn } from '@/lib/utils';

type CoachOption = {
  id: string;
  name: string;
  team: string | null;
};

type Props = {
  awards: SeasonAwardsPicks;
  locked?: boolean;
  onChange: (awardId: SeasonAwardId, pick: SeasonAwardPick | null) => void;
  className?: string;
  /** Hide the outer heading when embedded under Records. */
  embedded?: boolean;
};

const OL_AND_ST_EXCLUDES = [
  'D/ST',
  'DST',
  'DEF',
  'K',
  'PK',
  'P',
  'OT',
  'OG',
  'OL',
  'G',
  'C',
  'IOL',
];

function playerToPick(player: Player): SeasonAwardPick {
  return {
    id: player.id,
    name: player.name,
    team: player.team,
    position: player.position,
  };
}

function idpToPick(player: DefensiveRookie | DefensiveAwardPlayer): SeasonAwardPick {
  return {
    id: player.id,
    name: player.name,
    team: player.team,
    position: player.position,
  };
}

function pickToPlayer(pick: SeasonAwardPick | null): Player | null {
  if (!pick) return null;
  return {
    id: pick.id,
    name: pick.name,
    position: pick.position ?? 'FLEX',
    team: pick.team,
    adp: 999,
    bye_week: null,
    jersey_number: null,
    season: null,
    created_at: '',
  };
}

function pickToDefensiveRookie(pick: SeasonAwardPick | null): DefensiveRookie | null {
  if (!pick) return null;
  return {
    id: pick.id,
    name: pick.name,
    position: pick.position ?? 'DEF',
    team: pick.team,
    status: null,
  };
}

function pickToDefensiveAwardPlayer(pick: SeasonAwardPick | null): DefensiveAwardPlayer | null {
  if (!pick) return null;
  return {
    id: pick.id,
    name: pick.name,
    position: pick.position ?? 'DEF',
    team: pick.team,
  };
}

function pickToCoach(pick: SeasonAwardPick | null): CoachOption | null {
  if (!pick) return null;
  return { id: pick.id, name: pick.name, team: pick.team };
}

/** Shared awards grid: labels / fixed name boxes / pos+team all share column edges. */
const AWARDS_GRID_CLASS =
  'grid grid-cols-1 gap-x-3 gap-y-2.5 sm:grid-cols-[max-content_15rem_auto] sm:items-center';

function AwardLabel({ children }: { children: ReactNode }) {
  return <p className="text-sm font-medium text-foreground sm:pr-1 sm:text-right">{children}</p>;
}

function SelectedMeta({ pick }: { pick: SeasonAwardPick }) {
  return (
    <div className="flex min-h-11 items-center gap-2 text-xs text-muted-foreground">
      {pick.position && <PositionBadge position={pick.position} />}
      <span>{displayTeamAbbrevOrFa(pick.team, pick.position, pick.name)}</span>
    </div>
  );
}

function AwardMetaSlot({ pick }: { pick: SeasonAwardPick | null }) {
  return <div className="min-w-0">{pick ? <SelectedMeta pick={pick} /> : null}</div>;
}

export function SeasonAwardsPanel({
  awards,
  locked = false,
  onChange,
  className,
  embedded = false,
}: Props) {
  const [coaches, setCoaches] = useState<CoachOption[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await newsletterDb
        .from('team_coaching_2026')
        .select('team_abbr, hc_name');
      if (cancelled) return;
      if (error || !data?.length) {
        setCoaches(
          getTeams().map((t) => ({
            id: `team:${t.abbrev.toUpperCase()}`,
            name: `${t.name} HC`,
            team: t.abbrev.toUpperCase(),
          }))
        );
        return;
      }
      const options: CoachOption[] = [];
      for (const row of data as { team_abbr?: string | null; hc_name?: string | null }[]) {
        const name = row.hc_name?.trim();
        if (!name) continue;
        const team = row.team_abbr?.trim().toUpperCase() || null;
        options.push({
          id: `coach:${team ?? name}:${name}`,
          name,
          team,
        });
      }
      options.sort((a, b) => a.name.localeCompare(b.name));
      setCoaches(options);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      className={cn(
        'mx-auto flex w-full max-w-full flex-col items-center sm:w-fit',
        className
      )}
    >
      {!embedded && (
        <div className="mb-3 max-w-md text-center">
          <h3 className="font-display text-xl tracking-wide">Awards</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            OROY uses fantasy skill rookies. DROY uses 2026 defensive rookies. DPOY searches the
            current 2026 defensive roster (vets and rookies). O-line stays out of OPOY.
          </p>
        </div>
      )}

      <div
        className={cn(
          AWARDS_GRID_CLASS,
          'glass-card w-full max-w-full px-3 py-3 sm:w-fit sm:px-4'
        )}
      >
        {SEASON_AWARD_DEFS.map((def) => {
          if (def.kind === 'coach') {
            return (
              <Fragment key={def.id}>
                <AwardLabel>{def.label}</AwardLabel>
                <CoachSearchCombobox
                  className="w-full"
                  value={pickToCoach(awards.coach)}
                  options={coaches}
                  disabled={locked}
                  wrapSelectedName
                  showSelectedMeta={false}
                  placeholder="Search coach…"
                  onChange={(coach) =>
                    onChange(
                      'coach',
                      coach
                        ? {
                            id: coach.id,
                            name: coach.name,
                            team: coach.team,
                            position: 'HC',
                          }
                        : null
                    )
                  }
                />
                <AwardMetaSlot pick={awards.coach} />
              </Fragment>
            );
          }

          if (def.id === 'dpoy') {
            return (
              <Fragment key={def.id}>
                <AwardLabel>{def.label}</AwardLabel>
                <DefensivePlayerSearchCombobox
                  className="w-full"
                  value={pickToDefensiveAwardPlayer(awards.dpoy)}
                  disabled={locked}
                  wrapSelectedName
                  showSelectedMeta={false}
                  placeholder="Search player…"
                  onChange={(player) =>
                    onChange('dpoy', player ? idpToPick(player) : null)
                  }
                />
                <AwardMetaSlot pick={awards.dpoy} />
              </Fragment>
            );
          }

          if (def.id === 'droy') {
            return (
              <Fragment key={def.id}>
                <AwardLabel>{def.label}</AwardLabel>
                <DefensiveRookieSearchCombobox
                  className="w-full"
                  value={pickToDefensiveRookie(awards.droy)}
                  disabled={locked}
                  wrapSelectedName
                  showSelectedMeta={false}
                  placeholder="Search rookie…"
                  onChange={(player) =>
                    onChange('droy', player ? idpToPick(player) : null)
                  }
                />
                <AwardMetaSlot pick={awards.droy} />
              </Fragment>
            );
          }

          const isRookieAward = def.id === 'oroy';

          return (
            <Fragment key={def.id}>
              <AwardLabel>{def.label}</AwardLabel>
              <PlayerSearchCombobox
                className="w-full"
                value={pickToPlayer(awards[def.id])}
                disabled={locked}
                wrapSelectedName
                showSelectedMeta={false}
                placeholder={isRookieAward ? 'Search rookie…' : 'Search player…'}
                excludePositions={OL_AND_ST_EXCLUDES}
                rookiesOnly={isRookieAward}
                onChange={(player) =>
                  onChange(def.id, player ? playerToPick(player) : null)
                }
              />
              <AwardMetaSlot pick={awards[def.id]} />
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
