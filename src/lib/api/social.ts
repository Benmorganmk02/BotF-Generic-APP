import { supabase } from '@/lib/supabaseClient';

const TYPE_TO_DB: Record<string, 'Normal' | 'GM/NPC'> = {
  normal: 'Normal',
  gm: 'GM/NPC',
};
const TYPE_FROM_DB: Record<string, string> = {
  Normal: 'normal',
  'GM/NPC': 'gm',
};

async function requireUser() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('Not authenticated');
  return data.user;
}

async function fetchProfiles(ids: string[]) {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (uniqueIds.length === 0) return new Map<string, { id: string; email: string; firstName?: string; lastName?: string }>();
  const { data, error } = await supabase.from('profiles').select('*').in('id', uniqueIds);
  if (error) throw error;
  const map = new Map<string, { id: string; email: string; firstName?: string; lastName?: string }>();
  (data ?? []).forEach((p) => map.set(p.id, { id: p.id, email: p.email, firstName: p.first_name ?? undefined, lastName: p.last_name ?? undefined }));
  return map;
}

// ---------------------------------------------------------------------------
// Friends
// ---------------------------------------------------------------------------

export type FriendUser = { id: string; email: string; firstName?: string; lastName?: string };
export interface GetFriendRequestsOutputType {
  incoming: { requestId: string; sender: FriendUser }[];
  friends: { requestId: string; friend: FriendUser }[];
  sentInvites: { requestId: string; email: string }[];
}

export async function getFriendRequests(): Promise<GetFriendRequestsOutputType> {
  const user = await requireUser();
  const myEmail = (user.email ?? '').toLowerCase();

  // Auto-link any email-only invites that match my email
  const { data: pendingForMe } = await supabase
    .from('friend_requests')
    .select('*')
    .eq('receiver_email', myEmail)
    .eq('status', 'pending')
    .is('receiver', null);
  if (pendingForMe && pendingForMe.length > 0) {
    await Promise.all(
      pendingForMe.map((r) => supabase.from('friend_requests').update({ receiver: user.id, receiver_email: null }).eq('id', r.id)),
    );
  }

  const [{ data: pendingIn }, { data: acceptedSent }, { data: acceptedRecv }, { data: myInvites }] = await Promise.all([
    supabase.from('friend_requests').select('*').eq('receiver', user.id).eq('status', 'pending'),
    supabase.from('friend_requests').select('*').eq('sender', user.id).eq('status', 'accepted'),
    supabase.from('friend_requests').select('*').eq('receiver', user.id).eq('status', 'accepted'),
    supabase.from('friend_requests').select('*').eq('sender', user.id).eq('status', 'pending').is('receiver', null),
  ]);

  const sentInvites = (myInvites ?? [])
    .filter((r) => r.receiver_email)
    .map((r) => ({ requestId: r.id, email: r.receiver_email! }));

  const userIds = [
    ...(pendingIn ?? []).map((r) => r.sender),
    ...(acceptedSent ?? []).map((r) => r.receiver!),
    ...(acceptedRecv ?? []).map((r) => r.sender),
  ];
  const profiles = await fetchProfiles(userIds);

  const incoming = (pendingIn ?? [])
    .map((r) => {
      const sender = profiles.get(r.sender);
      return sender ? { requestId: r.id, sender } : null;
    })
    .filter(Boolean) as GetFriendRequestsOutputType['incoming'];

  const friends = [
    ...(acceptedSent ?? []).map((r) => {
      const friend = r.receiver ? profiles.get(r.receiver) : undefined;
      return friend ? { requestId: r.id, friend } : null;
    }),
    ...(acceptedRecv ?? []).map((r) => {
      const friend = profiles.get(r.sender);
      return friend ? { requestId: r.id, friend } : null;
    }),
  ].filter(Boolean) as GetFriendRequestsOutputType['friends'];

  return { incoming, friends, sentInvites };
}

export async function sendFriendRequest(input: { email: string }): Promise<{ success: boolean; message: string }> {
  const user = await requireUser();
  const normalizedEmail = input.email.trim().toLowerCase();
  const myEmail = (user.email ?? '').toLowerCase();

  if (normalizedEmail === myEmail) {
    return { success: false, message: 'You cannot send a friend request to yourself.' };
  }

  const { data: target } = await supabase.from('profiles').select('*').ilike('email', normalizedEmail).maybeSingle();

  if (target) {
    const [{ data: existing }, { data: reverse }] = await Promise.all([
      supabase.from('friend_requests').select('*').eq('sender', user.id).eq('receiver', target.id),
      supabase.from('friend_requests').select('*').eq('sender', target.id).eq('receiver', user.id),
    ]);
    const all = [...(existing ?? []), ...(reverse ?? [])];
    if (all.find((r) => r.status === 'accepted')) return { success: false, message: 'You are already friends with this user.' };
    if (all.find((r) => r.status === 'pending')) return { success: false, message: 'A friend request already exists with this user.' };

    const { error } = await supabase.from('friend_requests').insert({ sender: user.id, receiver: target.id, status: 'pending' });
    if (error) throw error;
    return { success: true, message: `Friend request sent to ${input.email}!` };
  }

  const { data: existingInvites } = await supabase
    .from('friend_requests')
    .select('*')
    .eq('sender', user.id)
    .eq('receiver_email', normalizedEmail)
    .eq('status', 'pending');
  if (existingInvites && existingInvites.length > 0) {
    return { success: false, message: 'You have already invited this email address.' };
  }

  const { error } = await supabase.from('friend_requests').insert({ sender: user.id, receiver_email: normalizedEmail, status: 'pending' });
  if (error) throw error;
  return { success: true, message: `Invite sent to ${input.email}. They'll see your request when they sign up!` };
}

export async function respondFriendRequest(input: { requestId: string; accept: boolean }): Promise<{ success: boolean }> {
  const { error } = await supabase
    .from('friend_requests')
    .update({ status: input.accept ? 'accepted' : 'declined' })
    .eq('id', input.requestId);
  if (error) throw error;
  return { success: true };
}

export async function removeFriend(input: { requestId: string }): Promise<{ success: boolean }> {
  const { error } = await supabase.from('friend_requests').delete().eq('id', input.requestId);
  if (error) throw error;
  return { success: true };
}

export async function getFriendCharacters(input: { friendId: string }): Promise<{
  characters: { cloudId: string; name: string; characterType: string; level: number; data: string }[];
}> {
  const { data, error } = await supabase.from('characters').select('*').eq('owner', input.friendId);
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

// ---------------------------------------------------------------------------
// Campaigns
// ---------------------------------------------------------------------------

export interface GetCampaignsOutputType {
  campaigns: { id: string; name: string; isGM: boolean; gmEmail?: string; characterCount: number }[];
}

export async function getCampaigns(): Promise<GetCampaignsOutputType> {
  const user = await requireUser();

  const [{ data: gmCampaigns }, { data: myChars }, { data: memberCampaigns }] = await Promise.all([
    supabase.from('campaigns').select('*').eq('gm', user.id),
    supabase.from('campaign_characters').select('campaign').eq('player', user.id),
    supabase.from('campaigns').select('*').contains('members', [user.id]),
  ]);

  const gmCampaignIds = new Set((gmCampaigns ?? []).map((c) => c.id));
  const playerCampaignIds = [...new Set((myChars ?? []).map((cc) => cc.campaign))];
  const memberCampaignIds = (memberCampaigns ?? []).map((c) => c.id);
  const playerOrMemberIds = [...new Set([...playerCampaignIds, ...memberCampaignIds])].filter((id) => !gmCampaignIds.has(id));

  const { data: playerCampaignRecords } = playerOrMemberIds.length
    ? await supabase.from('campaigns').select('*').in('id', playerOrMemberIds)
    : { data: [] };

  const allCampaignIds = [...gmCampaignIds, ...playerOrMemberIds];
  const charCounts = new Map<string, number>();
  await Promise.all(
    allCampaignIds.map(async (campaignId) => {
      const { count } = await supabase.from('campaign_characters').select('id', { count: 'exact', head: true }).eq('campaign', campaignId);
      charCounts.set(campaignId, count ?? 0);
    }),
  );

  const gmUserIds = (playerCampaignRecords ?? []).map((c) => c.gm);
  const gmProfiles = await fetchProfiles(gmUserIds);

  const gmResult = (gmCampaigns ?? []).map((c) => ({
    id: c.id,
    name: c.campaign_name ?? 'Unnamed',
    isGM: true,
    characterCount: charCounts.get(c.id) ?? 0,
  }));

  const playerResult = (playerCampaignRecords ?? []).map((c) => ({
    id: c.id,
    name: c.campaign_name ?? 'Unnamed',
    isGM: false,
    gmEmail: gmProfiles.get(c.gm)?.email,
    characterCount: charCounts.get(c.id) ?? 0,
  }));

  return { campaigns: [...gmResult, ...playerResult] };
}

export async function createCampaign(input: { name: string }): Promise<{ campaignId: string; name: string }> {
  const user = await requireUser();
  const { data, error } = await supabase
    .from('campaigns')
    .insert({ campaign_name: input.name, gm: user.id })
    .select('*')
    .single();
  if (error) throw error;
  return { campaignId: data.id, name: data.campaign_name };
}

export async function deleteCampaign(input: { campaignId: string }): Promise<{ success: boolean }> {
  await supabase.from('campaign_characters').delete().eq('campaign', input.campaignId);
  const { error } = await supabase.from('campaigns').delete().eq('id', input.campaignId);
  if (error) throw error;
  return { success: true };
}

export interface GetCampaignCharactersOutputType {
  campaign: { id: string; name: string; isGM: boolean; isInvitedMember: boolean; invitedMembers: { id: string; email: string }[] };
  characters: {
    id: string;
    name: string;
    characterType: string;
    level: number;
    data: string;
    playerId: string;
    playerEmail: string;
    canEdit: boolean;
    isUnassigned: boolean;
  }[];
}

export async function getCampaignCharacters(input: { campaignId: string }): Promise<GetCampaignCharactersOutputType> {
  const user = await requireUser();
  const { data: campaign, error: campaignErr } = await supabase.from('campaigns').select('*').eq('id', input.campaignId).single();
  if (campaignErr || !campaign) throw new Error('Campaign not found.');

  const isGM = campaign.gm === user.id;
  const members = campaign.members ?? [];
  const isMember = members.includes(user.id);

  const { data: allCc } = await supabase.from('campaign_characters').select('*').eq('campaign', input.campaignId);

  if (!isGM && !isMember) {
    const hasChar = (allCc ?? []).some((cc) => cc.player === user.id);
    if (!hasChar) throw new Error('You are not part of this campaign.');
  }

  const playerIds = [...new Set((allCc ?? []).map((cc) => cc.player).filter(Boolean))];
  const playerProfiles = await fetchProfiles(playerIds);

  let invitedMembers: { id: string; email: string }[] = [];
  if (isGM && members.length > 0) {
    const memberProfiles = await fetchProfiles(members);
    invitedMembers = [...memberProfiles.values()].map((p) => ({ id: p.id, email: p.email }));
  }

  const characters = (allCc ?? []).map((cc) => {
    const playerId = cc.player ?? '';
    const isUnassigned = !playerId;
    const canEdit = isGM || playerId === user.id;

    let level = 0;
    let characterType = 'normal';
    try {
      const parsed = JSON.parse(cc.character_data ?? '{}');
      level = parsed.level ?? 0;
      characterType = parsed.characterType ?? 'normal';
    } catch {
      /* ignore */
    }

    return {
      id: cc.id,
      name: cc.character_name ?? 'Unnamed',
      characterType,
      level,
      data: cc.character_data ?? '{}',
      playerId,
      playerEmail: isUnassigned ? '' : playerProfiles.get(playerId)?.email ?? playerId,
      canEdit,
      isUnassigned,
    };
  });

  return {
    campaign: { id: campaign.id, name: campaign.campaign_name ?? 'Unnamed', isGM, isInvitedMember: isMember, invitedMembers },
    characters,
  };
}

async function areFriends(userIdA: string, userIdB: string): Promise<boolean> {
  const [{ data: sent }, { data: recv }] = await Promise.all([
    supabase.from('friend_requests').select('id').eq('sender', userIdA).eq('receiver', userIdB).eq('status', 'accepted'),
    supabase.from('friend_requests').select('id').eq('sender', userIdB).eq('receiver', userIdA).eq('status', 'accepted'),
  ]);
  return (sent?.length ?? 0) > 0 || (recv?.length ?? 0) > 0;
}

export async function addCharacterToCampaign(input: { campaignId: string; characterId: string }): Promise<{ campaignCharacterId: string }> {
  const user = await requireUser();
  const { data: campaign } = await supabase.from('campaigns').select('*').eq('id', input.campaignId).single();
  if (!campaign) throw new Error('Campaign not found.');
  if (campaign.gm !== user.id) throw new Error('Only the GM can add characters to this campaign.');

  const { data: original } = await supabase.from('characters').select('*').eq('id', input.characterId).single();
  if (!original) throw new Error('Character not found.');

  if (original.owner !== user.id && !(await areFriends(user.id, original.owner))) {
    throw new Error('You can only add characters from friends.');
  }

  const { data: existing } = await supabase
    .from('campaign_characters')
    .select('id')
    .eq('campaign', input.campaignId)
    .eq('original_character', input.characterId);
  if (existing && existing.length > 0) throw new Error('This character is already in the campaign.');

  const { data: cc, error } = await supabase
    .from('campaign_characters')
    .insert({
      character_name: original.character_name,
      campaign: input.campaignId,
      original_character: input.characterId,
      player: original.owner,
      character_data: original.character_data ?? '{}',
    })
    .select('id')
    .single();
  if (error) throw error;
  return { campaignCharacterId: cc.id };
}

export async function addMyCharacterToCampaign(input: { campaignId: string; characterId: string }): Promise<{ campaignCharacterId: string }> {
  const user = await requireUser();
  const { data: campaign } = await supabase.from('campaigns').select('*').eq('id', input.campaignId).single();
  if (!campaign) throw new Error('Campaign not found.');

  const isGM = campaign.gm === user.id;
  const isMember = (campaign.members ?? []).includes(user.id);
  if (!isGM && !isMember) throw new Error('You are not a member of this campaign.');

  const { data: character } = await supabase.from('characters').select('*').eq('id', input.characterId).single();
  if (!character) throw new Error('Character not found.');
  if (character.owner !== user.id) throw new Error('You can only add your own characters.');

  const { data: existing } = await supabase
    .from('campaign_characters')
    .select('id')
    .eq('campaign', input.campaignId)
    .eq('original_character', input.characterId);
  if (existing && existing.length > 0) throw new Error('This character is already in the campaign.');

  const { data: cc, error } = await supabase
    .from('campaign_characters')
    .insert({
      character_name: character.character_name,
      campaign: input.campaignId,
      original_character: input.characterId,
      player: user.id,
      character_data: character.character_data ?? '{}',
    })
    .select('id')
    .single();
  if (error) throw error;
  return { campaignCharacterId: cc.id };
}

export async function assignCampaignCharacter(input: { campaignCharacterId: string; assigneeId: string }): Promise<{ success: boolean }> {
  const user = await requireUser();
  const { data: cc } = await supabase.from('campaign_characters').select('*').eq('id', input.campaignCharacterId).single();
  if (!cc) throw new Error('Campaign character not found.');

  const { data: campaign } = await supabase.from('campaigns').select('*').eq('id', cc.campaign).single();
  if (!campaign || campaign.gm !== user.id) throw new Error('Only the GM can assign characters.');
  if (cc.player) throw new Error('This character is already assigned to a player.');

  if (input.assigneeId !== user.id && !(await areFriends(user.id, input.assigneeId))) {
    throw new Error('You can only assign characters to friends.');
  }

  let charTypeKey = 'normal';
  try {
    charTypeKey = JSON.parse(cc.character_data ?? '{}').characterType ?? 'normal';
  } catch {
    /* ignore */
  }

  const { data: character, error: createErr } = await supabase
    .from('characters')
    .insert({
      character_name: cc.character_name,
      character_type: TYPE_TO_DB[charTypeKey] ?? 'Normal',
      level: 0,
      character_data: cc.character_data ?? '{}',
      owner: input.assigneeId,
    })
    .select('id')
    .single();
  if (createErr) throw createErr;

  const { error } = await supabase
    .from('campaign_characters')
    .update({ player: input.assigneeId, original_character: character.id })
    .eq('id', input.campaignCharacterId);
  if (error) throw error;
  return { success: true };
}

export async function createAndAssignCharacter(input: {
  campaignId: string;
  assigneeId?: string;
  name: string;
  playerName?: string;
  characterType: string;
  data: string;
}): Promise<{ campaignCharacterId: string }> {
  const user = await requireUser();
  const { data: campaign } = await supabase.from('campaigns').select('*').eq('id', input.campaignId).single();
  if (!campaign || campaign.gm !== user.id) throw new Error('Only the GM can create and assign characters.');

  if (input.assigneeId && input.assigneeId !== user.id && !(await areFriends(user.id, input.assigneeId))) {
    throw new Error('You can only assign characters to friends.');
  }

  let originalCharacterId: string | undefined;
  if (input.assigneeId) {
    const { data: character, error } = await supabase
      .from('characters')
      .insert({
        character_name: input.name,
        character_type: TYPE_TO_DB[input.characterType] ?? 'Normal',
        level: 0,
        character_data: input.data,
        owner: input.assigneeId,
      })
      .select('id')
      .single();
    if (error) throw error;
    originalCharacterId = character.id;
  }

  const { data: cc, error } = await supabase
    .from('campaign_characters')
    .insert({
      character_name: input.name,
      campaign: input.campaignId,
      ...(originalCharacterId ? { original_character: originalCharacterId } : {}),
      ...(input.assigneeId ? { player: input.assigneeId } : {}),
      character_data: input.data,
    })
    .select('id')
    .single();
  if (error) throw error;
  return { campaignCharacterId: cc.id };
}

export async function invitePlayerToCampaign(input: { campaignId: string; friendUserId: string }): Promise<{ success: boolean }> {
  const user = await requireUser();
  const { data: campaign } = await supabase.from('campaigns').select('*').eq('id', input.campaignId).single();
  if (!campaign || campaign.gm !== user.id) throw new Error('Only the GM can invite players.');

  const existing = campaign.members ?? [];
  if (existing.includes(input.friendUserId)) return { success: true };

  const { error } = await supabase.from('campaigns').update({ members: [...existing, input.friendUserId] }).eq('id', input.campaignId);
  if (error) throw error;
  return { success: true };
}

export async function removeCampaignCharacter(input: { campaignCharacterId: string }): Promise<{ success: boolean }> {
  const { error } = await supabase.from('campaign_characters').delete().eq('id', input.campaignCharacterId);
  if (error) throw error;
  return { success: true };
}

export async function saveCampaignCharacter(input: {
  campaignCharacterId: string;
  name: string;
  characterType: string;
  level: number;
  data: string;
}): Promise<{ success: boolean }> {
  const { error } = await supabase
    .from('campaign_characters')
    .update({ character_name: input.name, character_data: input.data, updated_at: new Date().toISOString() })
    .eq('id', input.campaignCharacterId);
  if (error) throw error;
  return { success: true };
}
