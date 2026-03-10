-- Profiles: store username for each user (unique). Used for sign-up and leaderboard display.
-- Created on sign-up via trigger; username comes from signUp options.data.username.

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL,
  CONSTRAINT profiles_username_length CHECK (char_length(trim(username)) >= 2),
  CONSTRAINT profiles_username_valid CHECK (username ~ '^[a-zA-Z0-9_-]+$')
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username_lower ON public.profiles (lower(trim(username)));

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can read/update their own profile
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Allow insert when id = current user (trigger runs in signup context; definer may still need this for RLS)
CREATE POLICY "Insert own profile on signup"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- RPC: check if a username is taken (case-insensitive). Callable by anon for sign-up.
CREATE OR REPLACE FUNCTION public.check_username_taken(p_username text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE lower(trim(username)) = lower(trim(p_username))
  );
$$;

-- RPC: check if email is already registered (for "already have an account" message)
CREATE OR REPLACE FUNCTION public.check_email_exists(email_to_check text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM auth.users WHERE email = lower(trim(email_to_check)));
$$;

-- On sign-up, create profile with username from metadata (or fallback to email local part)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_username text;
BEGIN
  v_username := coalesce(
    trim(nullif(NEW.raw_user_meta_data->>'username', '')),
    split_part(NEW.email, '@', 1)
  );
  IF v_username = '' OR char_length(v_username) < 2 THEN
    v_username := split_part(NEW.email, '@', 1);
  END IF;
  IF v_username !~ '^[a-zA-Z0-9_-]+$' THEN
    v_username := regexp_replace(v_username, '[^a-zA-Z0-9_-]', '', 'g');
    IF v_username = '' THEN
      v_username := 'user' || substr(NEW.id::text, 1, 8);
    END IF;
  END IF;
  INSERT INTO public.profiles (id, username)
  VALUES (NEW.id, v_username)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update leaderboard to prefer profiles.username when available
CREATE OR REPLACE FUNCTION public.get_pick_six_leaderboard(p_season integer DEFAULT 2026)
RETURNS TABLE (
  rank bigint,
  user_id uuid,
  positions_submitted bigint,
  username text
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  WITH counts AS (
    SELECT
      usp.user_id,
      COUNT(DISTINCT usp.position)::bigint AS positions_submitted
    FROM public.user_season_predictions usp
    WHERE usp.season = p_season
    GROUP BY usp.user_id
  )
  SELECT
    ROW_NUMBER() OVER (ORDER BY c.positions_submitted DESC, c.user_id)::bigint AS rank,
    c.user_id,
    c.positions_submitted,
    COALESCE(
      (SELECT pr.username FROM public.profiles pr WHERE pr.id = c.user_id),
      TRIM(NULLIF(u.raw_user_meta_data->>'full_name', '')),
      TRIM(NULLIF(u.raw_user_meta_data->>'name', '')),
      split_part(u.email, '@', 1)
    ) AS username
  FROM counts c
  LEFT JOIN auth.users u ON u.id = c.user_id
  ORDER BY c.positions_submitted DESC, c.user_id;
$$;
