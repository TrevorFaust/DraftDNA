/**
 * Supabase persists sessions under keys like `sb-<project-ref>-auth-token`.
 * signOut usually clears them; wipe is a fallback when refresh fails or storage is inconsistent.
 */
export function wipeLocalSupabaseAuthTokens(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('sb-') && k.endsWith('-auth-token')) keys.push(k);
    }
    for (const k of keys) localStorage.removeItem(k);
  } catch {
    /* ignore */
  }
}
