import { createContext, useContext, useState, ReactNode } from 'react';
import { usePersistedState } from '../utils/usePersistedState';
import { toast } from 'sonner';
import { useChar } from './CharacterContext';
import type { Character } from '../types/character';
import { getReactionCount, ACTIONS_PER_TURN, applyEndCombatRest } from '../utils/mechanics';

/** Table-state shared by everything on the sheet: how many opponents the character is fighting, and the
 * turn's action economy (whether combat is running, the combat's turn number, and how many actions and
 * reactions are spent). The all-time and session turn counts are saved on the character (turnStats). */
interface CombatCtxType {
  opponents: number;
  setOpponents: (n: number) => void;
  inCombat: boolean;
  /** The current combat's turn number (1 when combat starts). */
  turn: number;
  /** Changes every time a turn starts or combat starts or ends, so cards can drop per-turn state (Stabilize, roll mana). */
  turnKey: number;
  actionsMax: number;
  actionsLeft: number;
  reactionsMax: number;
  reactionsLeft: number;
  setActionsLeft: (n: number) => void;
  setReactionsLeft: (n: number) => void;
  /** Spend `n` (default 1); false, with nothing spent, when there are not enough left. */
  spendAction: (n?: number) => boolean;
  spendReaction: (n?: number) => boolean;
  refundAction: (n?: number) => void;
  refundReaction: (n?: number) => void;
  /** Begins combat: turn 1, actions and reactions full. Counts as a turn taken. */
  startCombat: () => void;
  /** Ends combat: the turn counter resets, the pools refill, Berzerk ends, and the end-of-combat rest is applied. */
  endCombat: () => void;
  /** Next turn: counts a turn, refills actions and reactions, and charges Berzerk its next stacking stamina cost (ending if it cannot be paid). */
  newTurn: () => void;
}

const CombatCtx = createContext<CombatCtxType | null>(null);

/** Counts one more turn taken, on the character: the all-time total and the session count. */
function bumpTurnStats(p: Character): Character {
  return { ...p, turnStats: { total: (p.turnStats?.total ?? 0) + 1, session: (p.turnStats?.session ?? 0) + 1 } };
}

export function CombatProvider({ children, onTurnStart }: { children: ReactNode; /** Runs when combat starts or a new turn begins (the campaign map gives the token its walking speed back). */ onTurnStart?: () => void }) {
  const { character, setCharacter } = useChar();
  // The combat state is kept across reloads (and app updates), per sheet; End Combat clears it
  const base = character.cloudId ?? character.id;
  const key = (name: string) => `botv_combat:${base}:${name}`;
  const [opponents, setOpponentsRaw] = usePersistedState(key('opponents'), 1);
  const setOpponents = (n: number) => setOpponentsRaw(Math.max(1, Math.floor(n) || 1));

  const [inCombat, setInCombat] = usePersistedState(key('inCombat'), false);
  const [turn, setTurn] = usePersistedState(key('turn'), 1);
  const [turnKey, setTurnKey] = useState(0);
  const [actionsSpent, setActionsSpent] = usePersistedState(key('actionsSpent'), 0);
  const [reactionsSpent, setReactionsSpent] = usePersistedState(key('reactionsSpent'), 0);

  const actionsMax = ACTIONS_PER_TURN;
  const reactionsMax = getReactionCount(character);
  const actionsLeft = Math.max(0, actionsMax - actionsSpent);
  const reactionsLeft = Math.max(0, reactionsMax - reactionsSpent);

  const clamp = (n: number, max: number) => Math.max(0, Math.min(max, Math.floor(n) || 0));
  const setActionsLeft = (n: number) => setActionsSpent(actionsMax - clamp(n, actionsMax));
  const setReactionsLeft = (n: number) => setReactionsSpent(reactionsMax - clamp(n, reactionsMax));

  const spendAction = (n = 1) => { if (actionsLeft < n) return false; setActionsSpent(s => s + n); return true; };
  const spendReaction = (n = 1) => { if (reactionsLeft < n) return false; setReactionsSpent(s => s + n); return true; };
  const refundAction = (n = 1) => setActionsSpent(s => Math.max(0, s - n));
  const refundReaction = (n = 1) => setReactionsSpent(s => Math.max(0, s - n));

  const refill = () => { setActionsSpent(0); setReactionsSpent(0); setTurnKey(k => k + 1); };

  const startCombat = () => {
    if (inCombat) return;
    setInCombat(true);
    setTurn(1);
    refill();
    setCharacter(bumpTurnStats);
    onTurnStart?.();
    toast.success('Combat started', { description: 'Turn 1.' });
  };

  const endCombat = () => {
    if (!inCombat) return;
    const hadBerzerk = character.berzerkActive;
    const rest = applyEndCombatRest(character);
    setCharacter(p => {
      const ended = p.berzerkActive ? { ...p, berzerkActive: false, berzerkRound: 0 } : p;
      return applyEndCombatRest(ended).character;
    });
    setInCombat(false);
    setTurn(1);
    refill();
    const lines = [
      ...(hadBerzerk ? ['Berzerk ended: all accumulated injuries and damage are now applied.'] : []),
      ...(rest.summary.length ? rest.summary : ['Rest: the rest rules are not set yet, so nothing was restored.']),
    ];
    toast.info('Combat ended', { description: lines.join(' '), duration: 7000 });
  };

  const newTurn = () => {
    if (!inCombat) return;
    // Berzerk is a round-by-round stacking stamina cost: 1 to start, then 2, 3, 4... each new turn.
    // If the next amount can't be paid it ends, and the accumulated injuries and damage land.
    if (character.berzerkActive) {
      const next = character.berzerkRound + 1;
      if (character.stamina.current >= next) {
        setCharacter(p => bumpTurnStats({ ...p, berzerkRound: p.berzerkRound + 1, stamina: { ...p.stamina, current: p.stamina.current - next } }));
        toast.info(`Berzerk round ${next}`, { description: `${next} STA paid. It costs ${next + 1} next turn.` });
      } else {
        setCharacter(p => bumpTurnStats({ ...p, berzerkActive: false, berzerkRound: 0 }));
        toast.warning('Berzerk ended', {
          description: `Not enough stamina for round ${next} (needs ${next} STA). All accumulated injuries and damage are now applied.`,
          duration: 7000,
        });
      }
    } else {
      setCharacter(bumpTurnStats);
    }
    setTurn(t => t + 1);
    refill();
    onTurnStart?.();
  };

  return (
    <CombatCtx.Provider value={{
      opponents, setOpponents, inCombat, turn, turnKey, actionsMax, actionsLeft, reactionsMax, reactionsLeft,
      setActionsLeft, setReactionsLeft, spendAction, spendReaction, refundAction, refundReaction,
      startCombat, endCombat, newTurn,
    }}>
      {children}
    </CombatCtx.Provider>
  );
}

export function useCombat() {
  const ctx = useContext(CombatCtx);
  if (!ctx) throw new Error('useCombat must be used within CombatProvider');
  return ctx;
}
