/**
 * Runs before React loads. Does not import the Supabase client (GoTrue would start otherwise).
 * Visit once with ?clear_auth=1 to wipe dead refresh tokens from localStorage after auth errors.
 *
 * Also wipes expired sessions up front. An expired access token makes supabase-js call
 * /auth/v1/token on getSession(); when the API returns Cloudflare 522 (no CORS headers),
 * the browser reports a CORS failure and sign-in/data loads hang.
 */
import { wipeLocalSupabaseAuthTokens } from '@/lib/supabaseAuthStorage';

function readAuthTokenKeys(): string[] {
  if (typeof localStorage === 'undefined') return [];
  const keys: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('sb-') && k.endsWith('-auth-token')) keys.push(k);
    }
  } catch {
    /* ignore */
  }
  return keys;
}

/** True when stored session would force a refresh before the app can paint. */
function storedSessionNeedsRefresh(): boolean {
  for (const key of readAuthTokenKeys()) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as {
        expires_at?: number;
        access_token?: string;
        refresh_token?: string;
      };
      // No refresh token → nothing useful to keep.
      if (!parsed?.refresh_token) return true;
      const exp = parsed.expires_at;
      if (typeof exp === 'number' && exp * 1000 <= Date.now() + 30_000) return true;
    } catch {
      return true;
    }
  }
  return false;
}

function run(): void {
  if (typeof window === 'undefined') return;
  try {
    const params = new URLSearchParams(window.location.search);
    const clearFlag = params.get('clear_auth') === '1';
    const shouldWipe = clearFlag || storedSessionNeedsRefresh();

    if (shouldWipe) {
      wipeLocalSupabaseAuthTokens();
    }

    if (clearFlag) {
      params.delete('clear_auth');
      const qs = params.toString();
      const url = `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`;
      window.history.replaceState(null, '', url);
    }
  } catch {
    /* ignore */
  }
}

run();
