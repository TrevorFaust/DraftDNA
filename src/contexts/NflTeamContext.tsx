import { createContext, useContext, type ReactNode } from 'react';
import {
  useNflTeamContext2025,
  type NflTeamContextLookup,
} from '@/hooks/useNflTeamContext2025';

const NflTeamContextContext = createContext<NflTeamContextLookup | null>(null);

/** Loads `nfl_team_context_2025` once for the app (32 rows, cached). */
export function NflTeamContextProvider({ children }: { children: ReactNode }) {
  const value = useNflTeamContext2025(true);
  return (
    <NflTeamContextContext.Provider value={value}>{children}</NflTeamContextContext.Provider>
  );
}

export function useNflTeamContext(): NflTeamContextLookup {
  const ctx = useContext(NflTeamContextContext);
  if (ctx) return ctx;
  return {
    loading: true,
    error: null,
    byAbbr: new Map(),
    olineByAbbr: new Map(),
    allOlineRows: [],
    getForTeam: () => null,
    getOlineForTeam: () => null,
    getRank: () => null,
    getSosRank: () => null,
    getSosOppWinPct: () => null,
  };
}

export type { NflTeamContextLookup };
