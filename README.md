# DraftDNA — Fantasy Football Draft Tool

Custom NFL fantasy rankings, mock drafts, player research, draft badges, and the free **Pick Six Challenge** (up to $36,000 in prizes).

## Features

- **Custom Rankings** — Drag-and-drop big board with community ADP, import from other league formats, and scoring buckets (standard, PPR, half-PPR, dynasty, superflex, rookies-only)
- **Mock Drafts & Draft Room** — 8–16 teams, snake or linear, CPU opponents with archetype-based logic, timers, and draft history
- **Draft Grades** — Post-draft report with narrative feedback on roster construction
- **Badges** — Archetype achievements from completed mock drafts
- **Players & Statistics** — Spreadsheet-style player table, expanded player profiles, 2025 stats, fantasy team depth chart, O-line context, and strength of schedule
- **Pick Six Challenge** — Predict top 6 at each position (QB, RB, WR, TE, K, D/ST) plus tiebreakers; live partial-credit scoring, dashboard leaderboard, and shareable prediction cards
- **Leagues & Settings** — Multi-league support, keepers, position limits, custom scoring, account management
- **Guest Mode** — Rankings and mock drafts without signing in (localStorage)

## Tech Stack

- **Frontend:** Vite, React, TypeScript, Tailwind CSS, shadcn/ui
- **Backend:** Supabase (auth, PostgreSQL)
- **Data & UI:** TanStack Query, React Hook Form, Zod, dnd-kit, Recharts

## About This Repository

This repo is the **source code** for DraftDNA. It is not a turnkey copy of the live site.

The app you use in production is backed by a **hosted Supabase project** (database, auth, edge functions) and deployed via **Vercel**. Player pools, ranking baselines, community data, and user accounts live in that backend — they are not bundled here. Without your own Supabase project, migrations applied, and data pipelines run, a clone is mostly an empty UI shell.

If you only want to **use** DraftDNA, visit the live site — you do not need this repo.

### Local development (optional)

For contributors or your own local work:

```sh
npm i
cp .env.example .env   # fill in your Supabase (and optional) keys — see file for comments
npm run dev
```

Required client env vars are documented in `.env.example`. Server-side scripts (rookies import, player sync, baselines) need `SUPABASE_SERVICE_ROLE_KEY` and are listed in `package.json`.

Further data setup: `HOW_TO_SYNC_DATA.md`, `sync_instructions.md`. Pick Six verification notes: `PICK_SIX_VERIFICATION.md`.

## Project Structure

```
src/
├── components/     # UI, PlayerCard, Navbar, Pick Six share card, etc.
├── constants/      # Archetypes, scoring, NFL/contest data
├── hooks/          # Auth, leagues, community rankings, Pick Six live stats
├── pages/          # Rankings, MockDraft, DraftRoom, PredictionChallenge, etc.
├── utils/          # CPU draft logic, draft grades, Pick Six scoring
└── types/          # Database types
supabase/migrations/  # Schema migrations (apply to your Supabase project)
scripts/            # Data import, archetype generation, sync tooling
```
