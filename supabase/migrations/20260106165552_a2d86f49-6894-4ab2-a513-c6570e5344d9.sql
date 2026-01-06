-- Add pick_timer column to mock_drafts table
ALTER TABLE public.mock_drafts
ADD COLUMN pick_timer integer NOT NULL DEFAULT 30;