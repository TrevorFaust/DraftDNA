import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePendingTeamClaim } from '@/hooks/usePendingTeamClaim';

function pathAllowedWithoutSeat(pathname: string) {
  return (
    pathname === '/dashboard' ||
    pathname === '/auth' ||
    pathname === '/recover-password' ||
    pathname.startsWith('/join/')
  );
}

export function RequireTeamSeat({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { claim, loading } = usePendingTeamClaim();
  const location = useLocation();

  if (authLoading || (user && loading)) {
    return children;
  }

  if (user && claim && !pathAllowedWithoutSeat(location.pathname)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
