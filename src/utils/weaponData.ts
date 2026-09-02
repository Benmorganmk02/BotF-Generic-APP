export type HandleType = 'polearm' | 'standard' | 'sword';
export type WeaponHandedness = 'small' | '1h' | '2h' | '1h2h';

export interface HandleSizeOption {
  id: string;
  label: string;
  range: string;
  handedness: WeaponHandedness;
  heavy: boolean;
}

export interface WeaponSubType {
  id: string;
  label: string;
  die: string;
  addMultiplier: number;
  /** Extra multiplier bonus when wielded with two hands (e.g. Long Sword) */
  twoHandedAddMultiplier?: number;
}

export interface WeaponHeadCategory {
  id: string;
  label: string;
  baseMultiplier: number;
  subTypes: WeaponSubType[];
}

export const POLEARM_SIZES: HandleSizeOption[] = [
  { id: 'tiny', label: 'Tiny', range: "2-4'", handedness: '1h2h', heavy: false },
  { id: 'short', label: 'Short', range: "4-6'", handedness: '1h2h', heavy: false },
  { id: 'standard', label: 'Standard', range: "6-8'", handedness: '2h', heavy: false },
  { id: 'long', label: 'Long', range: "8-10'", handedness: '2h', heavy: false },
  { id: 'great', label: 'Great', range: "10-15'", handedness: '2h', heavy: true },
  { id: 'pike', label: 'Pike', range: "20-25'", handedness: '2h', heavy: true },
];

export const STANDARD_SIZES: HandleSizeOption[] = [
  { id: 'none', label: 'None', range: '0"', handedness: 'small', heavy: false },
  { id: 'tiny', label: 'Tiny', range: '4-8"', handedness: 'small', heavy: false },
  { id: 'close', label: 'Close', range: '8-16"', handedness: '1h', heavy: false },
  { id: 'short', label: 'Short', range: '16-24"', handedness: '1h', heavy: false },
  { id: 'standard', label: 'Standard', range: '24-36"', handedness: '1h2h', heavy: false },
  { id: 'long', label: 'Long', range: '48-72"', handedness: '2h', heavy: false },
  { id: 'great', label: 'Great', range: '72-96"', handedness: '2h', heavy: true },
];

export const SWORD_SIZES: HandleSizeOption[] = [
  { id: 'none', label: 'None', range: '0"', handedness: 'small', heavy: false },
  { id: 'tiny', label: 'Tiny', range: '3"', handedness: 'small', heavy: false },
  { id: 'close', label: 'Close', range: '4"', handedness: '1h', heavy: false },
  { id: 'short', label: 'Short', range: '5-6"', handedness: '1h', heavy: false },
  { id: 'standard', label: 'Standard', range: '7-8"', handedness: '1h2h', heavy: false },
  { id: 'long', label: 'Long', range: '8-10"', handedness: '1h2h', heavy: false },
  { id: 'great', label: 'Great', range: '12-18"', handedness: '2h', heavy: false },
];

export function getHandleSizes(ht: HandleType): HandleSizeOption[] {
  return ht === 'polearm' ? POLEARM_SIZES : ht === 'standard' ? STANDARD_SIZES : SWORD_SIZES;
}

// All weapons have a base 1× multiplier. Category baseMultiplier and sub-type
// addMultiplier are added on top: total = 1 + baseMultiplier + addMultiplier.
export const HEAD_CATEGORIES: WeaponHeadCategory[] = [
  {
    id: 'knives', label: 'Knives', baseMultiplier: 0,
    subTypes: [
      { id: 'short', label: 'Short', die: 'D2', addMultiplier: 0 },
      { id: 'medium', label: 'Medium', die: 'D4', addMultiplier: 0 },
      { id: 'long', label: 'Long', die: 'D6', addMultiplier: 0.5 },
    ],
  },
  {
    id: 'swords', label: 'Swords', baseMultiplier: 1,
    subTypes: [
      { id: 'short', label: 'Short', die: 'D6', addMultiplier: 0 },
      { id: 'medium', label: 'Medium', die: 'D8', addMultiplier: 0 },
      { id: 'long', label: 'Long', die: 'D10', addMultiplier: 0, twoHandedAddMultiplier: 0.5 },
      { id: 'great', label: 'Great', die: 'D10', addMultiplier: 0.5 },
    ],
  },
  {
    id: 'axes', label: 'Axes', baseMultiplier: 1,
    subTypes: [
      { id: 'splitting', label: 'Splitting', die: 'D4', addMultiplier: -0.5 },
      { id: 'war', label: 'War', die: 'D6', addMultiplier: 0.5 },
      { id: 'bearded', label: 'Bearded', die: 'D8', addMultiplier: 0 },
      { id: 'bardiche', label: 'Bardiche', die: 'D12', addMultiplier: 0 },
    ],
  },
  {
    id: 'hammers', label: 'Hammers', baseMultiplier: 0.5,
    subTypes: [
      { id: 'carpenter', label: 'Carpenter', die: 'D2', addMultiplier: 0 },
      { id: 'smith', label: 'Smith', die: 'D2', addMultiplier: 0 },
      { id: 'war', label: 'War', die: 'D6', addMultiplier: 1 },
      { id: 'maul', label: 'Maul', die: 'D8', addMultiplier: 0.5 },
      { id: 'flanged', label: 'Flanged', die: 'D8', addMultiplier: 1 },
    ],
  },
  {
    id: 'maces', label: 'Maces', baseMultiplier: 1,
    subTypes: [
      { id: 'flanged', label: 'Flanged', die: 'D8', addMultiplier: 0 },
      { id: 'blunt', label: 'Blunt', die: 'D6', addMultiplier: 0 },
      { id: 'spiked', label: 'Spiked', die: 'D8', addMultiplier: 0 },
    ],
  },
  {
    id: 'clubs', label: 'Clubs', baseMultiplier: 0.5,
    subTypes: [
      { id: 'light', label: 'Light', die: 'D4', addMultiplier: 0 },
      { id: 'heavy', label: 'Heavy', die: 'D6', addMultiplier: 0.5 },
      { id: 'great', label: 'Great', die: 'D8', addMultiplier: 0.5 },
    ],
  },
  {
    id: 'spikes', label: 'Spikes', baseMultiplier: 0.5,
    subTypes: [
      { id: 'short', label: 'Short', die: 'D2', addMultiplier: 0 },
      { id: 'medium', label: 'Medium', die: 'D4', addMultiplier: 0 },
      { id: 'long', label: 'Long', die: 'D6', addMultiplier: 0 },
    ],
  },
  {
    id: 'curved_spikes', label: 'Curved Spikes', baseMultiplier: 0.5,
    subTypes: [
      { id: 'pick', label: 'Pick', die: 'D8', addMultiplier: 0 },
      { id: 'hook', label: 'Hook', die: 'D6', addMultiplier: 0 },
    ],
  },
];

/**
 * Returns allowed head categories for a given handle type.
 * advanced=true bypasses all restrictions (any head on any handle).
 */
export function getAllowedCategories(ht: HandleType, advanced = false): WeaponHeadCategory[] {
  if (advanced) return HEAD_CATEGORIES;
  if (ht === 'sword') return HEAD_CATEGORIES.filter(c => c.id === 'swords' || c.id === 'knives');
  if (ht === 'standard') return HEAD_CATEGORIES.filter(c => c.id !== 'swords');
  return HEAD_CATEGORIES;
}

/**
 * Base damage multiplier (1H or no-grip-info).
 * total = 1 + category.baseMultiplier + sub.addMultiplier
 */
export function getTotalMultiplier(categoryId: string, subTypeId: string): number {
  const cat = HEAD_CATEGORIES.find(c => c.id === categoryId);
  if (!cat) return 1;
  const sub = cat.subTypes.find(s => s.id === subTypeId);
  if (!sub) return 1;
  return 1 + cat.baseMultiplier + sub.addMultiplier;
}

/**
 * Damage multiplier factoring in handedness.
 * Applies twoHandedAddMultiplier only when handedness === '2h'.
 */
export function getTotalMultiplierForHandedness(
  categoryId: string,
  subTypeId: string,
  handedness: string,
): number {
  const cat = HEAD_CATEGORIES.find(c => c.id === categoryId);
  if (!cat) return 1;
  const sub = cat.subTypes.find(s => s.id === subTypeId);
  if (!sub) return 1;
  const twoHBonus = handedness === '2h' ? (sub.twoHandedAddMultiplier ?? 0) : 0;
  return 1 + cat.baseMultiplier + sub.addMultiplier + twoHBonus;
}

/**
 * Display string for multiplier, showing conditional 2H bonus when relevant.
 * e.g. "2" for 1H, "2.5" for 2H, "2 / 2.5 (2H)" for 1H/2H versatile.
 */
export function getMultiplierDisplay(
  categoryId: string,
  subTypeId: string,
  handedness: string,
): string {
  const cat = HEAD_CATEGORIES.find(c => c.id === categoryId);
  if (!cat) return '1';
  const sub = cat.subTypes.find(s => s.id === subTypeId);
  if (!sub) return '1';
  const base = 1 + cat.baseMultiplier + sub.addMultiplier;
  if (sub.twoHandedAddMultiplier) {
    const bonus = sub.twoHandedAddMultiplier;
    if (handedness === '2h') return String(base + bonus);
    if (handedness === '1h2h') return `${base} / ${base + bonus} (2H)`;
  }
  return String(base);
}

export function getDamageDie(categoryId: string, subTypeId: string): string {
  const cat = HEAD_CATEGORIES.find(c => c.id === categoryId);
  return cat?.subTypes.find(s => s.id === subTypeId)?.die ?? 'D?';
}

export function handednessLabel(h: string): string {
  return h === 'small' ? 'Small' : h === '1h' ? '1H' : h === '2h' ? '2H' : '1H/2H';
}

/** Returns weapon modifier for 1H wielding (min for 1h2h) */
export function getWeaponModifier(classification: string, handedness: string, weight: string): number {
  const martial = classification === 'martial' ? 1 : 0;
  const heavy = weight === 'heavy' ? 2 : 0;
  const hand = handedness === 'small' ? 0 : handedness === '1h' ? 1 : handedness === '2h' ? 2 : 1;
  return martial + hand + heavy;
}

/** Display string for weapon modifier, showing range for 1H/2H weapons */
export function getWeaponModDisplay(classification: string, handedness: string, weight: string): string {
  const base = getWeaponModifier(classification, handedness, weight);
  if (handedness !== '1h2h') return `+${base}d6`;
  const martial = classification === 'martial' ? 1 : 0;
  const heavy = weight === 'heavy' ? 2 : 0;
  return `+${base}d6 / +${martial + 2 + heavy}d6`;
}

export function getHandleTypeLabel(ht: string): string {
  return ht === 'polearm' ? 'Polearm' : ht === 'standard' ? 'Standard' : 'Sword';
}

/** Parse die string like "D8" or "D10" into the number of sides */
export function parseDieSides(die: string): number {
  return parseInt(die.replace(/[Dd]/g, '')) || 6;
}

/**
 * Compute damage dice count from attack successes and weapon multiplier.
 * Uses max(1, floor(successes * mult)) so even 0x weapons roll 1 die on a hit.
 */
export function calcDamageDiceCount(successes: number, multiplier: number): number {
  if (successes <= 0) return 0;
  return Math.max(1, Math.floor(successes * Math.max(multiplier, 0)));
}
