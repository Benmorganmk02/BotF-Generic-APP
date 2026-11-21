import type { Character, Firearm, Proficiency, InjuryLevel } from '../types/character';
import { getProfDice, effAttr } from './mechanics';
import { INJURY_LEVELS, INJURY_LEVEL_ORDER } from './armorInjury';

// ── Firearm proficiencies ─────────────────────────────────────────────────────
// Like the sword proficiencies, these are a fixed catalog: a character picks one
// and any gun built for it rolls with it. The attack roll is 3 + DEX + (INT or WIS,
// chosen on the proficiency) + proficiency level/modifier/item bonus + the gun's
// weapon bonus.
export type GunProfKey = 'handgun' | 'scattergun' | 'smg' | 'carbine' | 'rifle' | 'heavy';

export interface GunProfDef { key: GunProfKey; name: string; summary: string }

export const GUN_PROFICIENCIES: GunProfDef[] = [
  { key: 'handgun', name: 'Handgun', summary: 'Any gun without a stock (a pistol).' },
  { key: 'scattergun', name: 'Scattergun', summary: 'Shotguns. Build rules to come; pick it with the override for now.' },
  { key: 'smg', name: 'SMG', summary: 'Stocked, barrel level 0 or 1. Ammo heavier than Rimfire, Handgun or SMG ammo fires at -1.' },
  { key: 'carbine', name: 'Carbine', summary: 'Stocked, barrel level 2, on Carbine ammo (heavier ammo fires at -1). A Rifle build can use it at -1.' },
  { key: 'rifle', name: 'Rifle', summary: 'Stocked, any ammo, barrel level 3 or more. A Carbine build can use it at -1.' },
  { key: 'heavy', name: 'Heavy Gun', summary: 'Heavy weapons. Build rules to come; pick it with the override for now.' },
];

export function getGunProfDef(key: string | undefined): GunProfDef | undefined {
  return key ? GUN_PROFICIENCIES.find(p => p.key === key) : undefined;
}

// ── Ammunition ────────────────────────────────────────────────────────────────
/** One kind of round for a cartridge. `multiplier` is the round's damage multiplier (hit tiers adjust it: flesh wound
 * x multiplier, solid hit x (multiplier + 0.5), vital hit x (multiplier + 2), graze ignores it). `ap` is armor pierce:
 * positive pierces armor (armor-piercing rounds), negative is worse against it (hollow points, rimfire). It is shown, not
 * applied to armor automatically. */
export interface AmmoRound { id: string; label: string; multiplier: number; ap: number }

/** A cartridge: damage is `count` dice of `sides` sides, summed ("3D4" = 3 dice of d4), plus the round types it comes in.
 * `compatible` lists other cartridges a gun chambered for this one can also load (.357 Magnum loads .38 Special). */
export interface Ammo {
  id: string; label: string; count: number; sides: number;
  /** Base injury level the cartridge deals on a flesh wound (0 = rimfire; 1 Flesh Wound, 2 Minor, 3 Maiming, 4 Dismemberment, 5 Instant Kill). */
  baseInjury: number;
  rounds: AmmoRound[]; compatible?: string[];
}

const FMJ = (multiplier: number, ap = 0): AmmoRound => ({ id: 'fmj', label: 'FMJ', multiplier, ap });
const HP = (multiplier: number, ap = -1): AmmoRound => ({ id: 'hp', label: 'Hollow Point', multiplier, ap });
const AP = (multiplier: number, ap: number): AmmoRound => ({ id: 'ap', label: 'Armor Piercing', multiplier, ap });
const STD = (multiplier: number, ap: number): AmmoRound => ({ id: 'std', label: 'Standard', multiplier, ap });

export const AMMO: Ammo[] = [
  { id: '17hmr', label: '.17 HMR', count: 2, sides: 2, baseInjury: 0, rounds: [STD(1, -1)] },
  { id: '22lr', label: '.22 LR', count: 1, sides: 6, baseInjury: 0, rounds: [STD(1, -1)] },
  { id: '32acp', label: '.32 ACP', count: 2, sides: 6, baseInjury: 1, rounds: [FMJ(1), HP(1.5)] },
  { id: '9mm', label: '9mm', count: 3, sides: 4, baseInjury: 1, rounds: [FMJ(1), HP(1.5)] },
  { id: '38spec', label: '.38 Special', count: 2, sides: 8, baseInjury: 1, rounds: [FMJ(1), HP(1.5)] },
  { id: '357mag', label: '.357 Magnum', count: 4, sides: 4, baseInjury: 2, rounds: [FMJ(1), HP(1.5), AP(0.75, 1)], compatible: ['38spec'] },
  { id: '45acp', label: '.45 ACP', count: 2, sides: 10, baseInjury: 2, rounds: [FMJ(1.5), HP(2)] },
  { id: '44mag', label: '.44 Magnum', count: 2, sides: 12, baseInjury: 2, rounds: [FMJ(1.5), HP(2), AP(1.25, 1)] },
  { id: '40sw', label: '.40 S&W', count: 3, sides: 6, baseInjury: 1, rounds: [FMJ(1), HP(1.5)] },
  { id: '223', label: '.223', count: 5, sides: 6, baseInjury: 1, rounds: [FMJ(1.5, 1), AP(1.25, 2)] },
  { id: '556', label: '5.56', count: 3, sides: 10, baseInjury: 1, rounds: [FMJ(1.5, 2), AP(1.25, 4)], compatible: ['223'] },
  { id: '300blk', label: '300 BLK', count: 4, sides: 8, baseInjury: 1, rounds: [FMJ(1.75, 3), AP(1.5, 5)] },
  { id: '762x39', label: '7.62x39mm', count: 6, sides: 6, baseInjury: 2, rounds: [FMJ(1.75, 2), AP(1.5, 4)] },
  { id: '65cm', label: '6.5 Creedmoor', count: 3, sides: 12, baseInjury: 2, rounds: [FMJ(1.75, 3), AP(1.5, 5)] },
  { id: '277fury', label: '.277 Fury', count: 4, sides: 12, baseInjury: 3, rounds: [FMJ(2.25, 4), AP(2, 8)] },
  { id: '4570', label: '.45-70', count: 3, sides: 20, baseInjury: 3, rounds: [FMJ(5, 2), AP(3.5, 5)] },
  { id: '3030', label: '.30-30', count: 5, sides: 8, baseInjury: 3, rounds: [FMJ(2.25, 3), AP(2, 6)] },
  { id: '270win', label: '.270 Win', count: 7, sides: 6, baseInjury: 3, rounds: [FMJ(2.5, 3), AP(2.25, 7)] },
  { id: '762x51', label: '7.62x51mm', count: 6, sides: 8, baseInjury: 3, rounds: [FMJ(2.75, 4), AP(2.5, 9)] },
  { id: '308', label: '.308', count: 8, sides: 6, baseInjury: 3, rounds: [FMJ(3, 4), AP(2.75, 8)] },
  { id: '3006', label: '.30-06', count: 5, sides: 10, baseInjury: 3, rounds: [FMJ(3, 5), AP(2.75, 9)] },
  { id: '300wm', label: '.300 Win Mag', count: 7, sides: 8, baseInjury: 3, rounds: [FMJ(3, 6), AP(2.75, 12)] },
  { id: '338lapua', label: '.338 Lapua Magnum', count: 8, sides: 8, baseInjury: 3, rounds: [FMJ(3.5, 7), AP(3, 14)] },
];

export function getAmmo(id: string | undefined): Ammo | undefined {
  return id ? AMMO.find(a => a.id === id) : undefined;
}
export const ammoDice = (a: Ammo) => `${a.count}D${a.sides}`;
export const fmtMult = (n: number) => `×${n}`;
export const fmtAp = (n: number) => (n === 0 ? 'no AP' : `AP ${n > 0 ? '+' : ''}${n}`);
/** "3D4 ×1.5, AP -1" */
export const roundSummary = (a: Ammo, r: AmmoRound) => `${ammoDice(a)} ${fmtMult(r.multiplier)}, ${fmtAp(r.ap)}`;

/** One loadable choice: a round type of the chambered cartridge or of a cartridge it is compatible with. */
export interface LoadOption { ammoId: string; roundId: string; label: string }

export function getLoadOptions(chamberedId: string | undefined): LoadOption[] {
  const chambered = getAmmo(chamberedId);
  if (!chambered) return [];
  const out: LoadOption[] = [];
  for (const a of [chambered, ...(chambered.compatible ?? []).map(getAmmo).filter((x): x is Ammo => !!x)]) {
    for (const r of a.rounds) {
      out.push({ ammoId: a.id, roundId: r.id, label: `${a.label}${a.rounds.length > 1 ? ` ${r.label}` : ''} — ${roundSummary(a, r)}` });
    }
  }
  return out;
}

/** Key of one cartridge + round type in Character.ammoStock. */
export const ammoKey = (ammoId: string, roundId: string) => `${ammoId}:${roundId}`;
/** Rounds of one cartridge + round type in the inventory. */
export function getAmmoCount(c: Pick<Character, 'ammoStock'>, ammoId: string, roundId: string): number {
  return Math.max(0, Math.floor(c.ammoStock?.[ammoKey(ammoId, roundId)] ?? 0));
}
/** Cartridges a gun can load: the chambered one and any compatible ones. */
export function getGunCartridges(g: Pick<Firearm, 'ammoId'>): string[] {
  const chambered = getAmmo(g.ammoId);
  return chambered ? [chambered.id, ...(chambered.compatible ?? [])] : [];
}

type LoadFields = Pick<Firearm, 'ammoId' | 'loadedAmmoId' | 'roundId'>;
/** The cartridge actually loaded (the chambered one unless a compatible one was picked). */
export function getLoadedAmmo(g: LoadFields): Ammo | undefined { return getAmmo(g.loadedAmmoId ?? g.ammoId); }
/** The round type loaded; defaults to the cartridge's first round (FMJ). */
export function getLoadedRound(g: LoadFields): AmmoRound | undefined {
  const a = getLoadedAmmo(g);
  return a ? (a.rounds.find(r => r.id === g.roundId) ?? a.rounds[0]) : undefined;
}

// ── Receivers ─────────────────────────────────────────────────────────────────
export type GunClass = 'rimfire' | 'handgun' | 'smg' | 'carbine' | 'rifle';

export interface GunReceiver {
  id: GunClass;
  label: string;
  /** Ammo this receiver can chamber (ids from AMMO). */
  ammo: string[];
}

export const GUN_RECEIVERS: GunReceiver[] = [
  { id: 'rimfire', label: 'Rimfire', ammo: ['17hmr', '22lr'] },
  { id: 'handgun', label: 'Handgun', ammo: ['32acp', '9mm', '38spec', '357mag', '45acp', '44mag'] },
  { id: 'smg', label: 'SMG', ammo: ['9mm', '40sw', '45acp'] },
  { id: 'carbine', label: 'Carbine', ammo: ['45acp', '44mag', '223', '556', '300blk', '762x39', '65cm', '277fury', '4570'] },
  { id: 'rifle', label: 'Rifle', ammo: ['762x39', '65cm', '3030', '270win', '762x51', '277fury', '308', '3006', '300wm', '338lapua', '4570'] },
];

export function getGunReceiver(id: string | undefined): GunReceiver | undefined {
  return id ? GUN_RECEIVERS.find(r => r.id === id) : undefined;
}

// ── Base attachments (every gun has one of each) ──────────────────────────────
export interface GunOption { id: string; label: string; /** Weapon bonus it adds. */ bonus: number; note?: string }

export const RIFLING_OPTIONS: GunOption[] = [
  { id: 'smooth', label: 'Smoothbore', bonus: 0 },
  { id: 'rifled', label: 'Rifled', bonus: 1 },
];

export const STOCK_OPTIONS: GunOption[] = [
  { id: 'none', label: 'No stock', bonus: 0 },
  { id: 'stock', label: 'Stock', bonus: 1 },
];

/** Barrel length is a level: the base barrel is 0-4 in., every level beyond it adds 4 in. and +1 weapon
 * bonus, up to level 5 (21-24 in.). */
export const MAX_BARREL_LEVEL = 5;
export const BARREL_INCH_STEP = 4;
export function barrelLabel(level: number): string {
  const l = Math.max(0, Math.min(level, MAX_BARREL_LEVEL));
  return l === 0 ? `Base (0-${BARREL_INCH_STEP} in.)` : `Level ${l} (${(l * BARREL_INCH_STEP) + 1}-${(l + 1) * BARREL_INCH_STEP} in.)`;
}

/** Reload method has two halves, neither with a numeric effect yet; they are descriptive labels.
 * Ammo storage: where the rounds are kept. */
export const STORAGE_OPTIONS: GunOption[] = [
  { id: 'integrated', label: 'Integrated', bonus: 0, note: 'Rounds sit in the gun itself: break action, revolver and the like.' },
  { id: 'attached', label: 'Attached', bonus: 0, note: 'A magazine tube on a shotgun or lever gun, or internal storage like the M1 Garand, Carcano and Mosin-Nagant.' },
  { id: 'detachable-internal', label: 'Detachable (internal)', bonus: 0, note: 'An ejectable magazine that sits inside the gun, like most handguns.' },
  { id: 'detachable-external', label: 'Detachable (external)', bonus: 0, note: 'An ejectable magazine that sticks out of the gun, like most SMGs, carbines and some rifles.' },
];

/** Round cycling: how the next round gets into the chamber. Automatic is a separate toggle (see AUTO_MODES). */
export const CYCLING_OPTIONS: (GunOption & { group: string })[] = [
  { id: 'cylinder', group: 'Cylinder', label: 'Cylinder', bonus: 0, note: 'Revolvers.' },
  { id: 'lever', group: 'Manual cycling', label: 'Lever', bonus: 0 },
  { id: 'bolt', group: 'Manual cycling', label: 'Bolt', bonus: 0 },
  { id: 'pump', group: 'Manual cycling', label: 'Pump', bonus: 0 },
  { id: 'break', group: 'Manual insertion', label: 'Break action', bonus: 0 },
  { id: 'single', group: 'Manual insertion', label: 'Single shot', bonus: 0 },
  { id: 'muzzle', group: 'Manual insertion', label: 'Muzzle loader', bonus: 0 },
];

/** Automatic cycling: a gun with the Automatic toggle on carries one, two or all three of these fire modes. */
export const AUTO_CYCLING = 'automatic';
export const AUTO_MODES: { id: string; label: string }[] = [
  { id: 'semi', label: 'Semi-auto' },
  { id: 'burst', label: 'Burst' },
  { id: 'full', label: 'Full-auto' },
];

/** "Automatic (Semi-auto / Full-auto)" or the manual cycling label. */
export function cyclingLabel(g: Pick<Firearm, 'cycling' | 'autoModes'>): string {
  if (g.cycling === AUTO_CYCLING) {
    const modes = AUTO_MODES.filter(m => g.autoModes?.includes(m.id)).map(m => m.label);
    return `Automatic (${(modes.length ? modes : [AUTO_MODES[0].label]).join(' / ')})`;
  }
  return CYCLING_OPTIONS.find(o => o.id === g.cycling)?.label ?? '';
}

// ── Interchangeable attachments (optional, one per slot) ─────────────────────
// None of these change a number yet; they are recorded and shown on the gun.
export interface GunSlot { id: string; label: string; options: GunOption[] }

export const ATTACHMENT_SLOTS: GunSlot[] = [
  { id: 'optic', label: 'Optic', options: [
    { id: 'iron', label: 'Iron sights', bonus: 0 },
    { id: 'reddot', label: 'Red dot', bonus: 0 },
    { id: 'scope', label: 'Scope', bonus: 0 },
    { id: 'longscope', label: 'Long-range scope', bonus: 0 },
  ] },
  { id: 'rail', label: 'Rail system', options: [
    { id: 'picatinny', label: 'Picatinny rail', bonus: 0 },
    { id: 'mlok', label: 'M-LOK handguard', bonus: 0 },
  ] },
  { id: 'muzzle', label: 'Muzzle device', options: [
    { id: 'flash', label: 'Flash hider', bonus: 0 },
    { id: 'compensator', label: 'Compensator', bonus: 0 },
    { id: 'suppressor', label: 'Suppressor', bonus: 0 },
  ] },
  { id: 'underbarrel', label: 'Underbarrel', options: [
    { id: 'foregrip', label: 'Foregrip', bonus: 0 },
    { id: 'bipod', label: 'Bipod', bonus: 0 },
  ] },
];

// ── Attack math ───────────────────────────────────────────────────────────────
const find = (list: GunOption[], id: string | undefined) => list.find(o => o.id === id);

export const BASE_WEAPON_BONUS = 2;

export interface WeaponBonusPart { label: string; value: number }

/** Weapon bonus: 2 base, +1 rifling, +1 stock, +1 per barrel level beyond base length. */
export function getGunBonusParts(g: Firearm): WeaponBonusPart[] {
  const barrel = Math.max(0, Math.min(g.barrelLevel, MAX_BARREL_LEVEL));
  return [
    { label: 'Base', value: BASE_WEAPON_BONUS },
    { label: 'Rifling', value: find(RIFLING_OPTIONS, g.rifling)?.bonus ?? 0 },
    { label: 'Stock', value: find(STOCK_OPTIONS, g.stock)?.bonus ?? 0 },
    { label: 'Barrel', value: barrel },
  ];
}
export function getGunWeaponBonus(g: Firearm): number {
  return getGunBonusParts(g).reduce((s, p) => s + p.value, 0);
}

export function describeGun(g: Firearm): string {
  const parts = [
    find(RIFLING_OPTIONS, g.rifling)?.label, find(STOCK_OPTIONS, g.stock)?.label,
    `${barrelLabel(g.barrelLevel)} barrel`, find(STORAGE_OPTIONS, g.storage)?.label, cyclingLabel(g),
  ];
  for (const slot of ATTACHMENT_SLOTS) {
    const opt = find(slot.options, g.attachments?.[slot.id]);
    if (opt) parts.push(opt.label);
  }
  return parts.filter(Boolean).join(' · ');
}

// ── Magazine ─────────────────────────────────────────────────────────────────
// How many rounds a gun holds. These defaults by reload method are placeholders until the real magazine
// rules are set; every gun can override its own size in the builder.
export function defaultMagazineSize(storage: string, cycling: string): number {
  if (storage === 'integrated') {
    if (cycling === 'single' || cycling === 'muzzle') return 1;
    if (cycling === 'break') return 2;
    return 6; // cylinder
  }
  if (storage === 'attached') return 5;
  if (storage === 'detachable-internal') return 10;
  return 20; // detachable-external
}

/** The gun's magazine size: its own override, otherwise the default for its reload method. */
export function getMagazineSize(g: Pick<Firearm, 'storage' | 'cycling' | 'magazineSize'>): number {
  return g.magazineSize && g.magazineSize > 0 ? Math.floor(g.magazineSize) : defaultMagazineSize(g.storage, g.cycling);
}

/** Rounds loaded right now (a gun that has never fired is full), never more than the magazine holds. */
export function getRoundsLeft(g: Pick<Firearm, 'storage' | 'cycling' | 'magazineSize' | 'rounds'>): number {
  const size = getMagazineSize(g);
  return g.rounds === undefined ? size : Math.max(0, Math.min(size, Math.floor(g.rounds)));
}

// ── Which proficiency a build uses ───────────────────────────────────────────
// The receiver only sets the ammo list. The proficiency comes from how the whole gun is built:
//  - no stock = Handgun
//  - stocked, by barrel level: 0-1 SMG (SMG-class ammo), 2 Carbine (Carbine ammo), 3+ Rifle (any ammo)
//  - ammo heavier than the barrel level's proficiency allows: fires with that proficiency at -1
//  - a Rifle build can be fired with the Carbine proficiency at -1, and a Carbine build with Rifle at -1;
//    the two penalties stack (heavy-ammo Carbine build fired with Rifle = -2)
//  - lighter ammo that does not fit fits nothing
//  - Stabilizing removes every one of these penalties on the first shot (a toggle on the gun card)
// Scattergun and Heavy Gun have no build rules yet and are only reachable by override.
const ammoOfReceiver = (id: GunClass) => getGunReceiver(id)?.ammo ?? [];
const ammoIn = (ids: GunClass[], ammoId: string) => ids.some(r => ammoOfReceiver(r).includes(ammoId));

/** A proficiency a build can be fired with, and the dice penalty it costs when it is not an exact fit. */
export interface GunProfFit { key: GunProfKey; penalty: number; reason?: string }

type BuildFields = Pick<Firearm, 'stock' | 'ammoId' | 'barrelLevel'>;

/** Every proficiency the build can use, best first (the exact fit, then any penalised alternatives). */
export function getGunProfFits(g: BuildFields): GunProfFit[] {
  if (g.stock === 'none') return [{ key: 'handgun', penalty: 0 }];
  const lvl = g.barrelLevel;
  if (lvl >= 3) return [
    { key: 'rifle', penalty: 0 },
    { key: 'carbine', penalty: 1, reason: 'a Rifle build fired with the Carbine proficiency' },
  ];
  if (lvl === 2) {
    if (ammoIn(['carbine'], g.ammoId)) return [
      { key: 'carbine', penalty: 0 },
      { key: 'rifle', penalty: 1, reason: 'a Carbine build fired with the Rifle proficiency' },
    ];
    // Rifle-class ammo is heavier than Carbine ammo; lighter ammo fits nothing here
    return ammoIn(['rifle'], g.ammoId) ? [
      { key: 'carbine', penalty: 1, reason: 'the ammo is heavier than Carbine ammo' },
      { key: 'rifle', penalty: 2, reason: 'the ammo is heavier than Carbine ammo and a Carbine build is fired with the Rifle proficiency' },
    ] : [];
  }
  return ammoIn(['rimfire', 'handgun', 'smg'], g.ammoId)
    ? [{ key: 'smg', penalty: 0 }]
    : [{ key: 'smg', penalty: 1, reason: 'the ammo is heavier than SMG ammo' }];
}

export interface ResolvedGunProf { key?: GunProfKey; penalty: number; reason?: string; prof?: Proficiency; fits: GunProfFit[]; overridden: boolean }

/** The proficiency a gun fires with for this character: the override if set (no penalty);
 * otherwise the best fit the character has actually taken, else the exact fit (untaken, so the
 * gun fires unproficient). */
export function resolveGunProf(c: Character, g: Firearm): ResolvedGunProf {
  const find = (key: string) => c.proficiencies.find(p => p.profType === 'firearms' && p.gunKey === key);
  const fits = getGunProfFits(g);
  if (g.profOverride && getGunProfDef(g.profOverride)) {
    return { key: g.profOverride as GunProfKey, penalty: 0, prof: find(g.profOverride), fits, overridden: true };
  }
  const owned = fits.find(f => find(f.key));
  const pick = owned ?? fits[0];
  return pick
    ? { key: pick.key, penalty: owned ? pick.penalty : 0, reason: owned ? pick.reason : undefined, prof: owned ? find(pick.key) : undefined, fits, overridden: false }
    : { penalty: 0, fits, overridden: false };
}

/** Attack dice for a gun: the proficiency's dice (less any fit penalty) or 3 + INT/WIS without one, plus the weapon bonus. */
export function getGunAttackDice(c: Character, g: Firearm): number {
  const fit = resolveGunProf(c, g);
  const bonus = getGunWeaponBonus(g);
  if (fit.prof) return Math.max(0, getProfDice(c, fit.prof) - fit.penalty) + bonus;
  return Math.max(0, 3 + effAttr(c, g.mentalStat ?? 'int')) + bonus;
}

// ── Hit result ────────────────────────────────────────────────────────────────
export type HitTierKey = 'miss' | 'graze' | 'flesh' | 'solid' | 'vital';
export interface HitTier { key: HitTierKey; label: string; margin: number; challenge: number; note: string }

const TIER_LABELS: Record<HitTierKey, string> = {
  miss: 'Miss', graze: 'Graze', flesh: 'Flesh wound', solid: 'Solid hit', vital: 'Vital hit',
};

/** What each hit tier does to damage and injury. The multiplier comes from the loaded round (see AmmoRound) and the
 * base injury from its cartridge (see Ammo.baseInjury). The critical effect a vital hit adds (lethal or non-lethal,
 * by the ammo) is not defined yet, so it stays descriptive text. */
export const ROUND_PLACEHOLDER = { multiplier: 1 };

/** "injury level 3 (Maiming)"; anything past the ladder is an Instant Kill. */
export function injuryLabel(level: number): string {
  if (level <= 0) return 'no injury';
  const key = INJURY_LEVEL_ORDER[Math.min(level, INJURY_LEVEL_ORDER.length - 1)] as Exclude<InjuryLevel, 'none'>;
  return `injury level ${level} (${INJURY_LEVELS[key].label})`;
}

/** The injury level a hit tier deals: a graze none, a flesh wound the cartridge's base, a solid hit base +1, a vital hit
 * double the base. A cartridge with no base injury (rimfire) just adds +1 on a flesh wound, +2 solid, +3 vital. */
export function tierInjuryLevel(key: HitTierKey, base: number): number {
  if (key === 'graze' || key === 'miss') return 0;
  if (base <= 0) return key === 'flesh' ? 1 : key === 'solid' ? 2 : 3;
  return key === 'flesh' ? base : key === 'solid' ? base + 1 : base * 2;
}

export interface TierDamage { multiplier: number; formula: string; effect: string; injury: number }

const CRIT = 'plus a critical effect (lethal or non-lethal, by the ammo)';

/** Damage and injury for a hit tier. With `baseInjury` (a loaded cartridge) the text states real numbers. */
export function getTierDamage(key: HitTierKey, roundMultiplier = ROUND_PLACEHOLDER.multiplier, baseInjury?: number): TierDamage | null {
  if (key === 'miss') return null;
  const mult = key === 'graze' ? 1 : key === 'flesh' ? roundMultiplier : key === 'solid' ? roundMultiplier + 0.5 : roundMultiplier + 2;
  if (key === 'graze') return { multiplier: 1, formula: 'base dice', effect: 'No multiplier, no injury or effect.', injury: 0 };
  if (baseInjury === undefined) {
    const generic = {
      flesh: { formula: 'dice × round multiplier', effect: "The round's base injury/effect." },
      solid: { formula: 'dice × (round multiplier + 0.5)', effect: "The round's injury/effect raised by one level." },
      vital: { formula: 'dice × (round multiplier + 2)', effect: `The round's injury/effect doubled, ${CRIT}.` },
    }[key];
    return { multiplier: mult, ...generic, injury: 0 };
  }
  const injury = tierInjuryLevel(key, baseInjury);
  const how = baseInjury <= 0
    ? `No base injury, so a ${key === 'flesh' ? 'flesh wound' : key === 'solid' ? 'solid hit' : 'vital hit'} adds +${injury}: `
    : key === 'flesh' ? 'Base injury: ' : key === 'solid' ? 'Base injury +1: ' : 'Base injury doubled: ';
  return {
    multiplier: mult,
    formula: `dice × ${mult}`,
    effect: `${how}${injuryLabel(injury)}${key === 'vital' ? `, ${CRIT}` : ''}.`,
    injury,
  };
}
export const DAMAGE_TIERS: HitTierKey[] = ['graze', 'flesh', 'solid', 'vital'];

/** Successes against the enemy's Challenge to Hit: matching it is a graze, 1-2 above a flesh
 * wound, 3-4 a solid hit, 5+ a vital hit. Below it (or with no successes) is a miss. */
export const hitTierLabel = (k: HitTierKey) => TIER_LABELS[k];
export function getHitTier(successes: number, challenge: number, round?: { multiplier: number; baseInjury: number }): HitTier {
  const margin = successes - challenge;
  const key: HitTierKey = successes <= 0 || margin < 0 ? 'miss'
    : margin === 0 ? 'graze' : margin <= 2 ? 'flesh' : margin <= 4 ? 'solid' : 'vital';
  const td = getTierDamage(key, round?.multiplier ?? ROUND_PLACEHOLDER.multiplier, round?.baseInjury);
  return { key, label: TIER_LABELS[key], margin, challenge, note: td ? `${td.formula}. ${td.effect}` : 'The shot misses.' };
}
