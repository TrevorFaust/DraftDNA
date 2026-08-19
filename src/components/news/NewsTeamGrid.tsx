import { Link } from "react-router-dom";
import { getDivisionGroups } from "@/lib/newsletter/teams";
import { cn } from "@/lib/utils";

export function NewsTeamGrid({
  compact,
  onSelect,
}: {
  compact?: boolean;
  onSelect?: () => void;
}) {
  const divisions = getDivisionGroups();

  return (
    <div
      className={cn(
        "grid gap-x-4 gap-y-5",
        compact ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
      )}
    >
      {Object.entries(divisions).map(([division, teams]) => (
        <section key={division}>
          <h3 className="mb-2 font-sans text-[0.68rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            {division}
          </h3>
          <ul className="m-0 list-none space-y-0.5 p-0">
            {teams.map((team) => (
              <li key={team.slug}>
                <Link
                  to={`/news/${team.slug}`}
                  onClick={onSelect}
                  className={cn(
                    "flex items-center gap-2 rounded-md text-sm text-foreground transition-colors hover:bg-secondary hover:text-primary",
                    compact ? "px-1.5 py-1" : "min-h-11 px-2 py-1.5"
                  )}
                >
                  <span className="w-7 shrink-0 text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground">
                    {team.abbrev}
                  </span>
                  <span>{team.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
