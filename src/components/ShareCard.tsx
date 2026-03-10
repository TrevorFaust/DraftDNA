import { forwardRef } from 'react';
import { Crown } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { FootballHelmetIcon } from '@/components/icons/FootballHelmetIcon';
import { getFullTeamName } from '@/utils/teamMapping';
import type { Player } from '@/types/database';

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
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-cyan-400 to-cyan-600 flex items-center justify-center shadow-[0_0_8px_rgba(34,211,238,0.4)]">
              <FootballHelmetIcon className="w-3 h-3 text-white" />
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

        {/* Slots - #1 largest with crown, tapering width/height to #6 smallest */}
        <div className="relative flex flex-col items-center px-3 pb-1 space-y-0.5">
          {players.map((player, i) => {
            const isCrown = i === 0;
            const widthClasses = [
              'w-full',      // #1 widest
              'w-[96%]',
              'w-[92%]',
              'w-[88%]',
              'w-[84%]',
              'w-[80%]',     // #6 narrowest
            ][i];
            const sizeClasses = [
              'py-2.5 px-4',   // #1 largest
              'py-2 px-3.5',
              'py-1.5 px-3',
              'py-1.5 px-3',
              'py-1 px-3',
              'py-1 px-3',   // #6 smallest
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
                  className={`flex flex-col items-center justify-center rounded-lg border backdrop-blur-md ${widthClasses} mx-auto ${sizeClasses} ${
                    isCrown
                      ? 'bg-amber-500/15 border-amber-400/50 shadow-[0_0_20px_rgba(251,191,36,0.25),inset_0_1px_0_rgba(255,255,255,0.08)]'
                      : 'bg-white/[0.05] border-cyan-500/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]'
                  }`}
                >
                  <span
                    className={`font-bold tracking-wider ${
                      isCrown ? 'text-amber-400' : 'text-slate-500'
                    } ${rankSizeClasses}`}
                  >
                    #{i + 1}
                  </span>
                  <div className={`font-semibold text-slate-100 tracking-wide text-center ${textSizeClasses}`}>
                    {player.name}
                  </div>
                  <div className="text-slate-500 text-[10px] font-medium text-center">
                    {teamDisplay(player.team)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer CTA - compact horizontal layout */}
        <div className="relative px-4 py-1 bg-white/[0.03] border-t border-cyan-500/30 backdrop-blur-sm flex items-center justify-between gap-3">
          <p className="text-slate-300 font-bold text-[10px] tracking-[0.1em] uppercase">
            Can you beat this sequence?
          </p>
          <div className="flex items-center gap-2">
            <div className="bg-white p-1 rounded">
              <QRCodeSVG value={shareUrl} size={36} level="M" />
            </div>
            <p className="text-slate-500 text-[10px]">Scan to try</p>
          </div>
        </div>
      </div>
    );
  }
);

ShareCard.displayName = 'ShareCard';
