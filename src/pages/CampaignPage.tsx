import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  getCampaignCharacters, getFriendRequests, addCharacterToCampaign,
  removeCampaignCharacter, getFriendCharacters, createAndAssignCharacter,
  assignCampaignCharacter, invitePlayerToCampaign, addMyCharacterToCampaign,
  setCampaignCharacterVisibility, getVisibleCampaignCharacters, setCampaignCharacterNpc, duplicateCampaignCharacter, MAX_COPIES,
  getBattle, saveBattle, subscribeToCampaign, moveMyBattleToken, resetMyBattleMovement, openPingChannel,
} from '../lib/api/social';
import type { MapPing } from '../lib/api/social';
import type { GetCampaignCharactersOutputType, GetFriendRequestsOutputType, VisibleCampaignCharacter } from '../lib/api/social';
import { VISIBILITY_LEVELS, visibilityLabel } from '../utils/visibility';
import type { CharacterVisibility } from '../utils/visibility';
import { getCharacters, saveCharacter } from '../lib/api/characters';
import { saveLocalCharacter } from '../utils/storage';
import CreateCharacterDialog from '../components/CreateCharacterDialog';
import NpcControl from '../components/campaign/NpcControl';
import BattlePanel from '../components/campaign/BattlePanel';
import { newBattle, addToken, moveToken, limitMove, resetMovement, mergeRemotePositions, upsertStroke, upsertEffect, WALK_SPEED } from '../utils/battle';
import type { Drawing, MapEffect } from '../utils/battle';
import type { BattleState } from '../utils/battle';
import { usePersistedState } from '../utils/usePersistedState';
import type { Character } from '../types/character';
import type { GetCharactersOutputType } from '../lib/api/characters';
import { createDefaultCharacter } from '../utils/defaults';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Swords, Copy, ArrowLeft, Crown, UserPlus, Sword, Trash2, Edit, Eye, Plus, UserCheck, Mail } from 'lucide-react';
import { toast } from 'sonner';

type CampaignChar = GetCampaignCharactersOutputType['characters'][0];
type Friend = GetFriendRequestsOutputType['friends'][0];
type MyChar = GetCharactersOutputType['characters'][0];

const TYPE_COLORS: Record<string, string> = {
  normal: 'bg-primary/20 text-primary border-primary/40',
  gm: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
};
const TYPE_LABELS: Record<string, string> = { normal: 'Normal', gm: 'GM/NPC' };

// ── Invite Player Dialog (GM only) ────────────────────────────────────────────
function InvitePlayerDialog({ open, onClose, campaignId, invitedMemberIds, onInvited }: {
  open: boolean;
  onClose: () => void;
  campaignId: string;
  invitedMemberIds: string[];
  onInvited: () => void;
}) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    getFriendRequests()
      .then(r => setFriends(r.friends))
      .catch(() => toast.error('Failed to load friends'))
      .finally(() => setLoading(false));
  }, [open]);

  const handleInvite = async (friendId: string, friendEmail: string) => {
    setInviting(friendId);
    try {
      await invitePlayerToCampaign({ campaignId, friendUserId: friendId });
      toast.success(`${friendEmail} invited to campaign!`);
      onInvited();
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to invite player');
    } finally {
      setInviting(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Invite Player</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 py-1">
          <p className="text-sm text-muted-foreground">Select a friend to invite to this campaign.</p>
          {loading ? (
            <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
          ) : friends.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No friends yet. Add friends first!</p>
          ) : (
            friends.map(f => {
              const alreadyInvited = invitedMemberIds.includes(f.friend.id);
              return (
                <div key={f.requestId} className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2.5 gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-sm text-foreground truncate">{f.friend.email}</p>
                  </div>
                  {alreadyInvited ? (
                    <Badge variant="secondary" className="shrink-0 text-xs">Invited</Badge>
                  ) : (
                    <Button
                      size="sm"
                      disabled={inviting === f.friend.id}
                      onClick={() => handleInvite(f.friend.id, f.friend.email)}
                    >
                      {inviting === f.friend.id ? '...' : <><UserPlus className="h-3.5 w-3.5 mr-1" />Invite</>}
                    </Button>
                  )}
                </div>
              );
            })
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Add My Character Dialog (invited player) ──────────────────────────────────
function AddMyCharacterDialog({ open, onClose, campaignId, onAdded }: {
  open: boolean;
  onClose: () => void;
  campaignId: string;
  onAdded: () => void;
}) {
  const [myChars, setMyChars] = useState<MyChar[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    getCharacters()
      .then(r => setMyChars(r.characters))
      .catch(() => toast.error('Failed to load characters'))
      .finally(() => setLoading(false));
  }, [open]);

  const handleAdd = async (char: MyChar) => {
    setAdding(char.cloudId);
    try {
      await addMyCharacterToCampaign({ campaignId, characterId: char.cloudId });
      toast.success(`"${char.name}" added to campaign!`);
      onAdded();
      onClose();
    } catch (e: any) {
      if (e.message?.includes('already in the campaign')) {
        toast.error(`"${char.name}" is already in this campaign.`);
      } else {
        toast.error(e.message ?? 'Failed to add character');
      }
    } finally {
      setAdding(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add My Character</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 py-1">
          <p className="text-sm text-muted-foreground">Choose one of your characters to add to this campaign.</p>
          {loading ? (
            <div className="space-y-2">{[1, 2].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
          ) : myChars.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">You have no characters yet. Create one first!</p>
          ) : (
            myChars.map(c => (
              <div key={c.cloudId} className="rounded-lg border border-border bg-card p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-sm text-foreground truncate">{c.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className={`text-xs border ${TYPE_COLORS[c.characterType] ?? ''}`}>
                      {TYPE_LABELS[c.characterType] ?? c.characterType}
                    </Badge>
                    <span className="text-xs text-muted-foreground">Level {c.level}</span>
                  </div>
                </div>
                <Button size="sm" disabled={adding === c.cloudId} onClick={() => handleAdd(c)}>
                  {adding === c.cloudId ? '...' : <><Plus className="h-3.5 w-3.5 mr-1" />Add</>}
                </Button>
              </div>
            ))
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Assign Character Dialog ───────────────────────────────────────────────────
function AssignDialog({ char, friends, currentUser, open, onClose, onAssigned }: {
  char: CampaignChar | null;
  friends: Friend[];
  currentUser: { id: string; email: string };
  open: boolean;
  onClose: () => void;
  onAssigned: () => void;
}) {
  const [assigneeId, setAssigneeId] = useState(currentUser.id);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) setAssigneeId(currentUser.id); }, [open, currentUser.id]);

  const options = [
    { id: currentUser.id, label: `Me (${currentUser.email})` },
    ...friends.map(f => ({ id: f.friend.id, label: f.friend.email })),
  ];

  const handleAssign = async () => {
    if (!char) return;
    setSaving(true);
    try {
      await assignCampaignCharacter({ campaignCharacterId: char.id, assigneeId });
      toast.success('Character assigned!');
      onAssigned();
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to assign character');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Assign "{char?.name}"</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <p className="text-sm text-muted-foreground">
            This character will be saved to the selected player's account, and they'll gain edit access.
          </p>
          <div className="space-y-1.5">
            <Label>Assign to</Label>
            <Select value={assigneeId} onValueChange={setAssigneeId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {options.map(o => (
                  <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleAssign} disabled={saving}>
            {saving ? 'Assigning...' : <><UserCheck className="h-4 w-4 mr-1" />Assign</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Create & Assign sub-form ──────────────────────────────────────────────────
function CreateCharacterForm({ campaignId, friends, currentUser, onCreated, onCancel }: {
  campaignId: string;
  friends: Friend[];
  currentUser: { id: string; email: string };
  onCreated: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [charType, setCharType] = useState<'normal' | 'gm'>('normal');
  const [assigneeId, setAssigneeId] = useState('unassigned');
  const [asNpc, setAsNpc] = useState(false);
  const [saving, setSaving] = useState(false);

  const options = [
    { id: currentUser.id, label: `Me (${currentUser.email})` },
    ...friends.map(f => ({ id: f.friend.id, label: f.friend.email })),
  ];

  const handleCreate = async () => {
    if (!name.trim()) { toast.error('Character name is required.'); return; }
    setSaving(true);
    try {
      const char = createDefaultCharacter(charType, name.trim(), playerName.trim());
      const created = await createAndAssignCharacter({
        campaignId,
        assigneeId: assigneeId === 'unassigned' ? undefined : assigneeId,
        name: name.trim(),
        playerName: playerName.trim(),
        characterType: charType,
        data: JSON.stringify(char),
      });
      // A normal character can be an NPC in this campaign without using the GM/NPC type
      if (asNpc && charType === 'normal') {
        try { await setCampaignCharacterNpc({ campaignCharacterId: created.campaignCharacterId, isNpc: true }); }
        catch (e: any) { toast.error(e.message ?? 'Created, but could not mark it as an NPC.'); }
      }
      const assigned = assigneeId === 'unassigned' ? 'unassigned' : options.find(o => o.id === assigneeId)?.label;
      toast.success(`"${name}" created${assigned && assigned !== 'unassigned' ? ` and assigned to ${assigned}` : ' (unassigned)'}!`);
      onCreated();
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to create character');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" className="-ml-1" onClick={onCancel}>
        <ArrowLeft className="h-3.5 w-3.5 mr-1" />Back
      </Button>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label>Character Name <span className="text-destructive">*</span></Label>
          <Input placeholder="e.g. Aragorn" value={name} onChange={e => setName(e.target.value)} autoFocus />
        </div>
        <div className="space-y-1.5">
          <Label>Player Name <span className="text-muted-foreground text-xs">(optional)</span></Label>
          <Input placeholder="e.g. John" value={playerName} onChange={e => setPlayerName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Character Type</Label>
          <Select value={charType} onValueChange={v => setCharType(v as 'normal' | 'gm')}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="gm">GM/NPC</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {charType === 'normal' && (
          <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
            <input type="checkbox" className="h-4 w-4 accent-primary" checked={asNpc} onChange={e => setAsNpc(e.target.checked)} />
            <span>Make this an NPC in this campaign <span className="text-xs text-muted-foreground">(shows in NPC control)</span></span>
          </label>
        )}
        <div className="space-y-1.5">
          <Label>Assign to Player</Label>
          <Select value={assigneeId} onValueChange={setAssigneeId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="unassigned">Unassigned (assign later)</SelectItem>
              {options.map(o => (
                <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {assigneeId === 'unassigned' && (
            <p className="text-xs text-muted-foreground">Only you (GM) can edit until assigned to a player.</p>
          )}
        </div>
      </div>
      <Button className="w-full" onClick={handleCreate} disabled={saving || !name.trim()}>
        {saving ? 'Creating...' : <><Plus className="h-4 w-4 mr-1" />Create & Add to Campaign</>}
      </Button>
    </div>
  );
}

// ── Add Character Dialog (GM) ─────────────────────────────────────────────────
function AddCharacterDialog({ open, onClose, campaignId, onAdded }: {
  open: boolean; onClose: () => void; campaignId: string; onAdded: () => void;
}) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [friendChars, setFriendChars] = useState<{ cloudId: string; name: string; characterType: string; level: number }[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [loadingChars, setLoadingChars] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (!open) { setShowCreate(false); setSelectedFriend(null); return; }
    setLoadingFriends(true);
    getFriendRequests()
      .then(r => setFriends(r.friends))
      .catch(() => toast.error('Failed to load friends'))
      .finally(() => setLoadingFriends(false));
  }, [open]);

  const loadFriendChars = async (friend: Friend) => {
    setSelectedFriend(friend);
    setLoadingChars(true);
    try {
      const r = await getFriendCharacters({ friendId: friend.friend.id });
      setFriendChars(r.characters);
    } catch { toast.error('Failed to load characters'); }
    finally { setLoadingChars(false); }
  };

  const handleAdd = async (charId: string) => {
    setAdding(charId);
    try {
      await addCharacterToCampaign({ campaignId, characterId: charId });
      toast.success('Character added to campaign!');
      onAdded();
      onClose();
    } catch (e: any) { toast.error(e.message ?? 'Failed to add character'); }
    finally { setAdding(null); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Character to Campaign</DialogTitle>
        </DialogHeader>
        {showCreate ? (
          <CreateCharacterForm
            campaignId={campaignId}
            friends={friends}
            currentUser={{ id: user?.id ?? '', email: user?.email ?? '' }}
            onCreated={() => { onAdded(); onClose(); }}
            onCancel={() => setShowCreate(false)}
          />
        ) : (
          <Tabs defaultValue="existing">
            <TabsList className="w-full mb-3">
              <TabsTrigger value="existing" className="flex-1">From Friends</TabsTrigger>
              <TabsTrigger value="create" className="flex-1" onClick={() => setShowCreate(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" />Create New
              </TabsTrigger>
            </TabsList>
            <TabsContent value="existing">
              {!selectedFriend ? (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Select a friend to add their character:</p>
                  {loadingFriends ? (
                    <div className="space-y-2">{[1, 2].map(i => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
                  ) : friends.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No friends yet. Add friends first!</p>
                  ) : (
                    friends.map(f => (
                      <button key={f.requestId}
                        className="w-full text-left rounded-lg border border-border bg-card p-3 hover:border-primary/50 transition-colors"
                        onClick={() => loadFriendChars(f)}>
                        <p className="font-medium text-foreground">{f.friend.email}</p>
                      </button>
                    ))
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <Button variant="ghost" size="sm" className="mb-1 -ml-1"
                    onClick={() => { setSelectedFriend(null); setFriendChars([]); }}>
                    <ArrowLeft className="h-3.5 w-3.5 mr-1" />{selectedFriend.friend.email}
                  </Button>
                  {loadingChars ? (
                    <div className="space-y-2">{[1, 2].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
                  ) : friendChars.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">This friend has no characters.</p>
                  ) : (
                    friendChars.map(c => (
                      <div key={c.cloudId} className="rounded-lg border border-border bg-card p-3 flex items-center justify-between">
                        <div>
                          <p className="font-medium text-foreground">{c.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge className={`text-xs border ${TYPE_COLORS[c.characterType] ?? ''}`}>
                              {TYPE_LABELS[c.characterType] ?? c.characterType}
                            </Badge>
                            <span className="text-xs text-muted-foreground">Level {c.level}</span>
                          </div>
                        </div>
                        <Button size="sm" disabled={adding === c.cloudId} onClick={() => handleAdd(c.cloudId)}>
                          {adding === c.cloudId ? '...' : <><UserPlus className="h-3.5 w-3.5 mr-1" />Add</>}
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Make copies of a character (GM) ──────────────────────────────────────────
function DuplicateDialog({ char, onClose, onDone }: { char: CampaignChar | null; onClose: () => void; onDone: () => void }) {
  const [count, setCount] = useState(3);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (char) setCount(3); }, [char]);

  const make = async () => {
    if (!char) return;
    setSaving(true);
    try {
      const r = await duplicateCampaignCharacter({ campaignCharacterId: char.id, copies: count });
      toast.success(`Made ${r.names.length} cop${r.names.length === 1 ? 'y' : 'ies'}: ${r.names.join(', ')}.`);
      onDone();
      onClose();
    } catch (e: any) { toast.error(e.message ?? 'Failed to make copies'); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={!!char} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Make copies of "{char?.name}"</DialogTitle></DialogHeader>
        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label>How many copies?</Label>
            <div className="flex items-center gap-2">
              <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setCount(c => Math.max(1, c - 1))} disabled={count <= 1}>-</Button>
              <Input type="number" min={1} max={MAX_COPIES} value={count} onChange={e => setCount(Math.max(1, Math.min(MAX_COPIES, parseInt(e.target.value) || 1)))} className="h-8 w-20 text-center" aria-label="Number of copies" />
              <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setCount(c => Math.min(MAX_COPIES, c + 1))} disabled={count >= MAX_COPIES}>+</Button>
              <span className="text-xs text-muted-foreground">up to {MAX_COPIES}</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Each copy is its own NPC in this campaign with the same stats and weapons, full health, stamina and mana, and its own name ("{char?.name.replace(/\s+\d+$/, '')} 2", "... 3"). Copies are not linked to the original, so changing one never changes the others.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={make} disabled={saving}>{saving ? 'Making...' : <><Copy className="h-4 w-4 mr-1" />Make {count} cop{count === 1 ? 'y' : 'ies'}</>}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Campaign Page ─────────────────────────────────────────────────────────────
export default function CampaignPage() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState<GetCampaignCharactersOutputType | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [addMyCharOpen, setAddMyCharOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [dupTarget, setDupTarget] = useState<CampaignChar | null>(null);
  // The shared battle map. The GM writes it, a player moves only their own token, and everyone gets changes live.
  const [battle, setBattleState] = useState<BattleState | null>(null);
  const battleSave = useRef<{ timer?: number; latest?: BattleState | null }>({});
  const playerMove = useRef<{ pending?: { id: string; x: number; y: number; cost: number }; busy?: boolean; timer?: number }>({});
  const battleRef = useRef<BattleState | null>(null); // always the newest map (a drag started earlier must not write an old copy)
  const applyBattle = (f: (prev: BattleState | null) => BattleState | null) => { const next = f(battleRef.current); battleRef.current = next; setBattleState(next); };
  const lastWrite = useRef(0);
  // Pings on the map: shown for a few seconds, never saved
  const [pings, setPings] = useState<MapPing[]>([]);
  const pingChannel = useRef<{ send: (p: MapPing) => void; close: () => void } | null>(null);
  const lastPing = useRef(0);
  const movedHere = useRef<Set<string>>(new Set()); // tokens this device moved since the map last matched the server
  const refreshSeq = useRef(0);
  // Which NPC cards are collapsed to just a name (a layout preference, kept on this device)
  // A player's active character: the one run from the controls on this page (kept on this device)
  const [activeCharId, setActiveCharId] = usePersistedState<string>(`botv_active_char:${campaignId}`, '', 365 * 24 * 60 * 60 * 1000);
  const [collapsedNpcs, setCollapsedNpcs] = usePersistedState<Record<string, boolean>>(`botv_npc_collapsed:${campaignId}`, {}, 365 * 24 * 60 * 60 * 1000);
  const [removeTarget, setRemoveTarget] = useState<CampaignChar | null>(null);
  const [assignTarget, setAssignTarget] = useState<CampaignChar | null>(null);
  const [party, setParty] = useState<VisibleCampaignCharacter[]>([]);
  const [partyError, setPartyError] = useState('');

  const load = useCallback(async () => {
    if (!campaignId) return;
    setLoading(true);
    try {
      const [r, fr] = await Promise.all([
        getCampaignCharacters({ campaignId }),
        getFriendRequests(),
      ]);
      setData(r);
      setFriends(fr.friends);
      try { const b = await getBattle({ campaignId }); applyBattle(() => b); } catch { /* no battle yet */ }
      // Characters other people made visible to me (the GM already sees everyone)
      if (!r.campaign.isGM) {
        try { setParty(await getVisibleCampaignCharacters({ campaignId })); setPartyError(''); }
        catch (e: any) { setParty([]); setPartyError(e.message ?? 'Could not load the party.'); }
      } else { setParty([]); setPartyError(''); }
    } catch (e: any) { toast.error(e.message ?? 'Failed to load campaign'); navigate('/'); }
    finally { setLoading(false); }
  }, [campaignId, navigate]);

  useEffect(() => { load(); }, [load]);

  const handleRemove = async () => {
    if (!removeTarget) return;
    try {
      await removeCampaignCharacter({ campaignCharacterId: removeTarget.id });
      toast.success('Character removed from campaign.');
      setRemoveTarget(null);
      load();
    } catch { toast.error('Failed to remove character'); }
  };

  // Create a brand-new character for yourself right here: it is saved to your account like any other character and
  // added to this campaign, then opened.
  const handleCreateMine = async (char: Character, opts?: { npc: boolean }) => {
    if (!campaignId) return;
    try {
      saveLocalCharacter(char);
      const saved = await saveCharacter({ name: char.name, characterType: char.characterType, level: char.level, data: JSON.stringify(char) });
      saveLocalCharacter({ ...char, cloudId: saved.cloudId, cloudSyncedAt: saved.updatedAt });
      const added = await addMyCharacterToCampaign({ campaignId, characterId: saved.cloudId });
      if (opts?.npc) {
        try { await setCampaignCharacterNpc({ campaignCharacterId: added.campaignCharacterId, isNpc: true }); }
        catch (e: any) { toast.error(e.message ?? 'Created, but could not mark it as an NPC.'); }
      }
      setCreateOpen(false);
      toast.success(`"${char.name}" created and added to the campaign!`);
      navigate(`/campaign/${campaignId}/character/${added.campaignCharacterId}`);
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to create the character');
      load();
    }
  };

  const showPing = useCallback((p: MapPing) => {
    setPings(prev => [...prev.filter(k => k.id !== p.id), p]);
    window.setTimeout(() => setPings(prev => prev.filter(k => k.id !== p.id)), 4500);
  }, []);
  useEffect(() => {
    if (!campaignId || !data) return;
    const channel = openPingChannel(campaignId, showPing);
    pingChannel.current = channel;
    return () => { channel.close(); pingChannel.current = null; };
  }, [campaignId, !!data, showPing]);

  // Live, like the duels, for the GM and the players: the campaign row is pushed over Realtime, so combat starting and
  // every token move shows up as it happens. A slow refresh stays as a safety net if the connection drops. While this
  // device still has its own change on its way, a refresh waits, so an older copy never snaps the map back.
  const hasData = !!data;
  useEffect(() => {
    if (!campaignId || !hasData) return;
    let timer: number | undefined;
    let alive = true;
    const busy = () => !!(battleSave.current.timer || battleSave.current.latest !== undefined || playerMove.current.timer || playerMove.current.pending || playerMove.current.busy || Date.now() - lastWrite.current < 400);
    const refresh = async () => {
      timer = undefined;
      const seq = ++refreshSeq.current;
      try {
        const b = await getBattle({ campaignId });
        if (!alive || seq !== refreshSeq.current) return;
        if (busy()) {
          // our own change is still on its way: take in only what other people moved, keep ours, and look again soon
          if (b) {
            const mine = movedHere.current;
            applyBattle(prev => (prev ? mergeRemotePositions(prev, b, mine) : prev));
            if (battleSave.current.latest) battleSave.current.latest = mergeRemotePositions(battleSave.current.latest, b, mine);
          }
          timer = window.setTimeout(refresh, 450);
          return;
        }
        movedHere.current.clear();
        applyBattle(prev => (JSON.stringify(prev) === JSON.stringify(b) ? prev : b));
      } catch { /* try again on the next change */ }
    };
    const kick = () => { if (timer === undefined) void refresh(); };
    const unsubscribe = subscribeToCampaign(campaignId, kick);
    const safetyNet = window.setInterval(kick, 20000);
    const onVisible = () => { if (document.visibilityState === 'visible') kick(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { alive = false; window.clearTimeout(timer); unsubscribe(); window.clearInterval(safetyNet); document.removeEventListener('visibilitychange', onVisible); };
  }, [campaignId, hasData]);

  // GM: change the map now and save it at once, at most every 150 ms while dragging, so players watch it move
  const flushBattle = useCallback(() => {
    const s = battleSave.current;
    if (s.timer) { window.clearTimeout(s.timer); s.timer = undefined; }
    if (s.latest === undefined || !campaignId) return;
    const next = s.latest;
    s.latest = undefined;
    lastWrite.current = Date.now();
    saveBattle({ campaignId, battle: next }).then(() => { lastWrite.current = Date.now(); }).catch((e: Error) => toast.error(e.message ?? 'Could not save the battle map'));
  }, [campaignId]);
  const updateBattle = (next: BattleState | null) => {
    const cur = battleRef.current;
    if (next && cur) for (const t of next.tokens) { const o = cur.tokens.find(x => x.id === t.id); if (o && (o.x !== t.x || o.y !== t.y || (o.moved ?? 0) !== (t.moved ?? 0))) movedHere.current.add(t.id); }
    applyBattle(() => next);
    battleSave.current.latest = next;
    if (!battleSave.current.timer) battleSave.current.timer = window.setTimeout(flushBattle, 150);
  };
  useEffect(() => () => flushBattle(), [flushBattle]);

  // Player: move your own token. It moves on screen at once and is sent on at most every 150 ms while dragging.
  const flushMove = useCallback(async () => {
    const m = playerMove.current;
    if (m.timer) { window.clearTimeout(m.timer); m.timer = undefined; }
    if (m.busy || !m.pending || !campaignId) return;
    const p = m.pending;
    m.pending = undefined;
    m.busy = true;
    lastWrite.current = Date.now();
    try {
      await moveMyBattleToken({ campaignId, tokenId: p.id, x: p.x, y: p.y, cost: p.cost });
    } catch (e: any) {
      m.pending = undefined;
      toast.error(e.message ?? 'Could not move your token');
      try { const b = await getBattle({ campaignId }); applyBattle(() => b); } catch { /* keep what is shown */ }
    } finally {
      m.busy = false;
      lastWrite.current = Date.now();
      if (m.pending && !m.timer) m.timer = window.setTimeout(flushMove, 100);
    }
  }, [campaignId]);
  const moveOwnToken = (id: string, x: number, y: number): { x: number; y: number } | undefined => {
    const cur = battleRef.current;
    const t = cur?.tokens.find(k => k.id === id);
    if (!cur || !t) return undefined;
    // a player can only walk as far as the token has movement left this turn
    const a = limitMove(cur, id, x, y);
    if (a.limited) toast.info(a.cost === 0 ? 'No movement left this turn' : 'That is as far as you can walk this turn', { id: 'move-limit', description: `A character walks ${WALK_SPEED} m per turn. A New Turn gives it back.` });
    if (a.x === t.x && a.y === t.y) return { x: t.x, y: t.y };
    applyBattle(prev => (prev ? moveToken(prev, id, a.x, a.y) : prev));
    const m = playerMove.current;
    movedHere.current.add(id);
    m.pending = { id, x: a.x, y: a.y, cost: (m.pending?.id === id ? m.pending.cost : 0) + a.cost };
    lastWrite.current = Date.now();
    if (!m.timer && !m.busy) m.timer = window.setTimeout(flushMove, 150);
    return { x: a.x, y: a.y };
  };

  // Anyone can ping a spot on the map: shown here at once, sent to everyone else over Realtime
  const sendPing = (x: number, y: number) => {
    if (Date.now() - lastPing.current < 350) return;
    lastPing.current = Date.now();
    const mine = battleRef.current?.tokens.find(t => t.kind === 'pc' && t.owner === user?.id);
    const p: MapPing = { id: Math.random().toString(36).slice(2, 10), x, y, senderId: user?.id ?? '', name: isGM ? 'GM' : (mine?.name ?? 'Player'), gm: isGM };
    showPing(p);
    pingChannel.current?.send(p);
  };
  // The GM's drawing: the stroke so far, sent on as it grows
  // The GM's magic effects (fire, ice...): placed or moved on the map, sent on as they change
  // The GM edits the map itself (erase a drawing, the right-click menu): always on the newest map
  const editMap = (fn: (b: BattleState) => BattleState) => { const cur = battleRef.current; if (cur) updateBattle(fn(cur)); };
  const placeEffect = (e: MapEffect) => { const cur = battleRef.current; if (cur) updateBattle(upsertEffect(cur, e)); };
  const drawStroke = (s: Drawing) => { const cur = battleRef.current; if (cur) updateBattle(upsertStroke(cur, s)); };

  // A character that is no longer in the campaign (removed from the roster) is taken off the map too. It only goes
  // one way: taking a token off the map never touches the character.
  useEffect(() => {
    if (!data?.campaign.isGM || loading || !battle || battle.tokens.length === 0) return;
    const here = new Set(data.characters.map(c => c.id));
    if (battle.tokens.every(t => here.has(t.id))) return;
    updateBattle({ ...battle, tokens: battle.tokens.filter(t => here.has(t.id)) });
  }, [data, loading, battle]); // eslint-disable-line react-hooks/exhaustive-deps

  // A character's New Turn (or Start Combat) gives its token the full walking speed again
  const resetTokenMovement = (id: string) => {
    const cur = battleRef.current;
    const t = cur?.tokens.find(k => k.id === id);
    if (!cur || !cur.active || !t || !(t.moved ?? 0)) return;
    if (isGM) { updateBattle(resetMovement(cur, id)); return; }
    if (!campaignId) return;
    applyBattle(prev => (prev ? resetMovement(prev, id) : prev));
    movedHere.current.add(id);
    lastWrite.current = Date.now();
    resetMyBattleMovement({ campaignId, tokenId: id }).catch(() => { /* the GM can give the movement back */ });
  };
  useEffect(() => () => { void flushMove(); }, [flushMove]);
  // a drag reports every square it enters; the GM moves any token, a player only their own
  const moveToken_ = (id: string, x: number, y: number): { x: number; y: number } | undefined => {
    if (!isGM) return moveOwnToken(id, x, y);
    // the GM is never held to the walking speed (it is only counted), so a push or a dash is the GM's call
    const cur = battleRef.current;
    if (!cur) return undefined;
    const next = moveToken(cur, id, x, y);
    updateBattle(next);
    const t = next.tokens.find(k => k.id === id);
    return t ? { x: t.x, y: t.y } : undefined;
  };

  const toggleCombat = () => {
    if (battle?.active) { updateBattle({ ...battle, active: false }); toast.info('Combat ended. The map is hidden; the tokens are kept for next time.'); return; }
    // Start: keep the tokens from the last combat, or begin with every player's character
    let next: BattleState = battle ? { ...battle, active: true } : newBattle();
    if (!battle) {
      for (const c of data?.characters ?? []) {
        if (c.characterType !== 'gm' && !c.isNpc && !c.isUnassigned) next = addToken(next, { id: c.id, name: c.name, kind: 'pc', owner: c.playerId || undefined });
      }
    }
    updateBattle(next);
    toast.success('Combat started. Add NPCs to the map from the Combat panel.');
  };

  const handleNpc = async (char: CampaignChar, isNpc: boolean) => {
    try {
      await setCampaignCharacterNpc({ campaignCharacterId: char.id, isNpc });
      setData(d => d ? { ...d, characters: d.characters.map(c => c.id === char.id ? { ...c, isNpc } : c) } : d);
      toast.success(isNpc ? `"${char.name}" is now an NPC. Find it under NPC control.` : `"${char.name}" is no longer marked as an NPC.`);
    } catch (e: any) { toast.error(e.message ?? 'Failed to change the NPC mark'); }
  };

  const handleVisibility = async (char: CampaignChar, visibility: CharacterVisibility) => {
    try {
      await setCampaignCharacterVisibility({ campaignCharacterId: char.id, visibility });
      setData(d => d ? { ...d, characters: d.characters.map(c => c.id === char.id ? { ...c, visibility } : c) } : d);
      toast.success(visibility === 'hidden' ? `"${char.name}" is hidden from the other players.` : `"${char.name}" is now visible to the other players: ${visibilityLabel(visibility)}.`);
    } catch (e: any) { toast.error(e.message ?? 'Failed to change visibility'); }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4 space-y-4">
        <Skeleton className="h-12 w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      </div>
    );
  }

  const isGM = data?.campaign.isGM ?? false;
  const isInvitedMember = data?.campaign.isInvitedMember ?? false;
  const invitedMembers = data?.campaign.invitedMembers ?? [];
  // GM/NPC characters, and any character the GM marked as an NPC, that the GM can run from this page
  const npcs = (data?.characters ?? []).filter(c => (c.characterType === 'gm' || c.isNpc) && c.canEdit);
  // A player's own characters here; one of them is "active" and gets the same combat controls the GM has for NPCs
  const myChars = isGM ? [] : (data?.characters ?? []).filter(c => c.canEdit && !c.isUnassigned);
  const activeChar = myChars.find(c => c.id === activeCharId) ?? myChars[0] ?? null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2 min-w-0">
            {isGM && <Crown className="h-4 w-4 text-amber-400 shrink-0" />}
            <h1 className="text-lg font-bold text-foreground truncate">{data?.campaign.name}</h1>
            {isGM && <Badge className="text-xs bg-amber-500/20 text-amber-400 border-amber-500/40 border shrink-0">GM</Badge>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isGM && (
            <>
              <Button size="sm" variant={battle?.active ? 'destructive' : 'default'} onClick={toggleCombat}>
                <Swords className="h-4 w-4 mr-1" />{battle?.active ? 'End Combat' : 'Start Combat'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setInviteOpen(true)}>
                <Mail className="h-4 w-4 mr-1" />Invite Player
              </Button>
              <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>
                <Sword className="h-4 w-4 mr-1" />Create Character
              </Button>
              <Button size="sm" variant="outline" onClick={() => setAddMyCharOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />Add My Character
              </Button>
              <Button size="sm" onClick={() => setAddOpen(true)}>
                <UserPlus className="h-4 w-4 mr-1" />Add Character
              </Button>
            </>
          )}
          {!isGM && isInvitedMember && (
            <>
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Sword className="h-4 w-4 mr-1" />Create Character
              </Button>
              <Button size="sm" variant="outline" onClick={() => setAddMyCharOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />Add My Character
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Invited members strip (GM only) */}
      {isGM && invitedMembers.length > 0 && (
        <div className="border-b border-border bg-muted/20 px-4 py-2 flex items-center gap-2 flex-wrap">
          <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground shrink-0">Invited:</span>
          {invitedMembers.map(m => (
            <Badge key={m.id} variant="secondary" className="text-xs">{m.email}</Badge>
          ))}
        </div>
      )}

      {/* Roster */}
      <div className="max-w-4xl mx-auto p-4 space-y-4">
        {battle?.active && (
          <BattlePanel battle={battle} characters={data?.characters ?? []} isGM={isGM} viewerId={user?.id ?? ''} onChange={updateBattle} onMoveToken={moveToken_} onEnd={toggleCombat} pings={pings} onPing={sendPing} onDrawStroke={drawStroke} onEffect={placeEffect} onEdit={editMap} />
        )}

        {/* Player: the active character's health, stamina, mana, turns and attacks, without opening the sheet */}
        {!isGM && activeChar && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Active character</h2>
              <span className="text-xs text-muted-foreground">Changes save by themselves</span>
              <div className="flex-1 h-px bg-border" />
            </div>
            {myChars.length > 1 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {myChars.map(c => (
                  <Button key={c.id} size="sm" variant={c.id === activeChar.id ? 'default' : 'outline'} className="h-7 text-xs" onClick={() => setActiveCharId(c.id)}>{c.name}</Button>
                ))}
              </div>
            )}
            <NpcControl key={activeChar.id} npc={activeChar} accent="player" onTurnStart={() => resetTokenMovement(activeChar.id)} onOpenSheet={() => navigate(`/campaign/${campaignId}/character/${activeChar.id}`)}
              collapsed={!!collapsedNpcs[activeChar.id]} onToggleCollapsed={() => setCollapsedNpcs(c => ({ ...c, [activeChar.id]: !c[activeChar.id] }))} />
          </div>
        )}

        {!data?.characters.length ? (
          <div className="text-center py-20 space-y-3 text-muted-foreground">
            <Sword className="h-12 w-12 mx-auto opacity-40" />
            {isGM && <p>No characters yet. Add your own, add a friend's, or create one!</p>}
            {!isGM && isInvitedMember && <p>You've been invited! Create a character or add one of yours to get started.</p>}
            {!isGM && !isInvitedMember && <p>No characters in this campaign yet.</p>}
            {isGM && (
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <Button variant="outline" onClick={() => setAddMyCharOpen(true)}><Plus className="h-4 w-4 mr-1" />Add My Character</Button>
                <Button onClick={() => setAddOpen(true)}><UserPlus className="h-4 w-4 mr-1" />Add Character</Button>
              </div>
            )}
            {!isGM && isInvitedMember && (
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <Button onClick={() => setCreateOpen(true)}><Sword className="h-4 w-4 mr-1" />Create Character</Button>
                <Button variant="outline" onClick={() => setAddMyCharOpen(true)}><Plus className="h-4 w-4 mr-1" />Add My Character</Button>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {data.characters.map(char => (
              <CharacterCard
                key={char.id}
                char={char}
                isGM={isGM}
                onOpen={() => char.canEdit && navigate(`/campaign/${campaignId}/character/${char.id}`)}
                onRemove={() => setRemoveTarget(char)}
                onAssign={() => setAssignTarget(char)}
                onVisibility={v => handleVisibility(char, v)}
                onNpc={v => handleNpc(char, v)}
                onDuplicate={() => setDupTarget(char)}
                isActive={!isGM && activeChar?.id === char.id}
                onMakeActive={!isGM && char.canEdit && !char.isUnassigned ? () => setActiveCharId(char.id) : undefined}
              />
            ))}
          </div>
        )}

        {/* GM: run the NPCs' health, stamina, mana and attacks from here */}
        {isGM && npcs.length > 0 && (
          <div className="space-y-2 pt-2">
            <div className="flex items-center gap-2">
              <Crown className="h-4 w-4 text-amber-400" />
              <h2 className="text-sm font-semibold text-foreground">NPC control</h2>
              <span className="text-xs text-muted-foreground">Changes save by themselves</span>
              <div className="flex-1 h-px bg-border" />
              <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => setCollapsedNpcs(Object.fromEntries(npcs.map(n => [n.id, true])))}>Collapse all</Button>
              <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => setCollapsedNpcs({})}>Expand all</Button>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {npcs.map(n => <NpcControl key={n.id} npc={n} onTurnStart={() => resetTokenMovement(n.id)} onOpenSheet={() => navigate(`/campaign/${campaignId}/character/${n.id}`)} onDuplicate={() => setDupTarget(n)}
                collapsed={!!collapsedNpcs[n.id]} onToggleCollapsed={() => setCollapsedNpcs(c => ({ ...c, [n.id]: !c[n.id] }))} />)}
            </div>
          </div>
        )}

        {/* Characters other people made visible to you */}
        {!isGM && (party.length > 0 || partyError) && (
          <div className="space-y-2 pt-2">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Visible to you</h2>
              <div className="flex-1 h-px bg-border" />
            </div>
            {partyError ? (
              <p className="text-xs text-muted-foreground">{partyError}</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {party.map(p => <PartyCard key={p.id} char={p} onOpen={() => navigate(`/campaign/${campaignId}/view/${p.id}`)} />)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Dialogs */}
      {isGM && campaignId && (
        <>
          <AddCharacterDialog open={addOpen} onClose={() => setAddOpen(false)} campaignId={campaignId} onAdded={load} />
          <InvitePlayerDialog
            open={inviteOpen}
            onClose={() => setInviteOpen(false)}
            campaignId={campaignId}
            invitedMemberIds={invitedMembers.map(m => m.id)}
            onInvited={load}
          />
        </>
      )}

      {campaignId && (
        <AddMyCharacterDialog
          open={addMyCharOpen}
          onClose={() => setAddMyCharOpen(false)}
          campaignId={campaignId}
          onAdded={load}
        />
      )}

      {isGM && <DuplicateDialog char={dupTarget} onClose={() => setDupTarget(null)} onDone={load} />}

      {campaignId && (isGM || isInvitedMember) && (
        <CreateCharacterDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreate={handleCreateMine} allowGM={isGM} npcOption={isGM} />
      )}

      <AssignDialog
        char={assignTarget}
        friends={friends}
        currentUser={{ id: user?.id ?? '', email: user?.email ?? '' }}
        open={!!assignTarget}
        onClose={() => setAssignTarget(null)}
        onAssigned={load}
      />

      <AlertDialog open={!!removeTarget} onOpenChange={() => setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removeTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the campaign copy. The player's original character is unaffected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemove} className="bg-destructive text-destructive-foreground">Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Character Card ────────────────────────────────────────────────────────────
function CharacterCard({ char, isGM, onOpen, onRemove, onAssign, onVisibility, onNpc, onDuplicate, isActive, onMakeActive }: {
  char: CampaignChar;
  isGM: boolean;
  onOpen: () => void;
  onRemove: () => void;
  onAssign: () => void;
  onVisibility: (v: CharacterVisibility) => void;
  onNpc: (isNpc: boolean) => void;
  onDuplicate: () => void;
  /** Player: this is the character run from the Active character controls. */
  isActive?: boolean; onMakeActive?: () => void;
}) {
  return (
    <div
      className={`rounded-xl border bg-card p-4 transition-colors relative group
        ${char.isUnassigned ? 'border-dashed border-border/60' : 'border-border'}
        ${char.canEdit ? 'hover:border-primary/50 cursor-pointer' : 'opacity-80'}`}
      onClick={onOpen}
    >
      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {isGM && char.isUnassigned && (
          <Button size="icon" variant="ghost" className="h-7 w-7 text-primary"
            onClick={e => { e.stopPropagation(); onAssign(); }} title="Assign player">
            <UserCheck className="h-3.5 w-3.5" />
          </Button>
        )}
        {isGM && (
          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
            onClick={e => { e.stopPropagation(); onRemove(); }}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-1.5 pr-16">
          {char.canEdit
            ? <Edit className="h-3.5 w-3.5 text-primary flex-shrink-0" />
            : <Eye className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />}
          <h3 className="font-bold text-foreground truncate">{char.name}</h3>
        </div>

        {char.isUnassigned ? (
          <div className="flex items-center gap-1.5">
            <Badge className="text-xs border border-dashed border-muted-foreground/40 text-muted-foreground bg-transparent">
              Unassigned
            </Badge>
            {isGM && (
              <button className="text-xs text-primary underline underline-offset-2"
                onClick={e => { e.stopPropagation(); onAssign(); }}>
                Assign
              </button>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground truncate">{char.playerEmail}</p>
        )}

        <div className="flex items-center gap-2">
          <Badge className={`text-xs border ${TYPE_COLORS[char.characterType] ?? ''}`}>
            {TYPE_LABELS[char.characterType] ?? char.characterType}
          </Badge>
          {(char.characterType === 'gm' || char.isNpc) && <Badge variant="outline" className="text-[10px]">NPC</Badge>}
          <span className="text-xs text-muted-foreground">Level {char.level}</span>
        </div>

        {!char.canEdit && <p className="text-xs text-muted-foreground italic">View only</p>}

        {/* GM: run this character as an NPC from the NPC control section (GM/NPC characters always are) */}
        {isGM && char.canEdit && (
          <div className="flex items-center gap-2 pt-1" onClick={e => e.stopPropagation()}>
            <Switch checked={char.characterType === 'gm' || char.isNpc} disabled={char.characterType === 'gm'} onCheckedChange={onNpc}
              aria-label="NPC" title={char.characterType === 'gm' ? 'GM/NPC characters are always NPCs' : 'Run this character from NPC control'} />
            <span className="text-xs text-muted-foreground">NPC{char.characterType === 'gm' ? ' (by type)' : ''}</span>
            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs gap-1 ml-auto" onClick={onDuplicate} title="Make copies of this character to track several">
              <Copy className="h-3 w-3" />Copies
            </Button>
          </div>
        )}

        {/* Player: run this character from the Active character controls (the GM's version of this is the NPC switch) */}
        {onMakeActive && (
          <div className="flex items-center gap-2 pt-1" onClick={e => e.stopPropagation()}>
            <Button size="sm" variant={isActive ? 'default' : 'outline'} className="h-7 text-xs gap-1 flex-1" onClick={onMakeActive} disabled={isActive}
              title="Run this character from the controls at the top of the page">
              <UserCheck className="h-3 w-3" />{isActive ? 'Active character' : 'Make active'}
            </Button>
          </div>
        )}

        {/* Who else in the campaign can see this character (the GM and the player always can) */}
        {char.canEdit && (
          <div className="flex items-center gap-1.5 pt-1" onClick={e => e.stopPropagation()}>
            <Eye className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <Select value={char.visibility} onValueChange={v => onVisibility(v as CharacterVisibility)}>
              <SelectTrigger className="h-7 text-xs flex-1" title="Who else in the campaign can see this character"><SelectValue>{visibilityLabel(char.visibility)}</SelectValue></SelectTrigger>
              <SelectContent>
                {VISIBILITY_LEVELS.map(l => (
                  <SelectItem key={l.id} value={l.id}>{l.label} — {l.description}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Party Card (someone else's character made visible to you) ─────────────────
function PartyCard({ char, onOpen }: { char: VisibleCampaignCharacter; onOpen: () => void }) {
  let level = 0;
  let characterType = 'normal';
  try { const d = JSON.parse(char.data); level = d.level ?? 0; characterType = d.characterType ?? 'normal'; } catch { /* keep defaults */ }
  return (
    <div className="rounded-xl border border-border bg-card p-4 hover:border-primary/50 cursor-pointer transition-colors space-y-2" onClick={onOpen}>
      <div className="flex items-center gap-1.5">
        <Eye className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
        <h3 className="font-bold text-foreground truncate">{char.name}</h3>
      </div>
      {char.playerEmail && <p className="text-xs text-muted-foreground truncate">{char.playerEmail}</p>}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge className={`text-xs border ${TYPE_COLORS[characterType] ?? ''}`}>{TYPE_LABELS[characterType] ?? characterType}</Badge>
        <span className="text-xs text-muted-foreground">Level {level}</span>
        <Badge variant="outline" className="text-[10px]">{visibilityLabel(char.visibility)}</Badge>
      </div>
    </div>
  );
}
