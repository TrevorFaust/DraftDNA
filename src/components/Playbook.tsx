import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { prefersReducedMotion } from "@/components/landing/landingBoard";
import { cn } from "@/lib/utils";

export type PlaybookPage = {
  id: string;
  title: string;
  body: string;
  href?: string;
  actionLabel?: string;
  onOpen?: () => void;
  extra?: ReactNode;
  /** Fills the sheet. The spine still lists the page. */
  preview?: ReactNode;
};

/**
 * One open page at a time. The spine lists every page; the sheet shows the one you picked.
 */
export function Playbook({
  label,
  pages,
  emptyTitle,
  emptyBody,
  emptyHref,
  emptyAction,
  autoAdvanceMs,
  spineTitle,
  numbered = true,
  showIndex = true,
}: {
  label: string;
  pages: PlaybookPage[];
  emptyTitle: string;
  emptyBody: string;
  emptyHref?: string;
  emptyAction?: string;
  /** Advance to the next page on this interval. Any click on the list restarts the wait. */
  autoAdvanceMs?: number;
  /** Small bar above the page list. */
  spineTitle?: string;
  /** Show 01, 02, … beside each page. */
  numbered?: boolean;
  /** Show "Play 04" above the open page title. */
  showIndex?: boolean;
}) {
  const [active, setActive] = useState(0);
  const [dwell, setDwell] = useState(0);
  const safeIndex = pages.length === 0 ? 0 : Math.min(active, pages.length - 1);
  const page = pages[safeIndex];

  useEffect(() => {
    if (!autoAdvanceMs || pages.length < 2 || prefersReducedMotion()) return;
    const id = window.setTimeout(() => {
      setActive((current) => (current + 1) % pages.length);
    }, autoAdvanceMs);
    return () => window.clearTimeout(id);
  }, [active, dwell, autoAdvanceMs, pages.length]);

  function choose(index: number) {
    setActive(index);
    setDwell((current) => current + 1);
  }

  function move(next: number) {
    if (pages.length === 0) return;
    const wrapped = (next + pages.length) % pages.length;
    setActive(wrapped);
    const id = pages[wrapped]?.id;
    if (!id) return;
    requestAnimationFrame(() => {
      document.getElementById(`${label}-tab-${id}`)?.focus();
    });
  }

  return (
    <div className="overflow-hidden rounded-md border border-border bg-card">
      <div
        className={cn(
          'grid md:grid-cols-[17.5rem_minmax(0,1fr)]',
          page?.preview && 'md:h-[min(36rem,74dvh)]'
        )}
      >
        <div className="flex min-h-0 min-w-0 flex-col overflow-hidden border-b border-border md:border-b-0 md:border-r">
          {spineTitle ? (
            <div className="shrink-0 border-b border-border bg-secondary/50 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {spineTitle}
            </div>
          ) : null}
        <div
          role="tablist"
          aria-label={label}
          className="flex min-h-0 flex-1 gap-1.5 overflow-x-auto p-2 md:flex-col md:gap-2 md:overflow-hidden md:p-3"
        >
          {pages.length === 0 ? (
            <p className="px-2 py-3 text-sm text-muted-foreground">Nothing filed yet.</p>
          ) : (
            pages.map((item, index) => {
              const selected = index === safeIndex;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  id={`${label}-tab-${item.id}`}
                  aria-selected={selected}
                  aria-controls={`${label}-panel`}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => choose(index)}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
                      event.preventDefault();
                      move(index + 1);
                    } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
                      event.preventDefault();
                      move(index - 1);
                    } else if (event.key === "Home") {
                      event.preventDefault();
                      setActive(0);
                    } else if (event.key === "End") {
                      event.preventDefault();
                      setActive(pages.length - 1);
                    }
                  }}
                  className={cn(
                    "flex min-h-11 shrink-0 items-center gap-3 rounded-md px-3 text-left transition-colors",
                    "md:min-h-16 md:flex-1 md:gap-4 md:px-4",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    selected
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                  )}
                >
                  {numbered ? (
                    <span className="w-8 shrink-0 font-editorial text-xl leading-none text-primary tabular-nums md:text-2xl">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  ) : null}
                  <span className="min-w-0 truncate text-sm font-medium md:whitespace-normal md:text-base md:leading-snug">
                    {item.title}
                  </span>
                </button>
              );
            })
          )}
        </div>
        </div>

        <div
          role="tabpanel"
          id={`${label}-panel`}
          aria-labelledby={page ? `${label}-tab-${page.id}` : undefined}
          className="min-h-0 min-w-0 overflow-hidden"
        >
          {page ? (
            page.preview ? (
              <div className="flex h-[min(36rem,74dvh)] min-h-0 flex-col md:h-full">
                <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:px-5">
                  <div className="min-w-0">
                    {showIndex ? (
                      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                        {label} {String(safeIndex + 1).padStart(2, "0")}
                      </p>
                    ) : null}
                    <h3
                      className={cn(
                        "font-editorial text-2xl font-medium leading-none tracking-tight text-foreground sm:text-3xl",
                        showIndex && "mt-1"
                      )}
                    >
                      {page.title}
                    </h3>
                    <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted-foreground">{page.body}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
                    {page.href ? (
                      <Link to={page.href} className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        <Button variant="hero" size="sm" className="h-11 w-full sm:w-auto" onClick={page.onOpen}>
                          {page.actionLabel ?? "Open"}
                        </Button>
                      </Link>
                    ) : page.onOpen ? (
                      <Button variant="hero" size="sm" className="h-11 w-full sm:w-auto" onClick={page.onOpen}>
                        {page.actionLabel ?? "Open"}
                      </Button>
                    ) : null}
                    {page.extra}
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-hidden bg-background/35">{page.preview}</div>
              </div>
            ) : (
              <div className="px-4 py-5 sm:px-7 sm:py-6">
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  {label} {String(safeIndex + 1).padStart(2, "0")}
                </p>
                <h3 className="mt-2 font-editorial text-3xl font-medium leading-none tracking-tight text-foreground sm:text-4xl">
                  {page.title}
                </h3>
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
                  {page.body}
                </p>
                <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                  {page.href ? (
                    <Link to={page.href} className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <Button variant="hero" size="sm" className="h-11 w-full sm:w-auto" onClick={page.onOpen}>
                        {page.actionLabel ?? "Open"}
                      </Button>
                    </Link>
                  ) : page.onOpen ? (
                    <Button variant="hero" size="sm" className="h-11 w-full sm:w-auto" onClick={page.onOpen}>
                      {page.actionLabel ?? "Open"}
                    </Button>
                  ) : null}
                  {page.extra}
                </div>
              </div>
            )
          ) : (
            <div className="px-4 py-5 sm:px-7 sm:py-6">
              <h3 className="font-editorial text-3xl font-medium leading-none tracking-tight">{emptyTitle}</h3>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">{emptyBody}</p>
              {emptyHref ? (
                <Link to={emptyHref} className="mt-5 inline-flex rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Button variant="hero" size="sm" className="h-11">
                    {emptyAction ?? "Open"}
                  </Button>
                </Link>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
