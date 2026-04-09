/**
 * Origin used in Supabase auth email links. When unset, uses the current page
 * (fine for local dev). Set VITE_SITE_URL in production so reset/confirm
 * emails never point at localhost if someone triggered the flow from dev.
 */
export function getSiteOriginForAuth(): string {
  const fromEnv = import.meta.env.VITE_SITE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, '');
  return window.location.origin;
}
