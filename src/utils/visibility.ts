/** How much of a campaign character other people in the campaign can see. The GM and the character's own player
 * always see everything; this is what the rest of the table gets. Each level includes the one before it. */
export type CharacterVisibility = 'hidden' | 'basic' | 'stats' | 'full';

export const VISIBILITY_LEVELS: { id: CharacterVisibility; label: string; description: string }[] = [
  { id: 'hidden', label: 'Hidden', description: "Only the GM and the character's player can see it." },
  { id: 'basic', label: 'Basics', description: 'Name, race, level, archetype and type.' },
  { id: 'stats', label: 'Stats', description: 'Basics plus attributes, skills, HP, stamina, mana, proficiencies and abilities.' },
  { id: 'full', label: 'Full sheet', description: 'The whole character sheet, view only.' },
];

export function visibilityLabel(v: string | undefined): string {
  return VISIBILITY_LEVELS.find(l => l.id === v)?.label ?? 'Hidden';
}

export function asVisibility(v: unknown): CharacterVisibility {
  return v === 'basic' || v === 'stats' || v === 'full' ? v : 'hidden';
}
