import { forwardRef } from 'react';
import { Crown } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { SiteLogo } from '@/components/SiteLogo';
import { getFullTeamName } from '@/utils/teamMapping';
import type { Player } from '@/types/database';
import { getPickSixPlayerSurfaceStyle, useNflTeamJerseyColors } from '@/hooks/useNflTeamJerseyColors';
import { cn } from '@/lib/utils';

export interface ShareCardProps {
  position: string;
  season: number;
  players: Player[];
  playerStats?: Map<string, { totalFantasyPoints: number }>;
  shareUrl: string;
}

/** Position-specific sub-header for Pick Six Challenge */
const POSITION_SUBHEADERS: Record<string, string> = {
  QB: 'The Signal Caller Sequence',
  RB: 'Bell-Cow Bruisers',
  WR: 'Target Share Titans',
  TE: 'The Red Zone Rippers',
  K: 'Mega Leg Longshots',
  'D/ST': 'Defensive Dawgs',
};

function getPositionSubheader(position: string): string {
  return POSITION_SUBHEADERS[position] ?? `The ${position} Order`;
}

/** Footer headline on the share card (Pick Six position tab). */
const SHARE_CARD_HEADLINES: Record<string, string> = {
  K: "Everyone sleeps on kickers. You don't.",
  QB: "That's not luck. That's film study.",
  RB: "Between the tackles, just like you drew it up.",
  WR: "They said inconsistent. You said payday.",
  TE: "You saw the seam. They saw linebackers.",
  'D/ST': "You knew they'd hold. Now hold that $5,000.",
};

function getShareCardHeadline(position: string): string {
  return SHARE_CARD_HEADLINES[position] ?? "You know something they don't. You'll laugh last.";
}

/** Label for "2026 Top 6 Fantasy QBs" style header */
function getSeasonPositionLabel(season: number, position: string): string {
  const posLabel = position === 'D/ST' ? 'Defenses' : `${position}s`;
  return `${season} Top 6 Fantasy ${posLabel}`;
}

/** Full team name for display (e.g. "Baltimore Ravens") */
function teamDisplay(team: string | null | undefined): string {
  const full = getFullTeamName(team);
  return full || (team?.trim()) || '—';
}

/* Grain texture for share card */
const GRAIN_STYLE = {
  backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
};

export const ShareCard = forwardRef<HTMLDivElement, ShareCardProps>(
  ({ position, season, players, playerStats, shareUrl }, ref) => {
    const { data: teamColorsByAbbr } = useNflTeamJerseyColors();
    return (
      <div
        ref={ref}
        className="font-share w-[520px] relative rounded-xl overflow-hidden shadow-2xl border border-cyan-500/20"
        style={{
          backgroundColor: '#1a1c1e',
          backgroundImage: 'linear-gradient(180deg, #232629 0%, #1a1c1e 50%, #16181a 100%)',
        }}
      >
        {/* Grain overlay */}
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none mix-blend-soft-light"
          style={GRAIN_STYLE}
        />

        {/* Header: Pick Six Challenge + 2026 Top 6 Fantasy QBs on same line */}
        <div className="relative flex items-center justify-between gap-3 px-4 pt-2 pb-1 border-b border-cyan-500/30">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-cyan-400 to-cyan-600 flex items-center justify-center shadow-[0_0_8px_rgba(34,211,238,0.4)] overflow-hidden">
              <SiteLogo size={14} className="w-3.5 h-3.5" />
            </div>
            <span className="text-slate-400 text-[10px] font-bold tracking-[0.15em] uppercase">
              Pick Six Challenge
            </span>
          </div>
          <span className="text-slate-400 text-[10px] font-semibold tracking-wide shrink-0">
            {getSeasonPositionLabel(season, position)}
          </span>
        </div>

        {/* Sub-header */}
        <div className="relative px-4 py-2">
          <p className="text-amber-400/90 text-sm font-bold tracking-wider uppercase text-center w-full">
            {getPositionSubheader(position)}
          </p>
        </div>

        {/* Slots - #1 largest with crown, tapering width toward #6 */}
        <div className="relative flex flex-col items-center px-3 pb-1 space-y-0.5">
          {players.map((player, i) => {
            const isCrown = i === 0;
            const widthClasses = [
              'w-full',
              'w-[96%]',
              'w-[92%]',
              'w-[88%]',
              'w-[84%]',
              'w-[80%]',
            ][i];
            const sizeClasses = [
              'py-2.5 px-4',
              'py-2 px-3.5',
              'py-1.5 px-3',
              'py-1.5 px-3',
              'py-1 px-3',
              'py-1 px-3',
            ][i];
            const textSizeClasses = [
              'text-base',
              'text-sm',
              'text-sm',
              'text-sm',
              'text-xs',
              'text-xs',
            ][i];
            const rankSizeClasses = [
              'text-sm',
              'text-xs',
              'text-xs',
              'text-xs',
              'text-[10px]',
              'text-[10px]',
            ][i];
            const surface = getPickSixPlayerSurfaceStyle(teamColorsByAbbr, player.team);
            return (
              <div key={player.id} className={`relative flex flex-col items-center w-full ${isCrown ? 'mt-6' : ''}`}>
                {isCrown && (
                  <div className="absolute -top-5 left-1/2 -translate-x-1/2 z-10" style={{ perspective: '400px' }}>
                    <div className="animate-crown-spin-y" style={{ transformStyle: 'preserve-3d' }}>
                      <Crown className="w-8 h-8 text-amber-400 drop-shadow-[0_0_12px_rgba(251,191,36,0.7)]" fill="currentColor" stroke="currentColor" strokeWidth={0.5} />
                    </div>
                  </div>
                )}
                <div
                  style={surface}
                  className={cn(
                    'flex flex-col items-center justify-center rounded-lg border backdrop-blur-md mx-auto',
                    widthClasses,
                    sizeClasses,
                    surface
                      ? 'shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]'
                      : isCrown
                        ? 'bg-amber-500/15 border-amber-400/50 shadow-[0_0_20px_rgba(251,191,36,0.25),inset_0_1px_0_rgba(255,255,255,0.08)]'
                        : 'bg-white/[0.05] border-cyan-500/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]'
                  )}
                >
                  <span
                    className={cn(
                      'font-bold tracking-wider',
                      rankSizeClasses,
                      surface
                        ? 'opacity-90'
                        : isCrown
                          ? 'text-amber-400'
                          : 'text-slate-500'
                    )}
                  >
                    #{i + 1}
                  </span>
                  <div
                    className={cn(
                      'font-semibold tracking-wide text-center leading-snug',
                      textSizeClasses,
                      !surface && 'text-slate-100'
                    )}
                  >
                    {player.name}
                  </div>
                  <div
                    className={cn(
                      'font-medium text-center',
                      surface ? 'text-xs opacity-90' : 'text-slate-500 text-[10px]'
                    )}
                  >
                    {teamDisplay(player.team)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer CTA — headline centered; QR left + smaller body beside (Pick Six URL) */}
        <div className="relative px-4 py-3 bg-white/[0.03] border-t border-cyan-500/30 backdrop-blur-sm flex flex-col gap-3">
          <p className="text-slate-200 font-bold text-base tracking-wide leading-snug text-center px-2">
            {getShareCardHeadline(position)}
          </p>
          <div className="flex flex-row items-center gap-3">
            <div className="shrink-0">
              <div
                className="bg-white p-1 rounded shadow-sm"
                title="Opens DraftDNA Pick Six (create an account to play)"
              >
                <QRCodeSVG value={shareUrl} size={48} level="M" />
              </div>
            </div>
            <p className="text-slate-500 text-xs leading-relaxed flex-1 min-w-0 text-left">
              Scan the QR code to open DraftDNA&apos;s Pick Six Challenge. Sign up to lock in your prediction and
              win up to $30,000 in prizes.
            </p>
          </div>
        </div>
      </div>
    );
  }
);

ShareCard.displayName = 'ShareCard';
