# Pick Six Challenge: Data Storage & End-of-Season Verification

## How entries are stored

- **Table:** `user_season_predictions`  
  One row per (user, season, position, rank 1–6). So each “entry” for a position group is 6 rows (ranks 1–6).
- **Tiebreakers:** `user_season_tiebreakers`  
  One row per (user, season, position) with `tiebreaker_value` for the #1 pick stat.

**One entry per user per position group:**  
When a user submits or edits a position, the app deletes all existing rows for that (user_id, season, position) and then inserts the new 6 rows. So:
- Submitting counts as one entry for that position.
- Editing and resubmitting replaces the old entry; they still have only one entry per position.

The leaderboard counts distinct positions per user (`get_pick_six_leaderboard`), so each user has at most 6 “entries” (one per position: QB, RB, WR, TE, K, D/ST).

## Verifying “exact match” at end of season

1. **Use the verification view (recommended)**  
   In the Supabase SQL editor (or with service role), run:

   ```sql
   SELECT * FROM v_pick_six_entries_verification
   WHERE season = 2026
   ORDER BY user_id, position, rank;
   ```

   This returns one row per prediction with: `user_id`, `position`, `rank`, `player_id`, `player_name`, `player_team`, `tiebreaker_value`, `updated_at`.  
   Export to CSV and compare each (user, position) set of 6 `player_id`s to your actual top 6 results for that position.

2. **Or query the table directly**  
   ```sql
   SELECT usp.user_id, usp.position, usp.rank, usp.player_id, p.name AS player_name
   FROM user_season_predictions usp
   LEFT JOIN players p ON p.id = usp.player_id
   WHERE usp.season = 2026
   ORDER BY usp.user_id, usp.position, usp.rank;
   ```

3. **Finding “perfect pick six” winners**  
   For each position, you need the actual top 6 player IDs in order (from your scoring source). Then find users where, for that position, their 6 `player_id`s in rank 1–6 match that exact order. Tiebreakers in `user_season_tiebreakers` are used only when multiple users have the same perfect picks.

## Indexes

- `idx_user_season_predictions_user_season` — list a user’s entries.
- `idx_user_season_predictions_season_position` — all entries for a season/position (verification export).
