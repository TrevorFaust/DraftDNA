-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  display_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- Create players table (NFL players data)
CREATE TABLE public.players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  position TEXT NOT NULL,
  team TEXT,
  adp DECIMAL(6,2) DEFAULT 999.00,
  bye_week INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on players (public read)
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view players" ON public.players FOR SELECT USING (true);

-- Create user_rankings table
CREATE TABLE public.user_rankings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  player_id UUID REFERENCES public.players(id) ON DELETE CASCADE NOT NULL,
  rank INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, player_id)
);

-- Enable RLS on user_rankings
ALTER TABLE public.user_rankings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own rankings" ON public.user_rankings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own rankings" ON public.user_rankings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own rankings" ON public.user_rankings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own rankings" ON public.user_rankings FOR DELETE USING (auth.uid() = user_id);

-- Create mock_drafts table
CREATE TABLE public.mock_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  num_teams INTEGER NOT NULL DEFAULT 12,
  num_rounds INTEGER NOT NULL DEFAULT 15,
  user_pick_position INTEGER NOT NULL DEFAULT 1,
  draft_order TEXT NOT NULL DEFAULT 'snake',
  status TEXT NOT NULL DEFAULT 'setup',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS on mock_drafts
ALTER TABLE public.mock_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own drafts" ON public.mock_drafts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own drafts" ON public.mock_drafts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own drafts" ON public.mock_drafts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own drafts" ON public.mock_drafts FOR DELETE USING (auth.uid() = user_id);

-- Create draft_picks table
CREATE TABLE public.draft_picks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mock_draft_id UUID REFERENCES public.mock_drafts(id) ON DELETE CASCADE NOT NULL,
  player_id UUID REFERENCES public.players(id) ON DELETE CASCADE NOT NULL,
  team_number INTEGER NOT NULL,
  round_number INTEGER NOT NULL,
  pick_number INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on draft_picks
ALTER TABLE public.draft_picks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view picks from their drafts" ON public.draft_picks FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.mock_drafts WHERE id = mock_draft_id AND user_id = auth.uid()));
CREATE POLICY "Users can insert picks to their drafts" ON public.draft_picks FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM public.mock_drafts WHERE id = mock_draft_id AND user_id = auth.uid()));
CREATE POLICY "Users can delete picks from their drafts" ON public.draft_picks FOR DELETE 
  USING (EXISTS (SELECT 1 FROM public.mock_drafts WHERE id = mock_draft_id AND user_id = auth.uid()));

-- Function to handle profile creation on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (new.id, new.raw_user_meta_data ->> 'display_name');
  RETURN new;
END;
$$;

-- Trigger for auto profile creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers for timestamp updates
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_user_rankings_updated_at BEFORE UPDATE ON public.user_rankings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();