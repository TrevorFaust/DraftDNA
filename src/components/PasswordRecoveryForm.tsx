import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Lock, Loader2, Eye, EyeOff } from 'lucide-react';
import { SiteLogo } from '@/components/SiteLogo';
import { validatePassword } from '@/lib/passwordPolicy';

export function PasswordRecoveryForm() {
  const { user, completePasswordRecovery } = useAuth();
  const navigate = useNavigate();
  const [recoveryPassword, setRecoveryPassword] = useState('');
  const [recoveryConfirm, setRecoveryConfirm] = useState('');
  const [recoverySubmitting, setRecoverySubmitting] = useState(false);
  const [showRecoveryPassword, setShowRecoveryPassword] = useState(false);
  const [showRecoveryConfirm, setShowRecoveryConfirm] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validatePassword(recoveryPassword);
    if (err) {
      toast.error(err);
      return;
    }
    if (recoveryPassword !== recoveryConfirm) {
      toast.error('Passwords must match.');
      return;
    }
    setRecoverySubmitting(true);
    try {
      const { error } = await completePasswordRecovery(recoveryPassword);
      if (error) {
        toast.error(error.message || 'Could not update password');
        return;
      }
      toast.success('Password updated. You are signed in.');
      navigate('/dashboard');
    } finally {
      setRecoverySubmitting(false);
    }
  };

  if (!user?.email) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center mb-2">
        <div className="w-16 h-16 rounded-2xl bg-gradient-primary flex items-center justify-center mb-4 shadow-glow overflow-hidden">
          <SiteLogo size={40} className="w-10 h-10" />
        </div>
        <h1 className="font-display text-3xl tracking-wide text-gradient text-center">Set a new password</h1>
        <p className="text-muted-foreground mt-2 text-center text-sm">
          Your email link confirmed it is you. Choose a new password for{' '}
          <span className="font-medium text-foreground">{user.email}</span>.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="recovery-password">New password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="recovery-password"
              type={showRecoveryPassword ? 'text' : 'password'}
              value={recoveryPassword}
              onChange={(e) => setRecoveryPassword(e.target.value)}
              className="pl-10 pr-10 bg-secondary/50 border-border/50 focus:border-primary"
              required
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowRecoveryPassword((p) => !p)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={showRecoveryPassword ? 'Hide password' : 'Show password'}
            >
              {showRecoveryPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="recovery-confirm">Confirm new password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="recovery-confirm"
              type={showRecoveryConfirm ? 'text' : 'password'}
              value={recoveryConfirm}
              onChange={(e) => setRecoveryConfirm(e.target.value)}
              className="pl-10 pr-10 bg-secondary/50 border-border/50 focus:border-primary"
              required
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowRecoveryConfirm((p) => !p)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={showRecoveryConfirm ? 'Hide password' : 'Show password'}
            >
              {showRecoveryConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        {recoveryConfirm && recoveryPassword !== recoveryConfirm && (
          <p className="text-sm text-destructive">Passwords must match.</p>
        )}
        <div className="text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground/80">Password must include:</p>
          <ul className="list-disc list-inside space-y-0.5 pl-1">
            <li>At least 10 characters</li>
            <li>At least one uppercase letter</li>
            <li>At least one lowercase letter</li>
            <li>At least one number</li>
            <li>
              At least one special character: ! @ # $ % ^ {' & '} * ( ) _ - + = {'{ [ } ]'} | : ; {'<'} , {'>'} . ? / ~
            </li>
          </ul>
        </div>
        <Button type="submit" variant="hero" className="w-full" size="lg" disabled={recoverySubmitting}>
          {recoverySubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save password and continue'}
        </Button>
      </form>
    </div>
  );
}
