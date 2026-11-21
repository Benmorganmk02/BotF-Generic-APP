import { useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';

const DAY_MS = 24 * 60 * 60 * 1000;

function read<T>(key: string | null): T | undefined {
  if (!key) return undefined;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return undefined;
    const { v, t } = JSON.parse(raw) as { v: T; t: number };
    return Date.now() - t > DAY_MS ? undefined : v; // a day-old combat is not coming back
  } catch { return undefined; }
}

/** useState that survives a page reload (kept in localStorage under `key`, for up to a day). It is for table state
 * that is not part of the saved character, like the combat turn and the spent actions, so reloading or updating the
 * app mid-combat does not lose it. Pass null to turn it off. */
export function usePersistedState<T>(key: string | null, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => read<T>(key) ?? initial);
  useEffect(() => {
    if (!key) return;
    try { localStorage.setItem(key, JSON.stringify({ v: value, t: Date.now() })); } catch { /* not persisted */ }
  }, [key, value]);
  return [value, setValue];
}
