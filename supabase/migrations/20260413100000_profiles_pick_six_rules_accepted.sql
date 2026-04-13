-- Pick Six: store rules acceptance on the profile so one acceptance applies on every device for that account.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pick_six_rules_accepted_at timestamptz;

COMMENT ON COLUMN public.profiles.pick_six_rules_accepted_at IS
  'When the user accepted Pick Six official rules (checkboxes); null means not yet accepted.';
