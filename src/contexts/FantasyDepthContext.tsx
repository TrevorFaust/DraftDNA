import { createContext, useContext, type ReactNode } from 'react';
import { useFantasyTeamDepth, type FantasyDepthLookup } from '@/hooks/useFantasyTeamDepth';

const FantasyDepthContext = createContext<FantasyDepthLookup | null>(null);

export function FantasyDepthProvider({ children }: { children: ReactNode }) {
  const value = useFantasyTeamDepth();
  return (
    <FantasyDepthContext.Provider value={value}>{children}</FantasyDepthContext.Provider>
  );
}

export function useFantasyDepthContext(): FantasyDepthLookup {
  const ctx = useContext(FantasyDepthContext);
  if (ctx) return ctx;
  return {
    byPlayerId: new Map(),
    byTeamPosName: new Map(),
    loading: false,
    error: null,
    getForPlayer: () => null,
  };
}
