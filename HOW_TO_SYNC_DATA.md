# How to Sync Data Between PostgreSQL and Supabase

## Understanding the Connection

**Supabase IS PostgreSQL** - When you use Supabase, you're using a managed PostgreSQL database. The Supabase UI and your app connect to the same PostgreSQL database.

## The Issue

If you're making changes directly in PostgreSQL (using pgAdmin, DBeaver, psql, etc.) and not seeing them in Supabase UI:

1. **Verify you're connected to the Supabase database**, not a local one:
   - Host: `db.pavehsrhmpoexcqoighb.supabase.co`
   - Port: `5432` (or `6543` for connection pooler)
   - Database: `postgres`
   - Your connection string should match your Supabase project

2. **Ensure changes are committed**: Make sure you've run `COMMIT;` after your INSERT/UPDATE statements

3. **Refresh the Supabase UI**: The Supabase dashboard might cache data - try refreshing the page

## How Data Flows

```
nfl_players_historical (source table)
    ↓
[Migration syncs data]
    ↓
public.players (table your app reads from)
```

## Solution: Sync Your Data

If you added 2025 players directly to PostgreSQL:

### Option 1: Add to `nfl_players_historical` and sync
1. Add your 2025 players to the `nfl_players_historical` table with:
   - `season = 2025`
   - `position` in ('QB', 'RB', 'WR', 'TE', 'K')
   - `player_name`, `team`, `jersey_number`, etc.

2. Run the migration to sync from `nfl_players_historical` to `public.players`

### Option 2: Add directly to `public.players`
1. Add players directly to `public.players` table
2. Make sure `season = 2025`
3. The app will read them immediately (no migration needed)

## Finding Your Connection String

In Supabase Dashboard:
1. Go to Project Settings
2. Click on "Database"
3. Find "Connection string" or "Connection pooling"
4. Use this to connect your PostgreSQL client

## Verifying Your Connection

Run this query in your PostgreSQL client to verify you're connected to the right database:
```sql
SELECT current_database(), inet_server_addr();
```

You should see:
- Database: `postgres`
- Server: An IP address matching your Supabase project
