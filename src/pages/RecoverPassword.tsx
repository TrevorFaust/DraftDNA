import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { accessTokenIsPasswordRecovery } from '@/lib/passwordRecoveryToken';
import { PasswordRecoveryForm } from '@/components/PasswordRecoveryForm';
import { Button } from '@/components/ui/button';

/**
 * Dedicated landing path for password-reset emails (see resetPassword redirectTo).
 * Recovery is enforced using the session JWT (amr recovery) so it works across devices.
 */
const RecoverPassword = () => {
  const { user, session, loading, passwordRecoveryActive } = useAuth();
  const jwtRecovery = !!session?.access_token && accessTokenIsPasswordRecovery(session.access_token);
  const showForm = !!user && (jwtRecovery || passwordRecoveryActive);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" aria-hidden />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_hsl(190_95%_50%/0.15),transparent_50%)]" />
        <div className="glass-card p-8 w-full max-w-md relative text-center space-y-4">
          <p className="text-muted-foreground">
            Open the reset link from your email on this device, or request a new password reset from the sign-in page.
          </p>
          <Button asChild variant="hero" className="w-full">
            <Link to="/auth">Go to sign in</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!showForm) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_hsl(190_95%_50%/0.15),transparent_50%)]" />
        <div className="glass-card p-8 w-full max-w-md relative text-center space-y-4">
          <p className="text-muted-foreground">
            This page is only for links from a password-reset email. If you need to change your password, send a new reset
            email from the live site while signed out.
          </p>
          <Button asChild variant="hero" className="w-full">
            <Link to="/dashboard">Go to dashboard</Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link to="/auth">Sign in</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_hsl(190_95%_50%/0.15),transparent_50%)]" />
      <div className="glass-card p-8 w-full max-w-md animate-slide-up relative">
        <PasswordRecoveryForm />
      </div>
    </div>
  );
};

export default RecoverPassword;
