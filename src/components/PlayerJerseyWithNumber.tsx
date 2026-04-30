import { cn } from '@/lib/utils';
import { getTeamJerseyImageUrl } from '@/constants/teamJerseyAssets';

type JerseySize = 'card' | 'dialog';

interface PlayerJerseyWithNumberProps {
  team: string | null;
  jerseyNumber: number | null | undefined;
  /** `teams.team_color2` — jersey number interior fill */
  numberFillColor: string;
  size?: JerseySize;
  className?: string;
  /** Defense / FA placeholders when there is no jersey number */
  position?: string | null;
}

function jerseyNumberDisplay(n: number | null | undefined): string | null {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return null;
  const v = Math.floor(Number(n));
  if (v < 0 || v > 999) return null;
  return String(v);
}

function isDefensePosition(p: string | null | undefined): boolean {
  if (p == null || p === '') return false;
  const u = p.trim().toUpperCase();
  return u === 'D/ST' || u === 'DEF' || u === 'DST';
}

function isFreeAgentTeam(team: string | null | undefined): boolean {
  if (team == null || team === '') return true;
  return team.trim().toUpperCase() === 'FA';
}

/** Collegiate / varsity block (Google Fonts "Graduate"); Teko as geometric fallback */
const JERSEY_NUM_FONT =
  "'Graduate', 'Teko', 'Archivo Black', Impact, 'Arial Narrow', sans-serif";

/**
 * Graduate’s “0” has an inner dot. When the number includes 0, use one athletic stack for the
 * whole string (Teko first = plain oval zero) so “10” / “80” aren’t mixed fonts.
 */
const JERSEY_NUM_FONT_PLAIN_ZERO =
  "'Teko', 'Archivo Black', 'Graduate', Impact, 'Arial Narrow', sans-serif";

function overlayFontSize(overlay: string, size: JerseySize): number {
  if (overlay === 'X' || overlay === '?') {
    return size === 'dialog' ? 28 : 22;
  }
  if (overlay.length >= 3) return 13;
  if (overlay.length >= 2) return size === 'dialog' ? 19 : 15;
  return size === 'dialog' ? 24 : 19;
}

/**
 * Team jersey PNG: number, D/ST “X”, or FA “?” — same collegiate outline + fill styling.
 */
export function PlayerJerseyWithNumber({
  team,
  jerseyNumber,
  numberFillColor,
  size = 'card',
  className,
  position = null,
}: PlayerJerseyWithNumberProps) {
  const src = getTeamJerseyImageUrl(team);
  const numStr = jerseyNumberDisplay(jerseyNumber);
  const overlayStr = isFreeAgentTeam(team)
    ? '?'
    : isDefensePosition(position)
      ? 'X'
      : numStr ?? '0';

  const frame =
    size === 'dialog' ? 'h-28 w-20' : 'h-[4.25rem] w-[3.25rem]';

  const fontSize = overlayStr == null ? 0 : overlayFontSize(overlayStr, size);

  const outerStroke = size === 'dialog' ? 5.8 : 4.6;
  const innerStroke = size === 'dialog' ? 1.35 : 1.1;

  /** Card frame differs from dialog; slight x/y nudges so the number lines up with the art. */
  const numX = size === 'card' ? 47.5 : 47;
  const numYBase = size === 'card' ? 75 : 82;
  /** “X” / “?” sit a bit high on Graduate; nudge down toward jersey center. */
  const numY =
    overlayStr === 'X' || overlayStr === '?' ? numYBase + 3 : numYBase;

  if (!src) return null;

  const letterSpacing =
    overlayStr != null && overlayStr.length >= 2 ? '0.035em' : '0';
  const usesPlainZero = overlayStr.includes('0');

  const textProps = {
    x: numX,
    y: numY,
    textAnchor: 'middle' as const,
    dominantBaseline: 'middle' as const,
    fontSize,
    fontFamily: usesPlainZero ? JERSEY_NUM_FONT_PLAIN_ZERO : JERSEY_NUM_FONT,
    fontWeight: (usesPlainZero ? 700 : 400) as const,
    letterSpacing,
    strokeLinejoin: 'miter' as const,
    strokeLinecap: 'butt' as const,
    strokeMiterlimit: 2.5 as const,
  };

  return (
    <div
      className={cn(
        'relative shrink-0 flex items-end justify-center pointer-events-none',
        frame,
        className
      )}
      aria-hidden
    >
      <img
        src={src}
        alt=""
        className="max-h-full max-w-full object-contain object-bottom drop-shadow-md select-none"
        loading="lazy"
        decoding="async"
        draggable={false}
      />
      {overlayStr != null && (
        <svg
          className="absolute inset-0 h-full w-full overflow-visible select-none"
          viewBox="0 0 100 120"
          preserveAspectRatio="xMidYMid meet"
        >
          <g transform={`rotate(8 ${numX} ${numY})`}>
            <g
              transform={
                overlayStr === 'X'
                  ? `translate(${numX} ${numY}) scale(1.12 ${size === 'dialog' ? 0.93 : 1}) translate(${-numX} ${-numY})`
                  : undefined
              }
            >
              <text
                {...textProps}
                fill="none"
                stroke="#000000"
                strokeWidth={outerStroke}
              >
                {overlayStr}
              </text>
              <text
                {...textProps}
                fill={numberFillColor}
                stroke="#000000"
                strokeWidth={innerStroke}
                paintOrder="stroke fill"
              >
                {overlayStr}
              </text>
            </g>
          </g>
        </svg>
      )}
    </div>
  );
}
