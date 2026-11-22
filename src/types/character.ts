export type AttributeKey = 'str' | 'dex' | 'wis' | 'int' | 'cng' | 'cha';
export type SkillKey =
  | 'athletics' | 'endurance' | 'grip'
  | 'acrobatics' | 'stability' | 'stealth'
  | 'adv' | 'intuition' | 'survival'
  | 'generalKnowledge' | 'advancedKnowledge' | 'investigation'
  | 'converse' | 'deception' | 'infiltration'
  | 'convey' | 'performance' | 'persuasion';

export const ATTRIBUTE_KEYS: AttributeKey[] = ['str', 'dex', 'wis', 'int', 'cng', 'cha'];
export const ATTRIBUTE_INFO: Record<AttributeKey, { full: string; abbr: string; skills: SkillKey[] }> = {
  str: { full: 'Strength', abbr: 'STR', skills: ['athletics', 'endurance', 'grip'] },
  dex: { full: 'Dexterity', abbr: 'DEX', skills: ['acrobatics', 'stability', 'stealth'] },
  wis: { full: 'Wisdom', abbr: 'WIS', skills: ['adv', 'intuition', 'survival'] },
  int: { full: 'Intelligence', abbr: 'INT', skills: ['generalKnowledge', 'advancedKnowledge', 'investigation'] },
  cng: { full: 'Cunning', abbr: 'CNG', skills: ['converse', 'deception', 'infiltration'] },
  cha: { full: 'Charisma', abbr: 'CHA', skills: ['convey', 'performance', 'persuasion'] },
};
export const SKILL_LABELS: Record<SkillKey, string> = {
  athletics: 'Athletics', endurance: 'Endurance', grip: 'Grip',
  acrobatics: 'Acrobatics', stability: 'Stability', stealth: 'Stealth',
  adv: 'Discernment', intuition: 'Intuition', survival: 'Survival',
  generalKnowledge: 'General Knowledge', advancedKnowledge: 'Advanced Knowledge', investigation: 'Investigation',
  converse: 'Converse', deception: 'Deception', infiltration: 'Infiltration',
  convey: 'Convey', performance: 'Performance', persuasion: 'Persuasion',
};
export const SKILL_TO_ATTR: Record<SkillKey, AttributeKey> = {
  athletics: 'str', endurance: 'str', grip: 'str',
  acrobatics: 'dex', stability: 'dex', stealth: 'dex',
  adv: 'wis', intuition: 'wis', survival: 'wis',
  generalKnowledge: 'int', advancedKnowledge: 'int', investigation: 'int',
  converse: 'cng', deception: 'cng', infiltration: 'cng',
  convey: 'cha', performance: 'cha', persuasion: 'cha',
};

/** A caster's power option: which half of magic is innate (see utils/magic.ts). */
export type MagicSource = 'power' | 'pool' | 'sorcerer';

export interface Proficiency {
  id: string; name: string; level: number;
  attributes: AttributeKey[]; skills: SkillKey[];
  startingPrime: 0 | 1; itemBonus: number; modifier: number;
  freeLevel?: number;
  isForceSchool?: boolean; isForceMastery?: boolean; autoLevel?: boolean;
  profType?: 'weapon' | 'vocation' | 'bow' | 'crossbow' | 'firearms';
  /** Set when this is one of the fixed sword proficiencies (see swordData.ts) --
   * name, stat lock, level cap and allowed weapon components all come from it. */
  swordKey?: string;
  /** Set on the placeholder basic Melee proficiency: any weapon that is not a sword can be linked to it (see ProficienciesTab). */
  basicMelee?: boolean;
  /** Set when this is one of the fixed firearm proficiencies (see gunData.ts). */
  gunKey?: string;
  /** Marks the automatic vocation that fabricates the half of magic that is not innate. */
  magicFabricated?: 'pool' | 'river';
  physicalStat?: 'str' | 'dex';
  /** wis | int for weapon/vocation/firearms, int | dex for bow */
  mentalStat?: 'wis' | 'int' | 'dex';
}
export type ArmorSlot = 'head' | 'rightShoulder' | 'leftShoulder' | 'torso' | 'rightArm' | 'leftArm' | 'rightLeg' | 'leftLeg';
export const ARMOR_SLOTS: ArmorSlot[] = ['head', 'rightShoulder', 'leftShoulder', 'torso', 'rightArm', 'leftArm', 'rightLeg', 'leftLeg'];
export const ARMOR_SLOT_LABELS: Record<ArmorSlot, string> = {
  head: 'Head', rightShoulder: 'R. Shoulder', leftShoulder: 'L. Shoulder',
  torso: 'Torso', rightArm: 'R. Arm', leftArm: 'L. Arm', rightLeg: 'R. Leg', leftLeg: 'L. Leg',
};
export type ArmorLayer = 'clothing' | 'inner' | 'middle' | 'outer';
export const ARMOR_LAYERS: ArmorLayer[] = ['clothing', 'inner', 'middle', 'outer'];
export const ARMOR_LAYER_LABELS: Record<ArmorLayer, string> = {
  clothing: 'Clothing', inner: 'Inner Armor', middle: 'Middle Armor', outer: 'Outer Armor',
};
/** Max armor points a single piece of gear can provide at that layer --
 * layers stack (a slot's total is the sum across all 4), but no single
 * layer's contribution can exceed this. See getArmorForSlot. */
export const ARMOR_LAYER_MAX: Record<ArmorLayer, number> = {
  clothing: 1, inner: 2, middle: 3, outer: 5,
};
/** Degradation order -- outermost eligible layer with points left takes a
 * hit first, working inward. Reverse of ARMOR_LAYERS (which is innermost-
 * first, matching the Armor tab's display order). See degradeArmorAtSlot. */
export const ARMOR_DEGRADE_ORDER: ArmorLayer[] = ['outer', 'middle', 'inner', 'clothing'];

/** One piece of gear at a given layer+slot. `hard` armor (plate, durasteel,
 * etc.) only takes degradation from a Heavy attack or a dedicated armor-
 * breaker -- a normal/Light hit that meets-or-exceeds it still blocks the
 * hit (still counts toward the region's total defense) but skips over it
 * for degradation, moving to the next eligible layer inward instead. */
export interface ArmorPiece {
  name: string;
  value: number; // current points remaining, capped at ARMOR_LAYER_MAX[layer]
  hard: boolean;
}
export function emptyArmorPiece(): ArmorPiece { return { name: '', value: 0, hard: false }; }

/** The 6 locations that can actually be injured -- distinct from the 8
 * ArmorSlots that protect them (a shoulder slot protects an arm + torso,
 * but "shoulder" itself is never the thing that gets injured). Normal
 * combat only; dueling keeps its own narrower DUEL_REGIONS (5, legs
 * combined) -- see getDuelRegionArmor in armorInjury.ts for that mapping. */
export type InjuryLocation = 'head' | 'torso' | 'rightArm' | 'leftArm' | 'rightLeg' | 'leftLeg';
export const INJURY_LOCATIONS: InjuryLocation[] = ['head', 'torso', 'rightArm', 'leftArm', 'rightLeg', 'leftLeg'];
export const INJURY_LOCATION_LABELS: Record<InjuryLocation, string> = {
  head: 'Head', torso: 'Torso', rightArm: 'R. Arm', leftArm: 'L. Arm', rightLeg: 'R. Leg', leftLeg: 'L. Leg',
};

/** Severity of a single landed injury. 'none' means "this hit wasn't severe
 * enough to cause one" -- it's a valid return value from a hit-resolution
 * check, but never an entry actually stored in a location's injury list
 * (Character.injuries[location] is Exclude<InjuryLevel,'none'>[]; a
 * location with nothing landed is just an empty array). A single location
 * can carry MULTIPLE injuries at once, including repeats of the same
 * level (two separate Flesh Wounds each still cost their own -1 die) --
 * see getTotalInjuryDiceLoss, which sums every entry, not just the worst. */
export type InjuryLevel = 'none' | 'fleshWound' | 'minor' | 'maiming' | 'dismembered' | 'dead';
export interface LoadoutSet {
  mainHand: string; offhand: string; back1: string; back2: string; back3: string; hips4: string; hips5: string;
}
/** A money tracker: the balance and the last changes made to it. `amount` and every `delta` are whole Copper Krönur (see utils/money.ts). */
/** `delta` is in the unit of its purse: Copper Krönur, Algeir or Skøl (`currency`, Krönur when missing). */
export interface MoneyEntry { id: string; delta: number; note: string; at: string; currency?: 'kronur' | 'algeir' | 'skol' }
export interface MoneyTracker { amount: number; /** Algeir held (two decimals). */ algeir?: number; /** Skøl held (two decimals). */ skol?: number; log: MoneyEntry[] }

export interface InventoryItem { id: string; name: string; quantity: number; weight: number; description?: string; }

export interface WeaponHead { category: string; subType: string; }
export interface Weapon {
  id: string;
  name: string;
  /** Free text about the weapon, shown (or hidden) in the Weapons tab and shown in the inventory. */
  description?: string;
  classification: 'simple' | 'martial';
  handleType: 'polearm' | 'standard' | 'sword';
  handleSize: string;
  heads: WeaponHead[];
  handedness: 'small' | '1h' | '2h' | '1h2h';
  weight: 'regular' | 'heavy';
  linkedProficiencyId?: string;
  /** Sword builds only: the sword proficiency this weapon is locked to. */
  swordProfKey?: string;
  /** Sword builds only: blade thickness id (see SWORD_THICKNESSES). */
  bladeThickness?: string;
  /** Sword builds only: head style id (see HEAD_STYLES). */
  headStyle?: string;
  advancedMode?: boolean;
  attackModOverride?: number;
  currentGrip?: '1h' | '2h';
}

export interface AbilityEntry {
  id: string; name: string; description: string;
  /** Set when this ability was taken from a tree */
  treeId?: string;
  /** The specific ability id within the tree */
  treeAbilityId?: string;
}

// ── Ranged weapons ────────────────────────────────────────────────────────────
export type BowStyle = 'longbow' | 'shortbow' | 'recurve';
export type BowDrawWeight = 'hunting' | 'sporting' | 'war';
export type CrossbowDrawWeight = 'hand' | 'hunting' | 'war' | 'siege' | 'arbalest';

export interface Bow {
  id: string;
  name: string;
  description?: string;
  style: BowStyle;
  drawWeight: BowDrawWeight;
  linkedProficiencyId?: string;
}

export interface Crossbow {
  id: string;
  name: string;
  description?: string;
  drawWeight: CrossbowDrawWeight;
  linkedProficiencyId?: string;
}

/** A built firearm: receiver -> ammo, the four base attachments, and optional interchangeable ones. */
export interface Firearm {
  id: string;
  name: string;
  description?: string;
  /** Receiver class id (see GUN_RECEIVERS). */
  receiver: string;
  /** Chambered cartridge id (see AMMO). */
  ammoId: string;
  /** Round type loaded (see AmmoRound.id: fmj, hp, ap...). Defaults to the cartridge's first round. Sets the damage multiplier and armor pierce. */
  roundId?: string;
  /** Set when a compatible cartridge is loaded instead of the chambered one (e.g. .38 Special in a .357 Magnum); sets the damage dice. */
  loadedAmmoId?: string;
  /** Set only when the player overrides the proficiency the build would otherwise give it (see getGunProfKey). */
  profOverride?: string;
  rifling: string;
  stock: string;
  /** 0 = base barrel (0-4 in.); each level beyond it adds 4 in. and +1 weapon bonus, up to level 5 (24 in.). */
  barrelLevel: number;
  /** Reload method, half one: where the rounds are stored (see STORAGE_OPTIONS). */
  storage: string;
  /** Reload method, half two: how the next round is cycled in (see CYCLING_OPTIONS), or 'automatic'. */
  cycling: string;
  /** When cycling is 'automatic': the fire modes the gun can switch between (see AUTO_MODES), at least one. */
  autoModes?: string[];
  /** Magazine size in rounds. Missing = the default for the reload method (see defaultMagazineSize in gunData.ts). */
  magazineSize?: number;
  /** Rounds currently loaded. Missing = a full magazine. Each attack uses one; Reload refills it. */
  rounds?: number;
  /** INT or WIS for the attack roll when no firearm proficiency has been taken (the proficiency's own choice wins). Unproficient attack = 3 + this + weapon bonus. */
  mentalStat?: 'int' | 'wis';
  /** Interchangeable attachments, slot id -> option id. */
  attachments: Record<string, string>;
}

export interface Character {
  id: string; cloudId?: string;
  /** When this copy was last in step with the cloud row (ISO time), used to notice campaign edits made elsewhere. */
  cloudSyncedAt?: string;
  name: string; player: string; level: number;
  race: string; bodyType: string; age: string;
  /** Picked in the create dialog (see data/worlds.ts): world id, archetype name ("Custom" when freely built), background name. */
  world?: string; archetype?: string; background?: string;
  /** Caster power option; undefined = innate mana pool only, no magic roll. */
  magicSource?: MagicSource;
  disablingCharacteristics: string; inherentCharacteristics: string;
  characterType: 'normal' | 'gm';
  berzerkActive: boolean; berzerkRound: number;
  /** Turns taken in combat: all-time `total`, and `session` (the player resets it). Missing on older characters (counts as 0). */
  turnStats?: { total: number; session: number };
  /** Ammo in the inventory, rounds per cartridge:round type key (see ammoKey in gunData.ts). Reload on a gun draws from it. */
  ammoStock?: Record<string, number>;
  /** Money carried: Krönur, Algeir and Skøl (any character; created the first time it is used). */
  money?: MoneyTracker;
  bonusPoints: { attribute: number; skill: number; ability: number; proficiency: number };
  modifiers: { attributes: Record<AttributeKey, number>; skills: Record<SkillKey, number>; abilities: number };
  attributes: Record<AttributeKey, number>; skills: Record<SkillKey, number>;
  abilities: (string | AbilityEntry)[]; proficiencies: Proficiency[];
  hitPoints: { current: number; max: number }; stamina: { current: number; max: number };
  mana: { current: number; max: number }; maxReactions: number; maxHpTemp: number; destinyPoints: number;
  /** One named piece of gear per layer+slot -- value capped at
   * ARMOR_LAYER_MAX for its layer. A hit that meets-or-exceeds a location's
   * total (summed across the slots protecting it) automatically degrades 1
   * point off the outermost eligible layer there (armorInjury.ts's
   * degradeArmorAtSlot picks which -- outer-to-inner, skipping `hard`
   * pieces unless the attack is Heavy or a dedicated armor-breaker). */
  armor: Record<ArmorLayer, Record<ArmorSlot, ArmorPiece>>;
  /** Every injury currently landed at each location, oldest first -- NOT
   * just the worst one. A location can carry several at once, including
   * repeats of the same level (see InjuryLevel); an empty array means
   * uninjured. Dice-loss sums every entry (getTotalInjuryDiceLoss), it
   * doesn't just take the max. */
  injuries: Record<InjuryLocation, Exclude<InjuryLevel, 'none'>[]>;
  loadout: { loadout1: LoadoutSet; loadout2: LoadoutSet };
  inventory: InventoryItem[]; weapons: Weapon[];
  bows: Bow[]; crossbows: Crossbow[]; firearms: Firearm[];
  notes: string; freePicksUsed: number;
  gmModeIncreases: { attributes: Record<string, number>; skills: Record<string, number>; proficiencies: Record<string, number> };
}
