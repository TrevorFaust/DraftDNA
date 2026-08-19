import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BrandedLoader } from "@/components/BrandedLoader";
import { NewsBreadcrumb, NewsPageFrame } from "@/components/news/NewsPageFrame";
import { weekInReviewTitle } from "@/lib/newsletter/dates";
import { fetchNewsletterTeam, fetchTeamWeeklyEntries } from "@/lib/newsletter/queries";
import { getTeamBySlug } from "@/lib/newsletter/teams";

export default function NewsTeamWeeklies() {
  const { teamSlug = "" } = useParams();
  const staticTeam = getTeamBySlug(teamSlug);

  const { data, isLoading, error } = useQuery({
        queryKey: ["newsletter-team-weeklies", teamSlug, "from-2026-08-03"],
    queryFn: async () => {
      const team = await fetchNewsletterTeam(teamSlug);
      if (!team) return { team: null, entries: [] };
      const entries = await fetchTeamWeeklyEntries(team.id);
      return { team, entries };
    },
    enabled: Boolean(teamSlug),
  });

  const teamName = data?.team?.name ?? staticTeam?.name ?? teamSlug;
  const divisionLabel = data?.team
    ? `${data.team.conference} ${data.team.division}`
    : staticTeam
      ? `${staticTeam.conference} ${staticTeam.division}`
      : null;

  if (isLoading) {
    return (
      <NewsPageFrame>
        <div className="flex min-h-[40vh] items-center justify-center">
          <BrandedLoader size={36} />
        </div>
      </NewsPageFrame>
    );
  }

  if (error) {
    return (
      <NewsPageFrame>
        <NewsBreadcrumb items={[{ to: "/news", label: "News" }, { label: "Error" }]} />
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Could not load weekly issues. Try again in a moment.
        </p>
      </NewsPageFrame>
    );
  }

  if (!data?.team && !staticTeam) {
    return (
      <NewsPageFrame>
        <NewsBreadcrumb items={[{ to: "/news", label: "News" }, { label: "Not found" }]} />
        <h1 className="font-display text-3xl">Team not found</h1>
        <p className="mt-2 text-muted-foreground">
          No franchise matches <span className="text-foreground">{teamSlug}</span>.
        </p>
        <Link to="/news" className="mt-4 inline-block text-sm font-semibold text-primary hover:underline">
          Back to News
        </Link>
      </NewsPageFrame>
    );
  }

  const entries = data?.entries ?? [];

  return (
    <NewsPageFrame>
      <NewsBreadcrumb items={[{ to: "/news", label: "News" }, { label: teamName }]} />
      <header className="mb-8">
        {divisionLabel && (
          <p className="mb-1 font-sans text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {divisionLabel}
          </p>
        )}
        <h1 className="font-display text-4xl tracking-wide">{teamName}</h1>
        <p className="mt-2 font-sans text-base font-normal tracking-normal text-muted-foreground">
          Published weekly recaps for this team, newest first.
        </p>
      </header>

      {entries.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-card/60 px-4 py-10 text-center text-muted-foreground">
          No published weekly writeup for this team yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {entries.map(({ issue }) => (
            <li key={issue.slug}>
              <Link
                to={`/news/${teamSlug}/${issue.slug}`}
                className="team-day-entry team-day-entry-weekly flex items-center gap-3 transition-colors hover:border-primary/40"
              >
                <span className="edition-badge edition-weekly shrink-0">Weekly</span>
                <span className="team-day-date">{weekInReviewTitle(issue.issue_date)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </NewsPageFrame>
  );
}
