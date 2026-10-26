import type { Character, MagicSource, Proficiency } from '../types/character';
import { getFabricatedVocation, getManaMax, getMagicRollDice } from './mechanics';

/** A caster's power option decides which half of magic is innate and which must be fabricated:
 *  - the MAGIC ROLL (the "river": successes become mana put into a spell), and
 *  - the MANA POOL (the "reservoir": stored mana that tops up a spell).
 * Innate halves come from Wisdom + Intuition. A half that is not innate is fabricated with a
 * vocation (Intelligence + Intuition + Advanced Knowledge) that is added automatically. */
export const MAGIC_SOURCE_INFO: Record<MagicSource, {
  label: string;
  summary: string;
  /** Which half the automatic vocation fabricates (null = none needed). */
  fabricates: 'pool' | 'river' | null;
}> = {
  power: {
    label: 'Innate Power (river)',
    summary: 'Your magic roll is innate (3 + Wisdom + Intuition), a river of magic. Your mana pool is fabricated with a vocation.',
    fabricates: 'pool',
  },
  pool: {
    label: 'Innate Mana Pool (reservoir)',
    summary: 'Your mana pool is innate (3 + Wisdom + Intuition), a reservoir of magic. Your magic roll is fabricated with a vocation.',
    fabricates: 'river',
  },
  sorcerer: {
    label: 'Full Sorcerer',
    summary: 'Both your magic roll and your mana pool are innate, from Wisdom + Intuition. No vocation is needed.',
    fabricates: null,
  },
};
export const MAGIC_SOURCES = Object.keys(MAGIC_SOURCE_INFO) as MagicSource[];

export const FABRICATED_NAMES = { pool: 'Fabricated Pool', river: 'Fabricated River' } as const;

const newId = () => Date.now().toString(36) + Math.random().toString(36).substring(2, 9);

/** The automatic vocation, with one point already spent in it. It can be renamed and levelled like any other. */
export function makeFabricatedVocation(kind: 'pool' | 'river'): Proficiency {
  return {
    id: newId(), name: FABRICATED_NAMES[kind], level: 1,
    attributes: ['int'], skills: ['intuition', 'advancedKnowledge'],
    startingPrime: 0, itemBonus: 0, modifier: 0,
    profType: 'vocation', magicFabricated: kind,
  };
}

/** Sets a character's power option, swapping the automatic vocation to match (the old one is removed,
 * the new one starts at level 1). Choosing nothing (undefined) leaves a plain innate mana pool, no roll. */
export function applyMagicSource(c: Character, source: MagicSource | undefined): Character {
  const kind = source ? MAGIC_SOURCE_INFO[source].fabricates : null;
  const existing = c.proficiencies.find(p => p.magicFabricated);
  // Same power option already in place: keep the existing vocation (and its level / renaming).
  if (c.magicSource === source && (kind === null ? !existing : existing?.magicFabricated === kind)) return c;
  const rest = c.proficiencies.filter(p => !p.magicFabricated);
  return { ...c, magicSource: source, proficiencies: kind ? [...rest, makeFabricatedVocation(kind)] : rest };
}

/** One-line explanation of where the mana pool comes from. */
export function manaPoolFormula(c: Character): string {
  if (c.magicSource === 'power') {
    const v = getFabricatedVocation(c);
    return v ? `${v.name} dice (3 + level + INT + Intuition + AdvKnow) = ${getManaMax(c)}` : `no fabricated vocation yet = ${getManaMax(c)}`;
  }
  return `innate: 3 + WIS + Intuition = ${getManaMax(c)}`;
}

/** One-line explanation of where the magic roll comes from. */
export function magicRollFormula(c: Character): string {
  const dice = getMagicRollDice(c);
  if (c.magicSource === 'power' || c.magicSource === 'sorcerer') return `innate: 3 + WIS + Intuition = ${dice}d6`;
  if (c.magicSource === 'pool') {
    const v = getFabricatedVocation(c);
    return v ? `${v.name} dice (3 + level + INT + Intuition + AdvKnow) = ${dice}d6` : 'no fabricated vocation yet';
  }
  return 'no magic roll (pick a power option on the Magic tab)';
}
