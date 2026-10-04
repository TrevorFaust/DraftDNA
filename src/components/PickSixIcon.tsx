import { cn } from '@/lib/utils';
import { PICK_SIX_ICON_PATH } from '@/constants/contest';

type PickSixIconProps = {
  className?: string;
  /** When the adjacent heading already names the challenge, keep the graphic decorative for screen readers. */
  decorative?: boolean;
};

export function PickSixIcon({
  className,
  decorative = true,
}: PickSixIconProps) {
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

/** Ink bounds of `pick_six_icon.png` (676×369). The catcher sits in the right half of a wide canvas. */
const PICK_SIX_ART = { x: 257, y: 25, w: 265, h: 273, imgW: 676, imgH: 369 } as const;

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
  /** `contain` shows the full figure. `cropped` zooms into the tile. */
  fit?: 'cropped' | 'contain';
  /** Extra zoom for `contain`, so the figure can fill a tile that has empty canvas around it. */
  zoom?: number;
  /**
   * Size the frame to the catcher and drop the empty canvas. `pad` is the buffer on each side,
   * as a fraction of the frame (0.08 ≈ a thin margin around the top-right and bottom-left of the art).
   */
  hug?: boolean;
  hugPad?: number;
  /** `gold` recolors the navy mark so it reads on a black page. */
  tone?: 'native' | 'gold';
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
  fit = 'cropped',
  zoom = 1,
  hug = false,
  hugPad = 0.08,
  tone = 'native',
}: PickSixMarkProps) {
  const cropped = fit === 'cropped';
  const hugStyle = hug ? hugImageStyle(hugPad) : undefined;
  return (
    <div className={cn('relative shrink-0 overflow-hidden', frameClassName)}>
      <img
        src={PICK_SIX_ICON_PATH}
        alt=""
        aria-hidden
        decoding="async"
        draggable={false}
        className={cn(
          'pointer-events-none select-none absolute block max-w-none',
          hug
            ? 'h-auto w-auto'
            : 'inset-0 h-full w-full object-contain',
          !hug && (cropped || zoom !== 1 ? 'origin-center object-center' : 'p-[14%]'),
          tone === 'gold' && 'pick-six-on-dark',
        )}
        style={
          hugStyle
            ? hugStyle
            : cropped
              ? { transform: `translate(${shiftX}px, ${shiftY}px) scale(${edgeScale})` }
              : zoom !== 1
                ? { transform: `scale(${zoom})` }
                : undefined
        }
      />
    </div>
  );
}

/** Place the catcher in the frame with `pad` of the frame left empty on every side. */
function hugImageStyle(pad: number): { width: string; height: string; left: string; top: string } {
  const inner = 1 - pad * 2;
  const widthPct = (inner / (PICK_SIX_ART.w / PICK_SIX_ART.imgW)) * 100;
  const heightPct = (inner / (PICK_SIX_ART.h / PICK_SIX_ART.imgH)) * 100;
  const leftPct = pad * 100 - (PICK_SIX_ART.x / PICK_SIX_ART.imgW) * widthPct;
  const topPct = pad * 100 - (PICK_SIX_ART.y / PICK_SIX_ART.imgH) * heightPct;
  return {
    width: `${widthPct}%`,
    height: `${heightPct}%`,
    left: `${leftPct}%`,
    top: `${topPct}%`,
  };
}
