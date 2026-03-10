-- RPC: get email for sign-in when user enters their username (not email).
-- Used so sign-in can accept either email or username; returns the account email for that username.
-- SECURITY DEFINER to read auth.users; only returns email for matching username (no password exposure).

CREATE OR REPLACE FUNCTION public.get_email_for_signin(p_username text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT u.email
  FROM auth.users u
  INNER JOIN public.profiles p ON p.id = u.id
  WHERE lower(trim(p.username)) = lower(trim(p_username))
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_email_for_signin(text) IS
  'Returns the account email for a given username, for sign-in flow. Call with username only; used when user signs in with username instead of email.';
