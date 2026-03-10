/**
 * Badge component for draft archetypes.
 * Gold/bronze style like achievement badges. Each archetype gets a unique
 * visual via deterministic hash (icon + gradient).
 *
 * iconOnly: small circle with icon; hover shows name + description + why earned.
 * Full badge: pill with icon + name (for badges page grid).
 */

import { Crown, Trophy, Award, Target, Zap, Star, Shield, Flame, Swords, Sparkles, HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { getArchetypeByNameOrImproviser } from '@/constants/archetypeListWithImproviser';
import { getArchetypeDescription, getArchetypeEarnedReason } from '@/constants/archetypeDescriptions';
import { cn } from '@/lib/utils';

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
  /** Greyed out with ? icon (not yet earned) */
  locked?: boolean;
  className?: string;
}

export function ArchetypeBadge({
  archetypeName,
  archetypeIndex,
  iconOnly = true,
  size = 'sm',
  earnedFromDraft,
  locked = false,
  className,
}: ArchetypeBadgeProps) {
  const archetype = getArchetypeByNameOrImproviser(archetypeName);
  const strategies = archetype?.strategies;
  const description = strategies ? getArchetypeDescription(strategies) : archetypeName;
  const whyText = strategies ? getArchetypeEarnedReason(strategies) : `Complete a draft matching this archetype to unlock.`;
  const { Icon, gradient } = getBadgeStyle(archetypeName, archetypeIndex);

  const tooltipContent = (
    <TooltipContent side="top" className="max-w-[260px]">
      {locked ? (
        <p className="text-muted-foreground text-sm">Complete a draft matching this strategy to unlock.</p>
      ) : (
        <>
          <p className="font-medium mb-1">{archetypeName}</p>
          <p className="text-muted-foreground text-xs mb-1">{description}</p>
          <p className="text-muted-foreground/80 text-xs italic">{whyText}</p>
        </>
      )}
    </TooltipContent>
  );

  if (iconOnly) {
    const circleSize = size === 'sm' ? 'w-7 h-7' : 'w-10 h-10';
    const iconSize = size === 'sm' ? 'w-3.5 h-3.5' : 'w-5 h-5';
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'rounded-full flex items-center justify-center border shadow-sm cursor-default',
              locked
                ? 'bg-muted/60 border-muted-foreground/20 text-muted-foreground'
                : cn('border-amber-500/30 bg-gradient-to-br text-amber-950', gradient),
              circleSize,
              className
            )}
            role="img"
            aria-label={archetypeName}
          >
            {locked ? <HelpCircle className={iconSize} /> : <Icon className={iconSize} />}
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
