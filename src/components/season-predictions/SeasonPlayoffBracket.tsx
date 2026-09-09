import type { CSSProperties, ReactNode } from 'react';
import { Trophy } from 'lucide-react';
import {
  espnTeamLogoUrl,
  formatSeasonRecord,
  type PlayoffSeed,
} from '@/utils/seasonPredictionRecords';
import {
  conferenceMatchup,
  divisionalMatchups,
  type BracketMatchup,
  type ConferenceBracketPicks,
  type PlayoffBracketPicks,
  wildCardMatchups,
} from '@/utils/seasonPlayoffBracket';
import {
  useNflTeamJerseyColors,
  type TeamJerseyColorsRow,
} from '@/hooks/useNflTeamJerseyColors';
import { cn } from '@/lib/utils';

function parseHexRgb(hex: string): [number, number, number] | null {
  const t = hex.trim();
  if (/^#[0-9A-Fa-f]{3}$/.test(t)) {
    return [
      parseInt(t[1] + t[1], 16),
      parseInt(t[2] + t[2], 16),
      parseInt(t[3] + t[3], 16),
    ];
  }
  if (/^#[0-9A-Fa-f]{6}$/.test(t)) {
    return [parseInt(t.slice(1, 3), 16), parseInt(t.slice(3, 5), 16), parseInt(t.slice(5, 7), 16)];
  }
  if (/^#[0-9A-Fa-f]{8}$/.test(t)) {
    return [parseInt(t.slice(1, 3), 16), parseInt(t.slice(3, 5), 16), parseInt(t.slice(5, 7), 16)];
  }
  return null;
}

function relativeLuminance(hex: string): number {
  const rgb = parseHexRgb(hex);
  if (!rgb) return 0.2;
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Prefer primary team color for card backgrounds; never use white number-fill as bg. */
function teamCardColors(
  byAbbr: Record<string, TeamJerseyColorsRow> | undefined,
  abbr: string
): { backgroundColor: string; color: string } {
  const row = byAbbr?.[abbr.trim().toUpperCase()];
  const candidates = [row?.color1, row?.color2, row?.color3].filter(
    (c): c is string => Boolean(c && /^#[0-9A-Fa-f]{3,8}$/.test(c.trim()))
  );

  let backgroundColor = '#1e293b';
  for (const candidate of candidates) {
    const L = relativeLuminance(candidate);
    if (L > 0.82) continue;
    backgroundColor = candidate.trim();
    break;
  }

  if (relativeLuminance(backgroundColor) > 0.82) {
    backgroundColor = candidates[0]?.trim() ?? '#1e293b';
    if (relativeLuminance(backgroundColor) > 0.72) {
      backgroundColor = '#1e293b';
    }
  }

  const color = relativeLuminance(backgroundColor) > 0.55 ? '#0f172a' : '#f8fafc';
  return { backgroundColor, color };
}

function BracketTeam({
  team,
  selected,
  disabled,
  onSelect,
}: {
  team: PlayoffSeed;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  const { data: jerseyColors } = useNflTeamJerseyColors();
  const colors = teamCardColors(jerseyColors, team.abbr);
  const ringColor = colors.color === '#f8fafc' ? 'ring-white/85' : 'ring-slate-900/70';

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'flex min-h-10 w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left transition-all',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        disabled ? 'cursor-default opacity-70' : 'cursor-pointer hover:brightness-110',
        selected && `ring-2 ring-inset ${ringColor}`
      )}
      style={colors as CSSProperties}
    >
      <img
        src={espnTeamLogoUrl(team.abbr)}
        alt=""
        width={20}
        height={20}
        className="h-5 w-5 shrink-0 object-contain"
        loading="lazy"
      />
      <div className="min-w-0 flex-1">
        <p
          className="truncate font-display text-xs tracking-wide sm:text-sm"
          style={{ color: colors.color }}
        >
          ({team.seed}) {team.nick.toUpperCase()}
        </p>
        <p
          className="font-mono text-[10px] tabular-nums sm:text-[11px]"
          style={{ color: colors.color, opacity: 0.9 }}
        >
          {formatSeasonRecord(team.wins, team.losses)}
        </p>
      </div>
    </button>
  );
}

function MatchupCard({
  matchup,
  winnerAbbr,
  disabled,
  onPick,
}: {
  matchup: BracketMatchup;
  winnerAbbr: string | null;
  disabled?: boolean;
  onPick: (abbr: string) => void;
}) {
  return (
    <div className="w-full space-y-1">
      <BracketTeam
        team={matchup.away}
        selected={winnerAbbr === matchup.away.abbr}
        disabled={Boolean(disabled)}
        onSelect={() => onPick(matchup.away.abbr)}
      />
      <BracketTeam
        team={matchup.home}
        selected={winnerAbbr === matchup.home.abbr}
        disabled={Boolean(disabled)}
        onSelect={() => onPick(matchup.home.abbr)}
      />
    </div>
  );
}

function ByeCard({ team }: { team: PlayoffSeed | null }) {
  const { data: jerseyColors } = useNflTeamJerseyColors();
  if (!team) return null;
  const colors = teamCardColors(jerseyColors, team.abbr);

  return (
    <div
      className="flex min-h-10 w-full items-center gap-1.5 rounded-md border border-dashed px-1.5 py-1"
      style={{
        ...colors,
        borderColor: colors.color === '#f8fafc' ? 'rgba(255,255,255,0.35)' : 'rgba(15,23,42,0.25)',
      }}
    >
      <img
        src={espnTeamLogoUrl(team.abbr)}
        alt=""
        width={20}
        height={20}
        className="h-5 w-5 shrink-0 object-contain"
        loading="lazy"
      />
      <div className="min-w-0">
        <p
          className="truncate font-display text-xs tracking-wide sm:text-sm"
          style={{ color: colors.color }}
        >
          ({team.seed}) {team.nick.toUpperCase()}
        </p>
        <p className="text-[10px] sm:text-[11px]" style={{ color: colors.color, opacity: 0.9 }}>
          First-round bye
        </p>
      </div>
    </div>
  );
}

type Distribute = 'stack' | 'spread' | 'center';

function RoundColumn({
  title,
  children,
  align = 'left',
  distribute,
}: {
  title: string;
  children: ReactNode;
  align?: 'left' | 'right';
  distribute: Distribute;
}) {
  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <h4
        className={cn(
          'mb-2 shrink-0 text-[0.6rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground sm:text-[0.65rem]',
          align === 'right' && 'text-right'
        )}
      >
        {title}
      </h4>
      <div
        className={cn(
          'flex min-h-0 flex-1 flex-col gap-2',
          distribute === 'stack' && 'justify-start',
          distribute === 'spread' && 'justify-evenly',
          distribute === 'center' && 'justify-center'
        )}
      >
        {children}
      </div>
    </section>
  );
}

function ConferenceSide({
  conference,
  seeds,
  picks,
  onPick,
  mirrored,
}: {
  conference: 'AFC' | 'NFC';
  seeds: PlayoffSeed[];
  picks: ConferenceBracketPicks;
  onPick: (
    round: 'wildCard' | 'divisional' | 'conference',
    index: number | null,
    winnerAbbr: string
  ) => void;
  mirrored?: boolean;
}) {
  const isAfc = conference === 'AFC';
  const seed1 = seeds.find((s) => s.seed === 1) ?? null;
  const wc = wildCardMatchups(seeds);
  const div = divisionalMatchups(seeds, picks.wildCard);
  const conf = conferenceMatchup(seeds, picks);

  const wildCardCol = (
    <RoundColumn
      title="Wild card"
      align={mirrored ? 'right' : 'left'}
      distribute="stack"
      key="wc"
    >
      <ByeCard team={seed1} />
      {wc.map((matchup, index) => (
        <MatchupCard
          key={matchup.id}
          matchup={matchup}
          winnerAbbr={picks.wildCard[index]}
          onPick={(abbr) => onPick('wildCard', index, abbr)}
        />
      ))}
    </RoundColumn>
  );

  const divCol = (
    <RoundColumn
      title="Divisional"
      align={mirrored ? 'right' : 'left'}
      distribute="spread"
      key="div"
    >
      {div.length === 0 ? (
        <p
          className={cn(
            'text-[11px] leading-snug text-muted-foreground sm:text-xs',
            mirrored && 'text-right'
          )}
        >
          Finish wild card first.
        </p>
      ) : (
        div.map((matchup, index) => (
          <MatchupCard
            key={matchup.id}
            matchup={matchup}
            winnerAbbr={picks.divisional[index]}
            onPick={(abbr) => onPick('divisional', index, abbr)}
          />
        ))
      )}
    </RoundColumn>
  );

  const confCol = (
    <RoundColumn
      title="Conference"
      align={mirrored ? 'right' : 'left'}
      distribute="center"
      key="conf"
    >
      {!conf ? (
        <p
          className={cn(
            'text-[11px] leading-snug text-muted-foreground sm:text-xs',
            mirrored && 'text-right'
          )}
        >
          Finish divisional first.
        </p>
      ) : (
        <MatchupCard
          matchup={conf}
          winnerAbbr={picks.conference}
          onPick={(abbr) => onPick('conference', null, abbr)}
        />
      )}
    </RoundColumn>
  );

  const columns = mirrored
    ? [confCol, divCol, wildCardCol]
    : [wildCardCol, divCol, confCol];

  return (
    <div className="flex min-h-0 min-w-0 flex-[3] flex-col">
      <div
        className={cn(
          'mb-2 flex h-8 shrink-0 items-center gap-2',
          mirrored && 'justify-end'
        )}
      >
        <div
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-full font-display text-lg text-white',
            isAfc ? 'bg-[#d50a0a]' : 'bg-[#013369]',
            mirrored && 'order-2'
          )}
          aria-hidden
        >
          {isAfc ? 'A' : 'N'}
        </div>
        <h3 className="font-display text-base tracking-wide sm:text-lg">{conference}</h3>
      </div>
      <div className="flex min-h-0 flex-1 items-stretch gap-1.5 sm:gap-2">{columns}</div>
    </div>
  );
}

type BoardProps = {
  afcSeeds: PlayoffSeed[];
  nfcSeeds: PlayoffSeed[];
  bracket: PlayoffBracketPicks;
  onConferencePick: (
    conference: 'AFC' | 'NFC',
    round: 'wildCard' | 'divisional' | 'conference',
    index: number | null,
    winnerAbbr: string
  ) => void;
  onSuperBowlPick: (winnerAbbr: string) => void;
};

export function SeasonPlayoffBracketBoard({
  afcSeeds,
  nfcSeeds,
  bracket,
  onConferencePick,
  onSuperBowlPick,
}: BoardProps) {
  const sb = superBowlMatchupFromSeeds(afcSeeds, nfcSeeds, bracket);
  const champion = bracket.superBowl
    ? [...afcSeeds, ...nfcSeeds].find((t) => t.abbr === bracket.superBowl) ?? null
    : null;

  return (
    <div className="glass-card w-full px-2 py-4 sm:px-3 sm:py-5">
      <div className="flex w-full min-w-0 items-stretch gap-1.5 sm:gap-2 lg:gap-3">
        <ConferenceSide
          conference="AFC"
          seeds={afcSeeds}
          picks={bracket.afc}
          onPick={(round, index, abbr) => onConferencePick('AFC', round, index, abbr)}
        />

        <section className="flex w-[7.5rem] shrink-0 flex-col sm:w-[9rem]">
          <div className="mb-2 flex h-8 shrink-0 items-center justify-center gap-1.5">
            <Trophy className="h-4 w-4 text-accent sm:h-5 sm:w-5" aria-hidden />
            <h3 className="font-display text-sm tracking-wide sm:text-base">Super Bowl</h3>
          </div>
          <div className="flex min-h-0 flex-1 flex-col">
            <p className="mb-2 shrink-0 text-center text-[0.6rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground sm:text-[0.65rem]">
              Final
            </p>
            <div className="flex min-h-0 flex-1 flex-col justify-center gap-2">
              {!sb ? (
                <p className="text-center text-[11px] text-muted-foreground sm:text-sm">
                  Pick both conference champions first.
                </p>
              ) : (
                <div className="w-full space-y-2">
                  <MatchupCard
                    matchup={{
                      id: 'sb',
                      round: 'conference',
                      home: sb.nfc,
                      away: sb.afc,
                    }}
                    winnerAbbr={bracket.superBowl}
                    onPick={onSuperBowlPick}
                  />
                  {champion && (
                    <p className="text-center text-[11px] text-muted-foreground sm:text-sm">
                      Champion:{' '}
                      <span className="font-medium text-foreground">{champion.nick}</span>
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        <ConferenceSide
          conference="NFC"
          seeds={nfcSeeds}
          picks={bracket.nfc}
          mirrored
          onPick={(round, index, abbr) => onConferencePick('NFC', round, index, abbr)}
        />
      </div>
    </div>
  );
}

function superBowlMatchupFromSeeds(
  afcSeeds: PlayoffSeed[],
  nfcSeeds: PlayoffSeed[],
  bracket: PlayoffBracketPicks
) {
  const afc = bracket.afc.conference
    ? afcSeeds.find((s) => s.abbr === bracket.afc.conference) ?? null
    : null;
  const nfc = bracket.nfc.conference
    ? nfcSeeds.find((s) => s.abbr === bracket.nfc.conference) ?? null
    : null;
  if (!afc || !nfc) return null;
  return { afc, nfc };
}
