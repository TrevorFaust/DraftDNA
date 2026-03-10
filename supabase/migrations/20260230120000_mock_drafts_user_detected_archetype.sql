-- Store the detected archetype name when a draft is completed so Badges/History stay consistent.
ALTER TABLE public.mock_drafts
  ADD COLUMN IF NOT EXISTS user_detected_archetype text;

-- Index into the full archetype list (0-based) so the correct badge slot is unlocked (list has duplicate names).
ALTER TABLE public.mock_drafts
  ADD COLUMN IF NOT EXISTS user_detected_archetype_index integer;

COMMENT ON COLUMN public.mock_drafts.user_detected_archetype IS 'Archetype name (e.g. The Captain) detected for the user team when draft was completed.';
COMMENT ON COLUMN public.mock_drafts.user_detected_archetype_index IS 'Index into FULL_ARCHETYPE_LIST (0-based) for badge grid; used when names duplicate.';
