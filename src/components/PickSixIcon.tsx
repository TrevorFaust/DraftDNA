import { cn } from '@/lib/utils';
import { PICK_SIX_ICON_PATH } from '@/constants/contest';

type PickSixIconProps = {
  className?: string;
  /** When the adjacent heading already names the challenge, keep the graphic decorative for screen readers. */
  decorative?: boolean;
};

export function PickSixIcon({ className, decorative = true }: PickSixIconProps) {
  return (
    <img
      src={PICK_SIX_ICON_PATH}
      alt={decorative ? '' : 'Pick Six Challenge'}
      aria-hidden={decorative}
      className={cn('block max-h-full max-w-full pointer-events-none select-none object-contain', className)}
      decoding="async"
      draggable={false}
    />
  );
}

type PickSixMarkProps = {
  /** Outer frame: fixed size, `rounded-*`, background, shadows, `group-hover:*`, etc. */
  frameClassName: string;
  /**
   * Zoom after `object-contain` (parent clips). Default tuned so the mark fills the tile without reading past the rounded edge.
   */
  edgeScale?: number;
  /** Nudge the painted logo horizontally in px (negative = left). */
  shiftX?: number;
  /** Nudge the painted logo vertically in px (positive = down). */
  shiftY?: number;
};

/**
 * Pick Six logo in a rounded tile: image fills the frame (`inset-0`), `object-contain` + `object-center`, then
 * translate + `scale` from `origin-center` so zoom stays balanced while the parent clips.
 */
export function PickSixMark({
  frameClassName,
  edgeScale = 2.2932,
  shiftX = -10,
  shiftY = 10,
}: PickSixMarkProps) {
  return (
    <div className={cn('relative shrink-0 overflow-hidden', frameClassName)}>
      <img
        src={PICK_SIX_ICON_PATH}
        alt=""
        aria-hidden
        decoding="async"
        draggable={false}
        className="pointer-events-none select-none absolute inset-0 block h-full w-full origin-center object-contain object-center"
        style={{ transform: `translate(${shiftX}px, ${shiftY}px) scale(${edgeScale})` }}
      />
    </div>
  );
}
