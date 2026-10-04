import { cn } from '@/lib/utils';

/**
 * Clipboard holding a draft list, drawn as a vintage editorial ink illustration.
 * Generated art rather than an SVG glyph — the crosshatching and wood grain are the point.
 */
export function DraftClipboardArt({ className }: { className?: string }) {
  return (
    <img
      src="/mock-draft-clipboard.png"
      alt=""
      width={384}
      height={384}
      decoding="async"
      draggable={false}
      className={cn('shrink-0 select-none', className)}
    />
  );
}
