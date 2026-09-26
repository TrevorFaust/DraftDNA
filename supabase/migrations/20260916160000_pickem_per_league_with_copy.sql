-- Pick'em cards are per league again. A first save can copy to every league
-- the user is in; later edits stay in the league they saved from.

ALTER TABLE public.pickem_picks
  DROP CONSTRAINT IF EXISTS pickem_picks_user_game_key;

INSERT INTO public.pickem_picks (league_id, user_id, game_id, picked_abbr, updated_at)
SELECT m.league_id, pk.user_id, pk.game_id, pk.picked_abbr, pk.updated_at
FROM public.pickem_picks pk
JOIN public.league_members m ON m.user_id = pk.user_id
WHERE pk.league_id IS NOT NULL
  AND m.league_id IS DISTINCT FROM pk.league_id
  AND NOT EXISTS (
    SELECT 1
    FROM public.pickem_picks existing
    WHERE existing.league_id = m.league_id
      AND existing.user_id = pk.user_id
      AND existing.game_id = pk.game_id
  );

UPDATE public.pickem_picks pk
SET league_id = (
  SELECT m.league_id
  FROM public.league_members m
  WHERE m.user_id = pk.user_id
  ORDER BY m.joined_at
  LIMIT 1
)
WHERE pk.league_id IS NULL;

DELETE FROM public.pickem_picks WHERE league_id IS NULL;

ALTER TABLE public.pickem_picks
  DROP CONSTRAINT IF EXISTS pickem_picks_league_id_fkey;

ALTER TABLE public.pickem_picks
  ALTER COLUMN league_id SET NOT NULL;

ALTER TABLE public.pickem_picks
  ADD CONSTRAINT pickem_picks_league_id_fkey
  FOREIGN KEY (league_id) REFERENCES public.leagues(id) ON DELETE CASCADE;

ALTER TABLE public.pickem_picks
  ADD CONSTRAINT pickem_picks_league_id_user_id_game_id_key
  UNIQUE (league_id, user_id, game_id);

DROP POLICY IF EXISTS pickem_picks_own_select ON public.pickem_picks;
CREATE POLICY pickem_picks_own_select ON public.pickem_picks
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND public.is_league_member(league_id));
