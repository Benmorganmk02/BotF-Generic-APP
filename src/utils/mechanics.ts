import { Character, AttributeKey, SkillKey, Proficiency, Bow, Crossbow, SKILL_TO_ATTR } from '../types/character';
import { getBowWeaponBonus, getCrossbowWeaponBonus } from './rangedData';

export const PRIME_COSTS = [1, 2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47];

export function calcCostToLevel(level: number, sp: 0 | 1 = 0): number {
  if (level <= 0) return 0;
  let total = 0;
  for (let i = 0; i < level; i++) total += PRIME_COSTS[sp + i] ?? PRIME_COSTS[PRIME_COSTS.length - 1];
  return total;
}

function spentContrib(v: number, sp: 0 | 1): number {
  if (v > 0) return calcCostToLevel(v, sp);
  if (v < 0) return -calcCostToLevel(-v, sp);
  return 0;
}

export function getStatChangeCost(base: number, delta: 1 | -1, sp: 0 | 1 = 0): number {
  return spentContrib(base + delta, sp) - spentContrib(base, sp);
}

export function getBaseAttrPts(lvl: number) { return 6 + lvl * 6; }
export function getBaseSkillPts(lvl: number) { return 12 + lvl * 8; }
export function getBaseAbilityPts(lvl: number) { return 2 + lvl; }
export function getBaseProfPts(lvl: number) {
  let pts = 5;
  for (let i = 1; i <= lvl; i++) pts += i % 2 === 1 ? 4 : 5;
  return pts;
}

export function effAttr(c: Character, k: AttributeKey): number { return c.attributes[k] + c.modifiers.attributes[k]; }
/** Combat-effective STR — doubled when Berzerk is active. Use for attack formulas only, not resource pools. */
export function combatStr(c: Character): number {
  const base = effAttr(c, 'str');
  return c.berzerkActive ? base * 2 : base;
}
export function effSkill(c: Character, k: SkillKey): number { return c.skills[k] + c.modifiers.skills[k]; }

// Stamina/Mana both have a floor of 3, regardless of how low the underlying
// attribute/skill math would otherwise push them (e.g. negative modifiers).
export function getManaMax(c: Character): number {
  return Math.max(3, 3 + effAttr(c, 'int') + effSkill(c, 'advancedKnowledge'), 3 + effAttr(c, 'wis') + effSkill(c, 'intuition'));
}
export function getStaminaMax(c: Character): number { return Math.max(3, 3 + effAttr(c, 'str') + effSkill(c, 'endurance')); }
export function getHPMax(lvl: number): number { return 200 + lvl * 10; }

function getSpentAttrPts(c: Character): number {
  let s = 0;
  for (const k of Object.keys(c.attributes) as AttributeKey[]) { const v = c.attributes[k]; s += spentContrib(v, 0); }
  return s;
}
function getSpentSkillPts(c: Character): number {
  let s = 0;
  for (const k of Object.keys(c.skills) as SkillKey[]) { const v = c.skills[k]; s += spentContrib(v, 0); }
  return s;
}
function getSpentProfPts(c: Character): number {
  let s = 0;
  for (const p of c.proficiencies) {
    if (p.level > 0) s += Math.max(0, calcCostToLevel(p.level, p.startingPrime) - calcCostToLevel(p.freeLevel ?? 0, p.startingPrime));
  }
  return s;
}

export function getAvailAttrPts(c: Character): number {
  if (c.characterType === 'gm') return Infinity;
  return getBaseAttrPts(c.level) + c.bonusPoints.attribute - getSpentAttrPts(c);
}
export function getAvailSkillPts(c: Character): number {
  if (c.characterType === 'gm') return Infinity;
  return getBaseSkillPts(c.level) + c.bonusPoints.skill - getSpentSkillPts(c);
}
export function getAvailAbilityPts(c: Character): number {
  if (c.characterType === 'gm') return Infinity;
  return getBaseAbilityPts(c.level) + c.bonusPoints.ability + c.modifiers.abilities - c.abilities.length;
}
export function getAvailProfPts(c: Character): number {
  if (c.characterType === 'gm') return Infinity;
  return getBaseProfPts(c.level) + c.bonusPoints.proficiency - getSpentProfPts(c);
}

export function getSkillTotalDice(c: Character, k: SkillKey): number {
  return 3 + effAttr(c, SKILL_TO_ATTR[k]) + effSkill(c, k);
}
export function getProfDice(c: Character, p: Proficiency): number {
  if ((p.profType === 'weapon' || p.profType === 'bow') && p.physicalStat && p.mentalStat) {
    const phys = p.physicalStat === 'str' ? combatStr(c) : effAttr(c, p.physicalStat);
    return Math.max(0, 3 + phys + effAttr(c, p.mentalStat) + p.level + p.modifier + p.itemBonus);
  }
  let d = 3 + p.level + p.modifier + p.itemBonus;
  for (const ak of p.attributes) d += effAttr(c, ak);
  for (const sk of p.skills) d += effSkill(c, sk);
  return Math.max(0, d);
}
// ── Ranged weapon dice formulas ───────────────────────────────────────────────

/** Bow aim = 3 + weaponBonus + (prof level+mod+item) + DEX */
export function getBowAimDice(c: Character, bow: Bow, prof?: Proficiency): number {
  const wBonus = getBowWeaponBonus(bow.drawWeight);
  const profBonus = prof ? prof.level + prof.modifier + prof.itemBonus : 0;
  return Math.max(0, 3 + wBonus + profBonus + effAttr(c, 'dex'));
}

/** Bow attack = getProfDice (3 + STR + INT/DEX + level + mod + item), or 3+STR if no prof */
export function getBowAttackDice(c: Character, prof?: Proficiency): number {
  if (!prof) return Math.max(0, 3 + combatStr(c));
  return getProfDice(c, prof);
}

/** Crossbow aim = 3 + weaponBonus + (prof level+mod+item) + DEX */
export function getCrossbowAimDice(c: Character, xbow: Crossbow, prof?: Proficiency): number {
  const wBonus = getCrossbowWeaponBonus(xbow.drawWeight);
  const profBonus = prof ? prof.level + prof.modifier + prof.itemBonus : 0;
  return Math.max(0, 3 + wBonus + profBonus + effAttr(c, 'dex'));
}

/** Crossbow attack = 3 + INT + DEX (flat, no proficiency bonus) */
export function getCrossbowAttackDice(c: Character): number {
  return Math.max(0, 3 + effAttr(c, 'int') + effAttr(c, 'dex'));
}

/** Reactions = 1 base + floor((STR + DEX + WIS + INT raw) / 8) */
export function getReactionCount(c: Character): number {
  return 1 + Math.floor((c.attributes.str + c.attributes.dex + c.attributes.wis + c.attributes.int) / 8);
}
