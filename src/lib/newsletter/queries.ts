import { newsletterDb } from "./db";
import { sectionHasContent, type TeamSectionContent } from "./sections";

/** First weekly shown on Pick Six: Jul 27-Aug 2 recap (Monday issue date). */
export const NEWS_WEEKLY_FROM_ISSUE_DATE = "2026-08-03";

export type IssueSummary = {
  issue_date: string;
  slug: string;
  title: string;
  status: string;
  issue_type: "daily" | "weekly";
  published_at: string | null;
};

export type NewsletterTeam = {
  id: string;
  slug: string;
  abbrev: string;
  name: string;
  conference: string;
  division: string;
};

export type TeamWeeklyEntry = {
  issue: IssueSummary;
  section: TeamSectionContent;
};

type SectionRow = TeamSectionContent & {
  newsletter_issues: IssueSummary | IssueSummary[] | null;
};

const SECTION_SELECT = `
  intro_paragraphs,
  rookie_paragraph,
  activity_markdown,
  talk_markdown,
  fantasy_markdown,
  footnotes,
  tags,
  flags,
  is_empty,
  empty_reason,
  newsletter_issues!inner(issue_date, slug, title, status, issue_type, published_at)
`;

function unwrapIssue(raw: SectionRow["newsletter_issues"]): IssueSummary | null {
  const issue = Array.isArray(raw) ? raw[0] : raw;
  if (!issue) return null;
  if (issue.issue_type !== "weekly" || issue.status !== "published") return null;
  if (issue.issue_date < NEWS_WEEKLY_FROM_ISSUE_DATE) return null;
  return issue;
}

function normalizeSection(row: SectionRow): TeamSectionContent {
  const { newsletter_issues: _, ...rest } = row;
  return {
    ...rest,
    footnotes: Array.isArray(rest.footnotes) ? rest.footnotes : [],
    tags: Array.isArray(rest.tags) ? rest.tags : [],
    flags: Array.isArray(rest.flags) ? rest.flags : [],
  };
}

function toWeeklyEntry(row: SectionRow): TeamWeeklyEntry | null {
  const issue = unwrapIssue(row.newsletter_issues);
  if (!issue) return null;
  const section = normalizeSection(row);
  if (!sectionHasContent(section)) return null;
  return { issue, section };
}

export async function fetchNewsletterTeam(slug: string): Promise<NewsletterTeam | null> {
  const { data, error } = await newsletterDb
    .from("newsletter_teams")
    .select("id, slug, abbrev, name, conference, division")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return (data as NewsletterTeam | null) ?? null;
}

export async function fetchTeamWeeklyEntries(teamId: string): Promise<TeamWeeklyEntry[]> {
  const { data, error } = await newsletterDb
    .from("newsletter_sections")
    .select(SECTION_SELECT)
    .eq("team_id", teamId)
    .eq("newsletter_issues.issue_type", "weekly")
    .eq("newsletter_issues.status", "published")
    .gte("newsletter_issues.issue_date", NEWS_WEEKLY_FROM_ISSUE_DATE)
    .order("issue_date", { foreignTable: "newsletter_issues", ascending: false })
    .limit(120);

  if (!error) {
    return ((data ?? []) as SectionRow[])
      .map(toWeeklyEntry)
      .filter((e): e is TeamWeeklyEntry => e !== null)
      .sort((a, b) => b.issue.issue_date.localeCompare(a.issue.issue_date));
  }

  const retry = await newsletterDb
    .from("newsletter_sections")
    .select(
      `intro_paragraphs, rookie_paragraph, activity_markdown, talk_markdown, fantasy_markdown,
       footnotes, tags, flags, is_empty, empty_reason,
       newsletter_issues(issue_date, slug, title, status, issue_type, published_at)`
    )
    .eq("team_id", teamId)
    .order("issue_date", { foreignTable: "newsletter_issues", ascending: false })
    .limit(200);

  if (retry.error) throw error;

  return ((retry.data ?? []) as SectionRow[])
    .map(toWeeklyEntry)
    .filter((e): e is TeamWeeklyEntry => e !== null)
    .sort((a, b) => b.issue.issue_date.localeCompare(a.issue.issue_date));
}

export async function fetchTeamWeeklyIssue(
  teamSlug: string,
  issueSlug: string
): Promise<{
  team: NewsletterTeam | null;
  entry: TeamWeeklyEntry | null;
  prev: IssueSummary | null;
  next: IssueSummary | null;
}> {
  const team = await fetchNewsletterTeam(teamSlug);
  if (!team) {
    return { team: null, entry: null, prev: null, next: null };
  }

  const entries = await fetchTeamWeeklyEntries(team.id);
  const idx = entries.findIndex((e) => e.issue.slug === issueSlug);
  if (idx < 0) {
    return { team, entry: null, prev: null, next: null };
  }

  return {
    team,
    entry: entries[idx],
    prev: idx < entries.length - 1 ? entries[idx + 1].issue : null,
    next: idx > 0 ? entries[idx - 1].issue : null,
  };
}
