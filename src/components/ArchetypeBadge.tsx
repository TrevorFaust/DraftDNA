/**
 * Badge component for draft archetypes.
 * When composed PNGs exist under public/badges/ (see archetypeBadgeAssets.generated.ts),
 * earned badges show that art. Locked badges use public/badges/locked.png; otherwise gradient + icon.
 *
 * iconOnly: thumbnail (size sm/md); hover shows name + description + why earned when unlocked. Locked: no tooltip (identity hidden until earned).
 * Full badge: large composed art (name is on the asset), or pill with icon + name for gradient fallback.
 */

import { useState, useEffect } from 'react';
import { Crown, Trophy, Award, Target, Zap, Star, Shield, Flame, Swords, Sparkles } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { getArchetypeByName } from '@/constants/archetypeMappings.generated';
import { getArchetypeDescription, getArchetypeEarnedReason } from '@/constants/archetypeDescriptions';
import { getArchetypeBadgePublicUrl } from '@/constants/archetypeBadgeAssets.generated';
import { cn, capitalizeSentenceStart } from '@/lib/utils';

/** Served from `public/badges/locked.png`. */
const BADGE_LOCKED_PUBLIC_URL = '/badges/locked.png';

const BADGE_ICONS = [Crown, Trophy, Award, Target, Zap, Star, Shield, Flame, Swords, Sparkles];

const BADGE_GRADIENTS = [
  'from-amber-400 via-yellow-500 to-amber-600',
  'from-yellow-500 via-amber-500 to-yellow-700',
  'from-amber-300 via-yellow-400 to-amber-600',
  'from-amber-500 via-yellow-600 to-amber-800',
];

/** Pick icon and gradient. When archetypeIndex is provided (e.g. Badges grid), each slot gets a distinct combo; otherwise hash by name. */
function getBadgeStyle(name: string, archetypeIndex?: number): { Icon: typeof Crown; gradient: string } {
  if (typeof archetypeIndex === 'number') {
    const iconIdx = archetypeIndex % BADGE_ICONS.length;
    const gradIdx = Math.floor(archetypeIndex / BADGE_ICONS.length) % BADGE_GRADIENTS.length;
    return { Icon: BADGE_ICONS[iconIdx], gradient: BADGE_GRADIENTS[gradIdx] };
  }
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = ((h << 5) - h) + name.charCodeAt(i);
    h = h & h;
  }
  const iconIdx = Math.abs(h) % BADGE_ICONS.length;
  const gradIdx = Math.abs(h >> 8) % BADGE_GRADIENTS.length;
  return { Icon: BADGE_ICONS[iconIdx], gradient: BADGE_GRADIENTS[gradIdx] };
}

interface ArchetypeBadgeProps {
  archetypeName: string;
  /** When provided (e.g. Badges page grid), icon/gradient are chosen by index so each badge is visually distinct. */
  archetypeIndex?: number;
  /** Icon-only circle (hover for tooltip) vs full pill with name */
  iconOnly?: boolean;
  /** Size of icon-only circle: sm (history) vs md (badges page) */
  size?: 'sm' | 'md';
  /** Draft-specific context for "why you got it" */
  earnedFromDraft?: string;
  /** Not yet earned: uses public/badges/locked.png instead of composed art (unless showUnlockedAppearance). */
  locked?: boolean;
  /** When true with locked, show real badge art instead of locked.png (preview / debug). */
  showUnlockedAppearance?: boolean;
  /** Override flavor text (e.g. for chaos badges) */
  flavorText?: string;
  className?: string;
}

export function ArchetypeBadge({
  archetypeName,
  archetypeIndex,
  iconOnly = true,
  size = 'sm',
  earnedFromDraft,
  locked = false,
  showUnlockedAppearance = false,
  flavorText: flavorTextOverride,
  className,
}: ArchetypeBadgeProps) {
  const archetype = getArchetypeByName(archetypeName);
  const strategies = archetype?.strategies;
  const flavorTextRaw = flavorTextOverride ?? archetype?.flavorText;
  const flavorText = flavorTextRaw ? capitalizeSentenceStart(flavorTextRaw) : undefined;
  const description = strategies ? getArchetypeDescription(strategies) : archetypeName;
  const whyText = strategies ? getArchetypeEarnedReason(strategies) : `Complete a draft matching this archetype to unlock.`;
  const { Icon, gradient } = getBadgeStyle(archetypeName, archetypeIndex);

  const badgeAssetUrl = getArchetypeBadgePublicUrl(archetypeName);
  const [assetLoadFailed, setAssetLoadFailed] = useState(false);
  useEffect(() => {
    setAssetLoadFailed(false);
  }, [badgeAssetUrl]);
  const showCustomArt =
    !!badgeAssetUrl && (!locked || showUnlockedAppearance) && !assetLoadFailed;

  const tooltipContent = (
    <TooltipContent side="top" className="max-w-[320px]">
      <p className="font-medium mb-1">{archetypeName}</p>
      {flavorText ? (
        <p className="text-muted-foreground text-xs">{flavorText}</p>
      ) : (
        <>
          <p className="text-muted-foreground text-xs mb-1">{description}</p>
          <p className="text-muted-foreground/80 text-xs italic">{whyText}</p>
        </>
      )}
    </TooltipContent>
  );

  if (iconOnly) {
    const circleLocked = locked && !showUnlockedAppearance;
    const circleSize = size === 'sm' ? 'w-7 h-7' : 'w-10 h-10';
    const iconSize = size === 'sm' ? 'w-3.5 h-3.5' : 'w-5 h-5';
    /** Portrait composed badges (360×480): readable ribbon text needs width, not a tiny crop. */
    const customThumbClass =
      size === 'sm'
        ? 'w-[min(100%,7.5rem)] max-w-[7.5rem] aspect-[3/4]'
        : 'w-full max-w-[min(100%,11rem)] sm:max-w-[12.5rem] aspect-[3/4]';

    if (circleLocked) {
      return (
        <div
          className={cn('cursor-default flex items-center justify-center', customThumbClass, className)}
          role="img"
          aria-label="Locked badge"
        >
          <img
            src={BADGE_LOCKED_PUBLIC_URL}
            alt=""
            className="max-h-full max-w-full w-full h-full object-contain object-center select-none pointer-events-none"
            loading="lazy"
            decoding="async"
          />
        </div>
      );
    }

    if (showCustomArt && badgeAssetUrl) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={cn('cursor-default flex items-center justify-center', customThumbClass, className)}
              role="img"
              aria-label={archetypeName}
            >
              <img
                src={badgeAssetUrl}
                alt={archetypeName}
                className="max-h-full max-w-full w-full h-full object-contain object-center select-none pointer-events-none"
                loading="lazy"
                decoding="async"
                onError={() => setAssetLoadFailed(true)}
              />
            </div>
          </TooltipTrigger>
          {tooltipContent}
        </Tooltip>
      );
    }

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'rounded-full flex items-center justify-center border shadow-sm cursor-default',
              'border-amber-500/30 bg-gradient-to-br text-amber-950',
              gradient,
              circleSize,
              className
            )}
            role="img"
            aria-label={archetypeName}
          >
            <Icon className={iconSize} />
          </div>
        </TooltipTrigger>
        {tooltipContent}
      </Tooltip>
    );
  }

  if (locked && !showUnlockedAppearance) {
    return (
      <div
        className={cn('inline-flex flex-col items-center max-w-[min(100vw-2rem,28rem)]', className)}
        role="img"
        aria-label="Locked badge"
      >
        <img
          src={BADGE_LOCKED_PUBLIC_URL}
          alt=""
          className="w-full h-auto max-h-[min(75vh,36rem)] object-contain select-none"
          loading="lazy"
          decoding="async"
        />
      </div>
    );
  }

  if (showCustomArt && badgeAssetUrl) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn('inline-flex flex-col items-center max-w-[min(100vw-2rem,28rem)]', className)}>
            <img
              src={badgeAssetUrl}
              alt={archetypeName}
              className="w-full h-auto max-h-[min(75vh,36rem)] object-contain select-none"
              loading="lazy"
              decoding="async"
              onError={() => setAssetLoadFailed(true)}
            />
          </div>
        </TooltipTrigger>
        {tooltipContent}
      </Tooltip>
    );
  }

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-gradient-to-br shadow-sm',
        gradient,
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1.5 text-sm',
        'text-amber-950 font-semibold',
        className
      )}
    >
      <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} />
      <span>{archetypeName}</span>
    </div>
  );
}
