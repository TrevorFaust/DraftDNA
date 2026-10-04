import { Link } from "react-router-dom";
import { espnLogoAbbr, getConferenceBlocks } from "@/lib/newsletter/teams";
import { cn } from "@/lib/utils";

function TeamMark({ abbrev }: { abbrev: string }) {
  return (
    <img
      src={`https://a.espncdn.com/i/teamlogos/nfl/500/${espnLogoAbbr(abbrev)}.png`}
      alt=""
      width={28}
      height={28}
      loading="lazy"
      decoding="async"
      className="h-7 w-7 shrink-0 object-contain"
    />
  );
}

function TeamLink({
  slug,
  abbrev,
  name,
  onSelect,
  roomy,
}: {
  slug: string;
  abbrev: string;
  name: string;
  onSelect?: () => void;
  roomy?: boolean;
}) {
  return (
    <Link
      to={`/news/${slug}`}
      onClick={onSelect}
      className={cn(
        "flex items-center gap-2.5 rounded-md text-sm text-foreground transition-colors hover:bg-secondary hover:text-primary",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        roomy ? "min-h-11 px-2 py-1.5" : "min-h-10 px-1.5 py-1"
      )}
    >
      <TeamMark abbrev={abbrev} />
      <span className="w-8 shrink-0 text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground">
        {abbrev}
      </span>
      <span className="min-w-0 leading-snug">{name}</span>
    </Link>
  );
}

/**
 * `conferences` matches the Scout DNA teams page: AFC and NFC side by side,
 * each division in its own card.
 * `board` spreads all eight divisions evenly across one panel.
 */
export function NewsTeamGrid({
  layout = "conferences",
  onSelect,
}: {
  layout?: "conferences" | "board";
  onSelect?: () => void;
}) {
  const conferences = getConferenceBlocks();

  if (layout === "board") {
    return (
      <div className="grid grid-cols-2 gap-x-8 gap-y-7 xl:grid-cols-4">
        {conferences.flatMap((block) =>
          block.divisions.map((division) => (
            <section key={`${block.conference}-${division.name}`} className="min-w-0">
              <h3 className="mb-2 text-center font-sans text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {block.conference} {division.name}
              </h3>
              <ul className="m-0 list-none space-y-0.5 p-0">
                {division.teams.map((team) => (
                  <li key={team.slug}>
                    <TeamLink
                      slug={team.slug}
                      abbrev={team.abbrev}
                      name={team.name}
                      onSelect={onSelect}
                      roomy
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    );
  }

  return (
    <div className="grid items-start gap-8 lg:grid-cols-2 lg:gap-10">
      {conferences.map((block) => (
        <div key={block.conference} className="flex flex-col gap-4">
          <h2 className="flex flex-col items-center gap-3">
            <img
              src={`/conference-${block.conference.toLowerCase()}.png`}
              alt=""
              width={520}
              height={385}
              decoding="async"
              className="h-24 w-auto object-contain drop-shadow-[0_8px_18px_hsl(36_50%_20%/0.45)] sm:h-28"
            />
            <span className="flex w-full items-center gap-4">
              <span className="h-px flex-1 bg-border" aria-hidden />
              <span className="rounded-md border border-primary/40 bg-card px-5 py-1.5 font-display text-xl tracking-[0.18em] text-foreground">
                {block.conference}
              </span>
              <span className="h-px flex-1 bg-border" aria-hidden />
            </span>
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {block.divisions.map((division) => (
              <section
                key={division.name}
                className="rounded-md border border-border bg-card/80 px-2.5 py-3"
              >
                <h3 className="mb-2 text-center font-sans text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {block.conference} {division.name}
                </h3>
                <ul className="mx-auto m-0 w-max max-w-full list-none space-y-0.5 p-0">
                  {division.teams.map((team) => (
                    <li key={team.slug}>
                      <TeamLink
                        slug={team.slug}
                        abbrev={team.abbrev}
                        name={team.name}
                        onSelect={onSelect}
                        roomy
                      />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
