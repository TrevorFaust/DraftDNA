// Creates a confirmed account without sending email (bypasses broken/slow SMTP).
// Public signup path: verify_jwt is off; validate input here. Client signs in after success.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PASSWORD_SPECIAL = /[!@#$%^&*()_\-+=[\]{}|:;<,>.?/~]/;
const USERNAME_RE = /^[a-zA-Z0-9_-]+$/;

function validatePassword(password: string): string | null {
  if (password.length < 10) return 'Password must be at least 10 characters';
  if (!/[A-Z]/.test(password)) return 'Password must include at least one uppercase letter';
  if (!/[a-z]/.test(password)) return 'Password must include at least one lowercase letter';
  if (!/\d/.test(password)) return 'Password must include at least one number';
  if (!PASSWORD_SPECIAL.test(password)) {
    return 'Password must include at least one special character';
  }
  return null;
}

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      console.error('create-account: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
      return json(503, { error: 'Account creation is temporarily unavailable.' });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return json(400, { error: 'Invalid JSON body' });
    }

    const emailRaw =
      body && typeof body === 'object' && 'email' in body && typeof (body as { email: unknown }).email === 'string'
        ? (body as { email: string }).email
        : '';
    const password =
      body && typeof body === 'object' && 'password' in body && typeof (body as { password: unknown }).password === 'string'
        ? (body as { password: string }).password
        : '';
    const usernameRaw =
      body && typeof body === 'object' && 'username' in body && typeof (body as { username: unknown }).username === 'string'
        ? (body as { username: string }).username
        : '';

    const email = emailRaw.trim().toLowerCase();
    const username = usernameRaw.trim();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json(400, { error: 'Please enter a valid email address' });
    }
    if (username.length < 2 || username.length > 30 || !USERNAME_RE.test(username)) {
      return json(400, {
        error: 'Username must be 2–30 characters and use only letters, numbers, underscores, or hyphens',
      });
    }
    const passwordError = validatePassword(password);
    if (passwordError) {
      return json(400, { error: passwordError });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: usernameTaken, error: usernameCheckError } = await admin.rpc('check_username_taken', {
      p_username: username,
    });
    if (usernameCheckError) {
      console.error('create-account username check:', usernameCheckError);
      return json(500, { error: 'Could not verify username. Please try again.' });
    }
    if (usernameTaken) {
      return json(409, { error: 'That username is already taken. Please choose another.' });
    }

    const { data: emailExists, error: emailCheckError } = await admin.rpc('check_email_exists', {
      email_to_check: email,
    });
    if (emailCheckError) {
      console.error('create-account email check:', emailCheckError);
      return json(500, { error: 'Could not verify email. Please try again.' });
    }
    if (emailExists) {
      return json(409, {
        error: 'You already have an account with this email. Sign in instead.',
      });
    }

    const { data, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { username },
    });

    if (createError) {
      const msg = (createError.message ?? '').toLowerCase();
      if (msg.includes('already') || msg.includes('registered') || msg.includes('exists')) {
        return json(409, {
          error: 'You already have an account with this email. Sign in instead.',
        });
      }
      console.error('create-account createUser:', createError);
      return json(400, { error: createError.message || 'Could not create account.' });
    }

    if (!data.user) {
      return json(500, { error: 'Could not create account.' });
    }

    return json(200, { success: true, userId: data.user.id });
  } catch (err) {
    console.error('create-account error:', err);
    return json(500, { error: 'Internal server error' });
  }
});
