import { createContext, useContext, useState, ReactNode } from 'react';

/** Table-state shared by every attack on the sheet (not saved with the
 * character): how many opponents the character is currently fighting.
 * One shared value so the counter reads the same on every weapon card. */
interface CombatCtxType {
  opponents: number;
  setOpponents: (n: number) => void;
}

const CombatCtx = createContext<CombatCtxType | null>(null);

export function CombatProvider({ children }: { children: ReactNode }) {
  const [opponents, setOpponentsRaw] = useState(1);
  const setOpponents = (n: number) => setOpponentsRaw(Math.max(1, Math.floor(n) || 1));
  return <CombatCtx.Provider value={{ opponents, setOpponents }}>{children}</CombatCtx.Provider>;
}

export function useCombat() {
  const ctx = useContext(CombatCtx);
  if (!ctx) throw new Error('useCombat must be used within CombatProvider');
  return ctx;
}
