// ── Magic school & spell tree definitions ─────────────────────────────────────
// Magic abilities are stored as AbilityEntry records in the character's abilities
// array, using treeId = school id and treeAbilityId = spell ability id.

export interface MagicAbility {
  id: string;
  name: string;
  description: string;
  requiresAbilityId?: string;  // prerequisite within the same element/branch
  /** element this ability belongs to (for grouping) */
  element: string;
  /** Whether this is a base bolt spell */
  isBolt?: boolean;
  /** Whether this is a modifier (usable in spell builder) */
  isModifier?: boolean;
  /** Base mana cost when used as modifier in spell builder */
  modifierManaCost?: number;
  /** For modifiers: what the modifier does per mana in the builder */
  modifierEffect?: string;
  /** For modifiers: scaling description per additional mana */
  modifierScaling?: string;
  /** Special prerequisite function key */
  specialPrereq?: 'storm';
}

export interface MagicSchool {
  id: string;
  name: string;
  icon: string; // lucide icon name
  elements: string[]; // element groupings in display order
  abilities: MagicAbility[];
}

// ── School of Elements & Arcane ───────────────────────────────────────────────
const ELEMENTS_SCHOOL: MagicSchool = {
  id: 'elements_arcane',
  name: 'School of Elements & Arcane',
  icon: 'Flame',
  elements: ['Fire', 'Lightning', 'Frost', 'Poison', 'Arcane', 'Advanced'],
  abilities: [
    // ── Fire ──
    {
      id: 'fire_bolt',
      name: 'Fire Bolt',
      element: 'Fire',
      isBolt: true,
      description: 'Hurl a bolt of fire at a target. Costs 1 mana for 6 fire damage. Can be empowered with additional mana for +6 damage per mana.',
    },
    {
      id: 'blast',
      name: 'Blast',
      element: 'Fire',
      isModifier: true,
      modifierManaCost: 1,
      modifierEffect: 'Bolt explodes in a 10ft. circle dealing damage to all enemies in the area',
      modifierScaling: '+5ft. radius per additional mana',
      requiresAbilityId: 'fire_bolt',
      description: 'Requires Fire Bolt. Spend 1 mana to cause your elemental bolt to explode, dealing damage to anyone in a 10ft. circle. Each additional mana increases the radius by 5ft.',
    },
    // ── Lightning ──
    {
      id: 'lightning_bolt',
      name: 'Lightning Bolt',
      element: 'Lightning',
      isBolt: true,
      description: 'Hurl a bolt of lightning at a target. Costs 1 mana for 6 electric damage. Can be empowered with additional mana for +6 damage per mana.',
    },
    {
      id: 'chain',
      name: 'Chain',
      element: 'Lightning',
      isModifier: true,
      modifierManaCost: 1,
      modifierEffect: 'Bolt chains to hit 2 additional enemies',
      modifierScaling: '+2 additional enemies per extra mana',
      requiresAbilityId: 'lightning_bolt',
      description: 'Requires Lightning Bolt. Spend 1 mana to cause the bolt to chain, hitting 2 additional enemies. Each additional mana adds 2 more targets.',
    },
    // ── Frost ──
    {
      id: 'frost_bolt',
      name: 'Frost Bolt',
      element: 'Frost',
      isBolt: true,
      description: 'Hurl a bolt of frost at a target. Costs 1 mana for 6 frost damage. Can be empowered with additional mana for +6 damage per mana.',
    },
    {
      id: 'wave_cone',
      name: 'Wave / Cone',
      element: 'Frost',
      isModifier: true,
      modifierManaCost: 1,
      modifierEffect: 'Creates a 5ft. wave around you OR a 20ft. cone (choose length/width)',
      modifierScaling: '+5ft. wave / +10ft. cone per extra mana',
      requiresAbilityId: 'frost_bolt',
      description: 'Requires Frost Bolt. Spend 1 mana to create a 5ft. wave around you, or a 20ft. cone choosing the length and width. Each additional mana increases the wave by 5ft. and cone by 10ft.',
    },
    // ── Poison ──
    {
      id: 'poison_bolt',
      name: 'Poison Bolt',
      element: 'Poison',
      isBolt: true,
      description: 'Hurl a bolt of poison at a target. Costs 1 mana for 6 poison damage. Can be empowered with additional mana for +6 damage per mana.',
    },
    {
      id: 'healing',
      name: 'Healing',
      element: 'Poison',
      isBolt: true,
      requiresAbilityId: 'poison_bolt',
      description: 'Requires Poison Bolt. Costs 1 mana to heal 6 HP. Can be empowered with additional mana for +6 HP per mana. Modifiers apply their area/targeting effects to the heal.',
    },
    // ── Arcane ──
    {
      id: 'arcane_bolt',
      name: 'Arcane Bolt',
      element: 'Arcane',
      isBolt: true,
      description: 'Hurl a bolt of arcane energy at a target. Costs 1 mana for 6 arcane damage. Can be empowered with additional mana for +6 damage per mana.',
    },
    {
      id: 'shield',
      name: 'Shield',
      element: 'Arcane',
      isModifier: true,
      modifierManaCost: 1,
      modifierEffect: 'Details TBD',
      modifierScaling: 'Details TBD',
      requiresAbilityId: 'arcane_bolt',
      description: 'Requires Arcane Bolt. Shield details are pending — placeholder ability.',
    },
    // ── Advanced ──
    {
      id: 'storm',
      name: 'Storm',
      element: 'Advanced',
      isModifier: true,
      modifierManaCost: 3,
      modifierEffect: 'Massive elemental storm effect',
      modifierScaling: 'Details TBD',
      specialPrereq: 'storm',
      description: 'Requires the full Lightning tree completed AND either another full element tree completed OR 10 total elemental abilities selected.',
    },
  ],
};

// ── School of the Mind ────────────────────────────────────────────────────────
const MIND_SCHOOL: MagicSchool = {
  id: 'mind',
  name: 'School of the Mind',
  icon: 'Brain',
  elements: ['Illusions', 'Mind Affects'],
  abilities: [
    // ── Illusions ──
    {
      id: 'mind_physical_illusion',
      name: 'Create Physical Illusion',
      element: 'Illusions',
      description: 'Create a tangible illusion that can interact with the physical world.',
    },
    {
      id: 'mind_mental_illusion',
      name: 'Create Mental Illusion',
      element: 'Illusions',
      description: 'Create an illusion that exists only in the mind of the target.',
    },
    {
      id: 'mind_dynamic_illusion',
      name: 'Create Dynamic Illusion',
      element: 'Illusions',
      requiresAbilityId: 'mind_physical_illusion',
      // also requires mental illusion — handled via special logic
      description: 'Requires Physical Illusion and Mental Illusion. Create a complex illusion combining physical and mental elements.',
    },
    // ── Mind Affects ──
    {
      id: 'mind_charm',
      name: 'Charm',
      element: 'Mind Affects',
      description: 'Magically charm a target, making them friendly toward you.',
    },
    {
      id: 'mind_enthrall',
      name: 'Enthrall',
      element: 'Mind Affects',
      description: 'Captivate and hold the attention of one or more targets.',
    },
    {
      id: 'mind_dominate',
      name: 'Dominate',
      element: 'Mind Affects',
      description: 'Take control of a target\'s actions.',
    },
  ],
};

// ── School of Material ────────────────────────────────────────────────────────
const MATERIAL_SCHOOL: MagicSchool = {
  id: 'material',
  name: 'School of Material',
  icon: 'Hammer',
  elements: ['Enhance Body', 'Craftsmanship'],
  abilities: [
    // ── Enhance Body ──
    {
      id: 'mat_strength',
      name: 'Enhance Strength',
      element: 'Enhance Body',
      description: 'Magically enhance your physical strength.',
    },
    {
      id: 'mat_dexterity',
      name: 'Enhance Dexterity',
      element: 'Enhance Body',
      description: 'Magically enhance your dexterity and reflexes.',
    },
    {
      id: 'mat_durability',
      name: 'Enhance Durability',
      element: 'Enhance Body',
      description: 'Magically enhance your toughness and resilience.',
    },
    // ── Craftsmanship ──
    {
      id: 'mat_smithing',
      name: 'Smithing',
      element: 'Craftsmanship',
      description: 'Magically enhanced smithing — forge and repair metal equipment with supernatural skill.',
    },
    {
      id: 'mat_woodworking',
      name: 'Woodworking',
      element: 'Craftsmanship',
      description: 'Magically enhanced woodworking — shape and craft wood with supernatural precision.',
    },
  ],
};

// ── School of Runecraft (a sub-section of physical magic) ─────────────────────
const RUNECRAFT_SCHOOL: MagicSchool = {
  id: 'runecraft',
  name: 'School of Runecraft',
  icon: 'ScrollText',
  elements: ['Inscribing', 'Transcribing', 'Matrices', 'Scribing'],
  abilities: [
    {
      id: 'rune_inscribing',
      name: 'Inscribing Runes',
      element: 'Inscribing',
      description: 'Story prerequisites (not tracked by the app): knowing the runic language (the language of magic) and being able to use physical magic. Inscribing creates the pool of magic in a rune, etching the magic into it; any magic you have access to yourself can be imbued into a rune. Anyone can write, chisel or make runes, but only those who can inscribe can empower them. Opens three branches: Transcribing, Matrices and Scribing.',
    },
    {
      id: 'rune_transcribing',
      name: 'Transcribing',
      element: 'Transcribing',
      requiresAbilityId: 'rune_inscribing',
      description: 'Requires Inscribing Runes. Imbue magic from external sources into your runes: other magic users, magical items and magical environments.',
    },
    {
      id: 'rune_matrices_1',
      name: 'Matrices (Level 1)',
      element: 'Matrices',
      requiresAbilityId: 'rune_inscribing',
      description: 'Requires Inscribing Runes. Combine inscribed runes or runestones into a more complex spell or effect, such as a fire rune and a blast rune for a fireball, or a lightning rune and a chain rune for chain lightning. Can create any spell effect of the School of Elements & Arcane. The runes used in the casting are destroyed.',
    },
    {
      id: 'rune_matrices_2',
      name: 'Matrices (Level 2)',
      element: 'Matrices',
      requiresAbilityId: 'rune_matrices_1',
      description: 'Requires Matrices (Level 1). The runes are no longer destroyed in the casting.',
    },
    {
      id: 'rune_matrices_3',
      name: 'Matrices (Level 3)',
      element: 'Matrices',
      requiresAbilityId: 'rune_matrices_2',
      description: 'Requires Matrices (Level 2). The runes no longer need to be held, but they must be on your person and easily accessible.',
    },
    {
      id: 'rune_scribing',
      name: 'Scribing',
      element: 'Scribing',
      requiresAbilityId: 'rune_inscribing',
      description: 'Requires Inscribing Runes. Quickly draw and empower a rune with a single use, to be cast later, such as creating a spell scroll. Takes less time than inscribing a magic item.',
    },
    {
      id: 'rune_casting',
      name: 'Casting',
      element: 'Scribing',
      requiresAbilityId: 'rune_scribing',
      description: 'Requires Scribing. Quickly scribe simple runes to cast a magical effect on the spot, such as scribing a rune into the air to cast a Fire Bolt.',
    },
  ],
};

export const MAGIC_SCHOOLS: MagicSchool[] = [ELEMENTS_SCHOOL, MIND_SCHOOL, MATERIAL_SCHOOL, RUNECRAFT_SCHOOL];

// ── Helper: check Storm prerequisite ──────────────────────────────────────────
/** Lightning tree = lightning_bolt + chain. Full element tree = bolt + all its modifiers. */
export function checkStormPrereq(takenIds: Set<string>): boolean {
  // Full lightning tree
  const lightningFull = takenIds.has('lightning_bolt') && takenIds.has('chain');
  if (!lightningFull) return false;

  // Check if another full element tree is done
  const elementTrees: { bolt: string; mods: string[] }[] = [
    { bolt: 'fire_bolt', mods: ['blast'] },
    { bolt: 'frost_bolt', mods: ['wave_cone'] },
    { bolt: 'poison_bolt', mods: [] },
    { bolt: 'arcane_bolt', mods: ['shield'] },
  ];
  const anotherFull = elementTrees.some(t => takenIds.has(t.bolt) && t.mods.every(m => takenIds.has(m)));
  if (anotherFull) return true;

  // Or 10 total elemental abilities
  const allElementalIds = ELEMENTS_SCHOOL.abilities.filter(a => a.id !== 'storm').map(a => a.id);
  const count = allElementalIds.filter(id => takenIds.has(id)).length;
  return count >= 10;
}

/** Dynamic Illusion requires BOTH physical and mental illusion */
export function checkDynamicIllusionPrereq(takenIds: Set<string>): boolean {
  return takenIds.has('mind_physical_illusion') && takenIds.has('mind_mental_illusion');
}
