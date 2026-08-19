import { Newspaper } from "lucide-react";
import { NewsBreadcrumb, NewsPageFrame } from "@/components/news/NewsPageFrame";
import { NewsTeamGrid } from "@/components/news/NewsTeamGrid";

export default function NewsTeamDirectory() {
  return (
    <NewsPageFrame wide>
      <NewsBreadcrumb items={[{ label: "News" }]} />
      <header className="mb-8">
        <span className="edition-badge edition-weekly">Weekly Edition</span>
        <h1 className="mt-3 font-display text-4xl tracking-wide text-foreground">News</h1>
        <p className="mt-2 max-w-2xl font-sans text-base font-normal tracking-normal text-muted-foreground">
          Pick a team to read its Monday week-in-review. Each issue shows only that franchise,
          not the full 32-team digest.
        </p>
      </header>
      <section className="glass-card p-4 sm:p-6">
        <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Newspaper className="h-4 w-4" />
          <span>All 32 teams</span>
        </div>
        <NewsTeamGrid />
      </section>
    </NewsPageFrame>
  );
}
