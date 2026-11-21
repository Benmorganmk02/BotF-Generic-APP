import type { Character } from '../types/character';
import { INJURY_LOCATIONS } from '../types/character';
import { getHPMax, getStaminaMax, getManaMax } from './mechanics';
import { genId } from './defaults';

/** Names for copies of a character: "Bandit" gives "Bandit 2", "Bandit 3"... (and copying "Bandit 2" continues the
 * numbering), skipping any name already used in the campaign. */
export function nextCopyNames(name: string, existing: string[], count: number): string[] {
  const base = name.replace(/\s+\d+$/, '').trim() || name;
  const taken = new Set(existing.map(n => n.toLowerCase()));
  const out: string[] = [];
  for (let n = 2; out.length < count; n++) {
    const candidate = `${base} ${n}`;
    if (!taken.has(candidate.toLowerCase())) { out.push(candidate); taken.add(candidate.toLowerCase()); }
  }
  return out;
}

/** The character JSON for a fresh copy: its own id, full health, stamina and mana, no injuries, no active Berzerk,
 * turn counts at zero and full magazines. Everything else (stats, weapons, abilities) is the same. */
export function freshCopyData(data: string, name: string): string {
  const c = JSON.parse(data) as Character;
  const fresh: Character = {
    ...c,
    id: genId(), cloudId: undefined, cloudSyncedAt: undefined, name,
    hitPoints: { current: getHPMax(c.level), max: getHPMax(c.level) },
    stamina: { current: getStaminaMax(c), max: getStaminaMax(c) },
    mana: { current: getManaMax(c), max: getManaMax(c) },
    berzerkActive: false, berzerkRound: 0,
    turnStats: { total: 0, session: 0 },
    injuries: Object.fromEntries(INJURY_LOCATIONS.map(l => [l, []])) as unknown as Character['injuries'],
    // each copy's guns get their own ids, so they do not share Stabilize or magazine state
    firearms: (c.firearms ?? []).map(g => ({ ...g, id: genId(), rounds: undefined })),
  };
  return JSON.stringify(fresh);
}
