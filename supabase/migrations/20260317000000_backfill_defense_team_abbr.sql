-- Backfill D/ST rows so they carry a real NFL team abbreviation instead of NULL/FA.
-- This fixes UI labels (showing FA for defenses) and team-based archetype logic.

UPDATE public.players p
SET team = t.team_abbr
FROM public.teams t
WHERE p.position = 'D/ST'
  AND p.name = t.team_name
  AND t.team_abbr IS NOT NULL
  AND (p.team IS NULL OR p.team = '' OR UPPER(p.team) = 'FA');

