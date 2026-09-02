import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCampaigns, createCampaign, deleteCampaign } from '../../lib/api/social';
import type { GetCampaignsOutputType } from '../../lib/api/social';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Swords, Plus, Trash2, Crown, ChevronRight, Shield } from 'lucide-react';
import { toast } from 'sonner';

type Campaign = GetCampaignsOutputType['campaigns'][0];

export default function CampaignsTab() {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Campaign | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await getCampaigns();
      setCampaigns(r.campaigns);
    } catch { toast.error('Failed to load campaigns'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await createCampaign({ name: newName.trim() });
      toast.success(`Campaign "${newName}" created!`);
      setNewName('');
      setCreateOpen(false);
      load();
    } catch { toast.error('Failed to create campaign'); }
    finally { setCreating(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteCampaign({ campaignId: deleteTarget.id });
      toast.success('Campaign deleted.');
      setDeleteTarget(null);
      load();
    } catch { toast.error('Failed to delete campaign'); }
  };

  const gmCampaigns = campaigns.filter(c => c.isGM);
  const playerCampaigns = campaigns.filter(c => !c.isGM);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <Swords className="h-4 w-4 text-primary" />Campaigns
        </h3>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />New Campaign
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">{[1, 2].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-xl">
          <Swords className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No campaigns yet</p>
          <p className="text-sm mt-1">Create one to start a session as a GM, or ask a friend to add you.</p>
          <Button size="sm" className="mt-4" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />Create Campaign
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {gmCampaigns.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium flex items-center gap-1">
                <Crown className="h-3 w-3" />As Game Master
              </p>
              {gmCampaigns.map(c => (
                <CampaignCard key={c.id} campaign={c} onOpen={() => navigate(`/campaign/${c.id}`)} onDelete={() => setDeleteTarget(c)} />
              ))}
            </div>
          )}
          {playerCampaigns.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium flex items-center gap-1">
                <Shield className="h-3 w-3" />As Player
              </p>
              {playerCampaigns.map(c => (
                <CampaignCard key={c.id} campaign={c} onOpen={() => navigate(`/campaign/${c.id}`)} onDelete={null} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create Campaign Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>New Campaign</DialogTitle></DialogHeader>
          <Input placeholder="Campaign name..." value={newName} onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }} autoFocus />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating || !newName.trim()}>
              {creating ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete the campaign and all campaign character copies. Player originals are not affected.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CampaignCard({ campaign, onOpen, onDelete }: { campaign: Campaign; onOpen: () => void; onDelete: (() => void) | null }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 hover:border-primary/50 transition-colors cursor-pointer group relative"
      onClick={onOpen}>
      {onDelete && (
        <Button size="icon" variant="ghost" className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
          onClick={e => { e.stopPropagation(); onDelete(); }}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
      <div className="flex items-center justify-between pr-8">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            {campaign.isGM && <Crown className="h-3.5 w-3.5 text-amber-400" />}
            <h4 className="font-bold text-foreground">{campaign.name}</h4>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {!campaign.isGM && campaign.gmEmail && <span>GM: {campaign.gmEmail}</span>}
            <span>{campaign.characterCount} character{campaign.characterCount !== 1 ? 's' : ''}</span>
            {campaign.isGM && <Badge className="text-xs bg-amber-500/20 text-amber-400 border-amber-500/40 border">GM</Badge>}
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
    </div>
  );
}
