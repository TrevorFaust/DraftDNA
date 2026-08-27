# Draft DNA

I built [Draft DNA](https://draftdna.com) for 2026 fantasy prep. One site for your board, mocks, player research, and a free Pick Six contest with real prizes.

Rank and mock without an account if you want to kick the tires. Make one when you want leagues saved, badges, history, and Pick Six.

## What's on it

**Rankings.** Drag-and-drop your big board. Flip between your list, consensus, ESPN, Yahoo, Sleeper, CBS, and the other site boards. Import a cheat sheet if you already have one you like (CSV, paste, those ESPN PDFs). Standard, PPR, half-PPR, dynasty, superflex, rookies-only. Eighteen format buckets so the ADP matches the league you play.

**Mock drafts.** Solo vs CPU, or multiplayer with friends (invite code or an open lobby). Snake or linear, 4 to 32 teams, timers, keepers, and chat in the room. You pick which board you draft from. CPUs can run consensus or a named site board, and they fill a real starter lineup before they start stacking benches. After the last pick you get a grade that talks through how you built the roster, plus archetype badges from how the draft went.

**Player research.** Spreadsheet view of the pool, player profiles, 2025 stats, fantasy depth, O-line context, and 2026 strength of schedule. Draft stats show where you tend to reach and steal.

**News.** Monday week-in-reviews. Pick a franchise and read that team's issue.

**Pick Six Challenge.** Pick the top 6 fantasy scorers at each position (QB, RB, WR, TE, K, D/ST) in order. Nail a perfect board and you win $6,000 for that position. Six positions, up to $36,000. Partial-credit scoring and a leaderboard once the season starts. Free to enter. Official rules on the site. Deadline is NFL kickoff, Wednesday September 9, 2026.

**Leagues.** Invite friends with a link. Each person claims a team. Shared scoring, lineup slots, keepers. The commissioner can reassign or remove people. Guest mode still keeps rankings and mocks in the browser until you sign in.

**Team Rankings.** Rank every team's rooms, 1st at the top. Paste a full roster or search a player. Members only swap the lineup on the team they claimed.

**Weekly Pick'em.** Pick NFL winners each week and keep a record against the rest of the league.

## Stack

Vite, React, TypeScript, Tailwind, shadcn/ui. Supabase for auth and Postgres. TanStack Query, React Hook Form, Zod, dnd-kit, Recharts.

## This repo

This is the source for Draft DNA. It is not a copy of the live site you can spin up with one command.

Production runs on a hosted Supabase project (database, auth, edge functions) and deploys on Vercel. Player pools, ranking baselines, community data, and accounts live there. They are not bundled here. Clone without your own project, migrations, and data pipelines and you get an empty shell.

If you want to use Draft DNA, go to [draftdna.com](https://draftdna.com). You do not need this repo.

### Local work (optional)

For me, or anyone helping on the code:

```sh
npm i
cp .env.example .env   # fill in your Supabase keys. Comments in the file.
npm run dev
```

Client env vars are in `.env.example`. Server-side scripts (rookies import, player sync, baselines) need `SUPABASE_SERVICE_ROLE_KEY` and live in `package.json`.

Data setup: `HOW_TO_SYNC_DATA.md`, `sync_instructions.md`. Pick Six notes: `PICK_SIX_VERIFICATION.md`.

## Layout

```
src/
├── components/     # UI, PlayerCard, Navbar, Pick Six share card, etc.
├── constants/      # Archetypes, scoring, NFL/contest data
├── features/       # Team Rankings board
├── hooks/          # Auth, leagues, community rankings, Pick Six live stats
├── pages/          # Rankings, MockDraft, DraftRoom, LeagueRanker, Pickem, etc.
├── utils/          # CPU draft logic, draft grades, Pick Six scoring
└── types/          # Database types
supabase/migrations/  # Schema migrations (apply to your Supabase project)
scripts/            # Data import, archetype generation, sync tooling
```
