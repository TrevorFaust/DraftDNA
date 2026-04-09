/**
 * Recovery links establish a session; the access token’s amr claim includes
 * method "recovery" until the user sets a new password.
 */
export const PASSWORD_RECOVERY_PATH = '/recover-password';

export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    return JSON.parse(atob(padded)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function normalizeAmr(payload: Record<string, unknown>): unknown[] {
  const amr = payload.amr;
  if (Array.isArray(amr)) return amr;
  if (typeof amr === 'string') {
    try {
      const parsed = JSON.parse(amr);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function accessTokenIsPasswordRecovery(accessToken: string): boolean {
  const payload = decodeJwtPayload(accessToken);
  if (!payload) return false;
  return normalizeAmr(payload).some((entry) => {
    if (entry === 'recovery') return true;
    if (typeof entry === 'object' && entry !== null && 'method' in entry) {
      return (entry as { method?: string }).method === 'recovery';
    }
    return false;
  });
}

function onRecoveryLandingPath(): boolean {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname;
  return path === PASSWORD_RECOVERY_PATH || path.endsWith(PASSWORD_RECOVERY_PATH);
}

/**
 * Whether we should treat this navigation as password-recovery UX (before async auth runs).
 * Does not return true for an empty /recover-password visit (no hash / code).
 */
export function readPasswordRecoveryFromUrl(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('reset') === 'true') return true;
    const raw = window.location.hash.replace(/^#/, '');
    if (raw) {
      if (/type[=:]recovery/i.test(raw)) return true;
      try {
        if (new URLSearchParams(raw).get('type') === 'recovery') return true;
      } catch {
        /* ignore */
      }
    }
    if (onRecoveryLandingPath()) {
      if (params.toString().includes('code=')) return true;
      if (raw.length > 10) return true;
    }
    return false;
  } catch {
    return false;
  }
}
