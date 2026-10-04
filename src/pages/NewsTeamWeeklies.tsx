import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BrandedLoader } from "@/components/BrandedLoader";
import { EditionTicket, type WeekTicket } from "@/components/news/EditionTicket";
import { NewsBreadcrumb, NewsPageFrame } from "@/components/news/NewsPageFrame";
import { WeeklyReel } from "@/components/news/WeeklyReel";
import { formatIssueDate, recapLabel, weekTabLabel } from "@/lib/newsletter/dates";
import { fetchNewsletterTeam, fetchTeamWeeklyEntries, type TeamWeeklyEntry } from "@/lib/newsletter/queries";
import { usableField, type TeamSectionContent } from "@/lib/newsletter/sections";
import { getTeamBySlug } from "@/lib/newsletter/teams";

/** Markdown to one clean line: no headings, bullets, links, or footnote markers. */
function plainCopy(text: string | null | undefined): string {
  if (!usableField(text)) return "";
  return text!
    .split("\n")
    .filter((line) => !/^\s*#{1,6}\s/.test(line))
    .join("\n")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/[#>*_`]/g, "")
    .replace(/[\u00b9\u00b2\u00b3\u2070-\u209f]/g, "")
    .replace(/\s+/g, " ")
    // Keep scores and spans like "31-7" or "13-game" on one line.
    .replace(/(\d)-(?=[\dA-Za-z])/g, "$1\u2011")
    .trim();
}

/** Periods that end a title or initial rather than a sentence. */
const ABBREVIATION = /(?:\b(?:Jr|Sr|St|Dr|Mr|Ms|No|vs|Inc|Jan|Feb|Aug|Sept?|Oct|Nov|Dec)|\s[A-Z])\.$/;

/**
 * Whole sentences only. Anything after the last terminator is dropped, so a blurb
 * built from these can never trail off mid-thought.
 */
function wholeSentences(text: string): string[] {
  const parts = text.match(/[^.!?]+[.!?]+(?:\s|$)/g) ?? [];
  const out: string[] = [];
  for (const part of parts) {
    const piece = part.trim();
    if (!piece) continue;
    const previous = out[out.length - 1];
    if (previous && ABBREVIATION.test(previous)) out[out.length - 1] = `${previous} ${piece}`;
    else out.push(piece);
  }
  return out;
}

const BLURB_MAX = 210;

/** The opening sentences that fit the ticket, or the first short one if the lead runs long. */
function sectionBlurb(section: TeamSectionContent): string | null {
  const source =
    plainCopy(section.intro_paragraphs) ||
    plainCopy(section.activity_markdown) ||
    plainCopy(section.fantasy_markdown) ||
    plainCopy(section.talk_markdown);
  const all = wholeSentences(source);
  if (all.length === 0) return null;

  if (all[0].length <= BLURB_MAX) {
    let blurb = all[0];
    for (const next of all.slice(1)) {
      if (blurb.length + next.length + 1 > BLURB_MAX) break;
      blurb = `${blurb} ${next}`;
    }
    return blurb;
  }
  return all.find((sentence) => sentence.length <= BLURB_MAX) ?? null;
}

const NOTES_MAX = 4;

/** Players the week leans on — the bolded names in the writeup, in order. */
function keyNotes(section: TeamSectionContent): string[] {
  const notes: string[] = [];
  const seen = new Set<string>();
  const sources = [section.intro_paragraphs, section.fantasy_markdown, section.activity_markdown];

  for (const source of sources) {
    if (!usableField(source)) continue;
    const pattern = /\*\*([^*\n]{3,34})\*\*/g;
    let match = pattern.exec(source!);
    while (match) {
      const name = match[1]
        .trim()
        .replace(/^(?:HC|OC|DC|GM|QB|RB|WR|TE|K|DST)\s+/, "")
        .replace(/[’']s$/, "")
        .replace(/[.,:;]$/, "");
      if (/^[A-Z][^\s]*\s+[A-Z]/.test(name) && !seen.has(name)) {
        seen.add(name);
        notes.push(name);
        if (notes.length === NOTES_MAX) return notes;
      }
      match = pattern.exec(source!);
    }
  }
  return notes;
}

function toTicket(entry: TeamWeeklyEntry, teamSlug: string, kicker: string): WeekTicket {
  return {
    slug: entry.issue.slug,
    href: `/news/${teamSlug}/${entry.issue.slug}`,
    issueDate: entry.issue.issue_date,
    label: recapLabel(entry.issue.issue_date),
    tabLabel: weekTabLabel(entry.issue.issue_date),
    dateLabel: formatIssueDate(entry.issue.issue_date),
    blurb: sectionBlurb(entry.section),
    notes: keyNotes(entry.section),
    kicker,
  };
}

export default function NewsTeamWeeklies() {
  const { teamSlug = "" } = useParams();
  const staticTeam = getTeamBySlug(teamSlug);

  const { data, isLoading, error } = useQuery({
    queryKey: ["newsletter-team-weeklies", teamSlug, "from-2026-06-08"],
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

  const kicker = staticTeam?.abbrev
    ? `${staticTeam.abbrev.toUpperCase()} · Week file`
    : `${teamName} · Week file`;
  const tickets = (data?.entries ?? []).map((entry) => toTicket(entry, teamSlug, kicker));
  const [latest, ...earlier] = tickets;

  return (
    <NewsPageFrame wide>
      <div className="news-reel">
        <NewsBreadcrumb items={[{ to: "/news", label: "News" }, { label: teamName }]} />
        <header className="mb-8">
          {divisionLabel && (
            <p className="mb-1 font-sans text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {divisionLabel}
            </p>
          )}
          <h1 className="font-display text-4xl tracking-wide">{teamName}</h1>
          <p className="mt-2 max-w-2xl font-sans text-base font-normal tracking-normal text-muted-foreground">
            Every week is a golden ticket. Read one, find your hidden gem, and cash it in for a league title.
          </p>
        </header>

        {latest ? (
          <>
            <section className="weekly-shelf" aria-labelledby="weekly-latest-label">
              <h2 id="weekly-latest-label" className="weekly-shelf-label">
                This week
              </h2>
              <article className="ticket-featured">
                <EditionTicket item={latest} />
              </article>
            </section>
            {earlier.length > 0 ? (
              <section className="weekly-shelf" aria-labelledby="weekly-earlier-label">
                <h2 id="weekly-earlier-label" className="weekly-shelf-label">
                  Earlier weeks
                </h2>
                <WeeklyReel items={earlier} />
              </section>
            ) : null}
          </>
        ) : (
          <p className="rounded-xl border border-dashed border-border bg-card/60 px-4 py-10 text-center text-muted-foreground">
            No published weekly writeup for this team yet.
          </p>
        )}
      </div>
    </NewsPageFrame>
  );
}
