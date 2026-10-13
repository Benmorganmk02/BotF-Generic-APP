import type { Character, Proficiency, Weapon } from '../types/character';

/** Sword proficiencies are a fixed catalog (not free-text) -- a character picks
 * one, and any sword built for it is locked to that proficiency's allowed
 * components. Handle sizes and blade lengths reuse the ids in weaponData.ts
 * (getHandleSizes('sword') and the 'swords' HEAD_CATEGORIES entry). */
export type SwordProfKey = 'fencing' | 'longsword' | 'arming' | 'greatsword' | 'shortsword';

export const MAX_SWORD_PROF_LEVEL = 5;

/** Sword proficiencies are "complex": they start at 2 points instead of 1
 * (startingPrime 1 in the prime-cost table), and every sword is a martial weapon. */
export const SWORD_STARTING_PRIME = 1 as const;
export const SWORD_CLASSIFICATION = 'martial' as const;

/** What a single level GRANTS. Levels are cumulative: the totals at level N are
 * the sum of this table's entries for levels 1..N (see getSwordBonusTotals),
 * except the two "latest wins" count fields at the bottom. */
export interface SwordLevelBonus {
  /** Always-on bonus attack dice. */
  dice?: number;
  /** Extra attack dice while wielded two-handed. */
  dice2H?: number;
  /** Extra attack dice against a single opponent. */
  diceSingle?: number;
  /** Extra attack dice PER OPPONENT when attacking two or more opponents (capped by multiTargetMax). */
  diceMulti?: number;
  /** "+N Challenge to Hit" -- tracked and shown, not yet resolved mechanically. */
  challenge?: number;
  /** "+N Advantage when flanked by two allies" (stacks as advantage levels). */
  flankedAdvantage?: number;
  /** Greatsword: most opponents the per-opponent bonus counts at this level (latest level wins;
   * counts the first opponent, so 2 = the first plus one extra; null = no cap; leave undefined
   * to keep the previous level's value). */
  multiTargetMax?: number | null;
  /** Greatsword: number of defense dice that get Advantage at this level (latest level wins). */
  defenseAdvantageDice?: number;
}

export interface SwordProfDef {
  key: SwordProfKey;
  name: string;
  /** Always-on feature, independent of level. */
  baseFeature: string;
  /** Index 0 = Lvl 1 ... index 4 = Lvl 5. Human-readable text of what each level grants. */
  levels: [string, string, string, string, string];
  /** Same five levels as structured data -- keep in sync with `levels`. */
  bonuses: [SwordLevelBonus, SwordLevelBonus, SwordLevelBonus, SwordLevelBonus, SwordLevelBonus];
  /** Locks the proficiency's physical stat when set (Fencing = DEX, Greatsword = STR). */
  lockedPhysicalStat?: 'str' | 'dex';
  handles: string[];
  bladeLengths: string[];
  thicknesses: string[];
  headStyles: string[];
}

export interface SwordThickness {
  id: string;
  label: string;
  /** Modifier to Light / Heavy attacks (dueling only for now). null = that attack type is not allowed. */
  light: number | null;
  heavy: number | null;
}

export const SWORD_THICKNESSES: SwordThickness[] = [
  { id: 'needle', label: 'Needle', light: 2, heavy: null },
  { id: 'thin', label: 'Thin', light: 1, heavy: -1 },
  { id: 'standard', label: 'Standard', light: 0, heavy: 0 },
  { id: 'broad', label: 'Broad', light: -1, heavy: 1 },
  { id: 'thick', label: 'Thick', light: null, heavy: 2 },
];

export const HEAD_STYLES: { id: string; label: string }[] = [
  { id: 'straight', label: 'Straight' },
  { id: 'curved', label: 'Curved' },
  { id: 'wavy', label: 'Wavy' },
  { id: 'hooked', label: 'Hooked' },
];

export const SWORD_PROFICIENCIES: SwordProfDef[] = [
  {
    key: 'fencing',
    name: 'Fencing',
    baseFeature: 'Withdraw to cancel out all attacks this round. Requires DEX.',
    levels: [
      '+1d6, +1d6 against a single opponent',
      '+1d6, +1 Challenge to Hit, +1d6 against a single opponent',
      '+1d6, +1 Challenge to Hit, +2d6 against a single opponent',
      '+1d6, +1 Challenge to Hit, +2d6 against a single opponent',
      '+1d6, +2 Challenge to Hit, +3d6 against a single opponent',
    ],
    bonuses: [
      { dice: 1, diceSingle: 1 },
      { dice: 1, challenge: 1, diceSingle: 1 },
      { dice: 1, challenge: 1, diceSingle: 2 },
      { dice: 1, challenge: 1, diceSingle: 2 },
      { dice: 1, challenge: 2, diceSingle: 3 },
    ],
    lockedPhysicalStat: 'dex',
    handles: ['tiny', 'close', 'short', 'standard'],
    bladeLengths: ['short', 'medium', 'long'],
    thicknesses: ['needle', 'thin', 'standard'],
    headStyles: ['straight', 'curved'],
  },
  {
    key: 'longsword',
    name: 'Longsword',
    baseFeature: 'Can be wielded 1H or 2H.',
    levels: [
      '+2d6, +1d6 if 2H',
      '+1d6, +1d6 if 2H',
      '+2d6, +1d6 if 2H',
      '+1d6, +1d6 if 2H',
      '+2d6, +1d6 if 2H',
    ],
    bonuses: [
      { dice: 2, dice2H: 1 },
      { dice: 1, dice2H: 1 },
      { dice: 2, dice2H: 1 },
      { dice: 1, dice2H: 1 },
      { dice: 2, dice2H: 1 },
    ],
    handles: ['standard', 'long'],
    bladeLengths: ['long'],
    thicknesses: ['thin', 'standard', 'broad'],
    headStyles: ['straight', 'curved', 'wavy', 'hooked'],
  },
  {
    key: 'arming',
    name: 'Arming Sword',
    baseFeature: 'Cheaper (lower gold cost in-game). Should be paired with a shield.',
    levels: [
      '+1d6',
      '+1d6, +1 Advantage when flanked by two allies',
      '+1d6',
      '+1d6, +1 Advantage when flanked by two allies',
      '+1d6',
    ],
    bonuses: [
      { dice: 1 },
      { dice: 1, flankedAdvantage: 1 },
      { dice: 1 },
      { dice: 1, flankedAdvantage: 1 },
      { dice: 1 },
    ],
    handles: ['close', 'short', 'standard'],
    bladeLengths: ['medium'],
    thicknesses: ['needle', 'thin', 'standard', 'broad', 'thick'],
    headStyles: ['straight', 'curved', 'hooked'],
  },
  {
    key: 'greatsword',
    name: 'Greatsword',
    baseFeature:
      'Reach, High Defense, and target an additional opponent for free. Wild Attacks can hit through and will hit allies. Requires STR.',
    levels: [
      '+1d6, +1d6 per extra opponent (1 extra opponent), Advantage on 1 defense die',
      '+1d6, +1d6 per extra opponent (up to 3 opponents total), Advantage on 3 defense dice',
      '+1d6, +1d6 per extra opponent (up to 4 opponents total), Advantage on 5 defense dice',
      '+1d6, +1d6 per extra opponent (up to 5 opponents total), Advantage on 7 defense dice',
      '+1d6, +1d6 per extra opponent (no limit), Advantage on 10 defense dice',
    ],
    bonuses: [
      { dice: 1, diceMulti: 1, multiTargetMax: 2, defenseAdvantageDice: 1 },
      { dice: 1, diceMulti: 1, multiTargetMax: 3, defenseAdvantageDice: 3 },
      { dice: 1, diceMulti: 1, multiTargetMax: 4, defenseAdvantageDice: 5 },
      { dice: 1, diceMulti: 1, multiTargetMax: 5, defenseAdvantageDice: 7 },
      { dice: 1, diceMulti: 1, multiTargetMax: null, defenseAdvantageDice: 10 },
    ],
    lockedPhysicalStat: 'str',
    handles: ['long', 'great'],
    bladeLengths: ['great'],
    thicknesses: ['thin', 'standard', 'broad', 'thick'],
    headStyles: ['straight', 'curved', 'wavy'],
  },
  {
    key: 'shortsword',
    name: 'Short Sword',
    baseFeature:
      'Like the Arming Sword. Can be used to stab while grappling, and can use a full weapon attack in a grapple.',
    levels: [
      '+1d6, +1 Advantage when flanked by two allies',
      '+1d6',
      '+1d6',
      '+1d6',
      '+1d6',
    ],
    bonuses: [
      { dice: 1, flankedAdvantage: 1 },
      { dice: 1 },
      { dice: 1 },
      { dice: 1 },
      { dice: 1 },
    ],
    handles: ['close', 'short'],
    bladeLengths: ['short'],
    thicknesses: ['needle', 'thin', 'standard', 'broad', 'thick'],
    headStyles: ['straight', 'curved', 'wavy', 'hooked'],
  },
];

export function getSwordProfDef(key: string | undefined): SwordProfDef | undefined {
  return key ? SWORD_PROFICIENCIES.find(p => p.key === key) : undefined;
}

export function getSwordThickness(id: string | undefined): SwordThickness | undefined {
  return id ? SWORD_THICKNESSES.find(t => t.id === id) : undefined;
}

export function getHeadStyleLabel(id: string | undefined): string {
  return HEAD_STYLES.find(h => h.id === id)?.label ?? '';
}

/** "Light +1 / Heavy -1", "Light +2 / no Heavy attacks", etc. */
export function thicknessSummary(t: SwordThickness): string {
  const fmt = (n: number) => (n > 0 ? `+${n}` : String(n));
  const light = t.light === null ? 'no Light attacks' : `Light ${fmt(t.light)}`;
  const heavy = t.heavy === null ? 'no Heavy attacks' : `Heavy ${fmt(t.heavy)}`;
  return `${light} / ${heavy}`;
}

// ── Cumulative level bonuses ─────────────────────────────────────────────────

export interface SwordBonusTotals {
  dice: number;
  dice2H: number;
  diceSingle: number;
  diceMulti: number;
  challenge: number;
  flankedAdvantage: number;
  multiTargetMax: number | null;
  defenseAdvantageDice: number;
}

/** Everything the proficiency grants at `level`: levels 1..level stacked on top
 * of each other. Count-style fields (multiTargetMax, defenseAdvantageDice) are
 * absolute per level, so the highest unlocked level's value is used. */
export function getSwordBonusTotals(def: SwordProfDef | undefined, level: number): SwordBonusTotals {
  const totals: SwordBonusTotals = {
    dice: 0, dice2H: 0, diceSingle: 0, diceMulti: 0, challenge: 0, flankedAdvantage: 0,
    multiTargetMax: null, defenseAdvantageDice: 0,
  };
  if (!def) return totals;
  const n = Math.max(0, Math.min(level, MAX_SWORD_PROF_LEVEL));
  for (let i = 0; i < n; i++) {
    const b = def.bonuses[i];
    totals.dice += b.dice ?? 0;
    totals.dice2H += b.dice2H ?? 0;
    totals.diceSingle += b.diceSingle ?? 0;
    totals.diceMulti += b.diceMulti ?? 0;
    totals.challenge += b.challenge ?? 0;
    totals.flankedAdvantage += b.flankedAdvantage ?? 0;
    if (b.multiTargetMax !== undefined) totals.multiTargetMax = b.multiTargetMax;
    // Count-style fields use the highest unlocked level's value.
    if (b.defenseAdvantageDice !== undefined) totals.defenseAdvantageDice = b.defenseAdvantageDice;
  }
  return totals;
}

export interface SwordSituation {
  twoHanded: boolean;
  /** How many opponents are being attacked (1 or more). */
  opponents: number;
}

/** How many EXTRA opponents (beyond the first) earn the multi-opponent bonus.
 * The level's cap is a total opponent count, so targeting more than the cap
 * is allowed but earns nothing extra. */
export function getExtraOpponentsCounted(t: SwordBonusTotals, opponents: number): number {
  if (t.diceMulti === 0) return 0;
  return Math.max(0, Math.min(opponents, t.multiTargetMax ?? opponents) - 1);
}

/** The multi-opponent bonus is paid per extra opponent; the first opponent only gets the normal bonus. */
export function getMultiOpponentDice(t: SwordBonusTotals, opponents: number): number {
  return t.diceMulti * getExtraOpponentsCounted(t, opponents);
}

/** Bonus attack dice from the proficiency's levels for this particular attack. */
export function getSwordBonusDice(t: SwordBonusTotals, s: SwordSituation): number {
  return t.dice
    + (s.twoHanded ? t.dice2H : 0)
    + (s.opponents === 1 ? t.diceSingle : 0)
    + getMultiOpponentDice(t, s.opponents);
}

/** Pieces of the totals as short labels, for display ("+3d6", "+1d6 if 2H", ...). */
export function describeSwordTotals(t: SwordBonusTotals): string[] {
  const out: string[] = [];
  if (t.dice) out.push(`+${t.dice}d6`);
  if (t.dice2H) out.push(`+${t.dice2H}d6 if 2H`);
  if (t.diceSingle) out.push(`+${t.diceSingle}d6 vs a single opponent`);
  if (t.diceMulti) out.push(`+${t.diceMulti}d6 per extra opponent${t.multiTargetMax ? ` (up to ${t.multiTargetMax} opponents total)` : ''}`);
  if (t.challenge) out.push(`+${t.challenge} Challenge to Hit (automatic defense success${t.challenge === 1 ? '' : 'es'})`);
  if (t.flankedAdvantage) out.push(`+${t.flankedAdvantage} Advantage when flanked by two allies`);
  if (t.defenseAdvantageDice) out.push(`Advantage on ${t.defenseAdvantageDice} defense ${t.defenseAdvantageDice === 1 ? 'die' : 'dice'}`);
  return out;
}

/** The proficiency a weapon rolls with. A sword is bound to its catalog
 * proficiency (so it starts working the moment the character takes that
 * proficiency, regardless of build order); any other weapon uses the manual link. */
export function getWeaponProficiency(c: Character, w: Weapon): Proficiency | undefined {
  if (w.swordProfKey) return c.proficiencies.find(p => p.swordKey === w.swordProfKey);
  return w.linkedProficiencyId ? c.proficiencies.find(p => p.id === w.linkedProficiencyId) : undefined;
}

export function isWeaponLinkedToProficiency(w: Weapon, prof: Proficiency): boolean {
  if (w.swordProfKey) return prof.swordKey === w.swordProfKey;
  return w.linkedProficiencyId === prof.id;
}
