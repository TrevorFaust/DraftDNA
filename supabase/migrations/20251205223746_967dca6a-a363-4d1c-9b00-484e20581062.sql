-- Add scoring format column to mock_drafts table
ALTER TABLE public.mock_drafts 
ADD COLUMN scoring_format text NOT NULL DEFAULT 'standard';

-- Add a check constraint for valid values
ALTER TABLE public.mock_drafts 
ADD CONSTRAINT mock_drafts_scoring_format_check 
CHECK (scoring_format IN ('standard', 'ppr', 'half_ppr'));