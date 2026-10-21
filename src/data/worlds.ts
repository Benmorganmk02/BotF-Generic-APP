/** Worlds and the archetypes, races and backgrounds a hero can be built from in each.
 * Mirrors the website's "Hunters of the North" module files (content/modules/...) --
 * when who-can-take-what changes there, update the lists here to match.
 *
 * Crossover rule (same as the website's picker):
 *  - a race is open to an archetype only if BOTH the archetype's `races` and the race's `archetypes` allow it
 *  - a background is open only if BOTH its `archetypes` and `races` match the chosen archetype and race
 *  - 'all' means no restriction
 * A custom hero skips these crossover rules: any archetype with any race and any
 * background (the archetype still gives its small benefit). */

export type Allow = 'all' | string[];

export interface Archetype {
  id: string;
  name: string;
  /** Short description of what this kind of hero is like. Shown when the archetype is picked. */
  guideline?: string;
  races: Allow;
}

export interface Race {
  id: string;
  name: string;
  tag?: string;
  archetypes: Allow;
}

export interface Background {
  id: string;
  name: string;
  archetypes: Allow;
  races: Allow;
}

export interface World {
  id: string;
  name: string;
  archetypes: Archetype[];
  races: Race[];
  backgrounds: Background[];
}

const allows = (list: Allow, id: string) => list === 'all' || list.includes(id);

export const raceAllowed = (a: Archetype, r: Race) => allows(a.races, r.id) && allows(r.archetypes, a.id);
export const backgroundAllowed = (b: Background, a: Archetype, r: Race) => allows(b.archetypes, a.id) && allows(b.races, r.id);

export const WORLDS: World[] = [
  {
    id: 'aetherastra',
    name: 'Aetherastra',
    archetypes: [
      { id: 'ranger', name: 'Ranger', races: ['aeltheran', 'canideran', 'halfelurai', 'felineran'] },
      { id: 'rogue', name: 'Rogue', races: ['aeltheran', 'canideran', 'halfelurai', 'felineran', 'durhennar'] },
      { id: 'soldier', name: 'Soldier', races: 'all' },
      { id: 'inquisitor', name: 'Inquisitor', races: ['aeltheran', 'durhennar', 'halfelurai'] },
      { id: 'caster', name: 'Caster', races: 'all' },
      { id: 'druid', name: 'Druid', races: ['aeltheran', 'canideran', 'halfelurai', 'felineran'] },
    ],
    races: [
      { id: 'aeltheran', name: 'Aeltheran', tag: 'Human', archetypes: 'all' },
      { id: 'canideran', name: 'Canideran', tag: 'Dog / Wolf-folk', archetypes: ['ranger', 'rogue', 'soldier', 'caster', 'druid'] },
      { id: 'durhennar', name: 'Dúrhennar', tag: 'Dwarf', archetypes: ['soldier', 'inquisitor', 'caster', 'rogue'] },
      { id: 'halfelurai', name: 'Half-Elurai', tag: 'Half-Elf', archetypes: ['ranger', 'soldier', 'inquisitor', 'caster', 'druid'] },
      { id: 'felineran', name: 'Felineran', tag: 'Cat-folk', archetypes: ['ranger', 'rogue', 'soldier', 'caster', 'druid'] },
    ],
    backgrounds: [
      { id: 'noble', name: 'Noble', archetypes: ['ranger', 'soldier', 'inquisitor', 'caster'], races: ['aeltheran', 'durhennar', 'halfelurai'] },
      { id: 'criminal', name: 'Criminal', archetypes: ['ranger', 'caster', 'rogue', 'soldier'], races: ['aeltheran', 'canideran', 'felineran'] },
      { id: 'religious-acolyte', name: 'Religious Acolyte', archetypes: ['caster', 'inquisitor'], races: ['aeltheran', 'halfelurai', 'durhennar'] },
      { id: 'village', name: 'Village', archetypes: ['ranger', 'soldier', 'caster'], races: ['aeltheran', 'canideran', 'felineran'] },
      { id: 'merchant', name: 'Merchant', archetypes: ['soldier', 'caster', 'rogue'], races: ['aeltheran', 'canideran', 'felineran', 'durhennar'] },
      { id: 'city', name: 'City', archetypes: ['rogue', 'caster', 'soldier', 'inquisitor'], races: 'all' },
      { id: 'hermit', name: 'Hermit', archetypes: ['ranger', 'druid', 'soldier', 'caster'], races: 'all' },
      { id: 'military', name: 'Military', archetypes: ['soldier', 'ranger', 'inquisitor', 'caster'], races: ['felineran', 'durhennar', 'canideran', 'aeltheran'] },
      { id: 'mercenary', name: 'Mercenary', archetypes: ['caster', 'soldier', 'rogue'], races: 'all' },
      { id: 'guard', name: 'Guard', archetypes: ['soldier', 'caster'], races: ['aeltheran', 'canideran', 'felineran'] },
      { id: 'scholar', name: 'Scholar', archetypes: ['caster', 'inquisitor'], races: 'all' },
      { id: 'wanderer', name: 'Wanderer', archetypes: ['caster', 'druid', 'ranger', 'rogue'], races: 'all' },
    ],
  },
  { id: 'malconia', name: 'Malconia', archetypes: [], races: [], backgrounds: [] },
  { id: 'world-three', name: 'Uncharted World 3', archetypes: [], races: [], backgrounds: [] },
  { id: 'world-four', name: 'Uncharted World 4', archetypes: [], races: [], backgrounds: [] },
];

export const getWorld = (id: string | undefined) => WORLDS.find(w => w.id === id);
