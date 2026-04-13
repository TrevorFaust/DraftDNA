import { useState, useEffect, useRef, createContext, useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { User, Session } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { getSiteOriginForAuth } from '@/lib/siteOrigin';
import {
  accessTokenIsPasswordRecovery,
  PASSWORD_RECOVERY_PATH,
  readPasswordRecoveryFromUrl,
} from '@/lib/passwordRecoveryToken';
import { migrateAllTemporaryData } from '@/utils/migrateTempData';

const PASSWORD_RECOVERY_STORAGE_KEY = 'draftdna_password_recovery';

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
  toast.error(message);
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

        // Migrate temporary data when user signs in (transition from no user to user)
        if (event === 'SIGNED_IN' && session?.user && !previousUser && !hasMigratedRef.current) {
          hasMigratedRef.current = true;
          try {
            const result = await migrateAllTemporaryData(session.user.id);
            if (result.draftsMigrated > 0 || result.rankingsMigrated) {
              console.log(`Migrated ${result.draftsMigrated} drafts and ${result.rankingsMigrated ? 'rankings' : 'no rankings'}`);
            }
          } catch (error) {
            console.error('Error migrating temporary data:', error);
          }
        }

        // Reset migration flag when user signs out
        if (event === 'SIGNED_OUT') {
          hasMigratedRef.current = false;
          setPasswordRecoveryActive(false);
          clearPasswordRecoveryPending();
        }
      }
    );

    // THEN check for existing session (handle errors so we don't get stuck with bad state)
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        setSession(null);
        setUser(null);
        setLoading(false);
        return;
      }
      if (!session && readPasswordRecoveryPending()) {
        clearPasswordRecoveryPending();
        setPasswordRecoveryActive(false);
      }
      if (session?.access_token && accessTokenIsPasswordRecovery(session.access_token)) {
        markPasswordRecoveryPending();
        setPasswordRecoveryActive(true);
      }
      previousUserRef.current = session?.user ?? null;
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

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
    const redirectUrl = `${getSiteOriginForAuth()}/`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: options?.username ? { username: options.username.trim() } : undefined,
      },
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut({ scope: 'global' });
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
      toast.error(error.message || 'Signed out here; if issues persist, refresh the page.');
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
