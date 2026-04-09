const PASSWORD_SPECIAL = /[!@#$%^&*()_\-+=[\]{}|:;<,>.?/~]/;

export function validatePassword(password: string): string | null {
  if (password.length < 10) return 'Password must be at least 10 characters';
  if (!/[A-Z]/.test(password)) return 'Password must include at least one uppercase letter';
  if (!/[a-z]/.test(password)) return 'Password must include at least one lowercase letter';
  if (!/\d/.test(password)) return 'Password must include at least one number';
  if (!PASSWORD_SPECIAL.test(password))
    return 'Password must include at least one special character (! @ # $ % ^ & * ( ) _ - + = { [ } ] | : ; < , > . ? / ~)';
  return null;
}
