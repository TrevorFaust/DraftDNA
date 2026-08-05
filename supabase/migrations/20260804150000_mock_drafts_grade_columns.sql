-- Persist draft grade at completion so History matches the completion screen.
ALTER TABLE public.mock_drafts
  ADD COLUMN IF NOT EXISTS grade_letter text,
  ADD COLUMN IF NOT EXISTS grade_score numeric,
  ADD COLUMN IF NOT EXISTS grade_payload jsonb;

COMMENT ON COLUMN public.mock_drafts.grade_letter IS 'Letter grade shown at draft completion (A+…F-).';
COMMENT ON COLUMN public.mock_drafts.grade_score IS 'Numeric draft grade (0–100) at completion.';
COMMENT ON COLUMN public.mock_drafts.grade_payload IS 'Full DraftGradeResult JSON from completion for History display.';
