-- Add a derived team total yards column.
-- Formula requested: rushing_yards + passing_yards + sack_yards_lost.
alter table if exists public.team_stats_2025
  drop column if exists total_yards_allowed;

alter table if exists public.team_stats_2025
  add column if not exists total_yards integer
  generated always as (
    coalesce(rushing_yards, 0) +
    coalesce(passing_yards, 0) +
    coalesce(sack_yards_lost, 0)
  ) stored;
