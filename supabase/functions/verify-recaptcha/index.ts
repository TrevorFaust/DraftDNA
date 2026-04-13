// Verifies Google reCAPTCHA v2 checkbox token (server-side).
// Secret: set Edge Function secret RECAPTCHA_SECRET_KEY (same value as "Secret key" in Google admin).
// Client sends POST JSON: { "token": "<response from g-recaptcha-response>" }.
// Callers may be anonymous (e.g. future flows); no user JWT required.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type SiteVerifyResponse = {
  success?: boolean;
  'error-codes'?: string[];
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const secret = Deno.env.get('RECAPTCHA_SECRET_KEY');
    if (!secret) {
      console.error('verify-recaptcha: missing RECAPTCHA_SECRET_KEY');
      return new Response(
        JSON.stringify({
          error: 'reCAPTCHA is not configured on the server. Add secret RECAPTCHA_SECRET_KEY to Edge Functions.',
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token =
      body &&
      typeof body === 'object' &&
      'token' in body &&
      typeof (body as { token: unknown }).token === 'string'
        ? (body as { token: string }).token.trim()
        : '';

    if (!token) {
      return new Response(JSON.stringify({ error: 'Missing token' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const params = new URLSearchParams();
    params.set('secret', secret);
    params.set('response', token);

    const googleRes = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const json = (await googleRes.json()) as SiteVerifyResponse;
    const ok = json.success === true;

    // Always 200 so supabase.functions.invoke returns parsed JSON (non-2xx often omits `data` on the client).
    return new Response(JSON.stringify({ success: ok, errorCodes: ok ? [] : (json['error-codes'] ?? []) }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('verify-recaptcha error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
