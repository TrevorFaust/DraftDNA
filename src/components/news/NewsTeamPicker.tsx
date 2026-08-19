import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Newspaper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { NewsTeamGrid } from "@/components/news/NewsTeamGrid";
import { cn } from "@/lib/utils";

function useFineHover() {
  const [fineHover, setFineHover] = useState(() =>
    typeof window !== "undefined" &&
    window.matchMedia("(hover: hover) and (pointer: fine)").matches
  );

  useEffect(() => {
    const mql = window.matchMedia("(hover: hover) and (pointer: fine)");
    const sync = () => setFineHover(mql.matches);
    sync();
    mql.addEventListener("change", sync);
    return () => mql.removeEventListener("change", sync);
  }, []);

  return fineHover;
}

export function NewsTeamPicker() {
  const { pathname } = useLocation();
  const active = pathname.startsWith("/news");
  const fineHover = useFineHover();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <HoverCard
      openDelay={120}
      closeDelay={180}
      open={fineHover ? open : false}
      onOpenChange={(next) => {
        if (fineHover) setOpen(next);
      }}
    >
      <HoverCardTrigger asChild>
        <Link to="/news" className="shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className={cn("gap-2", active && "bg-secondary text-primary")}
            aria-current={active ? "page" : undefined}
            aria-haspopup={fineHover ? "true" : undefined}
          >
            <Newspaper className="h-4 w-4" />
            <span className="hidden lg:inline">News</span>
          </Button>
        </Link>
      </HoverCardTrigger>
      <HoverCardContent
        align="start"
        sideOffset={8}
        className="z-[60] w-[min(44rem,calc(100vw-2rem))] border-border bg-card p-4 shadow-lg"
      >
        <p className="mb-3 font-sans text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Weekly by team
        </p>
        <NewsTeamGrid compact onSelect={() => setOpen(false)} />
        <div className="mt-3 border-t border-border pt-2 text-center">
          <Link to="/news" className="text-sm font-semibold text-primary hover:underline">
            View all teams
          </Link>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
