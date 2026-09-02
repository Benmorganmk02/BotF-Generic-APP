import { createContext, useContext, ReactNode } from 'react';
import { Character } from '../types/character';

interface Ctx {
  character: Character;
  setCharacter: (updater: Character | ((prev: Character) => Character)) => void;
}
const CharacterContext = createContext<Ctx | null>(null);

export function CharacterProvider({
  character, setCharacter, children,
}: { character: Character; setCharacter: (u: Character | ((p: Character) => Character)) => void; children: ReactNode }) {
  return <CharacterContext.Provider value={{ character, setCharacter }}>{children}</CharacterContext.Provider>;
}

export function useChar() {
  const ctx = useContext(CharacterContext);
  if (!ctx) throw new Error('useChar must be used within CharacterProvider');
  return ctx;
}
