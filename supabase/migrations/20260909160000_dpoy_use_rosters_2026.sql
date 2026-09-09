-- DPOY: prefer current-season rosters_2026 (updated teams + rookies).
-- Fall back to rosters_2025 only when p_season = 2025 explicitly.
CREATE OR REPLACE FUNCTION public.get_defensive_players_for_awards(
  p_season integer DEFAULT NULL
)
RETURNS TABLE (
  player_id text,
  name text,
  "position" text,
  team text
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  yr integer;
BEGIN
  -- Default to the newest roster table available (2026 current teams / trades / rookies).
  yr := COALESCE(
    p_season,
    CASE
      WHEN EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'rosters_2026'
      ) THEN 2026
      ELSE 2025
    END
  );

  IF yr >= 2026 THEN
    RETURN QUERY
    SELECT DISTINCT ON (r.gsis_id)
      r.gsis_id::text,
      r.full_name::text,
      r.position::text,
      r.team_abbr::text
    FROM public.rosters_2026 r
    WHERE r.position IN (
        'DB', 'DL', 'LB', 'DE', 'DT', 'NT',
        'OLB', 'ILB', 'MLB', 'CB', 'S', 'FS', 'SS', 'EDGE'
      )
      AND r.gsis_id IS NOT NULL
      AND COALESCE(r.full_name, '') <> ''
      AND COALESCE(r.status, 'ACT') IN ('ACT', 'RES')
    ORDER BY r.gsis_id, r.full_name;
  ELSE
    RETURN QUERY
    SELECT DISTINCT ON (r.gsis_id)
      r.gsis_id::text,
      r.full_name::text,
      r.position::text,
      r.team::text
    FROM public.rosters_2025 r
    WHERE r.position IN ('DB', 'DL', 'LB')
      AND r.gsis_id IS NOT NULL
      AND COALESCE(r.full_name, '') <> ''
      AND COALESCE(r.status, 'ACT') IN ('ACT', 'RES')
    ORDER BY r.gsis_id, r.week DESC NULLS LAST;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_defensive_players_for_awards(integer) TO anon, authenticated;
