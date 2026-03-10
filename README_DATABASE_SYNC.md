# Database Sync Guide: postgres ↔ nfl_webapp

## Overview

You have two databases on the same Supabase server:
- **`postgres`**: Used by Supabase API (your website reads from here)
- **`nfl_webapp`**: Your working database (where you make changes)

## Important Understanding

**Your website will ALWAYS read from `postgres`** because Supabase's API is hardcoded to use the `postgres` database. You cannot change this.

## Workflow

### Option 1: Work in nfl_webapp, Sync to postgres (Recommended)

1. **Initial Setup**: Sync everything from `postgres` → `nfl_webapp`
   ```bash
   # Use the setup_nfl_webapp_from_postgres.sh script
   # OR use pg_dump method from sync_instructions.md
   ```

2. **Daily Work**: Make all your changes in `nfl_webapp`

3. **When Ready**: Sync changes from `nfl_webapp` → `postgres` so the website sees them
   ```bash
   # Use sync_nfl_webapp_to_postgres.sql
   # OR use pg_dump method
   ```

### Option 2: Work Directly in postgres

1. Connect to `postgres` database
2. Make changes directly
3. Website sees changes immediately
4. Sync to `nfl_webapp` periodically for backup

## Quick Start

### Step 1: Sync postgres → nfl_webapp (One-time setup)

**Method A: Using the script (Linux/Mac)**
```bash
chmod +x setup_nfl_webapp_from_postgres.sh
./setup_nfl_webapp_from_postgres.sh
```

**Method B: Manual pg_dump**
```bash
# Export from postgres
pg_dump -h db.pavehsrhmpoexcqoighb.supabase.co \
        -U postgres \
        -d postgres \
        --schema=public \
        --clean \
        --if-exists \
        > postgres_export.sql

# Import to nfl_webapp
psql -h db.pavehsrhmpoexcqoighb.supabase.co \
     -U postgres \
     -d nfl_webapp \
     -f postgres_export.sql
```

**Method C: Using Supabase Migrations**
1. Connect to `nfl_webapp` database
2. Run all migration files from `supabase/migrations/` in chronological order
3. Then copy data using pg_dump data-only export

### Step 2: Verify the Sync

Run this in both databases and compare row counts:
```sql
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

### Step 3: Sync Changes Back (When Ready)

When you want your `nfl_webapp` changes to appear on the website:

**Method A: Using dblink (if available)**
```sql
-- Run sync_nfl_webapp_to_postgres.sql from postgres database
```

**Method B: Using pg_dump (Recommended)**
```bash
# Export data from nfl_webapp
pg_dump -h db.pavehsrhmpoexcqoighb.supabase.co \
        -U postgres \
        -d nfl_webapp \
        --data-only \
        --schema=public \
        > nfl_webapp_data.sql

# Import to postgres (CAREFUL - this overwrites!)
psql -h db.pavehsrhmpoexcqoighb.supabase.co \
     -U postgres \
     -d postgres \
     -f nfl_webapp_data.sql
```

## Tables to Sync

### Application Tables (User Data)
- `players` - NFL players
- `user_rankings` - User rankings
- `mock_drafts` - Draft sessions
- `draft_picks` - Draft picks
- `leagues` - League configs
- `league_teams` - League teams
- `profiles` - User profiles
- `user_profiles` - Additional user data

### Data Tables (Reference Data)
- `nfl_players_historical` - Historical player data
- `player_game_stats` - Game statistics
- `nfl_schedule` - NFL schedule
- `games` - Game data
- `season_stats` - Season stats
- `weekly_stats` - Weekly stats
- `team_stats` - Team stats
- `teams` - Team info
- `kicking_stats` - Kicker stats
- `players_clean` - Cleaned data

## Troubleshooting

### Issue: "relation does not exist"
- Make sure you've run all migration files in `nfl_webapp`
- Check that you're connected to the right database

### Issue: "permission denied"
- Verify your PostgreSQL user has permissions on both databases
- Check RLS policies are synced

### Issue: "foreign key constraint"
- Make sure to sync tables in the correct order (dependencies first)
- Or disable foreign key checks temporarily during sync

### Issue: "duplicate key value"
- Use `ON CONFLICT` clauses in your INSERT statements
- Or use `--clean --if-exists` flags in pg_dump

## Best Practices

1. **Always verify** row counts match after syncing
2. **Backup before syncing** - especially when syncing to postgres
3. **Test in nfl_webapp first** - make sure your changes work
4. **Sync regularly** - don't let databases drift too far apart
5. **Document changes** - keep track of what you've changed in nfl_webapp

## Automation (Future)

Consider setting up:
- Scheduled syncs from `nfl_webapp` → `postgres` (cron job)
- Or a migration that auto-syncs specific tables
- Or a script that watches for changes and syncs automatically
