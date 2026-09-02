// ── Ability tree definitions ──────────────────────────────────────────────────
// Each tree is an archetype containing pre-defined abilities.
// To add new trees or abilities, edit this file only — no UI changes needed.

export interface TreeAbility {
  id: string;
  name: string;
  summary: string;          // short one-liner for the collapsed card
  description: string;      // full rules text shown on expand
  cost: string;             // e.g. "1 STA, 2 reactions"
  requiresAbilityId?: string; // tier prerequisite within the same tree
  /** When true, this ability and its prerequisite both show as separate cards (no tier collapsing) */
  stacking?: boolean;
}

export interface AbilityTree {
  id: string;
  name: string;
  icon: string; // lucide icon name
  abilities: TreeAbility[];
}

export const ABILITY_TREES: AbilityTree[] = [
  {
    id: 'open_combatant',
    name: 'Open Combatant',
    icon: 'Swords',
    abilities: [
      {
        id: 'oc_montante',
        name: 'Montante',
        summary: 'Area of denial with greatsword',
        description:
          'Greatswords: Spend a stamina point to create an area of denial, causing the attack roll to damage and push back any enemy who enters the area.',
        cost: '1 STA',
      },
      {
        id: 'oc_brutalize',
        name: 'Brutalize',
        summary: 'Terrify enemies after a devastating injury',
        description:
          'Cost 1 stamina and 1 reaction. Condition: dealing an injury level of 3 or higher. All creatures in visual range make a Wisdom (Survival) check against the victory level. On fail, they become terrified. Friendly creatures have advantage on the check. Limit of once per target.',
        cost: '1 STA, 1 reaction',
      },
      {
        id: 'oc_berzerk',
        name: 'Berzerk',
        summary: 'Double strength, ignore injuries — at a cost',
        description:
          'Cost 1 stamina (stacking) per round of combat (6 seconds) that it has been active. Condition: Any. Effect: Double your effective Strength score and ignore injury levels below 4. Ignore all damage until the effect ends. On effect end, all accumulated injuries and damage are applied.',
        cost: '1 STA/round (stacking)',
      },
    ],
  },
  {
    id: 'ranger',
    name: 'Ranger',
    icon: 'Target',
    abilities: [
      {
        id: 'rng_quickshot1',
        name: 'Quickshot I',
        summary: 'Fire a second arrow',
        description:
          'Bow: Quickly fire a second arrow in succession at the cost of one stamina point and two reactions.',
        cost: '1 STA, 2 reactions',
      },
      {
        id: 'rng_quickshot2',
        name: 'Quickshot II',
        summary: 'Fire 2 extra arrows',
        description:
          'Bow: Fire 2 extra arrows at the cost of one stamina point per extra arrow. The first extra arrow costs 1 reaction, the second costs 2 reactions.',
        cost: '1 STA/arrow, 1+2 reactions',
        requiresAbilityId: 'rng_quickshot1',
      },
      {
        id: 'rng_quickshot3',
        name: 'Quickshot III',
        summary: 'Fire extra arrows efficiently',
        description:
          'Bow: Fire extra arrows at the cost of 1 stamina point and 1 reaction per arrow. The most efficient form of rapid fire.',
        cost: '1 STA + 1 reaction/arrow',
        requiresAbilityId: 'rng_quickshot2',
      },
      {
        id: 'rng_multishot',
        name: 'Multishot',
        summary: 'Hit multiple nearby targets',
        description:
          'Bow: Fire multiple arrows from a single shot at multiple targets that are near each other. The attack damage is divided by how many arrows are fired.',
        cost: '1 STA',
      },
      {
        id: 'rng_identify_weakpoint',
        name: 'Identify Weakpoint',
        stacking: true,
        summary: 'Spot a flaw in the target\'s defense',
        description:
          'Cost 1 stamina and 1 reaction. Condition: Line of sight and prior knowledge of the target\'s defense style or armor weakness. Roll a relevant Perception check against their weapon proficiency, weapon bonus, and relevant armor value. On success, the next targeted attack against the weakpoint has advantage and only costs 1 stamina to target.',
        cost: '1 STA, 1 reaction',
      },
      {
        id: 'rng_exploit_weakpoint',
        name: 'Exploit Weakpoint',
        stacking: true,
        summary: 'Reduce target\'s armor or weapon bonus',
        description:
          'Cost 1 stamina and 1 reaction. Condition: User has successfully identified a weakpoint but has not yet attacked it. The targeted weakpoint attack reduces the target\'s relevant armor value or weapon bonus by the user\'s weapon bonus for that attack.',
        cost: '1 STA, 1 reaction',
        requiresAbilityId: 'rng_identify_weakpoint',
      },
    ],
  },
  {
    id: 'specialist',
    name: 'Specialist',
    icon: 'EyeOff',
    abilities: [],
  },
  {
    id: 'zealot',
    name: 'Zealot',
    icon: 'Flame',
    abilities: [],
  },
  {
    id: 'druid',
    name: 'Druid',
    icon: 'Leaf',
    abilities: [],
  },
];
