import {
  Character, ArmorSlot, ArmorLayer, ArmorPiece, ARMOR_LAYERS, ARMOR_LAYER_MAX, ARMOR_DEGRADE_ORDER,
  InjuryLocation, InjuryLevel, INJURY_LOCATIONS as INJURY_LOCATIONS_INTERNAL,
} from '../types/character';

/** Which armor slots protect which injury location. A shoulder slot
 * protects both its arm AND the torso (per the stated rules); every other
 * slot protects exactly the one location matching its name. Torso is the
 * only location covered by more than one slot besides its own. */
export const ARMOR_SLOTS_FOR_LOCATION: Record<InjuryLocation, ArmorSlot[]> = {
  head: ['head'],
  torso: ['torso', 'rightShoulder', 'leftShoulder'],
  rightArm: ['rightArm', 'rightShoulder'],
  leftArm: ['leftArm', 'leftShoulder'],
  rightLeg: ['rightLeg'],
  leftLeg: ['leftLeg'],
};

export const LIMB_LOCATIONS: InjuryLocation[] = ['rightArm', 'leftArm', 'rightLeg', 'leftLeg'];
export function isLimb(location: InjuryLocation): boolean {
  return LIMB_LOCATIONS.includes(location);
}

/** Tolerant read of one layer+slot's gear -- handles the current ArmorPiece
 * shape, but also two older shapes this field has gone through (a plain
 * number, or free-text string), coercing anything unrecognized to an empty
 * unhardened piece instead of crashing. Value is capped at the layer's max
 * (defensive against corrupt/manually-edited data exceeding it). */
export function getArmorPieceAt(c: Character, layer: ArmorLayer, slot: ArmorSlot): ArmorPiece {
  const raw = c.armor?.[layer]?.[slot] as unknown;
  if (raw && typeof raw === 'object' && 'value' in (raw as Record<string, unknown>)) {
    const p = raw as Partial<ArmorPiece>;
    return {
      name: typeof p.name === 'string' ? p.name : '',
      value: Math.max(0, Math.min(Number(p.value) || 0, ARMOR_LAYER_MAX[layer])),
      hard: !!p.hard,
    };
  }
  return { name: '', value: Math.max(0, Math.min(Number(raw) || 0, ARMOR_LAYER_MAX[layer])), hard: false };
}

/** Sum of all 4 armor layers currently equipped at one slot. */
export function getArmorForSlot(c: Character, slot: ArmorSlot): number {
  return ARMOR_LAYERS.reduce((sum, layer) => sum + getArmorPieceAt(c, layer, slot).value, 0);
}

/** Total armor defending one injury location -- summed across every slot
 * that protects it (see ARMOR_SLOTS_FOR_LOCATION; only Torso has more than
 * one contributing slot). */
export function getArmorForLocation(c: Character, location: InjuryLocation): number {
  return ARMOR_SLOTS_FOR_LOCATION[location].reduce((sum, slot) => sum + getArmorForSlot(c, slot), 0);
}

/** Where a hit's 1 point of armor degradation should land: the outermost
 * layer, at the first (highest-priority) slot in `slots`, that has points
 * left AND (isn't `hard` OR `allowHard` is true -- a Heavy attack/armor
 * breaker). Null means nothing eligible (everything's either empty or hard
 * armor a normal hit can't touch). */
export interface ArmorDegradeTarget { slot: ArmorSlot; layer: ArmorLayer; }
export function findArmorDegradeTarget(c: Character, slots: ArmorSlot[], allowHard: boolean): ArmorDegradeTarget | null {
  for (const slot of slots) {
    for (const layer of ARMOR_DEGRADE_ORDER) {
      const piece = getArmorPieceAt(c, layer, slot);
      if (piece.value > 0 && (allowHard || !piece.hard)) return { slot, layer };
    }
  }
  return null;
}

/** Applies 1 point (or `points`, for a future armor-breaker override) of
 * degradation at a specific layer+slot -- returns a NEW armor object,
 * doesn't mutate. Caller is responsible for actually saving it back onto
 * the character (see ArmorPanel/InjuriesPanel for normal combat; duels
 * never call this directly -- see duelArmorInjury.ts, which tracks
 * duel-scoped loss separately instead of touching real gear). */
export function applyArmorDegrade(c: Character, target: ArmorDegradeTarget, points = 1): Character['armor'] {
  const piece = getArmorPieceAt(c, target.layer, target.slot);
  return {
    ...c.armor,
    [target.layer]: {
      ...c.armor[target.layer],
      [target.slot]: { ...piece, value: Math.max(0, piece.value - points) },
    },
  };
}

// ── Injury ladder ────────────────────────────────────────────────────────────

export const INJURY_LEVEL_ORDER: InjuryLevel[] = ['none', 'fleshWound', 'minor', 'maiming', 'dismembered', 'dead'];

export interface InjuryLevelInfo {
  level: InjuryLevel;
  label: string;
  /** Successes-through-armor needed to reach this level in normal combat. */
  minSuccesses: number;
  /** Dice removed from the injured character's future attack rolls for the
   * rest of the encounter (99 stands in for "moot, they're dead"). Each
   * landed injury contributes its own diceLoss independently -- see
   * getTotalInjuryDiceLoss, which sums every entry at every location, not
   * just the worst one. */
  diceLoss: number;
  description: string;
}

export const INJURY_LEVELS: Record<Exclude<InjuryLevel, 'none'>, InjuryLevelInfo> = {
  fleshWound: { level: 'fleshWound', label: 'Flesh Wound', minSuccesses: 3, diceLoss: 1, description: '−1 die to attacks' },
  minor: { level: 'minor', label: 'Minor Injury', minSuccesses: 5, diceLoss: 2, description: '−2 dice to attacks' },
  maiming: { level: 'maiming', label: 'Maiming', minSuccesses: 6, diceLoss: 3, description: '−3 dice to attacks; loses use of the limb (if a limb was hit)' },
  dismembered: { level: 'dismembered', label: 'Dismemberment', minSuccesses: 7, diceLoss: 4, description: 'Limb is dismembered (if a limb) -- instant kill if the Head' },
  dead: { level: 'dead', label: 'Instant Kill', minSuccesses: 8, diceLoss: 99, description: 'Character is dead' },
};

/** Successes-through-armor -> base injury level, before the Head exception. */
export function getInjuryLevelForSuccesses(successesThrough: number): InjuryLevel {
  if (successesThrough >= 8) return 'dead';
  if (successesThrough >= 7) return 'dismembered';
  if (successesThrough >= 6) return 'maiming';
  if (successesThrough >= 5) return 'minor';
  if (successesThrough >= 3) return 'fleshWound';
  return 'none';
}

/** Applies the one location-specific override: a would-be Dismemberment
 * lands as an instant kill instead when the Head was hit (no "head falls
 * off" case to speak of). Every other location/level combination is
 * unchanged. */
export function resolveInjuryLevel(location: InjuryLocation, successesThrough: number): InjuryLevel {
  const base = getInjuryLevelForSuccesses(successesThrough);
  if (base === 'dismembered' && location === 'head') return 'dead';
  return base;
}

export function isWorseInjury(a: InjuryLevel, b: InjuryLevel): boolean {
  return INJURY_LEVEL_ORDER.indexOf(a) > INJURY_LEVEL_ORDER.indexOf(b);
}

/** The single worst entry in a location's injury list, for a compact status
 * display -- 'none' if the list is empty. The list itself (all entries,
 * not just this) is still what dice-loss sums over. */
export function getWorstInjury(list: Exclude<InjuryLevel, 'none'>[]): InjuryLevel {
  return list.reduce<InjuryLevel>((worst, lvl) => isWorseInjury(lvl, worst) ? lvl : worst, 'none');
}

/** Safe read of one location's full injury list -- tolerates old character
 * data whose `injuries` field predates this system (a single InjuryLevel
 * string, or the original {internal: string[], external: string[]} shape
 * entirely), coercing anything unrecognized to an empty list instead of
 * crashing. */
export function getInjuries(injuries: unknown, location: InjuryLocation): Exclude<InjuryLevel, 'none'>[] {
  const raw = (injuries as Record<string, unknown> | null | undefined)?.[location];
  if (Array.isArray(raw)) {
    return raw.filter((lvl): lvl is Exclude<InjuryLevel, 'none'> =>
      typeof lvl === 'string' && lvl !== 'none' && (INJURY_LEVEL_ORDER as string[]).includes(lvl));
  }
  // Pre-stacking shape: a single level string directly on the location.
  if (typeof raw === 'string' && raw !== 'none' && (INJURY_LEVEL_ORDER as string[]).includes(raw)) {
    return [raw as Exclude<InjuryLevel, 'none'>];
  }
  return [];
}

/** Total dice penalty across every injury at every location on a character
 * -- sums ALL entries, not just the worst per location (two separate Flesh
 * Wounds on the same arm each still cost their own -1 die). Iterates
 * INJURY_LOCATIONS explicitly (not Object.values on whatever `injuries`
 * happens to contain) so old-shaped data can't produce garbage entries. */
export function getTotalInjuryDiceLoss(injuries: unknown): number {
  return INJURY_LOCATIONS_INTERNAL.reduce((sum, loc) => {
    const list = getInjuries(injuries, loc);
    return sum + list.reduce((s, lvl) => s + INJURY_LEVELS[lvl].diceLoss, 0);
  }, 0);
}

// ── Hit resolution (normal combat: successes-based) ──────────────────────────

export interface HitResolution {
  armorValue: number;
  /** Successes that penetrated armor and reach the character -- 0 if fully absorbed. */
  successesThrough: number;
  /** Where armor degradation should land, or null if the hit didn't meet
   * armor (fully absorbed with room to spare) or nothing was eligible
   * (all-hard-and-disallowed / already empty). Already picked automatically
   * -- outer-to-inner, correct slot priority, hard-aware -- see
   * findArmorDegradeTarget. */
  armorDegradeTarget: ArmorDegradeTarget | null;
  /** True when nothing got through (successesThrough === 0). */
  absorbed: boolean;
  injuryLevel: InjuryLevel;
}

/** allowHard: whether this specific attack can degrade `hard` armor
 * (a Heavy weapon or dedicated armor-breaker) -- normal/Light hits can't,
 * they just get blocked by hard armor without wearing it down. */
export function resolveHitVsArmor(c: Character, rawSuccesses: number, location: InjuryLocation, allowHard: boolean): HitResolution {
  const slots = ARMOR_SLOTS_FOR_LOCATION[location];
  const armorValue = slots.reduce((sum, slot) => sum + getArmorForSlot(c, slot), 0);
  const successesThrough = Math.max(0, rawSuccesses - armorValue);
  const armorDegradeTarget = (armorValue > 0 && rawSuccesses >= armorValue)
    ? findArmorDegradeTarget(c, slots, allowHard)
    : null;
  return {
    armorValue,
    successesThrough,
    armorDegradeTarget,
    absorbed: successesThrough === 0,
    injuryLevel: resolveInjuryLevel(location, successesThrough),
  };
}

// ── Dueling equivalents ───────────────────────────────────────────────────────
// Duels resolve in raw point totals, not discrete successes. Armor scales
// ×3 (1 armor point = 3 duel defense points, confirmed with the user), but
// injury thresholds do NOT get that same scaling -- duel points-through map
// 1:1 onto the same success ladder as normal combat (also confirmed). See
// duelArmorInjury.ts for the duel-scoped (never touches real gear) version
// of all of this.
export const DUEL_ARMOR_POINTS_PER_ARMOR = 3;

export function getDuelArmorDefensePoints(armorValue: number): number {
  return armorValue * DUEL_ARMOR_POINTS_PER_ARMOR;
}
