import { supabase } from '@/lib/supabaseClient';

const TYPE_TO_DB: Record<string, 'Normal' | 'GM/NPC'> = {
  normal: 'Normal',
  gm: 'GM/NPC',
};
const TYPE_FROM_DB: Record<string, string> = {
  Normal: 'normal',
  'GM/NPC': 'gm',
};

export interface CloudCharacter {
  cloudId: string;
  name: string;
  characterType: string;
  level: number;
  data: string;
}

export interface GetCharactersOutputType {
  characters: CloudCharacter[];
}

export async function getCharacters(): Promise<{ characters: CloudCharacter[] }> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('characters')
    .select('*')
    .eq('owner', userData.user.id);

  if (error) throw error;

  return {
    characters: (data ?? []).map((r) => ({
      cloudId: r.id,
      name: r.character_name ?? 'Unnamed',
      characterType: TYPE_FROM_DB[r.character_type] ?? 'normal',
      level: r.level ?? 0,
      data: r.character_data ?? '{}',
    })),
  };
}

export async function saveCharacter(input: {
  cloudId?: string;
  name: string;
  characterType: string;
  level: number;
  data: string;
}): Promise<{ cloudId: string }> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error('Not authenticated');

  const fields = {
    character_name: input.name,
    character_type: TYPE_TO_DB[input.characterType] ?? 'Normal',
    level: input.level,
    character_data: input.data,
    updated_at: new Date().toISOString(),
  };

  if (input.cloudId) {
    const { error } = await supabase.from('characters').update(fields).eq('id', input.cloudId);
    if (error) throw error;
    return { cloudId: input.cloudId };
  } else {
    const { data, error } = await supabase
      .from('characters')
      .insert({ ...fields, owner: userData.user.id })
      .select('id')
      .single();
    if (error) throw error;
    return { cloudId: data.id };
  }
}

/** Narrow write used mid-duel to spend a resource (e.g. Form II's 1 STA
 * match bonus) without re-submitting the whole character sheet -- avoids
 * clobbering name/type/level with whatever the caller happened to have
 * locally cached. RLS restricts this to your own character row, same as
 * saveCharacter. */
export async function updateCharacterData(input: { cloudId: string; data: string }): Promise<void> {
  const { error } = await supabase
    .from('characters')
    .update({ character_data: input.data, updated_at: new Date().toISOString() })
    .eq('id', input.cloudId);
  if (error) throw error;
}

export async function deleteCharacter(input: { cloudId: string }): Promise<{ success: boolean }> {
  const { error } = await supabase.from('characters').delete().eq('id', input.cloudId);
  if (error) throw error;
  return { success: true };
}
