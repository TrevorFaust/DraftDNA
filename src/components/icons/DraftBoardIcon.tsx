import { cn } from '@/lib/utils';

/**
 * Clipboard holding a draft list: metal clip, board, and four numbered rows
 * whose name bars shorten down the page the way a board reads mid-draft.
 */
export function DraftBoardIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={cn('shrink-0', className)}
    >
      {/* board */}
      <path d="M8 4.5H6.5A1.5 1.5 0 0 0 5 6v13a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19V6a1.5 1.5 0 0 0-1.5-1.5H16" />
      {/* clip */}
      <path d="M9.5 3h5a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-.5.5h-5A.5.5 0 0 1 9 5.5v-2A.5.5 0 0 1 9.5 3Z" />
      {/* numbered rows */}
      <path d="M8 10h.01M8 13.5h.01M8 17h.01" />
      <path d="M10.5 10H16M10.5 13.5h4M10.5 17h2.5" />
    </svg>
  );
}
