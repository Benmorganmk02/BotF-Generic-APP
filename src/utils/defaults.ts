import {
  Character, AttributeKey, SkillKey, ArmorLayer, ArmorSlot, ArmorPiece, ARMOR_LAYERS, ARMOR_SLOTS, emptyArmorPiece,
  InjuryLocation, InjuryLevel, INJURY_LOCATIONS, Proficiency,
} from '../types/character';
import { getHPMax } from './mechanics';

export function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

const defaultAttr: Record<AttributeKey, number> = { str: 0, dex: 0, wis: 0, int: 0, cng: 0, cha: 0 };
const defaultSkills: Record<SkillKey, number> = {
  athletics: 0, endurance: 0, grip: 0, acrobatics: 0, stability: 0, stealth: 0,
  adv: 0, intuition: 0, survival: 0, generalKnowledge: 0, advancedKnowledge: 0, investigation: 0,
  converse: 0, deception: 0, infiltration: 0, convey: 0, performance: 0, persuasion: 0,
};
const defaultArmor = Object.fromEntries(
  ARMOR_LAYERS.map(layer => [layer, Object.fromEntries(ARMOR_SLOTS.map(slot => [slot, emptyArmorPiece()]))])
) as Record<ArmorLayer, Record<ArmorSlot, ArmorPiece>>;
const defaultInjuries = Object.fromEntries(INJURY_LOCATIONS.map(loc => [loc, [] as Exclude<InjuryLevel, 'none'>[]])) as Record<InjuryLocation, Exclude<InjuryLevel, 'none'>[]>;
const defaultLoadout = { mainHand: '', offhand: '', back1: '', back2: '', back3: '', hips4: '', hips5: '' };

export function createDefaultCharacter(
  type: 'normal' | 'gm',
  name = 'New Character', player = '',
): Character {
  const profs: Proficiency[] = [];

  return {
    id: genId(), name, player, level: 0, race: '', bodyType: '', age: '',
    disablingCharacteristics: '', inherentCharacteristics: '',
    characterType: type,
    berzerkActive: false, berzerkRound: 0,
    bonusPoints: { attribute: 0, skill: 0, ability: 0, proficiency: 0 },
    modifiers: { attributes: { ...defaultAttr }, skills: { ...defaultSkills }, abilities: 0 },
    attributes: { ...defaultAttr }, skills: { ...defaultSkills },
    abilities: [], proficiencies: profs,
    hitPoints: { current: getHPMax(0), max: getHPMax(0) },
    stamina: { current: 0, max: 0 }, mana: { current: 0, max: 0 },
    maxReactions: 3, maxHpTemp: 5, destinyPoints: 0,
    armor: defaultArmor,
    injuries: defaultInjuries,
    loadout: { loadout1: { ...defaultLoadout }, loadout2: { ...defaultLoadout } },
    inventory: [], weapons: [], bows: [], crossbows: [], notes: '', freePicksUsed: 0,
    gmModeIncreases: { attributes: {}, skills: {}, proficiencies: {} },
  };
}
