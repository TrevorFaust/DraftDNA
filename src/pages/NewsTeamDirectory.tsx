import { NewsBreadcrumb, NewsPageFrame } from "@/components/news/NewsPageFrame";
import { NewsTeamGrid } from "@/components/news/NewsTeamGrid";

export default function NewsTeamDirectory() {
  return (
    <NewsPageFrame wide>
      <NewsBreadcrumb items={[{ label: "News" }]} />
      <header className="mb-8">
        <h1 className="font-display text-4xl tracking-wide text-foreground">All 32 teams</h1>
        <p className="mt-2 max-w-2xl font-sans text-base font-normal tracking-normal text-muted-foreground">
          Pick your team and get the week’s news before your league mates do.
        </p>
      </header>
      <NewsTeamGrid layout="conferences" />
    </NewsPageFrame>
  );
}
