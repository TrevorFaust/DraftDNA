/**
 * Runs before React loads. Does not import the Supabase client (GoTrue would start otherwise).
 * Visit once with ?clear_auth=1 to wipe dead refresh tokens from localStorage after auth errors.
 */
import { wipeLocalSupabaseAuthTokens } from '@/lib/supabaseAuthStorage';

function run(): void {
  if (typeof window === 'undefined') return;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('clear_auth') !== '1') return;
    wipeLocalSupabaseAuthTokens();
    params.delete('clear_auth');
    const qs = params.toString();
    const url = `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`;
    window.history.replaceState(null, '', url);
  } catch {
    /* ignore */
  }
}

run();
