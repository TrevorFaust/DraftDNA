-- Store chaos archetype name when a chaos trigger fires at draft completion.
-- When replace-type: display only chaos badge. When companion: display main + chaos.

ALTER TABLE public.mock_drafts
  ADD COLUMN IF NOT EXISTS user_detected_chaos_archetype text;

COMMENT ON COLUMN public.mock_drafts.user_detected_chaos_archetype IS 'Chaos archetype name (e.g. The Kicker Truther) when a chaos trigger fired; null if none. Replace-type chaos replace main badge for display.';
