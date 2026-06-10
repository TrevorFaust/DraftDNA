-- Frozen 2025 team context: O-line, offense/defense ranks, 2026 SOS.
-- Regenerate: npx tsx scripts/generate-nfl-team-context-2025-migration.ts

CREATE TABLE IF NOT EXISTS public.nfl_team_context_2025 (
  team_abbr text PRIMARY KEY,
  oline_unit_rank smallint NOT NULL,
  oline_pass_rank smallint NOT NULL,
  oline_run_rank smallint NOT NULL,
  oline_pressure_pct numeric(5,2) NOT NULL,
  oline_pressure_roe numeric(6,2) NOT NULL,
  oline_pass_block_pff numeric(5,2) NOT NULL,
  oline_pass_block_win_rate_pct smallint NOT NULL,
  oline_adj_ybco_per_att numeric(5,2) NOT NULL,
  oline_run_block_pff numeric(5,2) NOT NULL,
  oline_run_block_win_rate_pct smallint NOT NULL,
  off_ppg numeric(6,3),
  off_pass_ypg numeric(7,2),
  off_rush_ypg numeric(7,2),
  def_ppg_allowed numeric(6,3),
  def_ypg_allowed numeric(7,2),
  games_played smallint,
  off_ppg_rank smallint,
  off_pass_ypg_rank smallint,
  off_rush_ypg_rank smallint,
  def_ppg_allowed_rank smallint,
  def_ypg_allowed_rank smallint,
  sos_2026_rank smallint,
  sos_2026_opp_win_pct numeric(5,3),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.nfl_team_context_2025 IS
  'Static per-team context for 2025 (O-line, off/def ranks) and 2026 SOS. One row per NFL team; join via player team abbr.';

CREATE INDEX IF NOT EXISTS idx_nfl_team_context_2025_team
  ON public.nfl_team_context_2025 (team_abbr);

ALTER TABLE public.nfl_team_context_2025 ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "nfl_team_context_2025 read access" ON public.nfl_team_context_2025;
CREATE POLICY "nfl_team_context_2025 read access"
ON public.nfl_team_context_2025
FOR SELECT
TO anon, authenticated
USING (true);

DELETE FROM public.nfl_team_context_2025;

INSERT INTO public.nfl_team_context_2025 (
  team_abbr,
  oline_unit_rank, oline_pass_rank, oline_run_rank,
  oline_pressure_pct, oline_pressure_roe, oline_pass_block_pff, oline_pass_block_win_rate_pct,
  oline_adj_ybco_per_att, oline_run_block_pff, oline_run_block_win_rate_pct,
  off_ppg, off_pass_ypg, off_rush_ypg, def_ppg_allowed, def_ypg_allowed, games_played,
  off_ppg_rank, off_pass_ypg_rank, off_rush_ypg_rank, def_ppg_allowed_rank, def_ypg_allowed_rank,
  sos_2026_rank, sos_2026_opp_win_pct
) VALUES
  ('ARI', 26, 19, 20, 39.0, 7.74, 60.5, 63, 2.21, 55.4, 71, 20.882, 256.12, 93.12, 28.706, 357.71, 17, 23, 5, 31, 29, 27, 3, 0.538),
  ('ATL', 14, 12, 16, 36.5, 4.11, 68.4, 65, 1.98, 71.0, 70, 20.765, 217.82, 125.76, 23.588, 326.65, 17, 24, 20, 8, 19, 15, 28, 0.465),
  ('BAL', 16, 29, 2, 43.3, 12.20, 62.6, 69, 3.15, 71.9, 71, 24.941, 192.82, 156.59, 23.412, 354.53, 17, 11, 28, 2, 18, 24, 24, 0.479),
  ('BUF', 6, 13, 3, 36.6, 5.91, 73.4, 72, 2.64, 75.7, 75, 28.294, 234.18, 159.65, 21.471, 293.12, 17, 4, 13, 1, 12, 7, 8, 0.528),
  ('CAR', 20, 25, 9, 41.8, 10.12, 67.4, 59, 2.13, 75.9, 70, 18.294, 194.35, 116.29, 22.353, 327.24, 17, 27, 27, 19, 15, 16, 10, 0.521),
  ('CHI', 3, 3, 4, 37.7, -0.12, 72.3, 74, 2.47, 77.4, 74, 25.941, 234.76, 144.18, 24.412, 361.76, 17, 9, 12, 3, 23, 29, 1, 0.550),
  ('CIN', 28, 10, 25, 34.1, 1.97, 61.0, 57, 1.90, 55.8, 72, 24.353, 249.65, 93.59, 28.941, 380.88, 17, 12, 7, 29, 30, 31, 30, 0.450),
  ('CLE', 31, 31, 31, 44.8, 11.54, 49.7, 62, 1.14, 55.4, 70, 16.412, 185.41, 97.00, 22.294, 283.65, 17, 31, 31, 27, 14, 4, 32, 0.429),
  ('DAL', 21, 16, 11, 37.3, 4.66, 53.7, 63, 2.08, 71.5, 72, 27.706, 278.53, 125.65, 30.059, 377.00, 17, 7, 1, 9, 32, 30, 20, 0.493),
  ('DEN', 1, 6, 5, 36.8, 2.89, 78.8, 68, 2.37, 73.3, 74, 23.588, 231.24, 118.71, 18.294, 278.24, 17, 14, 17, 16, 3, 2, 15, 0.512),
  ('DET', 12, 9, 7, 32.3, 1.86, 62.8, 55, 2.52, 69.8, 71, 28.294, 268.65, 120.06, 24.294, 331.88, 17, 4, 3, 14, 22, 18, 27, 0.467),
  ('GB', 19, 26, 23, 43.6, 11.28, 62.2, 69, 1.89, 60.1, 71, 23.000, 226.18, 119.82, 21.176, 311.82, 17, 16, 18, 15, 11, 12, 3, 0.538),
  ('HOU', 27, 18, 29, 37.5, 6.28, 63.3, 55, 1.45, 59.8, 68, 23.765, 232.71, 108.94, 17.353, 277.24, 17, 13, 14, 22, 2, 1, 26, 0.474),
  ('IND', 2, 8, 6, 33.0, 3.29, 74.6, 56, 2.23, 76.0, 73, 27.412, 240.29, 118.06, 24.235, 349.82, 17, 8, 8, 17, 21, 23, 28, 0.465),
  ('JAX', 24, 7, 13, 34.8, 4.08, 70.9, 67, 2.08, 66.7, 74, 27.882, 236.82, 115.06, 19.765, 303.65, 17, 6, 11, 20, 8, 11, 22, 0.490),
  ('KC', 10, 24, 27, 41.7, 12.36, 71.5, 72, 1.67, 62.2, 70, 21.294, 232.18, 106.59, 19.294, 301.53, 17, 21, 16, 25, 6, 10, 5, 0.536),
  ('LAC', 30, 32, 30, 43.2, 14.59, 49.7, 54, 1.95, 37.8, 69, 21.647, 232.53, 121.59, 20.000, 285.24, 17, 20, 15, 12, 9, 5, 9, 0.522),
  ('LAR', 4, 2, 1, 29.8, -2.74, 63.6, 69, 2.62, 87.9, 74, 30.471, 276.88, 126.59, 20.353, 327.53, 17, 1, 2, 7, 10, 17, 13, 0.516),
  ('LV', 32, 23, 32, 39.1, 8.65, 56.9, 60, 1.20, 53.0, 70, 14.176, 195.00, 77.47, 25.412, 317.82, 17, 32, 26, 32, 25, 14, 7, 0.529),
  ('MIA', 29, 11, 19, 32.0, 2.32, 54.9, 59, 2.32, 55.5, 70, 20.412, 195.41, 120.24, 24.941, 348.76, 17, 25, 25, 13, 24, 22, 2, 0.542),
  ('MIN', 18, 22, 10, 40.2, 10.36, 69.1, 59, 2.20, 67.8, 74, 20.235, 188.71, 108.29, 19.588, 282.59, 17, 26, 30, 23, 7, 3, 11, 0.519),
  ('NE', 11, 27, 14, 43.9, 12.16, 72.7, 64, 2.31, 62.2, 72, 28.824, 262.29, 128.88, 18.824, 295.24, 17, 2, 4, 6, 4, 8, 6, 0.531),
  ('NO', 25, 21, 28, 38.3, 9.21, 65.0, 55, 1.86, 49.8, 71, 18.000, 236.88, 94.29, 22.529, 299.76, 17, 28, 10, 28, 16, 9, 31, 0.434),
  ('NYG', 9, 28, 22, 42.9, 12.59, 71.1, 66, 1.87, 61.2, 71, 22.412, 217.82, 129.12, 25.824, 359.53, 17, 17, 20, 5, 26, 28, 17, 0.498),
  ('NYJ', 22, 30, 15, 42.9, 13.54, 68.2, 58, 2.41, 59.7, 71, 17.647, 163.76, 123.29, 29.588, 355.59, 17, 29, 32, 10, 31, 25, 12, 0.517),
  ('PHI', 7, 17, 12, 41.2, 7.77, 72.3, 64, 2.19, 67.9, 72, 22.294, 205.76, 116.94, 19.118, 314.18, 17, 19, 23, 18, 5, 13, 23, 0.481),
  ('PIT', 8, 1, 18, 26.4, -2.83, 74.8, 70, 2.01, 62.0, 72, 23.353, 213.65, 103.29, 22.765, 356.94, 17, 15, 22, 26, 17, 26, 19, 0.495),
  ('SEA', 15, 5, 17, 31.6, 0.72, 64.2, 63, 1.98, 64.4, 73, 28.412, 239.00, 123.29, 17.176, 285.88, 17, 3, 9, 10, 1, 6, 14, 0.514),
  ('SF', 5, 4, 8, 34.3, 0.49, 66.7, 66, 1.85, 83.3, 72, 25.706, 254.00, 106.88, 21.824, 340.24, 17, 10, 6, 24, 13, 20, 18, 0.497),
  ('TB', 17, 14, 26, 36.2, 4.79, 69.3, 65, 1.94, 56.9, 70, 22.353, 220.88, 114.53, 24.176, 337.24, 17, 18, 19, 21, 20, 19, 21, 0.491),
  ('TEN', 23, 15, 21, 38.5, 4.71, 69.2, 64, 2.17, 57.5, 70, 16.706, 190.65, 93.47, 28.118, 345.12, 17, 30, 29, 30, 28, 21, 25, 0.476),
  ('WAS', 13, 20, 24, 39.5, 11.13, 71.7, 63, 1.95, 57.2, 71, 20.941, 195.82, 134.71, 26.529, 384.00, 17, 22, 24, 4, 27, 32, 16, 0.502);
