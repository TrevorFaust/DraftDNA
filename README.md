# Draft Board — Fantasy Football Draft Tool

A fantasy football web app for creating custom player rankings, running mock drafts, and preparing for draft day. Features league support, multiple scoring formats, CPU opponents with archetype-based draft logic, and the Pick Six prediction challenge.

## Features

- **Custom Rankings** — Drag-and-drop big board with community ADP and multiple scoring buckets (standard, PPR, half-PPR, dynasty, superflex, rookies-only)
- **Mock Drafts** — Configurable mock drafts (8–16 teams, snake or linear, customizable rosters) with CPU opponents that follow draft archetypes
- **Draft Room** — Live draft simulation with timers, CPU draft speeds, and draft history
- **Badges** — Archetype achievements earned from completed mock drafts
- **Pick Six Challenge** — Season prediction contest: pick top 6 at each position (QB, RB, WR, TE, K, D/ST) plus tiebreakers
- **Statistics** — Player stats and visualization
- **League Settings** — Multi-league support, keepers, position limits, and custom scoring
- **Guest Mode** — Use rankings and mock drafts without signing in (data stored in localStorage)

## Tech Stack

- **Frontend:** Vite, React, TypeScript, Tailwind CSS, shadcn-ui
- **Backend:** Supabase (auth, PostgreSQL database)
- **State & Data:** TanStack Query, React Hook Form, Zod
- **UI:** dnd-kit (drag-and-drop), Recharts, Lucide icons, Sonner toasts

## Getting Started

### Prerequisites

- Node.js & npm (recommended: [nvm](https://github.com/nvm-sh/nvm#installing-and-updating))

### Setup

```sh
# 1. Clone the repository
git clone <YOUR_GIT_URL>
cd my-nfl-draft-1

# 2. Install dependencies
npm i

# 3. Configure Supabase (see below)
cp .env.example .env
# Edit .env with your Supabase credentials

# 4. Start the development server
npm run dev
```

### Environment Variables

1. Create a project at [Supabase Dashboard](https://supabase.com/dashboard)
2. Go to **Settings** > **API**
3. Copy:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **Publishable Key** (anon/public) → `VITE_SUPABASE_PUBLISHABLE_KEY`

Edit `.env`:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key-here
```

The `.env` file is in `.gitignore`; do not commit it.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Production build |
| `npm run preview` | Preview production build locally |
| `npm run generate:archetypes` | Generate archetype logic from config |

## Project Structure

```
src/
├── components/     # UI components, PlayerCard, Navbar, etc.
├── constants/      # Archetypes, scoring, NFL data
├── hooks/          # useAuth, useLeagues, useCommunityRankingsBucket, etc.
├── pages/          # Index, Rankings, MockDraft, DraftRoom, History, Badges, etc.
├── utils/          # CPU draft logic, archetype detection, storage helpers
└── types/          # Database types
supabase/migrations/  # Database migrations
scripts/            # Baseline parsing, archetype generation
```

## Data Sync

For syncing player data and baselines between PostgreSQL and Supabase, see:

- `HOW_TO_SYNC_DATA.md` — Syncing `nfl_players_historical` and `public.players`
- `sync_instructions.md` — Full guide for postgres ↔ nfl_webapp sync
