import { cn } from '@/lib/utils';

export type DraftMobilePanel = 'roster' | 'players' | 'board';

const PANELS: { id: DraftMobilePanel; label: string }[] = [
  { id: 'roster', label: 'Roster' },
  { id: 'players', label: 'Players' },
  { id: 'board', label: 'Board' },
];

/** Segmented control for narrow draft rooms — one module at a time below `lg`. */
export function DraftMobilePanelTabs({
  value,
  onChange,
  className,
}: {
  value: DraftMobilePanel;
  onChange: (panel: DraftMobilePanel) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label="Draft views"
      className={cn(
        'lg:hidden shrink-0 grid grid-cols-3 gap-1 rounded-lg bg-secondary/60 p-1 border border-border/40',
        className
      )}
    >
      {PANELS.map(({ id, label }) => {
        const selected = value === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(id)}
            className={cn(
              'min-h-11 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              selected
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

/** Mobile: show only the active panel. Desktop (`lg+`): always show. */
export function draftMobilePanelClass(
  active: DraftMobilePanel,
  panel: DraftMobilePanel
): string {
  return cn(
    'min-h-0',
    active === panel ? 'flex flex-1' : 'hidden lg:flex'
  );
}
