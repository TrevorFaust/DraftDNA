-- Security advisor hardening:
-- 1) Pin search_path on helper/trigger functions
-- 2) Revoke client EXECUTE on trigger-only / internal SECURITY DEFINER helpers
-- 3) Tighten newsletter RLS (service-role-only pipeline tables + safer subscriber insert)

-- ---------------------------------------------------------------------------
-- search_path
-- ---------------------------------------------------------------------------
ALTER FUNCTION public.set_updated_at() SET search_path = public;
ALTER FUNCTION public.set_updated_at_rookies_2026() SET search_path = public;
ALTER FUNCTION public.set_updated_at_fantasy_team_depth() SET search_path = public;
ALTER FUNCTION public.get_team_full_name(text) SET search_path = public;
ALTER FUNCTION public.safe_jersey_to_int(text) SET search_path = public;
ALTER FUNCTION public.map_depth_chart_position(text) SET search_path = public;
ALTER FUNCTION public.kicking_fp_add_on_from_weekly_json(jsonb) SET search_path = public;
ALTER FUNCTION public.kicker_weekly_derived_json(jsonb) SET search_path = public;
ALTER FUNCTION public.mp_team_for_pick(integer, integer, text) SET search_path = public;
ALTER FUNCTION public.mp_round_for_pick(integer, integer) SET search_path = public;
ALTER FUNCTION public.mp_normalize_pos(text) SET search_path = public;
ALTER FUNCTION public.mp_team_is_human(uuid, integer) SET search_path = public;
ALTER FUNCTION public.mp_generate_invite_code() SET search_path = public;
ALTER FUNCTION public.mp_default_team_name(integer) SET search_path = public;

-- ---------------------------------------------------------------------------
-- Internal / trigger-only SECURITY DEFINER: not client RPC entry points
-- (Owners and other SECURITY DEFINER callers still work.)
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon, authenticated;

REVOKE ALL ON FUNCTION public.mp_insert_pick(uuid, uuid, boolean, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mp_insert_pick(uuid, uuid, boolean, boolean) FROM anon, authenticated;

REVOKE ALL ON FUNCTION public.mp_advance_after_pick(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mp_advance_after_pick(uuid) FROM anon, authenticated;

REVOKE ALL ON FUNCTION public.mp_caller_is_participant(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mp_caller_is_participant(uuid, text) FROM anon, authenticated;

REVOKE ALL ON FUNCTION public.mp_position_allowed(uuid, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mp_position_allowed(uuid, integer, text) FROM anon, authenticated;

REVOKE ALL ON FUNCTION public.mp_select_bpa_player(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mp_select_bpa_player(uuid, integer) FROM anon, authenticated;

REVOKE ALL ON FUNCTION public.mp_team_needed_positions(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mp_team_needed_positions(uuid, integer) FROM anon, authenticated;

REVOKE ALL ON FUNCTION public.mp_relocate_seat_team_name(uuid, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mp_relocate_seat_team_name(uuid, integer, integer) FROM anon, authenticated;

REVOKE ALL ON FUNCTION public.mp_reset_seat_team_name(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mp_reset_seat_team_name(uuid, integer) FROM anon, authenticated;

-- Auth-only ranking import helper (no guest/anon use)
REVOKE ALL ON FUNCTION public.list_user_ranking_import_sources() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_user_ranking_import_sources() FROM anon;
GRANT EXECUTE ON FUNCTION public.list_user_ranking_import_sources() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_user_ranking_import_sources() TO service_role;

-- ---------------------------------------------------------------------------
-- Newsletter: pipeline tables stay client-inaccessible; clear "RLS no policy"
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'newsletter_glossary_terms',
    'newsletter_pipeline_runs',
    'newsletter_raw_items',
    'newsletter_sources',
    'newsletter_story_clusters'
  ]
  LOOP
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', t);
    EXECUTE format('DROP POLICY IF EXISTS "Service role full access" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "Service role full access" ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
      t
    );
  END LOOP;
END $$;

-- Public newsletter signup needs INSERT, but not WITH CHECK (true)
DROP POLICY IF EXISTS "Public insert newsletter subscribers" ON public.newsletter_subscribers;
CREATE POLICY "Public insert newsletter subscribers"
  ON public.newsletter_subscribers
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    email IS NOT NULL
    AND char_length(trim(email)) BETWEEN 3 AND 320
    AND position('@' in trim(email)) > 1
    AND position('.' in split_part(trim(email), '@', 2)) > 0
  );
