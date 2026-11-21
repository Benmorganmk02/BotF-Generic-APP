import type { Character } from '../types/character';

/** What counts as a change worth saving: the character without its cloud bookkeeping. Auto-save compares this
 * before and after to know whether anything changed. */
export const changeSig = (c: Character): string => JSON.stringify({ ...c, cloudId: undefined, cloudSyncedAt: undefined });
