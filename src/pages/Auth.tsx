import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Mail, Lock, Loader2, ArrowLeft, User, CheckCircle2, XCircle, Eye, EyeOff } from 'lucide-react';
import { FootballHelmetIcon } from '@/components/icons/FootballHelmetIcon';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().trim().email('Please enter a valid email address'),
  password: z.string().min(1, 'Please enter your password'),
});

const PASSWORD_SPECIAL = /[!@#$%^&*()_\-+=[\]{}|:;<,>.?/~]/;

function validatePassword(password: string): string | null {
  if (password.length < 10) return 'Password must be at least 10 characters';
  if (!/[A-Z]/.test(password)) return 'Password must include at least one uppercase letter';
  if (!/[a-z]/.test(password)) return 'Password must include at least one lowercase letter';
  if (!/\d/.test(password)) return 'Password must include at least one number';
  if (!PASSWORD_SPECIAL.test(password)) return 'Password must include at least one special character (! @ # $ % ^ & * ( ) _ - + = { [ } ] | : ; < , > . ? / ~)';
  return null;
}

const signUpSchema = z.object({
  username: z
    .string()
    .trim()
    .min(2, 'Username must be at least 2 characters')
    .max(30, 'Username must be 30 characters or less')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens'),
  email: z.string().trim().email('Please enter a valid email address'),
  password: z.string().min(1, 'Enter a password'),
  confirmPassword: z.string(),
})
  .superRefine((data, ctx) => {
    const err = validatePassword(data.password);
    if (err) ctx.addIssue({ code: z.ZodIssueCode.custom, message: err, path: ['password'] });
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords must match',
    path: ['confirmPassword'],
  });

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [usernameTaken, setUsernameTaken] = useState<boolean | null>(null);
  const [usernameCheckLoading, setUsernameCheckLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);
  const { signIn, signUp, user, resetPassword } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const checkUsernameTaken = useCallback(async (value: string) => {
    const trimmed = value.trim();
    if (trimmed.length < 2) {
      setUsernameTaken(null);
      return;
    }
    setUsernameCheckLoading(true);
    setUsernameTaken(null);
    try {
      const { data, error } = await supabase.rpc('check_username_taken', { p_username: trimmed });
      if (!error) setUsernameTaken(!!data);
    } catch {
      setUsernameTaken(null);
    } finally {
      setUsernameCheckLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isLogin && username.trim().length >= 2) {
      const t = setTimeout(() => checkUsernameTaken(username), 400);
      return () => clearTimeout(t);
    } else {
      setUsernameTaken(null);
    }
  }, [isLogin, username, checkUsernameTaken]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => setResendCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

  const handleResendVerification = async () => {
    if (!pendingVerificationEmail || resendCooldown > 0) return;
    setResendLoading(true);
    setResendError(null);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: pendingVerificationEmail,
        options: { shouldCreateUser: false },
      });
      if (error) {
        const is429 = (error as { status?: number }).status === 429 || error.message?.toLowerCase().includes('429') || error.message?.toLowerCase().includes('rate limit');
        if (is429) {
          setResendCooldown(60);
          setResendError('Too many requests. Wait about a minute and try again.');
        } else {
          setResendError(error.message || 'Could not send email. Please try again.');
        }
      } else {
        setResendCooldown(60);
        setResendError(null);
        toast.success('Verification email sent! Check your inbox.');
      }
    } catch (err) {
      setResendError('Could not send email. Please try again.');
    } finally {
      setResendLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isLogin) {
      const validation = loginSchema.safeParse({ email: email.trim(), password });
      if (!validation.success) {
        toast.error(validation.error.errors[0].message);
        return;
      }
    } else {
      const validation = signUpSchema.safeParse({
        username: username.trim(),
        email,
        password,
        confirmPassword,
      });
      if (!validation.success) {
        const first = validation.error.errors[0];
        toast.error(first.message);
        return;
      }
      if (usernameTaken === true) {
        toast.error('That username is already taken. Please choose another.');
        return;
      }
    }

    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await signIn(email.trim(), password);
        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            toast.error('Invalid email or password. Please try again.');
          } else {
            toast.error(error.message);
          }
          setLoading(false);
          return;
        }
        toast.success('Signed in.');
        return;
      }

      const { data: emailExists, error: emailCheckError } = await supabase.rpc('check_email_exists', {
        email_to_check: email.trim().toLowerCase(),
      });
      if (!emailCheckError && emailExists) {
        toast.error('You already have an account with this email. Sign in instead, or reset your password if you\'ve forgotten it.');
        setLoading(false);
        return;
      }

      const { error } = await signUp(email, password, { username: username.trim() });
      if (error) {
        const msg = error.message ?? '';
        if (msg.includes('User already registered') || msg.includes('already registered') || msg.includes('already exists')) {
          toast.error('You already have an account with this email. Sign in instead, or reset your password if you\'ve forgotten it.');
        } else if (usernameTaken === true) {
          toast.error('That username is already taken. Please choose another.');
        } else {
          toast.error(msg || 'Something went wrong. Please try again.');
        }
        setLoading(false);
        return;
      }
      const emailLower = email.trim().toLowerCase();
      setPendingVerificationEmail(emailLower);
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: emailLower,
        options: { shouldCreateUser: false },
      });
      if (otpError) {
        const is429 = (otpError as { status?: number }).status === 429 || otpError.message?.toLowerCase().includes('429') || otpError.message?.toLowerCase().includes('rate limit');
        if (is429) {
          setResendCooldown(60);
          setResendError('Too many requests. Wait about a minute and click Resend below.');
        } else {
          setResendError(otpError.message || 'Could not send email. Click Resend to try again.');
        }
      } else {
        toast.success('Check your email for a verification link.');
      }
    } catch (err) {
      toast.error('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      toast.error('Please enter your email address');
      return;
    }

    const emailValidation = z.string().email().safeParse(email);
    if (!emailValidation.success) {
      toast.error('Please enter a valid email address');
      return;
    }

    setResetLoading(true);
    try {
      const { data: emailExists, error: checkError } = await supabase.rpc('check_email_exists', {
        email_to_check: email.trim().toLowerCase(),
      });

      if (checkError) {
        console.error('Error checking email:', checkError);
        toast.error('An error occurred while checking your email. Please try again.');
        setResetLoading(false);
        return;
      }

      if (!emailExists) {
        toast.error('No account found with this email address. Please check your email or sign up for a new account.');
        setResetLoading(false);
        return;
      }

      const { error } = await resetPassword(email);
      if (error) {
        toast.error(error.message || 'Failed to send reset email');
      } else {
        setResetEmailSent(true);
        toast.success('Password reset email sent! Check your inbox.');
      }
    } catch (err: unknown) {
      console.error('Error in password reset:', err);
      toast.error('An unexpected error occurred. Please try again.');
    } finally {
      setResetLoading(false);
    }
  };

  const switchMode = () => {
    setIsLogin(!isLogin);
    setUsername('');
    setPassword('');
    setConfirmPassword('');
    setUsernameTaken(null);
    setPendingVerificationEmail(null);
    setResendCooldown(0);
    setResendError(null);
  };

  const goToSignIn = () => {
    setPendingVerificationEmail(null);
    setResendCooldown(0);
    setResendError(null);
    setIsLogin(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_hsl(190_95%_50%/0.15),transparent_50%)]" />

      <div className="glass-card p-8 w-full max-w-md animate-slide-up relative">
        {pendingVerificationEmail ? (
          <div className="space-y-6">
            <div className="flex flex-col items-center mb-6">
              <div className="w-16 h-16 rounded-2xl bg-gradient-primary flex items-center justify-center mb-4 shadow-glow">
                <FootballHelmetIcon className="w-8 h-8 text-primary-foreground" />
              </div>
              <h1 className="font-display text-4xl tracking-wide text-gradient">Verify your email</h1>
              <p className="text-muted-foreground mt-2 text-center">
                We&apos;ve sent a verification link to <span className="font-medium text-foreground">{pendingVerificationEmail}</span>. Click the link in the email to verify your account.
              </p>
              <p className="text-muted-foreground mt-2 text-center text-sm">
                If you&apos;ve already clicked the link, you can go straight to sign in.
              </p>
            </div>
            {resendError && (
              <p className="text-sm text-amber-600 dark:text-amber-400 text-center">
                {resendError}
              </p>
            )}
            <div className="space-y-3">
              <Button
                type="button"
                variant="hero"
                className="w-full"
                size="lg"
                onClick={goToSignIn}
              >
                Go to sign in
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                size="lg"
                onClick={handleResendVerification}
                disabled={resendLoading || resendCooldown > 0}
              >
                {resendLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend verification email'}
              </Button>
              <button
                type="button"
                onClick={() => { setPendingVerificationEmail(null); setResendCooldown(0); setResendError(null); }}
                className="w-full text-sm text-muted-foreground hover:text-foreground"
              >
                Use a different email
              </button>
            </div>
          </div>
        ) : (
          <>
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-primary flex items-center justify-center mb-4 shadow-glow">
            <FootballHelmetIcon className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="font-display text-4xl tracking-wide text-gradient">DRAFT BOARD</h1>
          <p className="text-muted-foreground mt-2">
            {isLogin ? 'Welcome back!' : 'Create your account'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="username"
                  type="text"
                  placeholder="johndoe"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-10 bg-secondary/50 border-border/50 focus:border-primary"
                  required
                  autoComplete="off"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2">
                  {usernameCheckLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                  {!usernameCheckLoading && username.trim().length >= 2 && usernameTaken === true && (
                    <XCircle className="w-4 h-4 text-destructive" aria-label="Username taken" />
                  )}
                  {!usernameCheckLoading && username.trim().length >= 2 && usernameTaken === false && (
                    <CheckCircle2 className="w-4 h-4 text-green-500" aria-label="Username available" />
                  )}
                </span>
              </div>
              {username.trim().length >= 2 && usernameTaken === true && (
                <p className="text-sm text-destructive">That username is already taken.</p>
              )}
              <p className="text-xs text-muted-foreground">Letters, numbers, underscores, and hyphens only. 2–30 characters.</p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10 bg-secondary/50 border-border/50 focus:border-primary"
                required
                autoComplete="email"
              />
            </div>
          </div>

          {!showForgotPassword && (
            <>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={isLogin ? 'password' : (showPassword ? 'text' : 'password')}
                    placeholder=""
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10 bg-secondary/50 border-border/50 focus:border-primary"
                    required
                    autoComplete={isLogin ? 'current-password' : 'off'}
                  />
                  {!isLogin && (
                    <button
                      type="button"
                      onClick={() => setShowPassword((p) => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  )}
                </div>
              </div>

              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder=""
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-10 pr-10 bg-secondary/50 border-border/50 focus:border-primary"
                      required
                      autoComplete="off"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((p) => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {confirmPassword && password !== confirmPassword && (
                    <p className="text-sm text-destructive">Passwords must match.</p>
                  )}
                </div>
              )}
            </>
          )}

          {isLogin && !showForgotPassword && (
            <div className="text-right">
              <button
                type="button"
                onClick={() => setShowForgotPassword(true)}
                className="text-sm text-primary hover:underline"
              >
                Forgot password?
              </button>
            </div>
          )}

          {showForgotPassword ? (
            <>
              {resetEmailSent ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                    <p className="text-sm text-green-400 text-center">
                      Password reset email sent! Check your inbox and follow the instructions to reset your password.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setShowForgotPassword(false);
                      setResetEmailSent(false);
                      setEmail('');
                    }}
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Sign In
                  </Button>
                </div>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowForgotPassword(false);
                      setResetEmailSent(false);
                    }}
                    className="mb-2 -mt-2"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Sign In
                  </Button>
                  <Button
                    type="button"
                    variant="hero"
                    className="w-full"
                    size="lg"
                    onClick={handleForgotPassword}
                    disabled={resetLoading || !email.trim()}
                  >
                    {resetLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      'Send Reset Email'
                    )}
                  </Button>
                  <p className="text-sm text-muted-foreground text-center mt-2">
                    Enter your email address and we'll send you a link to reset your password.
                  </p>
                </>
              )}
            </>
          ) : (
            <>
              {!isLogin && (
                <div className="text-xs text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground/80">Password must include:</p>
                  <ul className="list-disc list-inside space-y-0.5 pl-1">
                    <li>At least 10 characters</li>
                    <li>At least one uppercase letter</li>
                    <li>At least one lowercase letter</li>
                    <li>At least one number</li>
                    <li>At least one special character: ! @ # $ % ^ {' & '} * ( ) _ - + = {'{ [ } ]'} | : ; {'<'} , {'>'} . ? / ~</li>
                  </ul>
                  <p className="pt-1">Passwords must match.</p>
                </div>
              )}
              <Button type="submit" variant="hero" className="w-full" size="lg" disabled={loading}>
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isLogin ? (
                  'Sign In'
                ) : (
                  'Create Account'
                )}
              </Button>
            </>
          )}
        </form>

        {!showForgotPassword && (
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={switchMode}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {isLogin ? "Don't have an account? " : 'Already have an account? '}
              <span className="text-primary font-medium">
                {isLogin ? 'Sign up' : 'Sign in'}
              </span>
            </button>
          </div>
        )}
          </>
        )}
      </div>
    </div>
  );
};

export default Auth;
