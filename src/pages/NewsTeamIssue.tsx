import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { BrandedLoader } from "@/components/BrandedLoader";
import { NewsBreadcrumb, NewsPageFrame } from "@/components/news/NewsPageFrame";
import { TeamSectionBody } from "@/components/news/TeamSectionBody";
import { weekInReviewTitle, weekRangeCompact } from "@/lib/newsletter/dates";
import { fetchPlayerPositionLookup, serializePlayerLookup } from "@/lib/newsletter/playerRegistry";
import { fetchTeamWeeklyIssue } from "@/lib/newsletter/queries";
import { getTeamBySlug } from "@/lib/newsletter/teams";

export default function NewsTeamIssue() {
  const { teamSlug = "", issueSlug = "" } = useParams();
  const staticTeam = getTeamBySlug(teamSlug);

  const issueQuery = useQuery({
    queryKey: ["newsletter-team-issue", teamSlug, issueSlug, "from-2026-08-03"],
    queryFn: () => fetchTeamWeeklyIssue(teamSlug, issueSlug),
    enabled: Boolean(teamSlug && issueSlug),
  });

  const playersQuery = useQuery({
    queryKey: ["newsletter-player-lookup"],
    queryFn: async () => serializePlayerLookup(await fetchPlayerPositionLookup()),
    staleTime: 30 * 60 * 1000,
    enabled: Boolean(issueQuery.data?.entry),
  });

  if (issueQuery.isLoading) {
    return (
      <NewsPageFrame>
        <div className="flex min-h-[40vh] items-center justify-center">
          <BrandedLoader size={36} />
        </div>
      </NewsPageFrame>
    );
  }

  if (issueQuery.error) {
    return (
      <NewsPageFrame>
        <NewsBreadcrumb items={[{ to: "/news", label: "News" }, { label: "Error" }]} />
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Could not load this weekly writeup. Try again in a moment.
        </p>
      </NewsPageFrame>
    );
  }

  const team = issueQuery.data?.team;
  const entry = issueQuery.data?.entry;
  const teamName = team?.name ?? staticTeam?.name ?? teamSlug;

  if (!team || !entry) {
    return (
      <NewsPageFrame>
        <NewsBreadcrumb
          items={[
            { to: "/news", label: "News" },
            { to: `/news/${teamSlug}`, label: teamName },
            { label: "Not found" },
          ]}
        />
        <h1 className="font-display text-3xl">Writeup not found</h1>
        <p className="mt-2 text-muted-foreground">
          No published weekly section for this team and date.
        </p>
        <Link
          to={`/news/${teamSlug}`}
          className="mt-4 inline-block text-sm font-semibold text-primary hover:underline"
        >
          Back to {teamName} weeklies
        </Link>
      </NewsPageFrame>
    );
  }

  const { issue, section } = entry;
  const prev = issueQuery.data.prev;
  const next = issueQuery.data.next;
  const playerEntries = playersQuery.data ?? [];

  return (
    <NewsPageFrame>
      <article className="news-issue">
        <NewsBreadcrumb
          items={[
            { to: "/news", label: "News" },
            { to: `/news/${teamSlug}`, label: teamName },
            { label: weekRangeCompact(issue.issue_date) },
          ]}
        />

        <header className="issue-header mb-6">
          <span className="edition-badge edition-weekly">Weekly Edition</span>
          <p className="mt-3 font-sans text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {team.conference} {team.division}
          </p>
          <h1 className="mt-1 font-display text-4xl tracking-wide">{teamName}</h1>
          <p className="team-day-date mt-2">{weekInReviewTitle(issue.issue_date)}</p>
        </header>

        {(prev || next) && (
          <nav className="issue-adjacent-nav" aria-label="Adjacent weeks">
            {prev ? (
              <Link to={`/news/${teamSlug}/${prev.slug}`} className="issue-adjacent-link">
                <ChevronLeft className="h-5 w-5 shrink-0 text-primary" />
                <span className="issue-adjacent-label">
                  <span className="issue-adjacent-dir">Older week</span>
                  <span className="issue-adjacent-date">{weekRangeCompact(prev.issue_date)}</span>
                </span>
              </Link>
            ) : (
              <span className="issue-adjacent-spacer" />
            )}
            {next ? (
              <Link to={`/news/${teamSlug}/${next.slug}`} className="issue-adjacent-link issue-adjacent-next">
                <span className="issue-adjacent-label">
                  <span className="issue-adjacent-dir">Newer week</span>
                  <span className="issue-adjacent-date">{weekRangeCompact(next.issue_date)}</span>
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-primary" />
              </Link>
            ) : (
              <span className="issue-adjacent-spacer" />
            )}
          </nav>
        )}

        <TeamSectionBody section={section} playerEntries={playerEntries} />
      </article>
    </NewsPageFrame>
  );
}
