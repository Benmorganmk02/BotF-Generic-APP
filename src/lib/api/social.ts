import { supabase } from '@/lib/supabaseClient';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { asVisibility } from '../../utils/visibility';
import { nextCopyNames, freshCopyData } from '../../utils/duplicateCharacter';
import { parseBattle } from '../../utils/battle';
import type { BattleState } from '../../utils/battle';
import type { CharacterVisibility } from '../../utils/visibility';

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
  campaigns: { id: string; name: string; world?: string; isGM: boolean; gmEmail?: string; characterCount: number }[];
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
    world: c.world ?? undefined,
    isGM: true,
    characterCount: charCounts.get(c.id) ?? 0,
  }));

  const playerResult = (playerCampaignRecords ?? []).map((c) => ({
    id: c.id,
    name: c.campaign_name ?? 'Unnamed',
    world: c.world ?? undefined,
    isGM: false,
    gmEmail: gmProfiles.get(c.gm)?.email,
    characterCount: charCounts.get(c.id) ?? 0,
  }));

  return { campaigns: [...gmResult, ...playerResult] };
}

export async function createCampaign(input: { name: string; world?: string }): Promise<{ campaignId: string; name: string }> {
  const user = await requireUser();
  const { data, error } = await supabase
    .from('campaigns')
    .insert({ campaign_name: input.name, gm: user.id, ...(input.world ? { world: input.world } : {}) })
    .select('*')
    .single();
  if (error) {
    if (/world/i.test(error.message)) throw new Error('Run supabase/campaign-world.sql in the Supabase SQL editor first.');
    throw error;
  }
  return { campaignId: data.id, name: data.campaign_name };
}

export async function deleteCampaign(input: { campaignId: string }): Promise<{ success: boolean }> {
  await supabase.from('campaign_characters').delete().eq('campaign', input.campaignId);
  const { error } = await supabase.from('campaigns').delete().eq('id', input.campaignId);
  if (error) throw error;
  return { success: true };
}

export interface GetCampaignCharactersOutputType {
  campaign: { id: string; name: string; world?: string; isGM: boolean; isInvitedMember: boolean; invitedMembers: { id: string; email: string }[] };
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
    /** How much of this character the rest of the campaign can see. */
    visibility: CharacterVisibility;
    /** The GM marked it as an NPC for this campaign (GM/NPC characters count as NPCs without it). */
    isNpc: boolean;
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
      visibility: asVisibility((cc as { visibility?: unknown }).visibility),
      isNpc: (cc as { is_npc?: unknown }).is_npc === true,
    };
  });

  return {
    campaign: { id: campaign.id, name: campaign.campaign_name ?? 'Unnamed', world: campaign.world ?? undefined, isGM, isInvitedMember: isMember, invitedMembers },
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

const VISIBILITY_SETUP_HINT = 'Run supabase/campaign-visibility.sql in the Supabase SQL editor first.';

/** Set how much of a campaign character the rest of the campaign can see (the GM, or the character's own player). */
export async function setCampaignCharacterVisibility(input: { campaignCharacterId: string; visibility: CharacterVisibility }): Promise<{ success: boolean }> {
  const { data, error } = await supabase.from('campaign_characters')
    .update({ visibility: input.visibility })
    .eq('id', input.campaignCharacterId)
    .select('id');
  if (error) {
    if (/visibility/i.test(error.message)) throw new Error(VISIBILITY_SETUP_HINT);
    throw error;
  }
  if (!data || data.length === 0) throw new Error('You cannot change who sees this character.');
  return { success: true };
}

/** The campaign's battle map state (null when there is none). Players poll this to see combat start and tokens move. */
export async function getBattle(input: { campaignId: string }): Promise<BattleState | null> {
  const { data, error } = await supabase.from('campaigns').select('*').eq('id', input.campaignId).single();
  if (error || !data) throw new Error('Campaign not found.');
  return parseBattle((data as { battle?: unknown }).battle);
}

/** Live updates for the campaign row (the battle map): `onChange` runs the moment the GM changes it, the same way the
 * duels push moves to the other player. Returns an unsubscribe function; call it on unmount. */
export function subscribeToCampaign(campaignId: string, onChange: () => void): () => void {
  const channel: RealtimeChannel = supabase
    .channel(`campaign:${campaignId}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'campaigns', filter: `id=eq.${campaignId}` }, () => onChange())
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

/** A ping on the battle map: a marker everyone in the campaign sees for a few seconds. It is not stored anywhere. */
export interface MapPing { id: string; x: number; y: number; senderId: string; name: string; gm: boolean }

/** Pings travel over a Realtime broadcast channel (nothing is saved). `send` shows nothing locally; the caller shows its own. */
export function openPingChannel(campaignId: string, onPing: (p: MapPing) => void): { send: (p: MapPing) => void; close: () => void } {
  const channel: RealtimeChannel = supabase
    .channel(`campaign-ping:${campaignId}`)
    .on('broadcast', { event: 'ping' }, (msg: { payload?: Partial<MapPing> }) => {
      const p = msg?.payload;
      if (!p || typeof p.id !== 'string' || typeof p.x !== 'number' || typeof p.y !== 'number') return;
      onPing({ id: p.id, x: p.x, y: p.y, senderId: String(p.senderId ?? ''), name: String(p.name ?? '').slice(0, 30), gm: !!p.gm });
    })
    .subscribe();
  return { send: p => { void channel.send({ type: 'broadcast', event: 'ping', payload: p }); }, close: () => { supabase.removeChannel(channel); } };
}

/** A player moves their own token. Done through a database function (players cannot write the campaign row), which
 * only changes the position of a token that belongs to the caller. */
export async function moveMyBattleToken(input: { campaignId: string; tokenId: string; x: number; y: number; cost: number }): Promise<void> {
  const { error } = await supabase.rpc('move_battle_token', { p_campaign: input.campaignId, p_token: input.tokenId, p_x: Math.round(input.x), p_y: Math.round(input.y), p_cost: Math.round(input.cost) });
  if (error) {
    if (/move_battle_token|schema cache|does not exist/i.test(error.message)) throw new Error('Run supabase/campaign-battle.sql in the Supabase SQL editor first.');
    throw new Error(error.message);
  }
}

/** A player's New Turn: their own token gets its walking speed back. */
export async function resetMyBattleMovement(input: { campaignId: string; tokenId: string }): Promise<void> {
  const { error } = await supabase.rpc('reset_battle_movement', { p_campaign: input.campaignId, p_token: input.tokenId });
  if (error) throw new Error(error.message);
}

/** GM: save the battle map state (start, end, or move tokens). */
export async function saveBattle(input: { campaignId: string; battle: BattleState | null }): Promise<void> {
  const { data, error } = await supabase.from('campaigns').update({ battle: input.battle }).eq('id', input.campaignId).select('id');
  if (error) {
    if (/battle/i.test(error.message)) throw new Error('Run supabase/campaign-battle.sql in the Supabase SQL editor first.');
    throw error;
  }
  if (!data || data.length === 0) throw new Error('Only the GM can change the battle map.');
}

export const MAX_COPIES = 20;

/** GM: make copies of a campaign character so several can be tracked (five bandits) without building each one. Each
 * copy is its own campaign character owned by the GM, with full health and no link to the original. Copies of a
 * normal character are marked as NPCs so they show in NPC control. */
export async function duplicateCampaignCharacter(input: { campaignCharacterId: string; copies: number }): Promise<{ names: string[] }> {
  const user = await requireUser();
  const copies = Math.max(1, Math.min(MAX_COPIES, Math.floor(input.copies) || 1));
  const { data: cc } = await supabase.from('campaign_characters').select('*').eq('id', input.campaignCharacterId).single();
  if (!cc) throw new Error('Campaign character not found.');
  const { data: campaign } = await supabase.from('campaigns').select('*').eq('id', cc.campaign).single();
  if (!campaign || campaign.gm !== user.id) throw new Error('Only the GM can make copies.');

  const { data: siblings } = await supabase.from('campaign_characters').select('character_name').eq('campaign', cc.campaign);
  const names = nextCopyNames(cc.character_name ?? 'NPC', (siblings ?? []).map(s => s.character_name ?? ''), copies);

  let gmType = false;
  try { gmType = JSON.parse(cc.character_data ?? '{}').characterType === 'gm'; } catch { /* treat as a normal character */ }
  const rows = names.map(n => ({
    character_name: n,
    campaign: cc.campaign,
    player: user.id,
    character_data: freshCopyData(cc.character_data ?? '{}', n),
    ...(gmType ? {} : { is_npc: true }),
  }));
  const { error } = await supabase.from('campaign_characters').insert(rows);
  if (error) {
    if (/is_npc/i.test(error.message)) throw new Error('Run supabase/campaign-npc.sql in the Supabase SQL editor first.');
    throw error;
  }
  return { names };
}

/** Mark a campaign character as an NPC (or not) for this campaign. */
export async function setCampaignCharacterNpc(input: { campaignCharacterId: string; isNpc: boolean }): Promise<{ success: boolean }> {
  const { data, error } = await supabase.from('campaign_characters')
    .update({ is_npc: input.isNpc })
    .eq('id', input.campaignCharacterId)
    .select('id');
  if (error) {
    if (/is_npc/i.test(error.message)) throw new Error('Run supabase/campaign-npc.sql in the Supabase SQL editor first.');
    throw error;
  }
  if (!data || data.length === 0) throw new Error('You cannot change this character.');
  return { success: true };
}

export interface VisibleCampaignCharacter {
  id: string;
  name: string;
  playerId: string;
  playerEmail: string;
  visibility: CharacterVisibility;
  /** The character JSON, redacted to what the visibility level allows. */
  data: string;
}

/** Other people's campaign characters that have been made visible to you, redacted to their visibility level. */
export async function getVisibleCampaignCharacters(input: { campaignId: string }): Promise<VisibleCampaignCharacter[]> {
  const { data, error } = await supabase.rpc('get_visible_campaign_characters', { p_campaign: input.campaignId });
  if (error) {
    if (/get_visible_campaign_characters|schema cache|does not exist/i.test(error.message)) throw new Error(VISIBILITY_SETUP_HINT);
    throw new Error(error.message);
  }
  const rows = (data ?? []) as { id: string; character_name: string; player: string | null; visibility: string; character_data: string }[];
  const profiles = await fetchProfiles(rows.map(r => r.player ?? ''));
  return rows.map(r => ({
    id: r.id,
    name: r.character_name ?? 'Unnamed',
    playerId: r.player ?? '',
    playerEmail: r.player ? profiles.get(r.player)?.email ?? '' : '',
    visibility: asVisibility(r.visibility),
    data: r.character_data ?? '{}',
  }));
}

/** The JSON with its cloudId set to the row it is being stored in. */
function withCloudId(data: string, cloudId: string): string {
  try { return JSON.stringify({ ...JSON.parse(data), cloudId }); } catch { return data; }
}

/** The main character was saved: copy it onto every campaign copy of it, so the two stay the same. */
export async function syncCharacterToCampaigns(input: { cloudId: string; name: string; data: string; /** Only these campaign copies (default: all of them). */ copyIds?: string[] }): Promise<{ updated: number }> {
  const { data: all, error } = await supabase.from('campaign_characters').select('id').eq('original_character', input.cloudId);
  const copies = (all ?? []).filter(cc => !input.copyIds || input.copyIds.includes(cc.id));
  if (error || copies.length === 0) return { updated: 0 };
  let updated = 0;
  for (const cc of copies) {
    const { error: e } = await supabase.from('campaign_characters')
      .update({ character_name: input.name, character_data: withCloudId(input.data, cc.id), updated_at: new Date().toISOString() })
      .eq('id', cc.id);
    if (!e) updated++;
  }
  return { updated };
}

export interface SyncToOriginalResult {
  /** The campaign copy has a main character it is linked to. */
  linked: boolean;
  originalId?: string;
  /** The main character row was updated (false when the database blocked it, e.g. a GM editing a player's character without the sync policy). */
  originalUpdated: boolean;
  /** The main row's new updated_at. */
  updatedAt?: string;
  /** Other campaigns' copies of the same character that were updated too. */
  otherCopiesUpdated: number;
  /** The main character was deliberately left alone (it was not ticked). */
  mainSkipped?: boolean;
}

/** A campaign copy was saved: copy it onto the main character and onto the character's other campaign copies. */
export async function syncCampaignCharacterToOriginal(input: {
  campaignCharacterId: string; name: string; characterType: string; level: number; data: string;
  /** Update the main character (default yes). */
  updateMain?: boolean;
  /** Only these other campaign copies (default: all of them). */
  copyIds?: string[];
  /** Leave these other campaign copies alone. */
  skipCopyIds?: string[];
}): Promise<SyncToOriginalResult> {
  const { data: cc } = await supabase.from('campaign_characters').select('original_character').eq('id', input.campaignCharacterId).maybeSingle();
  const originalId = cc?.original_character ?? undefined;
  if (!originalId) return { linked: false, originalUpdated: false, otherCopiesUpdated: 0 };

  const updatedAt = new Date().toISOString();
  const updateMain = input.updateMain !== false;
  let originalUpdated = false;
  if (updateMain) {
    const { data: rows, error } = await supabase.from('characters')
      .update({
        character_name: input.name,
        character_type: TYPE_TO_DB[input.characterType] ?? 'Normal',
        level: input.level,
        character_data: withCloudId(input.data, originalId),
        updated_at: updatedAt,
      })
      .eq('id', originalId)
      .select('id');
    originalUpdated = !error && (rows?.length ?? 0) > 0;
    if (!originalUpdated) return { linked: true, originalId, originalUpdated: false, otherCopiesUpdated: 0 };
  }

  let otherCopiesUpdated = 0;
  const { data: others } = await supabase.from('campaign_characters').select('id').eq('original_character', originalId).neq('id', input.campaignCharacterId);
  for (const o of (others ?? []).filter(x => (!input.copyIds || input.copyIds.includes(x.id)) && !(input.skipCopyIds ?? []).includes(x.id))) {
    const { error: e } = await supabase.from('campaign_characters')
      .update({ character_name: input.name, character_data: withCloudId(input.data, o.id), updated_at: updatedAt })
      .eq('id', o.id);
    if (!e) otherCopiesUpdated++;
  }
  return { linked: true, originalId, originalUpdated, updatedAt: originalUpdated ? updatedAt : undefined, otherCopiesUpdated, mainSkipped: !updateMain };
}

/** A campaign copy of a character, with the campaign it is in. */
export interface LinkedCopy { id: string; campaignId: string; campaignName: string }

async function campaignNames(ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const unique = [...new Set(ids)];
  if (unique.length === 0) return out;
  const { data } = await supabase.from('campaigns').select('*').in('id', unique);
  (data ?? []).forEach(c => out.set(c.id, c.campaign_name ?? 'Campaign'));
  return out;
}

/** The campaign copies of a main character that you can see (so a save can offer to update them). */
export async function getLinkedCampaignCopies(input: { originalId: string }): Promise<LinkedCopy[]> {
  const { data } = await supabase.from('campaign_characters').select('id, campaign').eq('original_character', input.originalId);
  const rows = data ?? [];
  const names = await campaignNames(rows.map(r => r.campaign));
  return rows.map(r => ({ id: r.id, campaignId: r.campaign, campaignName: names.get(r.campaign) ?? 'Campaign' }));
}

/** For a campaign copy: the main character it comes from (if any) and the character's other campaign copies. */
export async function getLinkedSheetsForCopy(input: { campaignCharacterId: string }): Promise<{ originalId?: string; others: LinkedCopy[] }> {
  const { data: cc } = await supabase.from('campaign_characters').select('original_character').eq('id', input.campaignCharacterId).maybeSingle();
  const originalId = cc?.original_character ?? undefined;
  if (!originalId) return { others: [] };
  const copies = await getLinkedCampaignCopies({ originalId });
  return { originalId, others: copies.filter(c => c.id !== input.campaignCharacterId) };
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
