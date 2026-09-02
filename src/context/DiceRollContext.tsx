import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export type Advantage = 'normal' | 'advantage' | 'disadvantage';

export interface RollExtras {
  guaranteedSuccesses?: number;
  advantageDiceCount?: number; // first N dice use threshold 3
  note?: string;
  inherentDisadvLvl?: number;  // from negative skill (0, 1, or 2); stacks with player's choice
  aimDifficulty?: number;      // for ranged aim rolls: successes - difficulty = effective hits
}

export interface RollEntry {
  id: string;
  label: string;
  diceCount: number;
  advantage: Advantage;
  effectiveThreshold: number;
  dice: number[];
  total: number;
  rolledSuccesses: number;
  successes: number;
  timestamp: number;
  guaranteedSuccesses?: number;
  advantageDiceCount?: number;
  note?: string;
  /** for ranged aim rolls: successes minus this = effective hits */
  aimDifficulty?: number;
  effectiveHits?: number;
  /** 'attack' (default d6 threshold) | 'damage' (formula-based) */
  rollType?: 'attack' | 'damage';
  /** Die sides for damage rolls (2, 4, 6, 8, 10, 12) */
  dieType?: number;
  /** Damage formula fields — only set when rollType === 'damage' */
  dieCount?: number;         // how many dice were rolled (most weapons: 1)
  dieResult?: number;        // sum of all damage dice (individual rolls are in `dice`)
  damageMultiplier?: number; // weapon multiplier (e.g. 2.5)
  damageSuccesses?: number;  // attack successes used
  damageAfterMult?: number;  // dieResult × multiplier (intermediate)
}

interface DiceRollCtxType {
  log: RollEntry[];
  currentRoll: RollEntry | null;
  roll: (label: string, diceCount: number, advantage?: Advantage, extras?: RollExtras) => void;
  /** Roll damage: dieCount dice of dieSides summed, then (sum × multiplier × successes). dieCount defaults to 1. */
  rollDamage: (label: string, dieSides: number, multiplier: number, successes: number, dieCount?: number) => void;
  clearCurrentRoll: () => void;
  clearLog: () => void;
}

const DiceRollCtx = createContext<DiceRollCtxType | null>(null);

/** Net disadvantage level → success threshold */
export function computeEffectiveThreshold(advantage: Advantage, inherentDisadvLvl = 0): number {
  const chosenLevel = advantage === 'advantage' ? -1 : advantage === 'disadvantage' ? 1 : 0;
  const net = inherentDisadvLvl + chosenLevel;
  if (net <= -1) return 3;
  if (net === 0)  return 4;
  if (net === 1)  return 5;
  return 6;
}

/** @deprecated use entry.effectiveThreshold; kept for backwards compat */
export function getDiceThreshold(adv: Advantage): number {
  return adv === 'advantage' ? 3 : adv === 'disadvantage' ? 5 : 4;
}

function calcRolledSuccesses(dice: number[], threshold: number, advantageDiceCount = 0): number {
  return dice.reduce((sum, d, i) => {
    const t = i < advantageDiceCount ? 3 : threshold;
    return sum + (d >= t ? 1 : 0);
  }, 0);
}

export function DiceRollProvider({ children }: { children: ReactNode }) {
  const [log, setLog] = useState<RollEntry[]>([]);
  const [currentRoll, setCurrentRoll] = useState<RollEntry | null>(null);

  const roll = useCallback((
    label: string,
    diceCount: number,
    advantage: Advantage = 'normal',
    extras: RollExtras = {}
  ) => {
    const count = Math.max(1, diceCount);
    const dice = Array.from({ length: count }, () => Math.floor(Math.random() * 6) + 1);
    const { guaranteedSuccesses = 0, advantageDiceCount = 0, note, inherentDisadvLvl = 0, aimDifficulty } = extras;
    const effectiveThreshold = computeEffectiveThreshold(advantage, inherentDisadvLvl);
    const rolledSuccesses = calcRolledSuccesses(dice, effectiveThreshold, advantageDiceCount);
    const totalSuccesses = rolledSuccesses + guaranteedSuccesses;
    const effectiveHits = aimDifficulty !== undefined ? Math.max(0, totalSuccesses - aimDifficulty) : undefined;
    const entry: RollEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      label, diceCount: count, advantage, effectiveThreshold, dice,
      total: dice.reduce((a, b) => a + b, 0),
      rolledSuccesses,
      successes: totalSuccesses,
      timestamp: Date.now(),
      rollType: 'attack',
      ...(guaranteedSuccesses > 0 ? { guaranteedSuccesses } : {}),
      ...(advantageDiceCount > 0 ? { advantageDiceCount } : {}),
      ...(note ? { note } : {}),
      ...(aimDifficulty !== undefined ? { aimDifficulty, effectiveHits } : {}),
    };
    setCurrentRoll(entry);
    setLog(prev => [entry, ...prev].slice(0, 50));
  }, []);

  const rollDamage = useCallback((label: string, dieSides: number, multiplier: number, successes: number, dieCount: number = 1) => {
    const count = Math.max(1, dieCount);
    const dice = Array.from({ length: count }, () => Math.floor(Math.random() * dieSides) + 1);
    const dieResult = dice.reduce((a, b) => a + b, 0);
    const afterMult = dieResult * multiplier;
    const total = Math.round(afterMult * successes);
    const entry: RollEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      label,
      diceCount: count,
      advantage: 'normal',
      effectiveThreshold: 0,
      dice,
      total,
      rolledSuccesses: 0,
      successes: 0,
      timestamp: Date.now(),
      rollType: 'damage',
      dieType: dieSides,
      dieCount: count,
      dieResult,
      damageMultiplier: multiplier,
      damageSuccesses: successes,
      damageAfterMult: afterMult,
    };
    setCurrentRoll(entry);
    setLog(prev => [entry, ...prev].slice(0, 50));
  }, []);

  const clearCurrentRoll = useCallback(() => setCurrentRoll(null), []);
  const clearLog = useCallback(() => { setLog([]); setCurrentRoll(null); }, []);

  return (
    <DiceRollCtx.Provider value={{ log, currentRoll, roll, rollDamage, clearCurrentRoll, clearLog }}>
      {children}
    </DiceRollCtx.Provider>
  );
}

export function useDiceRoll() {
  const ctx = useContext(DiceRollCtx);
  if (!ctx) throw new Error('useDiceRoll must be used within DiceRollProvider');
  return ctx;
}
