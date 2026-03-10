import { useState, useEffect, useRef, createContext, useContext } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { migrateAllTemporaryData } from '@/utils/migrateTempData';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, options?: { username?: string }) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  changePassword: (newPassword: string) => Promise<{ error: Error | null }>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const previousUserRef = useRef<User | null>(null);
  const hasMigratedRef = useRef(false);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const previousUser = previousUserRef.current;
        previousUserRef.current = session?.user ?? null;
        
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
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      previousUserRef.current = session?.user ?? null;
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, options?: { username?: string }) => {
    const redirectUrl = `${window.location.origin}/`;
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
    await supabase.auth.signOut();
  };

  const changePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    return { error };
  };

  const resetPassword = async (email: string) => {
    const redirectUrl = `${window.location.origin}/auth?reset=true`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });
    return { error };
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut, changePassword, resetPassword }}>
      {children}
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
