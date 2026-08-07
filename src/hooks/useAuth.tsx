import { useState, useEffect, useRef, createContext, useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { User, Session, FunctionsHttpError } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { getSiteOriginForAuth } from '@/lib/siteOrigin';
import {
  accessTokenIsPasswordRecovery,
  PASSWORD_RECOVERY_PATH,
  readPasswordRecoveryFromUrl,
} from '@/lib/passwordRecoveryToken';
import { migrateAllTemporaryData } from '@/utils/migrateTempData';
import { wipeLocalSupabaseAuthTokens } from '@/lib/supabaseAuthStorage';
import { userFacingErrorMessage } from '@/utils/userFacingError';

const PASSWORD_RECOVERY_STORAGE_KEY = 'draftdna_password_recovery';

/** Kept off until we validate the session (see client `autoRefreshToken: false`). */
function setAuthAutoRefresh(enabled: boolean): void {
  try {
    const a = supabase.auth as {
      startAutoRefresh?: () => void;
      stopAutoRefresh?: () => void;
    };
    if (enabled && typeof a.startAutoRefresh === 'function') a.startAutoRefresh();
    else if (!enabled && typeof a.stopAutoRefresh === 'function') a.stopAutoRefresh();
  } catch {
    /* ignore */
  }
}

/** Supabase puts email-link failures in the URL hash, often on the project Site URL root (e.g. localhost:3000). */
function consumeSupabaseAuthFragmentError(): void {
  const rawHash = window.location.hash.replace(/^#/, '');
  if (!rawHash.includes('error=')) return;
  const params = new URLSearchParams(rawHash);
  const rawMsg = params.get('error_description') ?? params.get('error');
  if (!rawMsg) return;
  const spaced = rawMsg.replace(/\+/g, ' ');
  let message: string;
  try {
    message = decodeURIComponent(spaced);
  } catch {
    message = spaced;
  }
  toast.error(userFacingErrorMessage(message, 'Sign-in link failed. Request a new one and try again.'));
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  passwordRecoveryActive: boolean;
  signUp: (email: string, password: string, options?: { username?: string }) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  changePassword: (newPassword: string) => Promise<{ error: Error | null }>;
  completePasswordRecovery: (newPassword: string) => Promise<{ error: Error | null }>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function markPasswordRecoveryPending() {
  try {
    sessionStorage.setItem(PASSWORD_RECOVERY_STORAGE_KEY, '1');
  } catch {
    /* ignore */
  }
}

function clearPasswordRecoveryPending() {
  try {
    sessionStorage.removeItem(PASSWORD_RECOVERY_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

function readPasswordRecoveryPending(): boolean {
  try {
    return sessionStorage.getItem(PASSWORD_RECOVERY_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/** Supabase keeps refresh tokens in localStorage; if the server revoked them, refresh returns 400 and queries stay anonymous until we clear storage. */
function isStaleRefreshTokenError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    msg.includes('refresh token') ||
    msg.includes('invalid refresh') ||
    msg.includes('refresh_token_not_found')
  );
}

/**
 * Dead/poisoned refresh tokens often surface as CORS `Failed to fetch` on `/auth/v1/token`
 * (error responses without Access-Control-Allow-Origin). Keeping auto-refresh on then stalls every query.
 */
function isAuthNetworkOrCorsFailure(error: unknown): boolean {
  const msg = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network request failed') ||
    msg.includes('load failed') ||
    msg.includes('err_failed')
  );
}

async function clearBrokenLocalSession(reasonToast?: string): Promise<void> {
  setAuthAutoRefresh(false);
  try {
    await supabase.auth.signOut({ scope: 'local' });
  } catch {
    /* ignore */
  }
  wipeLocalSupabaseAuthTokens();
  if (reasonToast) toast.info(reasonToast);
}

/**
 * Recovery sessions must finish on /recover-password or /auth (must sit inside BrowserRouter).
 * Uses JWT amr + context flag so we redirect even if PASSWORD_RECOVERY fires late (e.g. mobile).
 */
function PasswordRecoveryRedirect({ children }: { children: React.ReactNode }) {
  const { user, session, loading, passwordRecoveryActive } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (loading || !user) return;
    const jwtRecovery = !!session?.access_token && accessTokenIsPasswordRecovery(session.access_token);
    if (!passwordRecoveryActive && !jwtRecovery) return;
    const path = location.pathname;
    if (path === '/auth' || path === PASSWORD_RECOVERY_PATH) return;
    navigate(PASSWORD_RECOVERY_PATH, { replace: true });
  }, [loading, user, session?.access_token, passwordRecoveryActive, location.pathname, navigate]);

  return <>{children}</>;
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [passwordRecoveryActive, setPasswordRecoveryActive] = useState(() => {
    if (readPasswordRecoveryPending()) return true;
    if (readPasswordRecoveryFromUrl()) {
      markPasswordRecoveryPending();
      return true;
    }
    return false;
  });
  const previousUserRef = useRef<User | null>(null);
  const hasMigratedRef = useRef(false);
  const lastHiddenAtRef = useRef<number | null>(null);

  useEffect(() => {
    consumeSupabaseAuthFragmentError();
  }, []);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const previousUser = previousUserRef.current;
        previousUserRef.current = session?.user ?? null;

        if (event === 'PASSWORD_RECOVERY' && session?.user) {
          markPasswordRecoveryPending();
          setPasswordRecoveryActive(true);
        }

        if (session?.access_token && accessTokenIsPasswordRecovery(session.access_token)) {
          markPasswordRecoveryPending();
          setPasswordRecoveryActive(true);
        }

        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        if (event === 'SIGNED_IN' && session?.user) {
          setAuthAutoRefresh(true);
        }
        if (event === 'SIGNED_OUT') {
          setAuthAutoRefresh(false);
          wipeLocalSupabaseAuthTokens();
        }

        // Migrate guest localStorage in the background — never block auth callbacks / UI.
        if (event === 'SIGNED_IN' && session?.user && !previousUser && !hasMigratedRef.current) {
          hasMigratedRef.current = true;
          const uid = session.user.id;
          void migrateAllTemporaryData(uid)
            .then((result) => {
              if (result.draftsMigrated > 0 || result.rankingsMigrated) {
                console.log(
                  `Migrated ${result.draftsMigrated} drafts and ${result.rankingsMigrated ? 'rankings' : 'no rankings'}`
                );
              }
            })
            .catch((error) => {
              console.error('Error migrating temporary data:', error);
            });
        }

        // Reset migration flag when user signs out
        if (event === 'SIGNED_OUT') {
          hasMigratedRef.current = false;
          setPasswordRecoveryActive(false);
          clearPasswordRecoveryPending();
        }
      }
    );

    // Paint immediately from local session, then validate in the background.
    // Waiting on getUser() alone hung for 30–60s+ when refresh_token/CORS failed.
    const AUTH_VALIDATE_MS = 5_000;
    void (async () => {
      const {
        data: { session: localSession },
        error: localSessionError,
      } = await supabase.auth.getSession();

      if (!localSessionError && localSession) {
        if (localSession.access_token && accessTokenIsPasswordRecovery(localSession.access_token)) {
          markPasswordRecoveryPending();
          setPasswordRecoveryActive(true);
        }
        previousUserRef.current = localSession.user ?? null;
        setSession(localSession);
        setUser(localSession.user);
      } else {
        previousUserRef.current = null;
        setSession(null);
        setUser(null);
      }
      setLoading(false);

      type GetUserResult = Awaited<ReturnType<typeof supabase.auth.getUser>>;
      let userData: GetUserResult['data'] | null = null;
      let userError: GetUserResult['error'] | null = null;
      try {
        const raced = await Promise.race([
          supabase.auth.getUser().then((r) => ({ kind: 'ok' as const, r })),
          new Promise<{ kind: 'timeout' }>((resolve) =>
            setTimeout(() => resolve({ kind: 'timeout' }), AUTH_VALIDATE_MS)
          ),
        ]);
        if (raced.kind === 'timeout') {
          // Keep local session; skip auto-refresh until a later successful validation.
          if (localSession) setAuthAutoRefresh(false);
          return;
        }
        userData = raced.r.data;
        userError = raced.r.error;
      } catch (e) {
        userError = e as GetUserResult['error'];
      }

      if (userError) {
        if (isStaleRefreshTokenError(userError)) {
          await clearBrokenLocalSession('Your session expired. Please sign in again.');
          setSession(null);
          setUser(null);
          return;
        }

        const cached = localSession;
        if (!cached) {
          setAuthAutoRefresh(false);
          setSession(null);
          setUser(null);
          return;
        }

        if (isAuthNetworkOrCorsFailure(userError)) {
          const expiresAtMs = (cached.expires_at ?? 0) * 1000;
          const accessStillValid = expiresAtMs > Date.now() + 60_000;
          if (accessStillValid) {
            setAuthAutoRefresh(false);
            return;
          }

          try {
            const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
            if (
              refreshError ||
              !refreshed.session ||
              isStaleRefreshTokenError(refreshError) ||
              isAuthNetworkOrCorsFailure(refreshError)
            ) {
              await clearBrokenLocalSession('Your session expired. Please sign in again.');
              setSession(null);
              setUser(null);
              return;
            }
            if (refreshed.session.access_token && accessTokenIsPasswordRecovery(refreshed.session.access_token)) {
              markPasswordRecoveryPending();
              setPasswordRecoveryActive(true);
            }
            previousUserRef.current = refreshed.session.user ?? null;
            setSession(refreshed.session);
            setUser(refreshed.session.user);
            setAuthAutoRefresh(true);
            return;
          } catch {
            await clearBrokenLocalSession('Your session expired. Please sign in again.');
            setSession(null);
            setUser(null);
            return;
          }
        }

        // Transient errors: keep local session.
        setAuthAutoRefresh(true);
        return;
      }

      const session = (await supabase.auth.getSession()).data.session;
      if (!session && readPasswordRecoveryPending()) {
        clearPasswordRecoveryPending();
        setPasswordRecoveryActive(false);
      }
      if (session?.access_token && accessTokenIsPasswordRecovery(session.access_token)) {
        markPasswordRecoveryPending();
        setPasswordRecoveryActive(true);
      }
      previousUserRef.current = userData?.user ?? session?.user ?? null;
      setSession(session);
      setUser(userData?.user ?? session?.user ?? null);
      if (userData?.user ?? session?.user) setAuthAutoRefresh(true);
      else setAuthAutoRefresh(false);
    })();

    // When user returns to tab after long idle, do a full page reload for a clean state
    const IDLE_MS_BEFORE_RELOAD = 30 * 60 * 1000; // 30 minutes
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        lastHiddenAtRef.current = Date.now();
        return;
      }
      const hiddenAt = lastHiddenAtRef.current;
      if (hiddenAt == null || Date.now() - hiddenAt < IDLE_MS_BEFORE_RELOAD) return;
      lastHiddenAtRef.current = null;
      window.location.reload();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const signUp = async (email: string, password: string, options?: { username?: string }) => {
    const username = options?.username?.trim();
    if (!username) {
      return { error: new Error('Username is required') };
    }

    // Bypass GoTrue /signup + SMTP (Gmail SMTP was timing out at ~10s with 504s).
    // create-account uses admin.createUser with email_confirm so no verification email is sent.
    const { data, error: invokeError, response } = await supabase.functions.invoke('create-account', {
      body: {
        email: email.trim().toLowerCase(),
        password,
        username,
      },
    });

    let invokeMessage =
      data && typeof data === 'object' && 'error' in data && typeof (data as { error: unknown }).error === 'string'
        ? (data as { error: string }).error
        : null;

    if (!invokeMessage && invokeError) {
      invokeMessage = invokeError.message;
      if (invokeError instanceof FunctionsHttpError && response) {
        try {
          const body: unknown = await response.json();
          if (
            body &&
            typeof body === 'object' &&
            'error' in body &&
            typeof (body as { error: unknown }).error === 'string'
          ) {
            invokeMessage = (body as { error: string }).error;
          }
        } catch {
          /* keep invokeError.message */
        }
      }
    }

    if (invokeMessage) {
      return { error: new Error(invokeMessage) };
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    return { error: signInError };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signOut = async () => {
    setAuthAutoRefresh(false);
    const { error } = await supabase.auth.signOut({ scope: 'global' });
    wipeLocalSupabaseAuthTokens();
    // Always clear local state so UI updates even if revoke fails (e.g. right after account delete).
    previousUserRef.current = null;
    hasMigratedRef.current = false;
    setPasswordRecoveryActive(false);
    clearPasswordRecoveryPending();
    setSession(null);
    setUser(null);
    setLoading(false);
    if (error) {
      console.error('Sign out:', error);
      toast.error(
        userFacingErrorMessage(error, 'Signed out here. If issues persist, refresh the page.')
      );
    }
  };

  const changePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    return { error };
  };

  const completePasswordRecovery = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (!error) {
      setPasswordRecoveryActive(false);
      clearPasswordRecoveryPending();
    }
    return { error };
  };

  const resetPassword = async (email: string) => {
    const origin = getSiteOriginForAuth();
    if (import.meta.env.DEV) {
      const isLocal =
        /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(origin) ||
        /^https?:\/\/192\.168\.\d+\.\d+(:\d+)?$/i.test(origin) ||
        /^https?:\/\/10\.\d+\.\d+\.\d+(:\d+)?$/i.test(origin);
      if (isLocal && !import.meta.env.VITE_SITE_URL?.trim()) {
        console.warn(
          '[DraftDNA auth] Reset links use',
          origin + PASSWORD_RECOVERY_PATH,
          '— phones and other devices cannot open that URL. Set VITE_SITE_URL in .env to your live site (e.g. https://yourdomain.com), restart dev, then send reset again.'
        );
      }
    }
    const redirectUrl = `${origin}${PASSWORD_RECOVERY_PATH}`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });
    return { error };
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        passwordRecoveryActive,
        signUp,
        signIn,
        signOut,
        changePassword,
        completePasswordRecovery,
        resetPassword,
      }}
    >
      <PasswordRecoveryRedirect>{children}</PasswordRecoveryRedirect>
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
