import { useState, useEffect, useCallback } from 'react';
import { getFriendRequests, respondFriendRequest, sendFriendRequest, removeFriend, getFriendCharacters } from '../../lib/api/social';
import type { GetFriendRequestsOutputType } from '../../lib/api/social';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { UserPlus, UserCheck, UserX, Sword, Check, X, ChevronRight, Users } from 'lucide-react';
import { toast } from 'sonner';

type Friend = GetFriendRequestsOutputType['friends'][0];
type IncomingRequest = GetFriendRequestsOutputType['incoming'][0];
type SentInvite = GetFriendRequestsOutputType['sentInvites'][0];

const TYPE_COLORS: Record<string, string> = {
  normal: 'bg-primary/20 text-primary border-primary/40',
  gm: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
};
const TYPE_LABELS: Record<string, string> = { normal: 'Normal', gm: 'GM/NPC' };

function FriendCharactersDialog({ friend, open, onClose }: {
  friend: Friend | null; open: boolean; onClose: () => void;
}) {
  const [chars, setChars] = useState<{ cloudId: string; name: string; characterType: string; level: number }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !friend) return;
    setLoading(true);
    getFriendCharacters({ friendId: friend.friend.id })
      .then(r => setChars(r.characters))
      .catch(() => toast.error('Failed to load characters'))
      .finally(() => setLoading(false));
  }, [open, friend]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{friend?.friend.email}'s Characters</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>
        ) : chars.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Sword className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p>No characters yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {chars.map(c => (
              <div key={c.cloudId} className="rounded-lg border border-border bg-card p-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">{c.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className={`text-xs border ${TYPE_COLORS[c.characterType] ?? ''}`}>{TYPE_LABELS[c.characterType] ?? c.characterType}</Badge>
                    <span className="text-xs text-muted-foreground">Level {c.level}</span>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground italic">View only</span>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function FriendsTab() {
  const [loading, setLoading] = useState(true);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [incoming, setIncoming] = useState<IncomingRequest[]>([]);
  const [sentInvites, setSentInvites] = useState<SentInvite[]>([]);
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<Friend | null>(null);
  const [viewFriend, setViewFriend] = useState<Friend | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await getFriendRequests();
      setFriends(r.friends);
      setIncoming(r.incoming);
      setSentInvites(r.sentInvites ?? []);
    } catch { toast.error('Failed to load friends'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSend = async () => {
    if (!email.trim()) return;
    setSending(true);
    try {
      const r = await sendFriendRequest({ email: email.trim() });
      if (r.success) { toast.success(r.message); setEmail(''); }
      else toast.error(r.message);
    } catch (e: any) { toast.error(e.message ?? 'Failed to send request'); }
    finally { setSending(false); }
  };

  const handleRespond = async (requestId: string, accept: boolean) => {
    try {
      await respondFriendRequest({ requestId, accept });
      toast.success(accept ? 'Friend request accepted!' : 'Request declined.');
      load();
    } catch { toast.error('Failed to respond to request'); }
  };

  const handleRemove = async () => {
    if (!removeTarget) return;
    try {
      await removeFriend({ requestId: removeTarget.requestId });
      toast.success('Friend removed.');
      setRemoveTarget(null);
      load();
    } catch { toast.error('Failed to remove friend'); }
  };

  const displayName = (u: { email: string; firstName?: string; lastName?: string }) => {
    const name = [u.firstName, u.lastName].filter(Boolean).join(' ');
    return name || u.email;
  };

  return (
    <div className="space-y-6">
      {/* Add Friend */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <h3 className="font-semibold text-foreground flex items-center gap-2"><UserPlus className="h-4 w-4 text-primary" />Add Friend</h3>
        <div className="flex gap-2">
          <Input placeholder="Enter their email address..." value={email} onChange={e => setEmail(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSend(); }} className="flex-1" />
          <Button onClick={handleSend} disabled={sending || !email.trim()}>
            {sending ? 'Sending...' : 'Send Request'}
          </Button>
        </div>
      </div>

      {/* Incoming Requests */}
      {incoming.length > 0 && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-primary" />
            Incoming Requests
            <Badge className="text-xs bg-primary text-primary-foreground">{incoming.length}</Badge>
          </h3>
          <div className="space-y-2">
            {incoming.map(req => (
              <div key={req.requestId} className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
                <div>
                  <p className="font-medium text-foreground">{displayName(req.sender)}</p>
                  <p className="text-xs text-muted-foreground">{req.sender.email}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="h-8 w-8 p-0 border-destructive/50 text-destructive hover:bg-destructive/10"
                    onClick={() => handleRespond(req.requestId, false)}><X className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" className="h-8 w-8 p-0" onClick={() => handleRespond(req.requestId, true)}><Check className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sent Invites (email-only, user hasn't signed up) */}
      {sentInvites.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-muted-foreground" />
            Sent Invites
            <Badge variant="outline" className="text-xs">{sentInvites.length}</Badge>
          </h3>
          <div className="space-y-2">
            {sentInvites.map(inv => (
              <div key={inv.requestId} className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
                <div>
                  <p className="text-sm text-foreground font-medium">{inv.email}</p>
                  <p className="text-xs text-muted-foreground">Hasn't signed up yet</p>
                </div>
                <Badge variant="secondary" className="text-xs">Invited</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Friends List */}
      <div className="space-y-3">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          Friends {!loading && <span className="text-muted-foreground font-normal text-sm">({friends.length})</span>}
        </h3>
        {loading ? (
          <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
        ) : friends.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground border border-dashed border-border rounded-xl">
            <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No friends yet. Send a request above!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {friends.map(f => (
              <div key={f.requestId} className="rounded-lg border border-border bg-card p-3 flex items-center justify-between group hover:border-primary/40 transition-colors">
                <div>
                  <p className="font-medium text-foreground">{displayName(f.friend)}</p>
                  <p className="text-xs text-muted-foreground">{f.friend.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => setViewFriend(f)}>
                    <Sword className="h-3 w-3" />Characters<ChevronRight className="h-3 w-3" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                    onClick={() => setRemoveTarget(f)}><UserX className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <FriendCharactersDialog friend={viewFriend} open={!!viewFriend} onClose={() => setViewFriend(null)} />

      <AlertDialog open={!!removeTarget} onOpenChange={() => setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removeTarget?.friend.email}?</AlertDialogTitle>
            <AlertDialogDescription>They will no longer be able to see your characters or be added to campaigns together.</AlertDialogDescription>
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
