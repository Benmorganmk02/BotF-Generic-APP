import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  getCampaignCharacters, getFriendRequests, addCharacterToCampaign,
  removeCampaignCharacter, getFriendCharacters, createAndAssignCharacter,
  assignCampaignCharacter, invitePlayerToCampaign, addMyCharacterToCampaign,
} from '../lib/api/social';
import type { GetCampaignCharactersOutputType, GetFriendRequestsOutputType } from '../lib/api/social';
import { getCharacters } from '../lib/api/characters';
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
import { ArrowLeft, Crown, UserPlus, Sword, Trash2, Edit, Eye, Plus, UserCheck, Mail } from 'lucide-react';
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
      await createAndAssignCharacter({
        campaignId,
        assigneeId: assigneeId === 'unassigned' ? undefined : assigneeId,
        name: name.trim(),
        playerName: playerName.trim(),
        characterType: charType,
        data: JSON.stringify(char),
      });
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
  const [removeTarget, setRemoveTarget] = useState<CampaignChar | null>(null);
  const [assignTarget, setAssignTarget] = useState<CampaignChar | null>(null);

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
              <Button size="sm" variant="outline" onClick={() => setInviteOpen(true)}>
                <Mail className="h-4 w-4 mr-1" />Invite Player
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
            <Button size="sm" onClick={() => setAddMyCharOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />Add My Character
            </Button>
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
        {!data?.characters.length ? (
          <div className="text-center py-20 space-y-3 text-muted-foreground">
            <Sword className="h-12 w-12 mx-auto opacity-40" />
            {isGM && <p>No characters yet. Add your own, add a friend's, or create one!</p>}
            {!isGM && isInvitedMember && <p>You've been invited! Add your character to get started.</p>}
            {!isGM && !isInvitedMember && <p>No characters in this campaign yet.</p>}
            {isGM && (
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <Button variant="outline" onClick={() => setAddMyCharOpen(true)}><Plus className="h-4 w-4 mr-1" />Add My Character</Button>
                <Button onClick={() => setAddOpen(true)}><UserPlus className="h-4 w-4 mr-1" />Add Character</Button>
              </div>
            )}
            {!isGM && isInvitedMember && (
              <Button onClick={() => setAddMyCharOpen(true)}><Plus className="h-4 w-4 mr-1" />Add My Character</Button>
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
              />
            ))}
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
function CharacterCard({ char, isGM, onOpen, onRemove, onAssign }: {
  char: CampaignChar;
  isGM: boolean;
  onOpen: () => void;
  onRemove: () => void;
  onAssign: () => void;
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
          <span className="text-xs text-muted-foreground">Level {char.level}</span>
        </div>

        {!char.canEdit && <p className="text-xs text-muted-foreground italic">View only</p>}
      </div>
    </div>
  );
}
