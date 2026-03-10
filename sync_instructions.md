# Complete Guide: Syncing postgres → nfl_webapp

## Important Understanding

**Supabase always uses the `postgres` database** for its API. Your website connects through Supabase's API, so it will always read from `postgres`, not `nfl_webapp`.

However, you can:
1. Keep `nfl_webapp` as your working database for local development
2. Sync data from `postgres` to `nfl_webapp` so you have a complete copy
3. Make changes in `nfl_webapp` and then sync back to `postgres` when ready

## Method 1: Using pg_dump (Recommended)

This is the most reliable method to copy everything.

### Step 1: Export from postgres

```bash
pg_dump -h db.pavehsrhmpoexcqoighb.supabase.co \
        -U postgres \
        -d postgres \
        --schema=public \
        --clean \
        --if-exists \
        --no-owner \
        --no-acl \
        > postgres_to_nfl_webapp.sql
```

### Step 2: Import to nfl_webapp

```bash
psql -h db.pavehsrhmpoexcqoighb.supabase.co \
     -U postgres \
     -d nfl_webapp \
     -f postgres_to_nfl_webapp.sql
```

## Method 2: Using Supabase Migrations

Since all your migrations are already in `supabase/migrations/`, you can:

1. Connect to `nfl_webapp` database
2. Run all migration files in order (they're timestamped, so run them chronologically)
3. This will create all the tables and schema

Then copy the data manually or use Method 1's data-only export.

## Method 3: Manual Table-by-Table Sync

If you need more control, you can sync tables one by one:

### Step 1: Create Tables in nfl_webapp

Run all migration files from `supabase/migrations/` in order while connected to `nfl_webapp`.

### Step 2: Copy Data

For each table, generate INSERT statements from postgres and run them in nfl_webapp.

Example for players table:
```sql
-- Run this in postgres to generate INSERT statements
\copy (SELECT 'INSERT INTO public.players (id, name, position, team, adp, bye_week, created_at, jersey_number, season) VALUES (' || quote_literal(id) || ', ' || quote_literal(name) || ', ' || quote_literal(position) || ', ' || COALESCE(quote_literal(team), 'NULL') || ', ' || adp || ', ' || COALESCE(bye_week::text, 'NULL') || ', ' || quote_literal(created_at) || ', ' || COALESCE(jersey_number::text, 'NULL') || ', ' || COALESCE(season::text, 'NULL') || ');' FROM public.players) TO 'players_inserts.sql'

-- Then run the generated SQL file in nfl_webapp
```

## Tables to Sync

Based on the postgres database, here are all the tables that need to be synced:

1. **Application Tables:**
   - `players` - NFL players data
   - `user_rankings` - User player rankings
   - `mock_drafts` - Mock draft sessions
   - `draft_picks` - Individual draft picks
   - `leagues` - League configurations
   - `league_teams` - League team names
   - `profiles` - User profiles
   - `user_profiles` - Additional user data

2. **Data Tables:**
   - `nfl_players_historical` - Historical player data
   - `player_game_stats` - Player game statistics
   - `nfl_schedule` - NFL schedule
   - `games` - Game data
   - `season_stats` - Season statistics
   - `weekly_stats` - Weekly statistics
   - `team_stats` - Team statistics
   - `teams` - Team information
   - `kicking_stats` - Kicker statistics
   - `players_clean` - Cleaned player data

## After Syncing

Once you've synced everything:

1. **Verify the sync:**
   ```sql
   -- Run in nfl_webapp
   SELECT COUNT(*) FROM public.players;
   -- Should match the count from postgres
   ```

2. **Continue working in nfl_webapp:**
   - Make your changes in `nfl_webapp`
   - When ready, sync back to `postgres` so the website sees the changes

3. **Sync back to postgres when needed:**
   - Use the reverse process (nfl_webapp → postgres)
   - Or manually update postgres with your changes

## Important Notes

- **RLS Policies**: Make sure to sync RLS policies as well (they're in the migration files)
- **Foreign Keys**: Some tables reference `auth.users` - these will work in Supabase but may need adjustment in nfl_webapp
- **Functions & Triggers**: Don't forget to sync functions and triggers (also in migration files)
- **Indexes**: Indexes are usually included in pg_dump, but verify they exist

## Quick Verification Script

After syncing, run this in both databases to compare:

```sql
-- Run in both postgres and nfl_webapp
SELECT 
  'players' as table_name, COUNT(*) as row_count FROM public.players
UNION ALL
SELECT 'user_rankings', COUNT(*) FROM public.user_rankings
UNION ALL
SELECT 'mock_drafts', COUNT(*) FROM public.mock_drafts
UNION ALL
SELECT 'draft_picks', COUNT(*) FROM public.draft_picks
UNION ALL
SELECT 'leagues', COUNT(*) FROM public.leagues
ORDER BY table_name;
```

The row counts should match (or nfl_webapp should have more if you've added data there).
