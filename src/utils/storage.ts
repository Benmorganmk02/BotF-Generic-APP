import { Character } from '../types/character';

const STORAGE_KEY = 'rpg_characters';
export const GUEST_MODE_KEY = 'rpg_guest_mode';

export function isGuestMode(): boolean { return localStorage.getItem(GUEST_MODE_KEY) === 'true'; }
export function setGuestMode(v: boolean) {
  if (v) localStorage.setItem(GUEST_MODE_KEY, 'true'); else localStorage.removeItem(GUEST_MODE_KEY);
}

export function getLocalCharacters(): Character[] {
  try { const r = localStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : []; } catch { return []; }
}
export function saveLocalCharacter(c: Character) {
  const chars = getLocalCharacters();
  const idx = chars.findIndex(x => x.id === c.id);
  if (idx >= 0) chars[idx] = c; else chars.push(c);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(chars));
}
export function deleteLocalCharacter(id: string) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(getLocalCharacters().filter(c => c.id !== id)));
}
export function getLocalCharacter(id: string): Character | null {
  return getLocalCharacters().find(c => c.id === id) ?? null;
}
