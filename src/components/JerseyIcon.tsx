import { cn } from '@/lib/utils';
import { parseSvgViewBox, recolorJerseyByInkscapeLabels } from '@/lib/jerseyRecolorByLabel';
import jerseySvgRaw from '@/assets/empty_football_jersey.svg?raw';

interface JerseyIconProps {
  jerseyNumber: number | null | undefined;
  /** DB `team_color` */
  primaryColor?: string | null;
  /** DB `team_color2` */
  secondaryColor?: string | null;
  /** DB `team_color3` */
  tertiaryColor?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const DEFAULT_PRIMARY = '#8B1538';
const DEFAULT_SECONDARY = '#FFD700';
const DEFAULT_TERTIARY = '#FFFFFF';

function safeHexColor(value: string | null | undefined, fallback: string): string {
  if (value == null || value === '') return fallback;
  const t = value.trim();
  if (/^#[0-9A-Fa-f]{3}$/.test(t) || /^#[0-9A-Fa-f]{6}$/.test(t) || /^#[0-9A-Fa-f]{8}$/.test(t)) {
    return t;
  }
  return fallback;
}

function stripLeadingXmlDecl(svg: string): string {
  return svg.replace(/<\?xml[\s\S]*?\?>\s*/i, '').trim();
}

export const JerseyIcon = ({
  jerseyNumber,
  primaryColor,
  secondaryColor,
  tertiaryColor,
  size = 'md',
  className,
}: JerseyIconProps) => {
  const sizeClasses = {
    sm: 'w-16 h-20',
    md: 'w-20 h-28',
    lg: 'w-28 h-36',
  };

  const primary = safeHexColor(primaryColor, DEFAULT_PRIMARY);
  const secondary = safeHexColor(secondaryColor, DEFAULT_SECONDARY);
  const tertiary = safeHexColor(tertiaryColor, DEFAULT_TERTIARY);

  const jerseyNumStr =
    jerseyNumber !== null && jerseyNumber !== undefined ? Math.floor(jerseyNumber).toString() : null;

  const baseSvg = stripLeadingXmlDecl(jerseySvgRaw);
  const themedSvg = recolorJerseyByInkscapeLabels(baseSvg, primary, secondary, tertiary);
  const viewBox = parseSvgViewBox(themedSvg);

  return (
    <div
      className={cn(
        'relative flex items-center justify-center',
        sizeClasses[size],
        className
      )}
      style={{ filter: 'drop-shadow(3px 5px 8px rgba(0,0,0,0.4))' }}
    >
      <div
        className="pointer-events-none absolute inset-0 [&>svg]:h-full [&>svg]:w-full"
        dangerouslySetInnerHTML={{ __html: themedSvg }}
        aria-hidden
      />
      {jerseyNumStr && (
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full select-none"
          viewBox={viewBox}
          xmlns="http://www.w3.org/2000/svg"
        >
          <text
            x="50%"
            y="38%"
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="88"
            fontWeight="900"
            fontFamily="Arial Black, Arial, sans-serif"
            fill={primary}
            stroke={primary}
            strokeWidth="4"
            strokeLinejoin="round"
            strokeLinecap="round"
            style={{ paintOrder: 'stroke fill' }}
          >
            {jerseyNumStr}
          </text>
          <text
            x="50%"
            y="38%"
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="88"
            fontWeight="900"
            fontFamily="Arial Black, Arial, sans-serif"
            fill={secondary}
          >
            {jerseyNumStr}
          </text>
          <text
            x="82%"
            y="20%"
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="26"
            fontWeight="900"
            fontFamily="Arial Black, Arial, sans-serif"
            fill={primary}
            stroke={primary}
            strokeWidth="2"
            strokeLinejoin="round"
            style={{ paintOrder: 'stroke fill' }}
          >
            {jerseyNumStr}
          </text>
          <text
            x="82%"
            y="20%"
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="26"
            fontWeight="900"
            fontFamily="Arial Black, Arial, sans-serif"
            fill={secondary}
          >
            {jerseyNumStr}
          </text>
        </svg>
      )}
    </div>
  );
};
