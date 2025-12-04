-- Create leagues table for organizing mock drafts
CREATE TABLE public.leagues (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  num_teams INTEGER NOT NULL DEFAULT 12,
  user_pick_position INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own leagues" 
ON public.leagues 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own leagues" 
ON public.leagues 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own leagues" 
ON public.leagues 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own leagues" 
ON public.leagues 
FOR DELETE 
USING (auth.uid() = user_id);

-- Add league_id to mock_drafts (nullable for existing drafts)
ALTER TABLE public.mock_drafts ADD COLUMN league_id UUID REFERENCES public.leagues(id) ON DELETE SET NULL;